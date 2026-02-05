@echo off
title Medical 3D Splat Viewer
color 0A

echo.
echo ============================================================
echo   MEDICAL 3D SPLAT VIEWER
echo ============================================================
echo.

:: Check if ComfyUI is running
echo [1/3] Checking ComfyUI status...
curl -s http://127.0.0.1:8188/system_stats >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] ComfyUI is not running!
    echo Please start ComfyUI manually:
    echo   cd C:\Users\pc\Documents\ComfyUI
    echo   python main.py
    echo.
    echo Press any key to continue anyway...
    pause >nul
)

:: Install backend dependencies if needed
echo [2/3] Setting up backend...
cd /d "d:\sharp viewer\backend"
pip install -r requirements.txt -q

:: Start backend server in background
echo [3/3] Starting application...
start /min cmd /c "cd /d d:\sharp viewer\backend && python main.py"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Open browser
echo.
echo Opening browser...
start http://localhost:8000

echo.
echo ============================================================
echo   Application is running at: http://localhost:8000
echo   Press Ctrl+C to stop the server
echo ============================================================
echo.

:: Keep window open and show backend logs
cd /d "d:\sharp viewer\backend"
python main.py
