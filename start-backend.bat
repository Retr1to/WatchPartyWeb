@echo off
echo ====================================
echo  WatchTogether - Starting Backend
echo ====================================
echo.

cd Backend

if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    echo.
)

echo Starting backend server on port 3000...
call npm start
