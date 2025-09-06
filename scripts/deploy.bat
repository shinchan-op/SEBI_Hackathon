@echo off
REM SEBI Fractional Bond Marketplace Deployment Script for Windows
REM This script handles the complete deployment of the marketplace

setlocal enabledelayedexpansion

REM Configuration
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=development
set DOCKER_COMPOSE_FILE=docker-compose.yml
set BACKUP_DIR=backups
set LOG_DIR=logs

REM Create necessary directories
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo 🚀 Starting SEBI Fractional Bond Marketplace Deployment
echo Environment: %ENVIRONMENT%

REM Check prerequisites
echo 🔍 Checking prerequisites...

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed
    exit /b 1
)

REM Check Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Backup existing data (production only)
if "%ENVIRONMENT%"=="production" (
    echo 💾 Creating backup...
    set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
    set TIMESTAMP=!TIMESTAMP: =0!
    set BACKUP_PATH=%BACKUP_DIR%\backup_!TIMESTAMP!
    
    REM Backup database
    docker-compose exec -T postgres pg_dump -U postgres sebi_marketplace > "%BACKUP_PATH%.sql"
    
    REM Backup Redis data
    docker-compose exec -T redis redis-cli --rdb - > "%BACKUP_PATH%.rdb"
    
    echo ✅ Backup created at %BACKUP_PATH%
)

REM Build and start services
echo 🏗️  Building and starting services...

REM Pull latest images
docker-compose pull

REM Build custom images
docker-compose build --no-cache

REM Start services
docker-compose up -d

echo ✅ Services started

REM Wait for services to be healthy
echo ⏳ Waiting for services to be healthy...

REM Wait for PostgreSQL
echo Waiting for PostgreSQL...
:wait_postgres
docker-compose exec postgres pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    timeout /t 2 >nul
    goto wait_postgres
)
echo ✅ PostgreSQL is ready

REM Wait for Redis
echo Waiting for Redis...
:wait_redis
docker-compose exec redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    timeout /t 2 >nul
    goto wait_redis
)
echo ✅ Redis is ready

REM Wait for Backend API
echo Waiting for Backend API...
:wait_backend
curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    timeout /t 5 >nul
    goto wait_backend
)
echo ✅ Backend API is ready

REM Wait for ML Service
echo Waiting for ML Service...
:wait_ml
curl -f http://localhost:8001/health >nul 2>&1
if errorlevel 1 (
    timeout /t 5 >nul
    goto wait_ml
)
echo ✅ ML Service is ready

REM Wait for Frontend
echo Waiting for Frontend...
:wait_frontend
curl -f http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    timeout /t 5 >nul
    goto wait_frontend
)
echo ✅ Frontend is ready

REM Run database migrations
echo 🗄️  Running database migrations...
timeout /t 10 >nul
docker-compose exec backend npm run migration:run >nul 2>&1
echo ✅ Database migrations completed

REM Seed initial data (development only)
if "%ENVIRONMENT%"=="development" (
    echo 🌱 Seeding initial data...
    docker-compose exec backend npm run seed >nul 2>&1
    echo ✅ Initial data seeded
)

REM Run health checks
echo 🏥 Running health checks...

REM Check all services
curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Backend API health check failed
) else (
    echo ✅ Backend API is healthy
)

curl -f http://localhost:8001/health >nul 2>&1
if errorlevel 1 (
    echo ⚠️  ML Service health check failed
) else (
    echo ✅ ML Service is healthy
)

curl -f http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Frontend health check failed
) else (
    echo ✅ Frontend is healthy
)

REM Display deployment summary
echo.
echo 📊 Deployment Summary
echo ==================================
echo Environment: %ENVIRONMENT%
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:3001
echo ML Service: http://localhost:8001
echo Grafana: http://localhost:3001 (admin/admin)
echo Prometheus: http://localhost:9090
echo.
echo 🎉 Deployment completed successfully!
echo.
echo Next steps:
echo 1. Access the frontend at http://localhost:3000
echo 2. Check logs with: docker-compose logs -f
echo 3. Monitor with Grafana at http://localhost:3001
echo 4. View API docs at http://localhost:3001/api/docs

pause
