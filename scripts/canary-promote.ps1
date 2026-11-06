param(
    [int[]]$Stages = @(5, 25, 50, 100),
    [int]$BakeMinutes = 5,
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

$trafficChanged = $false
$rollbackAttempted = $false

function Set-CanaryWeight {
    param([int]$CanaryWeight)

    $StableWeight = 100 - $CanaryWeight

    $payload = @(
        @{
            Type = "forward"
            ForwardConfig = @{
                TargetGroups = @(
                    @{ TargetGroupArn = $StableTG; Weight = $StableWeight }
                    @{ TargetGroupArn = $CanaryTG; Weight = $CanaryWeight }
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
    if (!(Test-Path $Gate)) { throw "Quality Gate no encontrado." }
    if (!(Test-Path $Rollback)) { throw "Rollback no encontrado." }
    if ($BakeMinutes -lt 1) { throw "BakeMinutes debe ser al menos 1." }
    if ($Stages.Count -eq 0) { throw "No hay etapas." }

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

    Write-Host "`nPlan de promocion Canary" -ForegroundColor Cyan
    Write-Host "Etapas: $($Stages -join '% -> ')%"
    Write-Host "Observacion: $BakeMinutes minutos por etapa"

    if (!$Apply) {
        Write-Host "`nSIMULACION: no se modificara AWS." -ForegroundColor Yellow

        foreach ($stage in $Stages) {
            Write-Host "Stable: $(100 - $stage) % | Canary: $stage %"
        }

        exit 0
    }

    Write-Host "`nATENCION: se modificara el trafico publico." -ForegroundColor Yellow
    $confirmation = Read-Host "Escribe PROMOVER para continuar"

    if ($confirmation -cne "PROMOVER") {
        Write-Host "Promocion cancelada."
        exit 1
    }

    foreach ($stage in $Stages) {
        Write-Host "`n=== ETAPA CANARY $stage % ===" -ForegroundColor Cyan

        $stageStartTime = (Get-Date).ToUniversalTime()

        Set-CanaryWeight -CanaryWeight $stage

        Write-Host "Esperando $BakeMinutes minutos..."
        Start-Sleep -Seconds ($BakeMinutes * 60)

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
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    if ($trafficChanged -and !$rollbackAttempted) {
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
