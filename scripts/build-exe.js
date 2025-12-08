#!/usr/bin/env node
/**
 * Build script for Windows EXE
 * This script copies electron files into frontend folder before building
 * because electron-builder requires all files to be under the project directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ELECTRON_SRC = path.join(ROOT, '..', 'electron');
const ELECTRON_DEST = path.join(ROOT, 'electron');

console.log('🔧 Zapeera EXE Build Script');
console.log('='.repeat(50));

// Step 1: Copy electron folder
console.log('\n📁 Step 1: Copying electron files...');
try {
  // Remove existing electron folder if exists
  if (fs.existsSync(ELECTRON_DEST)) {
    fs.rmSync(ELECTRON_DEST, { recursive: true, force: true });
    console.log('   Removed existing electron folder');
  }

  // Create destination folder
  fs.mkdirSync(ELECTRON_DEST, { recursive: true });

  // Copy files
  const files = fs.readdirSync(ELECTRON_SRC);
  for (const file of files) {
    const srcPath = path.join(ELECTRON_SRC, file);
    const destPath = path.join(ELECTRON_DEST, file);

    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`   Copied: ${file}`);
    }
  }

  console.log('   ✅ Electron files copied successfully');
} catch (err) {
  console.error('   ❌ Failed to copy electron files:', err.message);
  process.exit(1);
}

// Step 2: Build backend
console.log('\n🔨 Step 2: Building backend...');
try {
  execSync('npm run build', {
    cwd: path.join(ROOT, '..', 'backend-pharmachy'),
    stdio: 'inherit'
  });
  console.log('   ✅ Backend built successfully');
} catch (err) {
  console.error('   ❌ Backend build failed');
  process.exit(1);
}

// Step 3: Build frontend
console.log('\n🔨 Step 3: Building frontend...');
try {
  execSync('npm run build', {
    cwd: ROOT,
    stdio: 'inherit'
  });
  console.log('   ✅ Frontend built successfully');
} catch (err) {
  console.error('   ❌ Frontend build failed');
  process.exit(1);
}

// Step 4: Build EXE
console.log('\n📦 Step 4: Building Windows EXE...');
try {
  execSync('npx electron-builder --win', {
    cwd: ROOT,
    stdio: 'inherit'
  });
  console.log('   ✅ Windows EXE built successfully');
} catch (err) {
  console.error('   ❌ EXE build failed');
  process.exit(1);
}

// Step 5: Cleanup (optional - keep electron folder for dev mode)
console.log('\n🧹 Step 5: Cleanup...');
// Don't delete - might be needed for development
console.log('   Keeping electron folder for development use');

console.log('\n' + '='.repeat(50));
console.log('✅ BUILD COMPLETE!');
console.log('📁 EXE location: release/');
console.log('='.repeat(50));






