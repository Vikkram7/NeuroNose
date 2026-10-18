@echo off
REM NeuroNose - Windows Startup Script
REM This script starts all services for development

echo ========================================
echo  NeuroNose Development Startup
echo ========================================
echo.

REM Check prerequisites
echo [1/6] Checking prerequisites...
java --version >nul 2>&1 || (echo ERROR: Java 21 not found & exit /b 1)
python --version >nul 2>&1 || (echo ERROR: Python not found & exit /b 1)
node --version >nul 2>&1 || (echo ERROR: Node.js not found & exit /b 1)
docker --version >nul 2>&1 || (echo ERROR: Docker not found & exit /b 1)
echo    All prerequisites found.
echo.

REM Copy env if needed
if not exist .env (
    echo [2/6] Creating .env from template...
    copy .env.example .env
) else (
    echo [2/6] .env already exists.
)
echo.

REM Start PostgreSQL
echo [3/6] Starting PostgreSQL...
docker compose up -d
echo    Waiting for database to be ready...
timeout /t 5 /nobreak >nul
echo.

REM Build and start Java backend
echo [4/6] Building Java backend...
cd java-backend
call mvn package -DskipTests -q
echo    Starting backend on port 8080...
start "NeuroNose Backend" cmd /c "mvn spring-boot:run -Dspring-boot.run.profiles=dev"
cd ..
timeout /t 10 /nobreak >nul
echo.

REM Install frontend dependencies
echo [5/6] Setting up frontend...
cd frontend
call npm install --silent
echo    Starting frontend on port 5173...
start "NeuroNose Dashboard" cmd /c "npm run dev"
cd ..
echo.

echo [6/6] All services starting!
echo.
echo ========================================
echo  Services:
echo    Database:   localhost:5432
echo    Backend:    http://localhost:8080
echo    Swagger:    http://localhost:8080/swagger-ui.html
echo    Dashboard:  http://localhost:5173
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

REM Cleanup
echo Stopping services...
taskkill /FI "WINDOWTITLE eq NeuroNose*" /F >nul 2>&1
docker compose down
echo Done.
