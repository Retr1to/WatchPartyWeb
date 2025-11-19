@echo off
echo ====================================
echo  WatchTogether - Starting Frontend
echo ====================================
echo.

cd Frontend

if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    echo.
)

echo Starting Angular development server...
call npm start
