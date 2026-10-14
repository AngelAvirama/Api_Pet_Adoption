
$ErrorActionPreference = "Stop"

$repository = "pet-adoption-api"
$region = "us-east-1"

Write-Host "`n=== 1. Verificando repositorio ECR ===" -ForegroundColor Cyan

$repoOutput = aws ecr describe-repositories `
    --repository-names $repository `
    --region $region `
    --output json 2>&1

$repoExitCode = $LASTEXITCODE
$repoExists = $false

if ($repoExitCode -eq 0) {
    $repoExists = $true
}
elseif (($repoOutput | Out-String) -match "RepositoryNotFoundException") {
    Write-Host "El repositorio ECR no existe; se continuara." -ForegroundColor Yellow
}
else {
    throw "No se pudo verificar ECR. Se cancela por seguridad: $repoOutput"
}

if ($repoExists) {
    Write-Host "Buscando imagenes en ECR..."

    $imagesJson = aws ecr list-images `
        --repository-name $repository `
        --region $region `
        --query "imageIds[].imageDigest" `
        --output json

    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron listar las imagenes. Destruccion cancelada."
    }

    $digests = @($imagesJson | ConvertFrom-Json)

    foreach ($digest in $digests) {
        if ([string]::IsNullOrWhiteSpace([string]$digest)) {
            continue
        }

        Write-Host "Eliminando imagen $digest..."

        $deleteOutput = aws ecr batch-delete-image `
            --repository-name $repository `
            --region $region `
            --image-ids "imageDigest=$digest" `
            --output json

        if ($LASTEXITCODE -ne 0) {
            throw "Fallo AWS CLI al eliminar $digest. Destruccion cancelada."
        }

        $deleteResult = $deleteOutput | ConvertFrom-Json

        if (@($deleteResult.failures).Count -gt 0) {
            throw "ECR reporto fallos al eliminar imagenes. Destruccion cancelada: $($deleteResult.failures | ConvertTo-Json -Compress)"
        }
    }

    Write-Host "Verificando que ECR este vacio..."

    $remaining = aws ecr list-images `
        --repository-name $repository `
        --region $region `
        --query "length(imageIds)" `
        --output text

    if ($LASTEXITCODE -ne 0 -or [int]$remaining -gt 0) {
        throw "ECR aun contiene imagenes o no se pudo verificar. Destruccion cancelada."
    }

    Write-Host "ECR esta vacio y listo para destruirse." -ForegroundColor Green
}

Write-Host "`n=== 2. Confirmacion ===" -ForegroundColor Cyan
Write-Host "Se eliminaran los recursos administrados por Terraform."
Write-Host "La base de datos y sus datos pueden perderse permanentemente."
Write-Host "El bucket S3 del estado remoto NO debe eliminarse."

$confirmation = Read-Host "Escribe DESTRUIR para continuar"

if ($confirmation -cne "DESTRUIR") {
    Write-Host "Operacion cancelada por el usuario." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n=== 3. Destruyendo infraestructura ===" -ForegroundColor Cyan

terraform -chdir=terraform destroy

if ($LASTEXITCODE -ne 0) {
    throw "Terraform no termino correctamente. Revisa el error antes de continuar."
}

Write-Host "`nInfraestructura destruida correctamente." -ForegroundColor Green
Write-Host "El bucket S3 del estado remoto se conserva."
