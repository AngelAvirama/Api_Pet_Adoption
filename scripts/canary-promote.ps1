param(
    [int[]]$Stages = @(5, 25, 50, 100),
    [int]$BakeMinutes = 5,
    [int]$CloudWatchDelaySeconds = 120,
    [int]$ConcurrentRequests = 1000,
    [int]$ConcurrentWorkers = 20,
    [int]$WindowMinutes = 5,
    [int]$MinRequests = 20,
    [double]$Max5xxRate = 1.0,
    [double]$MaxP95Seconds = 1.0,
    [switch]$AllowPartialStages,
    [switch]$Apply,
    [switch]$NonInteractive,
    [switch]$ConfirmPromotion
)

$ErrorActionPreference = "Stop"

$Region = "us-east-1"

$ListenerArn = "arn:aws:elasticloadbalancing:us-east-1:296121913016:listener/app/pet-adoption-demo-alb/ff18874a789d24ca/e6325fd883476309"

$StableTG = "arn:aws:elasticloadbalancing:us-east-1:296121913016:targetgroup/pet-adoption-demo-tg/de0336b986a695b1"

$CanaryTG = "arn:aws:elasticloadbalancing:us-east-1:296121913016:targetgroup/pet-adoption-demo-canary-tg/e5994e9fe2fd1dcf"

$Gate = Join-Path $PSScriptRoot "canary-quality-gate.ps1"
$Rollback = Join-Path $PSScriptRoot "canary-rollback.ps1"
$ConcurrentTest = Join-Path $PSScriptRoot "canary-concurrent-test.ps1"

$tempJson = Join-Path ([System.IO.Path]::GetTempPath()) "canary-promotion-actions.json"

$script:trafficChanged = $false
$script:rollbackAttempted = $false

# ==========================================
# 1. CAMBIAR PESOS DEL LISTENER
# ==========================================

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

# ==========================================
# 2. ROLLBACK AUTOMATICO
# ==========================================

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

# ==========================================
# 3. VALIDACIONES
# ==========================================

