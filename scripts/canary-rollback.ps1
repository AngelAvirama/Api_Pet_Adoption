param(
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$Region = "us-east-1"
$ListenerArn = "arn:aws:elasticloadbalancing:us-east-1:296121913016:listener/app/pet-adoption-demo-alb/ff18874a789d24ca/e6325fd883476309"
$StableTG = "arn:aws:elasticloadbalancing:us-east-1:296121913016:targetgroup/pet-adoption-demo-tg/de0336b986a695b1"
$CanaryTG = "arn:aws:elasticloadbalancing:us-east-1:296121913016:targetgroup/pet-adoption-demo-canary-tg/e5994e9fe2fd1dcf"

$tempJson = Join-Path ([System.IO.Path]::GetTempPath()) "canary-rollback-actions.json"

try {
    Write-Host "`n=== CANARY ROLLBACK ===" -ForegroundColor Cyan

    $listenerJson = aws elbv2 describe-listeners `
        --listener-arns $ListenerArn `
        --region $Region `
        --output json

    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible consultar el listener."
    }

    $listener = $listenerJson | ConvertFrom-Json
    $action = $listener.Listeners[0].DefaultActions |
        Where-Object { $_.Type -eq "forward" } |
        Select-Object -First 1

    if (!$action) {
        throw "No se encontro la accion forward."
    }

    $groups = $action.ForwardConfig.TargetGroups

    if (!(($groups | Where-Object { $_.TargetGroupArn -eq $StableTG })) -or
        !(($groups | Where-Object { $_.TargetGroupArn -eq $CanaryTG }))) {
        throw "Los Target Groups no coinciden."
    }

    $payload = @(
        @{
            Type = "forward"
            ForwardConfig = @{
                TargetGroups = @(
                    @{ TargetGroupArn = $StableTG; Weight = 100 }
                    @{ TargetGroupArn = $CanaryTG; Weight = 0 }
                )
            }
        }
    )

    $jsonActions = ConvertTo-Json -InputObject $payload -Depth 8 -Compress
    Set-Content -Path $tempJson -Value $jsonActions -Encoding ascii

    Write-Host "Stable: 100 %"
    Write-Host "Canary: 0 %"

    if ($DryRun) {
        Write-Host "`nDRY RUN: no se modifico AWS." -ForegroundColor Yellow
        Get-Content $tempJson -Raw
        exit 0
    }

    if (!$Force) {
        $confirmation = Read-Host "Escribe ROLLBACK para confirmar"

        if ($confirmation -cne "ROLLBACK") {
            Write-Host "Operacion cancelada."
            exit 1
        }
    }
    else {
        Write-Host "Rollback automatico autorizado." -ForegroundColor Yellow
    }

    aws elbv2 modify-listener `
        --listener-arn $ListenerArn `
        --default-actions "file://$tempJson" `
        --region $Region `
        --output json

    if ($LASTEXITCODE -ne 0) {
        throw "AWS no pudo modificar el listener."
    }

    Write-Host "`nRollback aplicado correctamente." -ForegroundColor Green
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path $tempJson) {
        Remove-Item $tempJson -Force
    }
}
