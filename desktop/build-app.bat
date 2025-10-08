@echo off
echo ========================================
echo   Music Player - Build Installer
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
echo   Dang build file .exe installer...
echo ========================================
echo.
echo Qua trinh nay co the mat vai phut...
echo.

call npm run build:win

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build that bai!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD THANH CONG!
echo ========================================
echo.
echo File installer duoc tao trong thu muc: dist/
echo.
echo Tim file: "Music Player Setup.exe"
echo.
pause

explorer dist