try {

    if (!(Test-Path $Gate)) {
        throw "Quality Gate no encontrado."
    }

    if (!(Test-Path $Rollback)) {
        throw "Rollback no encontrado."
    }

    if (!(Test-Path $ConcurrentTest)) {
        throw "Generador concurrente no encontrado."
    }

    if ($BakeMinutes -lt 1) {
        throw "BakeMinutes debe ser al menos 1."
    }

    if ($CloudWatchDelaySeconds -lt 60) {
        throw "CloudWatchDelaySeconds debe ser al menos 60 segundos."
    }

    if ($ConcurrentRequests -lt 600) {
        throw "ConcurrentRequests debe ser al menos 600."
    }

    if ($ConcurrentWorkers -lt 1 -or $ConcurrentWorkers -gt 50) {
        throw "ConcurrentWorkers debe estar entre 1 y 50."
    }

    if ($WindowMinutes -lt 1) {
        throw "WindowMinutes debe ser al menos 1."
    }

    if ($MinRequests -lt 1) {
        throw "MinRequests debe ser al menos 1."
    }

    if ($Max5xxRate -lt 0 -or $Max5xxRate -gt 100) {
        throw "Max5xxRate debe estar entre 0 y 100."
    }

    if ($MaxP95Seconds -le 0) {
        throw "MaxP95Seconds debe ser mayor que cero."
    }

    if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
        throw "AWS CLI no esta disponible."
    }

    if ($Stages.Count -eq 0) {
        throw "No hay etapas configuradas."
    }

    # Las etapas deben ser ascendentes y unicas.

    $previous = 0

    foreach ($stage in $Stages) {

        if ($stage -lt 5 -or $stage -gt 100 -or $stage -le $previous) {
            throw "Las etapas deben ser ascendentes, unicas y estar entre 5 y 100."
        }

        $previous = $stage
    }

    # El modo parcial solo permite probar el 5%.

    if ($AllowPartialStages) {

        if ($Stages.Count -ne 1) {
            throw "AllowPartialStages solo permite ejecutar una etapa por ejecucion."
        }

    }
    elseif ($Stages[-1] -ne 100) {
        throw "La ultima etapa debe ser 100. Usa AllowPartialStages para ejecutar una etapa individual."
    }

    # ==========================================
    # 4. MOSTRAR PLAN
    # ==========================================

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "       PLAN DE PROMOCION CANARY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "Etapas: $($Stages -join '% -> ')%"
    Write-Host "Observacion: $BakeMinutes minutos por etapa"
    Write-Host "Margen CloudWatch: $CloudWatchDelaySeconds segundos"
    Write-Host "Solicitudes concurrentes: $ConcurrentRequests"
    Write-Host "Trabajadores concurrentes: $ConcurrentWorkers"
    Write-Host "Ventana Quality Gate: $WindowMinutes minutos"
    Write-Host "Minimo solicitudes Canary: $MinRequests"
    Write-Host "Maximo 5xx: $Max5xxRate %"
    Write-Host "Maximo p95: $MaxP95Seconds segundos"

    if ($AllowPartialStages) {
        Write-Host "Modo: ETAPA CANARY INDIVIDUAL $($Stages[0])%" -ForegroundColor Yellow
    }

    $estimatedMinutes = (
        $Stages.Count * (
            $BakeMinutes +
            [math]::Ceiling($CloudWatchDelaySeconds / 60) +
            2
        )
    )

    Write-Host "Tiempo estimado: $estimatedMinutes minutos"

    # ==========================================
    # 5. SIMULACION
    # ==========================================

    if (!$Apply) {

        Write-Host "`nSIMULACION: no se modificara AWS." -ForegroundColor Yellow

        foreach ($stage in $Stages) {
            Write-Host "Stable: $(100 - $stage) % | Canary: $stage %"
        }

        return
    }

        # ==========================================
        # 6. CONFIRMACION
        # ==========================================

        Write-Host "`nATENCION: se modificara el trafico publico." -ForegroundColor Yellow

        if ($AllowPartialStages) {
            Write-Host "Solo se habilitara el $($Stages[0])% de trafico publico hacia Canary." -ForegroundColor Yellow
        }

        if ($NonInteractive) {

            if (!$ConfirmPromotion) {
                throw "Promocion no autorizada: se requiere -ConfirmPromotion."
            }

            Write-Host "Promocion no interactiva autorizada mediante confirmacion explicita." -ForegroundColor Yellow

        }
        else {

            $confirmation = Read-Host "Escribe PROMOVER para continuar"

            if ($confirmation -cne "PROMOVER") {
                Write-Host "Promocion cancelada."
                return
            }
        }

    # ==========================================
    # 7. VERIFICAR LISTENER
    # ==========================================

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

    $currentArns = @(
        $currentGroups |
        ForEach-Object { $_.TargetGroupArn }
    )

    if (
        $StableTG -notin $currentArns -or
        $CanaryTG -notin $currentArns
    ) {
        throw "El listener no contiene los Target Groups esperados."
    }

    # ==========================================
    # 8. PROMOCION PROGRESIVA
    # ==========================================

    foreach ($stage in $Stages) {

        Write-Host "`n========================================" -ForegroundColor Cyan
        Write-Host "          ETAPA CANARY $stage %" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan

        # Aplicar el peso de la etapa.

        Set-CanaryWeight -CanaryWeight $stage

        # Registrar el comienzo de esta etapa.

        $stageStartTime = (Get-Date).ToUniversalTime()

        # Observar el comportamiento durante el bake time.

        Write-Host "`nObservando trafico durante $BakeMinutes minutos..."

        Start-Sleep -Seconds ($BakeMinutes * 60)

        # Generar solicitudes concurrentes DESPUES de la observacion.
        # Asi la muestra queda dentro de la ventana de evaluacion.

        Write-Host "`nGenerando carga concurrente..." -ForegroundColor Cyan

        & $ConcurrentTest `
            -Requests $ConcurrentRequests `
            -Workers $ConcurrentWorkers

        if ($LASTEXITCODE -ne 0) {
            throw "El generador concurrente termino con error."
        }

        # Esperar publicacion de metricas en CloudWatch.

        Write-Host "`nEsperando $CloudWatchDelaySeconds segundos para CloudWatch..."

        Start-Sleep -Seconds $CloudWatchDelaySeconds

        # Evaluar la etapa.

        Write-Host "`nEvaluando Quality Gate..." -ForegroundColor Cyan

        & $Gate `
            -WindowMinutes $WindowMinutes `
            -MinRequests $MinRequests `
            -Max5xxRate $Max5xxRate `
            -MaxP95Seconds $MaxP95Seconds `
            -StartTime $stageStartTime

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

    if ($AllowPartialStages) {

        $finalStage = $Stages[-1]
        $stableStage = 100 - $finalStage

        Write-Host "`nPRUEBA COMPLETADA: Stable $stableStage % / Canary $finalStage %." -ForegroundColor Green
        Write-Host "El trafico permanecera en esta distribucion hasta una nueva instruccion."

    }
    else {

        Write-Host "`nPROMOCION COMPLETADA: Canary 100 %." -ForegroundColor Green

    }
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
