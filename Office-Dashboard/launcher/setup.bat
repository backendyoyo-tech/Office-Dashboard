@echo off
REM Hair Rap Launcher - Interactive Setup
REM This script guides you through the initial setup process

echo ========================================
echo Hair Rap Launcher - Setup
echo ========================================
echo.

REM Check Python installation
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo.
    echo Please install Python 3.11 or later from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PYTHON_VERSION=%%i"
echo Found Python %PYTHON_VERSION%
echo.

REM Install dependencies
echo [2/5] Installing dependencies...
pip install -r requirements.txt --quiet
if %errorLevel% neq 0 (
    echo WARNING: Failed to install dependencies. Trying with pip3...
    pip3 install -r requirements.txt --quiet
    if %errorLevel% neq 0 (
        echo ERROR: Failed to install dependencies.
        echo Please run: pip install requests
        pause
        exit /b 1
    )
)
echo Dependencies installed successfully.
echo.

REM Configure dashboard URL
echo [3/5] Configuring dashboard URL...
set /p DASHBOARD_URL="Enter dashboard URL [http://localhost:3001]: "
if "%DASHBOARD_URL%"=="" set "DASHBOARD_URL=http://localhost:3001"

REM Update config file
python -c "from config import update_config_value; update_config_value('dashboard_url', '%DASHBOARD_URL%')"
echo Dashboard URL set to: %DASHBOARD_URL%
echo.

REM Configure device code
echo [4/5] Configuring device...
set /p DEVICE_CODE="Enter device code (e.g., PC-01): "
if "%DEVICE_CODE%"=="" (
    echo ERROR: Device code is required.
    pause
    exit /b 1
)

set /p FRIENDLY_NAME="Enter friendly name (e.g., Main Office Desktop): "
if "%FRIENDLY_NAME%"=="" set "FRIENDLY_NAME=%COMPUTERNAME%"

REM Update config
python -c "from config import update_config_value; update_config_value('device_code', '%DEVICE_CODE%'); update_config_value('friendly_name', '%FRIENDLY_NAME%')"
echo Device configured: %DEVICE_CODE% - %FRIENDLY_NAME%
echo.

REM Register device
echo [5/5] Registering device with dashboard...
echo.
echo Please ensure the dashboard is running at %DASHBOARD_URL%
echo.
pause

python main.py --register
if %errorLevel% neq 0 (
    echo.
    echo WARNING: Registration failed. You can try again later by running:
    echo python main.py --register
    echo.
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Install as startup task: install.bat
echo 2. Start launcher now: start.bat
echo.
echo Configuration file: launcher_config.json
echo Log file: launcher.log
echo.
pause
