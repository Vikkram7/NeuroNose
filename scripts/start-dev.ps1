# NeuroNose - PowerShell Development Startup Script
# Run with: powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " NeuroNose Full-Stack Dev Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$root = (Get-Item -Path $PSScriptRoot\..).FullName

# 1. Environment file
if (-not (Test-Path "$root\.env")) {
    Write-Host "[1/5] Creating .env from template..." -ForegroundColor Yellow
    Copy-Item "$root\.env.example" "$root\.env"
} else {
    Write-Host "[1/5] .env file verified." -ForegroundColor Green
}

# 2. Start PostgreSQL via Docker Compose
Write-Host "[2/5] Starting PostgreSQL container..." -ForegroundColor Yellow
try {
    docker compose up -d
    Write-Host "      PostgreSQL running on localhost:5432." -ForegroundColor Green
} catch {
    Write-Host "      Docker not running. Note: Java backend can fallback to H2 if PostgreSQL is unavailable." -ForegroundColor DarkYellow
}

# 3. Python ML Model Baseline Check
Write-Host "[3/5] Checking ML models..." -ForegroundColor Yellow
if (-not (Test-Path "$root\python-ml\models\neuronose_rf_model.joblib")) {
    Write-Host "      Training baseline Random Forest model..." -ForegroundColor Yellow
    python "$root\python-ml\train_model.py"
}
Write-Host "      ML models ready in python-ml/models." -ForegroundColor Green

# 4. Start Java Backend
Write-Host "[4/5] Launching Java Spring Boot Backend..." -ForegroundColor Yellow
$backendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\java-backend'; mvn spring-boot:run -Dspring-boot.run.profiles=dev" -PassThru
Write-Host "      Java Backend process started (PID: $($backendJob.Id))." -ForegroundColor Green

# 5. Start Frontend Dashboard
Write-Host "[5/5] Launching React Vite Dashboard..." -ForegroundColor Yellow
$frontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; npm run dev" -PassThru
Write-Host "      Frontend process started (PID: $($frontendJob.Id))." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " NeuroNose Services Online:" -ForegroundColor Cyan
Write-Host "   Frontend Dashboard:  http://localhost:5173" -ForegroundColor White
Write-Host "   Backend REST API:    http://localhost:8080" -ForegroundColor White
Write-Host "   Swagger / OpenAPI:   http://localhost:8080/swagger-ui.html" -ForegroundColor White
Write-Host "   PostgreSQL Database: localhost:5432" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
