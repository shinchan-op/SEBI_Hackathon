@echo off
echo 🚀 Starting SEBI Fractional Bond Marketplace (Local Development)
echo.

echo 📦 Installing dependencies...
cd packages\backend
call npm install
if errorlevel 1 (
    echo ❌ Backend dependencies installation failed
    pause
    exit /b 1
)

cd ..\frontend
call npm install
if errorlevel 1 (
    echo ❌ Frontend dependencies installation failed
    pause
    exit /b 1
)

cd ..\ml-service
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ ML service dependencies installation failed
    pause
    exit /b 1
)

echo.
echo ✅ Dependencies installed successfully!
echo.

echo 🗄️  Setting up database...
cd ..\packages\backend
call npm run seed
if errorlevel 1 (
    echo ⚠️  Database seeding failed, but continuing...
)

echo.
echo 🚀 Starting services...
echo.

echo Starting Backend API on http://localhost:3001...
start "Backend API" cmd /k "cd packages\backend && npm run dev"

echo Starting Frontend on http://localhost:3000...
start "Frontend" cmd /k "cd packages\frontend && npm run dev"

echo Starting ML Service on http://localhost:8001...
start "ML Service" cmd /k "cd packages\ml-service && python src\main.py"

echo.
echo 🎉 All services starting!
echo.
echo Access the application at:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:3001
echo - ML Service: http://localhost:8001
echo.
echo Press any key to exit...
pause >nul
