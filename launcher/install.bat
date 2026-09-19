@echo off
REM Hair Rap Launcher - Windows Task Scheduler Installation
REM This script installs the launcher to run on user login

echo ========================================
echo Hair Rap Launcher - Installation
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

REM Check Python installation
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.11 or later from https://www.python.org/
    pause
    exit /b 1
)

REM Get the directory of this script
set "SCRIPT_DIR=%~dp0"
set "LAUNCHER_PATH=%SCRIPT_DIR%main.py"

REM Check if main.py exists
if not exist "%LAUNCHER_PATH%" (
    echo ERROR: main.py not found in %SCRIPT_DIR%
    pause
    exit /b 1
)

REM Get Python path
for /f "tokens=*" %%i in ('where python') do set "PYTHON_PATH=%%i"
set "PYTHONW_PATH=%PYTHON_PATH:python.exe=pythonw.exe%"

REM Check if pythonw exists
if not exist "%PYTHONW_PATH%" (
    echo WARNING: pythonw.exe not found. Using python.exe instead.
    set "PYTHONW_PATH=%PYTHON_PATH%"
)

echo Installing Hair Rap Launcher as Windows startup task...
echo.

REM Create scheduled task
schtasks /create /tn "HairRapLauncher" /tr "\"%PYTHONW_PATH%\" \"%LAUNCHER_PATH%\"" /sc onlogon /rl highest /f

if %errorLevel% equ 0 (
    echo.
    echo SUCCESS: Hair Rap Launcher installed successfully!
    echo.
    echo The launcher will start automatically when you log in.
    echo.
    echo To uninstall, run: uninstall.bat
    echo To start now, run: start.bat
) else (
    echo.
    echo ERROR: Failed to create scheduled task.
    echo Please ensure you have administrator privileges.
)

echo.
pause
