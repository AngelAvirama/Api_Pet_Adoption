
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
    if ($WindowMinutes -lt 1) {
        throw "WindowMinutes debe ser al menos 1."
    }

    if ($MinRequests -lt 1) {
        throw "MinRequests debe ser al menos 1."
    }

    if ($Max5xxRate -lt 0 -or $MaxP95Seconds -le 0) {
        throw "Los umbrales de calidad no son validos."
    }

    if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
        throw "AWS CLI no esta disponible."
    }

    $endTime = (Get-Date).ToUniversalTime()
    $startTime = $StartTime.ToUniversalTime()

    if ($startTime -ge $endTime) {
        throw "StartTime debe ser anterior al momento de evaluacion."
    }

    # Limitar la consulta a la ventana configurada.
    $minimumStart = $endTime.AddMinutes(-$WindowMinutes)

    if ($startTime -lt $minimumStart) {
        $startTime = $minimumStart
    }

    $start = $startTime.ToString("yyyy-MM-ddTHH:mm:ssZ")
    $end = $endTime.ToString("yyyy-MM-ddTHH:mm:ssZ")

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

    Write-Host "`nEvaluando calidad de Canary..." -ForegroundColor Cyan
    Write-Host "Inicio: $start"
    Write-Host "Fin: $end"
    Write-Host "Ventana efectiva: $([math]::Round(($endTime - $startTime).TotalMinutes, 2)) minutos"

    # Consultar metricas
    # Las solicitudes de Canary se obtienen de la metrica personalizada.
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
        throw "Error consultando las solicitudes de Canary."
    }

    $requests = @($requestResult.Datapoints)

    $errors = @(Get-CanaryMetric -MetricName "HTTPCode_Target_5XX_Count" -Statistic "Sum")
    $latencies = @(Get-CanaryP95)

    $successfulRequestCount = 0.0

    if ($requests.Count -gt 0) {
        $successfulRequestCount = [double]((
            $requests | Measure-Object -Property Sum -Sum
        ).Sum)
    }

    # Solicitudes que terminaron en HTTP 5xx.
    $errorCount = 0.0

    if ($errors.Count -gt 0) {
        $errorCount = [double]((
            $errors | Measure-Object -Property Sum -Sum
        ).Sum)
    }

    # Total de solicitudes: exitosas + errores 5xx.
    $requestCount = $successfulRequestCount + $errorCount

    $p95Values = @(
        $latencies |
        Where-Object { $null -ne $_.ExtendedStatistics.p95 } |
        ForEach-Object { [double]$_.ExtendedStatistics.p95 }
    )

    $p95 = $null

    if ($p95Values.Count -gt 0) {
        $p95 = ($p95Values | Measure-Object -Maximum).Maximum
    }

    $errorRate = 0

    if ($requestCount -gt 0) {
        $errorRate = ($errorCount / $requestCount) * 100
    }

    Write-Host "`n--- Metricas Canary ---" -ForegroundColor Cyan
    Write-Host "Solicitudes exitosas: $successfulRequestCount"
    Write-Host "Errores 5xx: $errorCount"
    Write-Host "Total solicitudes: $requestCount"
    Write-Host ("Tasa 5xx: {0:N2}%" -f $errorRate)

    if ($null -ne $p95) {
        Write-Host ("Peor p95: {0:N3} segundos" -f $p95)
    }
    else {
        Write-Host "p95: sin datos"
    }

    # Consultar alarmas
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
            Where-Object { $_.Name -eq $name } |
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
        elseif ($alarm.State -ne "OK" -and $alarmState -ne "ALARM") {
            $alarmState = "INSUFFICIENT_DATA"
        }
    }

    Write-Host "`n--- Decision ---" -ForegroundColor Cyan

    # Una alarma critica o cualquier error 5xx provoca rollback.
    if ($alarmState -eq "ALARM" -or $errorCount -gt 0) {
        Write-Host "ROLLBACK - Error 5xx o alarma critica." -ForegroundColor Red
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
