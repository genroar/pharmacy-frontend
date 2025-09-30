#!/bin/bash

# Railway start script for frontend
set -e

echo "🚀 Starting MediBill Pulse Frontend on Railway..."

# Build the application
echo "🔨 Building application..."
npm run build:prod

# Start the preview server
echo "🌐 Starting preview server..."
npx vite preview --host 0.0.0.0 --port $PORT
