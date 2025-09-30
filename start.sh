#!/bin/bash

# Railway start script for frontend
set -e

echo "🚀 Starting MediBill Pulse Frontend on Railway..."

# Check if build exists, if not build it
if [ ! -d "dist" ]; then
    echo "🔨 Building application..."
    npm run build:prod
else
    echo "✅ Build already exists, skipping build step"
fi

# Start the preview server
echo "🌐 Starting preview server on port ${PORT:-3000}..."
npx vite preview --host 0.0.0.0 --port ${PORT:-3000}
