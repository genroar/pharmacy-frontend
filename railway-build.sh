#!/bin/bash

# Railway build script for frontend
set -e

echo "🚀 Building MediBill Pulse Frontend for Railway..."

# Install all dependencies (including dev dependencies)
echo "📦 Installing dependencies..."
npm ci

# Build the application
echo "🔨 Building application..."
npm run build:prod

echo "✅ Build completed successfully!"
