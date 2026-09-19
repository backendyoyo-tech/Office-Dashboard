@echo off
REM Hair Rap Launcher - Start
REM This script starts the launcher manually

echo ========================================
echo Hair Rap Launcher - Starting
echo ========================================
echo.

REM Check Python installation
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    pause
    exit /b 1
)

REM Get the directory of this script
set "SCRIPT_DIR=%~dp0"

REM Check if main.py exists
if not exist "%SCRIPT_DIR%main.py" (
    echo ERROR: main.py not found in %SCRIPT_DIR%
    pause
    exit /b 1
)

REM Check if config exists
if not exist "%SCRIPT_DIR%launcher_config.json" (
    echo WARNING: Configuration file not found.
    echo Please run setup.bat first.
    pause
    exit /b 1
)

echo Starting Hair Rap Launcher...
echo Press Ctrl+C to stop.
echo.

python "%SCRIPT_DIR%main.py"

pause
