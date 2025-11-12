# test-stats.ps1 - Script para mostrar estadísticas de tests
Write-Host "Calculando estadísticas de tests..." -ForegroundColor Yellow

# Ejecutar tests y obtener resultado JSON
$jsonOutput = npx jest --json --silent 2>$null

try {
    $result = $jsonOutput | ConvertFrom-Json
    
    $total = $result.numTotalTests
    $passed = $result.numPassedTests  
    $failed = $result.numFailedTests
    
    if ($total -gt 0) {
        $percentage = [math]::Round(($passed / $total * 100), 2)
    } else {
        $percentage = 0
    }

    Write-Host "`n📊 ESTADÍSTICAS DE TESTS" -ForegroundColor Cyan
    Write-Host "=======================" -ForegroundColor Cyan
    Write-Host "✅ Tests pasados: $passed" -ForegroundColor Green
    Write-Host "❌ Tests fallados: $failed" -ForegroundColor Red
    Write-Host "📋 Total tests: $total" -ForegroundColor Yellow
    Write-Host "🎯 Porcentaje de aprobación: $percentage%" -ForegroundColor Magenta

    # Mensajes según el porcentaje
    if ($percentage -eq 100) {
        Write-Host "🎉 ¡EXCELENTE! 100% de aprobación" -ForegroundColor Green
    } elseif ($percentage -ge 90) {
        Write-Host "👍 Muy buen trabajo" -ForegroundColor Green
    } elseif ($percentage -ge 80) {
        Write-Host "💪 Casi allí, sigue así" -ForegroundColor Yellow
    } else {
        Write-Host "🔧 Necesita mejorar" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ No se pudieron calcular las estadísticas" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Mostrar porcentaje manual basado en output conocido
    Write-Host "`n📊 BASADO EN TU ÚLTIMO OUTPUT:" -ForegroundColor Yellow
    Write-Host "Tests: 2 failed, 83 passed, 85 total" -ForegroundColor White
    $percentage = [math]::Round((83 / 85 * 100), 2)
    Write-Host "🎯 Porcentaje de aprobación: $percentage%" -ForegroundColor Magenta
}