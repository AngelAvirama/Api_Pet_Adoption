
param(
    [int]$WindowMinutes = 15,
    [int]$MinRequests = 20,
    [double]$Max5xxRate = 1.0,
    [double]$MaxP95Seconds = 1.0,
    [datetime]$StartTime = (Get-Date).ToUniversalTime().AddMinutes(-15)
)

$ErrorActionPreference = "Stop"

$Region = "us-east-1"

$LoadBalancer = "app/pet-adoption-demo-alb/ff18874a789d24ca"

$CanaryTargetGroup = "targetgroup/pet-adoption-demo-canary-tg/e5994e9fe2fd1dcf"

$AlarmNames = @(
    "pet-adoption-demo-ecs-canary-cpu-high",
    "pet-adoption-demo-ecs-canary-memory-high"
)

try {

    # ==========================================
    # 1. VALIDACIONES
    # ==========================================

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

 
# ==========================================
# 2. DEFINIR VENTANA AISLADA POR ETAPA
# ==========================================

$now = (Get-Date).ToUniversalTime()

# Usar solamente minutos completos para evitar
# mezclar datos de periodos anteriores de CloudWatch.

$endTime = $now.AddMinutes(-1)

$endTime = [datetime]::new(
    $endTime.Year,
    $endTime.Month,
    $endTime.Day,
    $endTime.Hour,
    $endTime.Minute,
    0,
    [DateTimeKind]::Utc
)

# Alinear el inicio al siguiente minuto completo.

$startTime = $StartTime.ToUniversalTime()

if ($startTime.Second -gt 0 -or $startTime.Millisecond -gt 0) {
    $startTime = $startTime.AddMinutes(1)
}

$startTime = [datetime]::new(
    $startTime.Year,
    $startTime.Month,
    $startTime.Day,
    $startTime.Hour,
    $startTime.Minute,
    0,
    [DateTimeKind]::Utc
)

# Limitar la ventana a WindowMinutes.

$minimumStart = $endTime.AddMinutes(-$WindowMinutes)

if ($startTime -lt $minimumStart) {
    $startTime = $minimumStart
}

if ($startTime -ge $endTime) {
    throw "La ventana de evaluacion no contiene minutos completos."
}

$start = $startTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = $endTime.ToString("yyyy-MM-ddTHH:mm:ssZ")


    # ==========================================
    # 3. FUNCIONES DE CONSULTA
    # ==========================================

    function Get-CanaryMetric {

        param(
            [string]$MetricName,
            [string]$Statistic
        )

        $result = aws cloudwatch get-metric-statistics `
            --namespace AWS/ApplicationELB `
            --metric-name $MetricName `
            --dimensions `
                "Name=LoadBalancer,Value=$LoadBalancer" `
                "Name=TargetGroup,Value=$CanaryTargetGroup" `
            --start-time $start `
            --end-time $end `
            --period 60 `
            --statistics $Statistic `
            --region $Region `
            --output json | ConvertFrom-Json

        if ($LASTEXITCODE -ne 0) {
            throw "Error consultando la metrica $MetricName."
        }

        return @($result.Datapoints)
    }

    function Get-CanaryP95 {

        $result = aws cloudwatch get-metric-statistics `
            --namespace AWS/ApplicationELB `
            --metric-name TargetResponseTime `
            --dimensions `
                "Name=LoadBalancer,Value=$LoadBalancer" `
                "Name=TargetGroup,Value=$CanaryTargetGroup" `
            --start-time $start `
            --end-time $end `
            --period 60 `
            --extended-statistics p95 `
            --region $Region `
            --output json | ConvertFrom-Json

        if ($LASTEXITCODE -ne 0) {
            throw "Error consultando p95."
        }

        return @($result.Datapoints)
    }

    # ==========================================
    # 4. MOSTRAR VENTANA
    # ==========================================

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "       CANARY QUALITY GATE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "Inicio: $start"
    Write-Host "Fin: $end"

    Write-Host "Ventana efectiva: $([math]::Round(($endTime - $startTime).TotalMinutes, 2)) minutos"

    Write-Host "Minimo solicitudes: $MinRequests"
    Write-Host "Maximo 5xx: $Max5xxRate %"
    Write-Host "Maximo p95: $MaxP95Seconds segundos"

    # ==========================================
    # 5. CONSULTAR SOLICITUDES EXITOSAS
    # ==========================================

    $requestResult = aws cloudwatch get-metric-statistics `
        --namespace "PetAdoption/Canary" `
        --metric-name "AnimalRecommendationRequests" `
        --dimensions `
            "Name=AppVersion,Value=v4" `
            "Name=AppTrack,Value=canary" `
        --start-time $start `
        --end-time $end `
        --period 60 `
        --statistics Sum `
        --region $Region `
        --output json | ConvertFrom-Json

    if ($LASTEXITCODE -ne 0) {
        throw "Error consultando las solicitudes exitosas de Canary."
    }

    $requests = @($requestResult.Datapoints)

    # ==========================================
    # 6. CONSULTAR ERRORES HTTP
    # ==========================================

    $errors4xx = @(
        Get-CanaryMetric `
            -MetricName "HTTPCode_Target_4XX_Count" `
            -Statistic "Sum"
    )

    $errors5xx = @(
        Get-CanaryMetric `
            -MetricName "HTTPCode_Target_5XX_Count" `
            -Statistic "Sum"
    )

    $latencies = @(Get-CanaryP95)

    # ==========================================
    # 7. CALCULAR SOLICITUDES
    # ==========================================

    $successfulRequestCount = 0.0

    if ($requests.Count -gt 0) {

        $successfulRequestCount = [double]((
            $requests | Measure-Object -Property Sum -Sum
        ).Sum)
    }

    $error4xxCount = 0.0

    if ($errors4xx.Count -gt 0) {

        $error4xxCount = [double]((
            $errors4xx | Measure-Object -Property Sum -Sum
        ).Sum)
    }

    $error5xxCount = 0.0

    if ($errors5xx.Count -gt 0) {

        $error5xxCount = [double]((
            $errors5xx | Measure-Object -Property Sum -Sum
        ).Sum)
    }

    $requestCount = (
        $successfulRequestCount +
        $error4xxCount +
        $error5xxCount
    )

    $errorRate = 0.0

    if ($requestCount -gt 0) {
        $errorRate = ($error5xxCount / $requestCount) * 100
    }

    # ==========================================
    # 8. CALCULAR P95
    # ==========================================

    $p95Values = @(
        $latencies |
        Where-Object {
            $null -ne $_.ExtendedStatistics.p95
        } |
        ForEach-Object {
            [double]$_.ExtendedStatistics.p95
        }
    )

    $p95 = $null

    if ($p95Values.Count -gt 0) {

        $p95 = (
            $p95Values |
            Measure-Object -Maximum
        ).Maximum
    }

    # ==========================================
    # 9. MOSTRAR METRICAS
    # ==========================================

    Write-Host "`n--- METRICAS CANARY ---" -ForegroundColor Cyan

    Write-Host "Solicitudes exitosas: $successfulRequestCount"
    Write-Host "Errores 4xx: $error4xxCount"
    Write-Host "Errores 5xx: $error5xxCount"
    Write-Host "Total solicitudes contabilizadas: $requestCount"

    Write-Host ("Tasa 5xx: {0:N2}%" -f $errorRate)

    if ($null -ne $p95) {

        Write-Host ("Peor p95: {0:N3} segundos" -f $p95)

    }
    else {

        Write-Host "p95: sin datos"

    }

    # ==========================================
    # 10. CONSULTAR ALARMAS
    # ==========================================

    $alarms = aws cloudwatch describe-alarms `
        --alarm-names $AlarmNames `
        --region $Region `
        --query "MetricAlarms[].{Name:AlarmName,State:StateValue}" `
        --output json | ConvertFrom-Json

    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible consultar las alarmas."
    }

    $alarmState = "OK"

    foreach ($name in $AlarmNames) {

        $alarm = $alarms |
            Where-Object {
                $_.Name -eq $name
            } |
            Select-Object -First 1

        if (!$alarm) {

            $alarmState = "INSUFFICIENT_DATA"

            Write-Host "${name}: NO ENCONTRADA"

            continue
        }

        Write-Host "$($alarm.Name): $($alarm.State)"

        if ($alarm.State -eq "ALARM") {

            $alarmState = "ALARM"

        }
        elseif (
            $alarm.State -ne "OK" -and
            $alarmState -ne "ALARM"
        ) {

            $alarmState = "INSUFFICIENT_DATA"

        }
    }

    # ==========================================
    # 11. DECISION
    # ==========================================

    Write-Host "`n--- DECISION ---" -ForegroundColor Cyan

    # Las alarmas criticas provocan rollback.

    if ($alarmState -eq "ALARM") {

        Write-Host "ROLLBACK - Alarma critica." -ForegroundColor Red

        exit 2
    }

    # Sin muestra suficiente no se permite avanzar.

    if (
        $requestCount -lt $MinRequests -or
        $null -eq $p95 -or
        $alarmState -ne "OK"
    ) {

        Write-Host "HOLD - Muestra insuficiente o metricas no concluyentes." -ForegroundColor Yellow

        exit 1
    }

    # Evaluar umbrales SLO.

    if (
        $errorRate -gt $Max5xxRate -or
        $p95 -gt $MaxP95Seconds
    ) {

        Write-Host "ROLLBACK - Se incumplio un umbral de calidad." -ForegroundColor Red

        exit 2
    }

    Write-Host "PROMOTE - Canary cumple los criterios." -ForegroundColor Green

    exit 0
}
catch {

    Write-Host "HOLD - Error al evaluar: $($_.Exception.Message)" -ForegroundColor Yellow

    exit 1
}
