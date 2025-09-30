#!/bin/bash

# Railway start script for frontend
echo "🚀 Starting MediBill Pulse Frontend on Railway..."

# Build the application
echo "🔨 Building application..."
npm run build:prod

# Start the preview server
echo "🌐 Starting preview server on port ${PORT:-3000}..."
vite preview --host 0.0.0.0 --port ${PORT:-3000}
