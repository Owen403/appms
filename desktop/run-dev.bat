@echo off
echo ========================================
echo   Music Player - Development Mode
echo ========================================
echo.
echo Dang kiem tra Node.js...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js chua duoc cai dat!
    echo Vui long tai tai: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js: OK
echo.
echo Dang kiem tra dependencies...

if not exist node_modules (
    echo Chua cai dat dependencies, dang cai dat...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Cai dat that bai!
        pause
        exit /b 1
    )
)

echo Dependencies: OK
echo.
echo ========================================
echo   Dang khoi dong Music Player...
echo ========================================
echo.

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Khong the khoi dong app!
    pause
    exit /b 1
)

pause
