
param(
    [int]$Requests = 600,
    [int]$Workers = 20,
    [int]$TimeoutSeconds = 15,
    [string]$Mode = "Public"
)

$ErrorActionPreference = "Stop"

$Url = "http://pet-adoption-demo-alb-1749865692.us-east-1.elb.amazonaws.com/api/v4/animals/recommendations"

# ==========================================
# 1. VALIDACIONES
# ==========================================

if ($Requests -lt 1) {
    throw "Requests debe ser mayor que cero."
}

if ($Workers -lt 1 -or $Workers -gt 50) {
    throw "Workers debe estar entre 1 y 50."
}

if ($TimeoutSeconds -lt 1) {
    throw "TimeoutSeconds debe ser mayor que cero."
}

if ($Mode -ne "Public") {
    throw "Esta prueba compara Stable y Canary mediante el ALB publico."
}

# ==========================================
# 2. INICIALIZAR PRUEBA
# ==========================================

$Results = [System.Collections.Generic.List[object]]::new()

$BatchSize = [math]::Min($Workers, $Requests)
$Completed = 0

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "    CANARY CONCURRENT LOAD TEST" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Solicitudes: $Requests"
Write-Host "Trabajadores concurrentes: $Workers"
Write-Host "Destino: ALB publico"
Write-Host ""

# ==========================================
# 3. GENERAR SOLICITUDES CONCURRENTES
# ==========================================

