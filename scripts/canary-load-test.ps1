
param(
    [int]$Requests = 25,
    [int]$DelayMs = 200,
    [int]$TimeoutSeconds = 15,
    [ValidateSet("Canary", "Public")]
    [string]$Mode = "Canary"
)

$ErrorActionPreference = "Stop"

$Url = "http://pet-adoption-demo-alb-1749865692.us-east-1.elb.amazonaws.com/api/v4/animals/recommendations"

if ($Requests -lt 1) {
    throw "Requests debe ser mayor que cero."
}

if ($DelayMs -lt 0) {
    throw "DelayMs no puede ser negativo."
}

$Headers = @{}

if ($Mode -eq "Canary") {
    $Headers["X-Canary"] = "true"
}

$Results = [System.Collections.Generic.List[object]]::new()

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "       CANARY LOAD TEST" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Modo: $Mode"
Write-Host "Solicitudes: $Requests"
Write-Host "Endpoint: $Url"
Write-Host ""

for ($i = 1; $i -le $Requests; $i++) {

    $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    $StatusCode = 0
    $Version = ""
    $Track = ""
    $ErrorMessage = ""

    try {
        $Response = Invoke-WebRequest `
            -Uri $Url `
            -Headers $Headers `
            -Method Get `
            -UseBasicParsing `
            -TimeoutSec $TimeoutSeconds

        $StatusCode = [int]$Response.StatusCode
        $Version = [string]$Response.Headers["X-App-Version"]
        $Track = [string]$Response.Headers["X-App-Track"]
    }
    catch {
        $ErrorMessage = $_.Exception.Message

        if ($_.Exception.Response) {
            try {
                $StatusCode = [int]$_.Exception.Response.StatusCode
            }
            catch {
                $StatusCode = 0
            }
        }
    }

    $Stopwatch.Stop()

    $DurationMs = [math]::Round($Stopwatch.Elapsed.TotalMilliseconds, 2)

    $Results.Add([PSCustomObject]@{
        Request    = $i
        Mode       = $Mode
        StatusCode = $StatusCode
        DurationMs = $DurationMs
        Version    = $Version
        Track      = $Track
        Error      = $ErrorMessage
    })

    if ($StatusCode -ge 200 -and $StatusCode -lt 300) {
        Write-Host "Solicitud $i : HTTP $StatusCode | $DurationMs ms | $Track" -ForegroundColor Green
    }
    else {
        Write-Host "Solicitud $i : HTTP $StatusCode | $DurationMs ms | ERROR" -ForegroundColor Red
    }

    if ($i -lt $Requests -and $DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$CsvPath = Join-Path $PSScriptRoot "canary-load-$Mode-$Timestamp.csv"

$Results | Export-Csv -Path $CsvPath -NoTypeInformation -Encoding UTF8

$SuccessCount = @($Results | Where-Object {
    $_.StatusCode -ge 200 -and $_.StatusCode -lt 300
}).Count

$ErrorCount = $Requests - $SuccessCount

$AverageLatency = ($Results |
    Measure-Object -Property DurationMs -Average).Average

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "             RESUMEN" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Total solicitudes: $Requests"
Write-Host "Exitosas: $SuccessCount"
Write-Host "Errores: $ErrorCount"
Write-Host ("Latencia promedio: {0:N2} ms" -f $AverageLatency)
Write-Host "Resultados CSV: $CsvPath"
Write-Host "====================================" -ForegroundColor Cyan
