@echo off
echo ====================================
echo    WatchTogether - Quick Start
echo ====================================
echo.
echo This will start both backend and frontend servers.
echo.
echo Backend will run on: http://localhost:3000
echo Frontend will run on: http://localhost:4200
echo.
echo Press Ctrl+C to stop the servers.
echo.
pause

start "WatchTogether Backend" cmd /k "cd Backend && npm install && npm start"
timeout /t 3 >nul
start "WatchTogether Frontend" cmd /k "cd Frontend && npm install && npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:4200
echo.