while ($Completed -lt $Requests) {

    $CurrentBatch = [math]::Min(
        $BatchSize,
        $Requests - $Completed
    )

    $Jobs = @()

    for ($i = 1; $i -le $CurrentBatch; $i++) {

        $RequestNumber = $Completed + $i

        $Jobs += Start-Job -ArgumentList @(
            $Url,
            $RequestNumber,
            $TimeoutSeconds
        ) -ScriptBlock {

            param($Url, $RequestNumber, $TimeoutSeconds)

            $Watch = [System.Diagnostics.Stopwatch]::StartNew()

            $StatusCode = 0
            $Version = ""
            $Track = ""
            $ErrorMessage = ""

            try {

                $Response = Invoke-WebRequest `
                    -Uri $Url `
                    -Method Get `
                    -UseBasicParsing `
                    -TimeoutSec $TimeoutSeconds `
                    -ErrorAction Stop

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

            $Watch.Stop()

            [PSCustomObject]@{
                Request    = $RequestNumber
                StatusCode = $StatusCode
                DurationMs = [math]::Round($Watch.Elapsed.TotalMilliseconds, 2)
                Version    = $Version
                Track      = $Track
                Error      = $ErrorMessage
            }
        }
    }

    $Jobs | Wait-Job | Out-Null

    foreach ($Job in $Jobs) {

        $Output = Receive-Job -Job $Job

        foreach ($Item in $Output) {
            $Results.Add($Item)
        }

        Remove-Job -Job $Job -Force
    }

    $Completed += $CurrentBatch

    Write-Progress `
        -Activity "Prueba concurrente" `
        -Status "$Completed de $Requests solicitudes" `
        -PercentComplete (($Completed / $Requests) * 100)
}

Write-Progress -Activity "Prueba concurrente" -Completed

# ==========================================
# 4. GUARDAR RESULTADOS
# ==========================================

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$CsvPath = Join-Path $PSScriptRoot "canary-concurrent-$Timestamp.csv"

$Results |
    Sort-Object Request |
    Export-Csv -Path $CsvPath -NoTypeInformation -Encoding UTF8

# ==========================================
# 5. CLASIFICAR RESULTADOS
# ==========================================

$Success = @($Results | Where-Object {
    $_.StatusCode -ge 200 -and $_.StatusCode -lt 300
})

$Errors = @($Results | Where-Object {
    $_.StatusCode -lt 200 -or $_.StatusCode -ge 300
})

$Stable = @($Results | Where-Object {
    $_.Track -eq "stable"
})

$Canary = @($Results | Where-Object {
    $_.Track -eq "canary"
})

$UnknownTrack = @($Results | Where-Object {
    $_.Track -ne "stable" -and $_.Track -ne "canary"
})

# ==========================================
# 6. FUNCION PARA CALCULAR LATENCIAS
# ==========================================

function Get-LatencyStatistics {

    param(
        [object[]]$Items
    )

    $Values = @(
        $Items |
        Where-Object {
            $_.DurationMs -ge 0
        } |
        ForEach-Object {
            [double]$_.DurationMs
        } |
        Sort-Object
    )

    if ($Values.Count -eq 0) {
        return [PSCustomObject]@{
            Count   = 0
            Average = 0
            P50     = 0
            P95     = 0
            P99     = 0
        }
    }

    return [PSCustomObject]@{
        Count   = $Values.Count
        Average = [math]::Round(
            ($Values | Measure-Object -Average).Average, 2
        )
        P50 = $Values[
            [math]::Ceiling($Values.Count * 0.50) - 1
        ]
        P95 = $Values[
            [math]::Ceiling($Values.Count * 0.95) - 1
        ]
        P99 = $Values[
            [math]::Ceiling($Values.Count * 0.99) - 1
        ]
    }
}

# ==========================================
# 7. ESTADISTICAS GENERALES Y POR TRACK
# ==========================================

$AllStats = Get-LatencyStatistics -Items $Results
$StableStats = Get-LatencyStatistics -Items $Stable
$CanaryStats = Get-LatencyStatistics -Items $Canary

$StableErrors = @($Stable | Where-Object {
    $_.StatusCode -lt 200 -or $_.StatusCode -ge 300
})

$CanaryErrors = @($Canary | Where-Object {
    $_.StatusCode -lt 200 -or $_.StatusCode -ge 300
})

# ==========================================
# 8. MOSTRAR RESUMEN
# ==========================================

Write-Host "`n====================================" -ForegroundColor Cyan
Write-Host "             RESULTADOS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

Write-Host "Total: $($Results.Count)"
Write-Host "Exitosas: $($Success.Count)" -ForegroundColor Green
Write-Host "Errores: $($Errors.Count)" -ForegroundColor Red
Write-Host "Track desconocido: $($UnknownTrack.Count)"

Write-Host "`nDistribucion:"
Write-Host "Stable: $($Stable.Count)"
Write-Host "Canary: $($Canary.Count)"

if ($Results.Count -gt 0) {

    Write-Host "`nPorcentaje:"
    Write-Host ("Stable: {0:N2}%" -f (($Stable.Count / $Results.Count) * 100))
    Write-Host ("Canary: {0:N2}%" -f (($Canary.Count / $Results.Count) * 100))
}

Write-Host "`n--- COMPARACION POR TRACK ---" -ForegroundColor Cyan

Write-Host "`nSTABLE"
Write-Host "Solicitudes: $($Stable.Count)"
Write-Host "Errores: $($StableErrors.Count)"
Write-Host ("Promedio: {0:N2} ms" -f $StableStats.Average)
Write-Host ("P50: {0:N2} ms" -f $StableStats.P50)
Write-Host ("P95: {0:N2} ms" -f $StableStats.P95)
Write-Host ("P99: {0:N2} ms" -f $StableStats.P99)

Write-Host "`nCANARY"
Write-Host "Solicitudes: $($Canary.Count)"
Write-Host "Errores: $($CanaryErrors.Count)"
Write-Host ("Promedio: {0:N2} ms" -f $CanaryStats.Average)
Write-Host ("P50: {0:N2} ms" -f $CanaryStats.P50)
Write-Host ("P95: {0:N2} ms" -f $CanaryStats.P95)
Write-Host ("P99: {0:N2} ms" -f $CanaryStats.P99)

Write-Host "`n--- LATENCIA GENERAL ---"
Write-Host ("Promedio: {0:N2} ms" -f $AllStats.Average)
Write-Host ("P50: {0:N2} ms" -f $AllStats.P50)
Write-Host ("P95: {0:N2} ms" -f $AllStats.P95)
Write-Host ("P99: {0:N2} ms" -f $AllStats.P99)

Write-Host "`nCSV: $CsvPath"
Write-Host "====================================" -ForegroundColor Cyan

# ==========================================
# 9. VALIDACIONES DE INTEGRIDAD
# ==========================================

if ($Results.Count -ne $Requests) {
    throw "La cantidad de resultados no coincide con las solicitudes solicitadas."
}

if ($UnknownTrack.Count -gt 0) {
    throw "Hay respuestas sin identificar correctamente su version o track."
}

if ($Success.Count -ne $Requests) {
    Write-Warning "La prueba registro errores HTTP o de conexion. El Quality Gate evaluara las metricas."
}

# Exit code 0 significa que el generador pudo completar y registrar la prueba.
# Los errores HTTP quedan en el CSV para que los evalúe el Quality Gate.
# Codigo de salida explicito para GitHub Actions.
exit 0