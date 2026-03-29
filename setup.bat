@echo off
REM Quick Start Script for SBLR 1071 - Windows

echo.
echo ======================================
echo SBLR 1071 Data Collection System
echo Quick Start Setup
echo ======================================
echo.

REM Check if PostgreSQL is installed
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL not found. Please install PostgreSQL first.
    echo Download from: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python 3.9+ not found. Please install Python first.
    echo Download from: https://www.python.org/
    pause
    exit /b 1
)

echo Step 1: Setting up PostgreSQL database...
echo.

REM Create database
createdb sblr1071
if %errorlevel% equ 0 (
    echo [OK] Database created
) else (
    echo [INFO] Database may already exist
)

REM Load schema
echo [INFO] Loading schema...
psql -d sblr1071 -f database\schema.sql >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Schema loaded
) else (
    echo [ERROR] Failed to load schema
    pause
    exit /b 1
)

REM Load sample data
echo [INFO] Loading sample data...
psql -d sblr1071 -f database\seed.sql >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Sample data loaded
) else (
    echo [INFO] Sample data may already exist or skipped
)

echo.
echo Step 2: Setting up Backend (FastAPI)...
echo.

cd backend

REM Create virtual environment
if not exist venv (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Create .env if it doesn't exist
if not exist .env (
    echo [INFO] Creating .env file...
    copy .env.example .env >nul
    echo [OK] .env created - update with your SMTP settings if needed
)

REM Install dependencies
echo [INFO] Installing Python dependencies...
pip install -q -r requirements.txt
if %errorlevel% equ 0 (
    echo [OK] Dependencies installed
) else (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo Step 3: Setting up Frontend (React)...
echo.

cd frontend

REM Install dependencies
echo [INFO] Installing npm packages...
call npm install -q
if %errorlevel% equ 0 (
    echo [OK] Dependencies installed
) else (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

cd ..

echo.
echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo Next steps:
echo.
echo 1. Open Terminal 1 and run Backend:
echo    cd backend
echo    venv\Scripts\activate.bat
echo    python main.py
echo    Backend runs on http://localhost:8000
echo.
echo 2. Open Terminal 2 and run Frontend:
echo    cd frontend
echo    npm run dev
echo    Frontend runs on http://localhost:3000
echo.
echo 3. Open browser to http://localhost:3000
echo.
echo View API docs at http://localhost:8000/docs
echo.
pause
