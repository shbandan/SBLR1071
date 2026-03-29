#!/bin/bash
# Quick Start Script for SBLR 1071 - macOS/Linux

echo ""
echo "======================================"
echo "SBLR 1071 Data Collection System"
echo "Quick Start Setup"
echo "======================================"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "ERROR: PostgreSQL not found. Please install PostgreSQL first."
    echo "macOS: brew install postgresql"
    echo "Linux: sudo apt-get install postgresql"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Please install Node.js first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3.9+ not found. Please install Python first."
    exit 1
fi

echo "Step 1: Setting up PostgreSQL database..."
echo ""

# Create database
createdb sblr1071 2>/dev/null
if [ $? -eq 0 ]; then
    echo "[OK] Database created"
else
    echo "[INFO] Database may already exist"
fi

# Load schema
echo "[INFO] Loading schema..."
psql -d sblr1071 -f database/schema.sql > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[OK] Schema loaded"
else
    echo "[ERROR] Failed to load schema"
    exit 1
fi

# Load sample data
echo "[INFO] Loading sample data..."
psql -d sblr1071 -f database/seed.sql > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[OK] Sample data loaded"
else
    echo "[INFO] Sample data may already exist or skipped"
fi

echo ""
echo "Step 2: Setting up Backend (FastAPI)..."
echo ""

cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "[INFO] Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "[INFO] Creating .env file..."
    cp .env.example .env
    echo "[OK] .env created - update with your SMTP settings if needed"
fi

# Install dependencies
echo "[INFO] Installing Python dependencies..."
pip install -q -r requirements.txt
if [ $? -eq 0 ]; then
    echo "[OK] Dependencies installed"
else
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

cd ..

echo ""
echo "Step 3: Setting up Frontend (React)..."
echo ""

cd frontend

# Install dependencies
echo "[INFO] Installing npm packages..."
npm install -q
if [ $? -eq 0 ]; then
    echo "[OK] Dependencies installed"
else
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

cd ..

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Open Terminal 1 and run Backend:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo "   Backend runs on http://localhost:8000"
echo ""
echo "2. Open Terminal 2 and run Frontend:"
echo "   cd frontend"
echo "   npm run dev"
echo "   Frontend runs on http://localhost:3000"
echo ""
echo "3. Open browser to http://localhost:3000"
echo ""
echo "View API docs at http://localhost:8000/docs"
echo ""
