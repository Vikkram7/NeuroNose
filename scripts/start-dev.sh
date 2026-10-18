#!/bin/bash
# NeuroNose - Linux/Mac Startup Script

set -e

echo "========================================"
echo " NeuroNose Development Startup"
echo "========================================"
echo

# Check prerequisites
echo "[1/6] Checking prerequisites..."
command -v java >/dev/null 2>&1 || { echo "ERROR: Java 21 not found"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Python not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker not found"; exit 1; }
echo "   All prerequisites found."
echo

# Copy env if needed
if [ ! -f .env ]; then
    echo "[2/6] Creating .env from template..."
    cp .env.example .env
else
    echo "[2/6] .env already exists."
fi
echo

# Start PostgreSQL
echo "[3/6] Starting PostgreSQL..."
docker compose up -d
echo "   Waiting for database to be ready..."
sleep 5
echo

# Build and start Java backend
echo "[4/6] Building Java backend..."
cd java-backend
mvn package -DskipTests -q
echo "   Starting backend on port 8080..."
mvn spring-boot:run -Dspring-boot.run.profiles=dev &
BACKEND_PID=$!
cd ..
sleep 10
echo

# Install frontend dependencies
echo "[5/6] Setting up frontend..."
cd frontend
npm install --silent
echo "   Starting frontend on port 5173..."
npm run dev &
FRONTEND_PID=$!
cd ..
echo

echo "[6/6] All services started!"
echo
echo "========================================"
echo " Services:"
echo "   Database:   localhost:5432"
echo "   Backend:    http://localhost:8080"
echo "   Swagger:    http://localhost:8080/swagger-ui.html"
echo "   Dashboard:  http://localhost:5173"
echo "========================================"
echo
echo "Press Ctrl+C to stop all services..."

cleanup() {
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    docker compose down
    echo "Done."
}
trap cleanup EXIT INT TERM

wait
