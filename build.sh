#!/bin/bash

# Simple build script for Railway
echo "🚀 Building MediBill Pulse Frontend..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build:prod

echo "✅ Build completed successfully!"
