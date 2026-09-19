@echo off
REM Hair Rap Launcher - Windows Task Scheduler Uninstallation
REM This script removes the launcher from startup

echo ========================================
echo Hair Rap Launcher - Uninstallation
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Check if task exists
schtasks /query /tn "HairRapLauncher" >nul 2>&1
if %errorLevel% neq 0 (
    echo Hair Rap Launcher is not installed.
    pause
    exit /b 0
)

echo Removing Hair Rap Launcher from startup...
echo.

REM Delete scheduled task
schtasks /delete /tn "HairRapLauncher" /f

if %errorLevel% equ 0 (
    echo.
    echo SUCCESS: Hair Rap Launcher uninstalled successfully!
    echo.
    echo The launcher will no longer start automatically.
) else (
    echo.
    echo ERROR: Failed to remove scheduled task.
    echo Please ensure you have administrator privileges.
)

echo.
pause
