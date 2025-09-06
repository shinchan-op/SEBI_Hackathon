#!/bin/bash

echo "🚀 Starting SEBI Bond Trading Platform Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to backend directory
cd packages/backend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in packages/backend directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the backend
echo "🏃 Starting backend server..."
npm run dev
