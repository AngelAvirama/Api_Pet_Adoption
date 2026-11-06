
param(
    [int[]]$Stages = @(5, 25, 50, 100),
    [int]$BakeMinutes = 5,
    [int]$CloudWatchDelaySeconds = 120,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$Region = "us-east-1"

$ListenerArn = "arn:aws:elasticloadbalancing:us-east-1:296121913016:listener/app/pet-adoption-demo-alb/ff18874a789d24ca/e6325fd883476309"

$StableTG = "arn:aws:elasticloadbalancing:us-east-1:296121913016:targetgroup/pet-adoption-demo-tg/de0336b986a695b1"

$CanaryTG = "arn:aws:elasticloadbalancing:us-east-1:296121913016:targetgroup/pet-adoption-demo-canary-tg/e5994e9fe2fd1dcf"

$Gate = Join-Path $PSScriptRoot "canary-quality-gate.ps1"
$Rollback = Join-Path $PSScriptRoot "canary-rollback.ps1"
$tempJson = Join-Path $env:TEMP "canary-promotion-actions.json"

$script:trafficChanged = $false
$script:rollbackAttempted = $false

function Set-CanaryWeight {
    param(
        [int]$CanaryWeight
    )

    $StableWeight = 100 - $CanaryWeight

    $payload = @(
        @{
            Type = "forward"
            ForwardConfig = @{
                TargetGroups = @(
                    @{
                        TargetGroupArn = $StableTG
                        Weight = $StableWeight
                    }
                    @{
                        TargetGroupArn = $CanaryTG
                        Weight = $CanaryWeight
                    }
                )
            }
        }
    )

    $json = ConvertTo-Json -InputObject $payload -Depth 8 -Compress

    Set-Content -Path $tempJson -Value $json -Encoding ascii

    aws elbv2 modify-listener `
        --listener-arn $ListenerArn `
        --default-actions "file://$tempJson" `
        --region $Region `
        --output json | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "AWS no pudo actualizar el peso de Canary."
    }

    $script:trafficChanged = $true

    Write-Host "Stable: $StableWeight % | Canary: $CanaryWeight %" -ForegroundColor Green
}

function Invoke-AutomaticRollback {
    Write-Host "`nRestaurando Stable 100 % / Canary 0 %..." -ForegroundColor Red

    $script:rollbackAttempted = $true

    & $Rollback -Force

    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo completar el rollback automatico."
    }

    $script:trafficChanged = $false

    Write-Host "Rollback automatico completado." -ForegroundColor Green
}

try {
    # Validaciones iniciales

    if (!(Test-Path $Gate)) {
        throw "Quality Gate no encontrado."
    }

    if (!(Test-Path $Rollback)) {
        throw "Rollback no encontrado."
    }

    if ($BakeMinutes -lt 1) {
        throw "BakeMinutes debe ser al menos 1."
    }

    if ($CloudWatchDelaySeconds -lt 0) {
        throw "CloudWatchDelaySeconds no puede ser negativo."
    }

    if ($Stages.Count -eq 0) {
        throw "No hay etapas configuradas."
    }

    if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
        throw "AWS CLI no esta instalado o no esta disponible en PATH."
    }

    # Validar etapas

    $previous = 0

    foreach ($stage in $Stages) {
        if ($stage -lt 5 -or $stage -gt 100 -or $stage -le $previous) {
            throw "Las etapas deben ser ascendentes, unicas y estar entre 5 y 100."
        }

        $previous = $stage
    }

    if ($Stages[-1] -ne 100) {
        throw "La ultima etapa debe ser 100."
    }

    # Mostrar plan

    $totalMinutes = $Stages.Count * $BakeMinutes
    $totalDelay = $Stages.Count * $CloudWatchDelaySeconds

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "       PLAN DE PROMOCION CANARY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "Etapas: $($Stages -join '% -> ')%"
    Write-Host "Observacion: $BakeMinutes minutos por etapa"
    Write-Host "Margen CloudWatch: $CloudWatchDelaySeconds segundos"
    Write-Host "Tiempo estimado: $($totalMinutes + [math]::Ceiling($totalDelay / 60)) minutos"

    if (!$Apply) {
        Write-Host "`nSIMULACION: no se modificara AWS." -ForegroundColor Yellow

        foreach ($stage in $Stages) {
            Write-Host "Stable: $(100 - $stage) % | Canary: $stage %"
        }

        exit 0
    }

    # Confirmacion

    Write-Host "`nATENCION: se modificara el trafico publico." -ForegroundColor Yellow

    $confirmation = Read-Host "Escribe PROMOVER para continuar"

    if ($confirmation -cne "PROMOVER") {
        Write-Host "Promocion cancelada."
        exit 1
    }

    # Verificar listener antes de modificarlo

    $listener = aws elbv2 describe-listeners `
        --listener-arns $ListenerArn `
        --region $Region `
        --output json | ConvertFrom-Json

    if ($LASTEXITCODE -ne 0 -or !$listener.Listeners) {
        throw "No fue posible verificar el listener."
    }

    $actions = $listener.Listeners[0].DefaultActions

    $currentGroups = @(
        $actions |
        Where-Object { $_.Type -eq "forward" } |
        ForEach-Object { $_.ForwardConfig.TargetGroups }
    )

    $currentArns = @($currentGroups | ForEach-Object { $_.TargetGroupArn })

    if (
        $StableTG -notin $currentArns -or
        $CanaryTG -notin $currentArns
    ) {
        throw "El listener no contiene los Target Groups esperados. Promocion cancelada."
    }

    # Promocion progresiva

    foreach ($stage in $Stages) {

        Write-Host "`n=== ETAPA CANARY $stage % ===" -ForegroundColor Cyan

        $stageStartTime = (Get-Date).ToUniversalTime()

        Set-CanaryWeight -CanaryWeight $stage

        Write-Host "Observando trafico durante $BakeMinutes minutos..."

        Start-Sleep -Seconds ($BakeMinutes * 60)

        if ($CloudWatchDelaySeconds -gt 0) {
            Write-Host "Esperando $CloudWatchDelaySeconds segundos adicionales para CloudWatch..."

            Start-Sleep -Seconds $CloudWatchDelaySeconds
        }

        Write-Host "`nEvaluando metricas de la etapa..." -ForegroundColor Cyan

        & $Gate -StartTime $stageStartTime

        $gateResult = $LASTEXITCODE

        if ($gateResult -eq 2) {
            Write-Host "ROLLBACK detectado por Quality Gate." -ForegroundColor Red

            Invoke-AutomaticRollback

            exit 2
        }

        if ($gateResult -ne 0) {
            Write-Host "HOLD: no se cumplen las condiciones para continuar." -ForegroundColor Yellow

            Invoke-AutomaticRollback

            exit 1
        }

        Write-Host "Etapa $stage % aprobada." -ForegroundColor Green
    }

    Write-Host "`nPROMOCION COMPLETADA: Canary 100 %." -ForegroundColor Green
}
catch {
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red

    if ($script:trafficChanged -and !$script:rollbackAttempted) {
        try {
            Invoke-AutomaticRollback
        }
        catch {
            Write-Host "ERROR CRITICO: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Verifica manualmente el peso del listener." -ForegroundColor Red
        }
    }

    exit 1
}
finally {
    if (Test-Path $tempJson) {
        Remove-Item $tempJson -Force
    }
}
