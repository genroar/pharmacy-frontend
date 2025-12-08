#!/usr/bin/env node
/**
 * Build script for Windows/Mac/Linux executables
 *
 * Folder Structure:
 *   Pharmacy-App/
 *     frontend-pharmachy/
 *       electron/main.cjs, preload.cjs  <-- Electron files HERE
 *     backend-pharmachy/
 *       dist/server.js
 *
 * Usage:
 *   npm run electron:build:win   (runs this script)
 *   npm run electron:build:mac   (standard electron-builder)
 *   npm run electron:build       (standard electron-builder)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');  // frontend-pharmachy
const ELECTRON_DIR = path.join(ROOT, 'electron');  // frontend-pharmachy/electron
const BACKEND_DIR = path.join(ROOT, '..', 'backend-pharmachy');  // backend-pharmachy
const RELEASE_DIR = path.join(ROOT, 'release');

console.log('🔧 Zapeera Build Script');
console.log('='.repeat(60));
console.log(`📁 Frontend Root: ${ROOT}`);
console.log(`📁 Electron Dir:  ${ELECTRON_DIR}`);
console.log(`📁 Backend Dir:   ${BACKEND_DIR}`);
console.log(`📁 Release Dir:   ${RELEASE_DIR}`);
console.log('='.repeat(60));

// Step 1: Verify electron folder exists in frontend
console.log('\n📁 Step 1: Verifying Electron files...');
try {
  const requiredFiles = ['main.cjs', 'preload.cjs'];
  const missingFiles = [];

  for (const file of requiredFiles) {
    const filePath = path.join(ELECTRON_DIR, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    } else {
      console.log(`   ✓ Found: electron/${file}`);
    }
  }

  if (missingFiles.length > 0) {
    console.error(`   ❌ Missing files in electron/: ${missingFiles.join(', ')}`);
    console.error(`   Please ensure electron/main.cjs and electron/preload.cjs exist`);
    process.exit(1);
  }

  console.log('   ✅ All Electron files present');
} catch (err) {
  console.error('   ❌ Failed to verify electron files:', err.message);
  process.exit(1);
}

// Step 2: Verify backend exists
console.log('\n📁 Step 2: Verifying Backend directory...');
try {
  if (!fs.existsSync(BACKEND_DIR)) {
    console.error(`   ❌ Backend directory not found at: ${BACKEND_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(BACKEND_DIR, 'package.json'))) {
    console.error(`   ❌ Backend package.json not found`);
    process.exit(1);
  }
  console.log('   ✅ Backend directory verified');
} catch (err) {
  console.error('   ❌ Backend verification failed:', err.message);
  process.exit(1);
}

// Step 3: Generate Prisma client with correct binary targets
console.log('\n🔨 Step 3: Generating Prisma client...');
try {
  const prismaSchema = path.join(BACKEND_DIR, 'prisma', 'schema.prisma');
  if (fs.existsSync(prismaSchema)) {
    // Read and update schema with correct binary targets
    let schemaContent = fs.readFileSync(prismaSchema, 'utf8');

    // Check if binaryTargets already exists
    if (!schemaContent.includes('binaryTargets')) {
      // Add binary targets for all platforms
      schemaContent = schemaContent.replace(
        /(generator\s+client\s*\{)/,
        `$1\n  binaryTargets = ["native", "windows", "darwin", "darwin-arm64", "linux-musl-openssl-3.0.x"]`
      );
      fs.writeFileSync(prismaSchema, schemaContent);
      console.log('   Added binary targets to schema.prisma');
    }

    execSync('npx prisma generate', {
      cwd: BACKEND_DIR,
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('   ✅ Prisma client generated');
  } else {
    console.log('   ⚠️ Prisma schema not found, skipping generation');
  }
} catch (err) {
  console.error('   ⚠️ Prisma generate warning:', err.message);
  // Continue anyway - might already be generated
}

// Step 4: Build backend
console.log('\n🔨 Step 4: Building backend...');
try {
  execSync('npm run build', {
    cwd: BACKEND_DIR,
    stdio: 'inherit'
  });
  console.log('   ✅ Backend built successfully');

  // Verify server.js exists
  const serverPath = path.join(BACKEND_DIR, 'dist', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error(`   ❌ Backend server.js not found at: ${serverPath}`);
    process.exit(1);
  }
  console.log(`   ✓ Verified: dist/server.js exists`);
} catch (err) {
  console.error('   ❌ Backend build failed:', err.message);
  process.exit(1);
}

// Step 5: Build frontend
console.log('\n🔨 Step 5: Building frontend...');
try {
  execSync('npm run build', {
    cwd: ROOT,
    stdio: 'inherit'
  });
  console.log('   ✅ Frontend built successfully');

  // Verify dist/index.html exists
  const indexPath = path.join(ROOT, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`   ❌ Frontend index.html not found at: ${indexPath}`);
    process.exit(1);
  }
  console.log(`   ✓ Verified: dist/index.html exists`);
} catch (err) {
  console.error('   ❌ Frontend build failed:', err.message);
  process.exit(1);
}

// Step 6: Verify and update package.json main entry
console.log('\n🔍 Step 6: Verifying package.json main entry...');
try {
  const packageJsonPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (pkg.main !== 'electron/main.cjs') {
    console.log(`   Updating main entry from "${pkg.main}" to "electron/main.cjs"`);
    pkg.main = 'electron/main.cjs';
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('   ✅ package.json main entry updated');
  } else {
    console.log('   ✅ package.json main entry is correct: electron/main.cjs');
  }
} catch (err) {
  console.error('   ❌ Failed to verify package.json:', err.message);
  process.exit(1);
}

// Step 7: Verify electron-builder.json
console.log('\n🔍 Step 7: Verifying electron-builder.json...');
try {
  const builderConfigPath = path.join(ROOT, 'electron-builder.json');
  if (fs.existsSync(builderConfigPath)) {
    const config = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));
    console.log(`   App ID: ${config.appId}`);
    console.log(`   Product Name: ${config.productName}`);
    console.log('   ✅ electron-builder.json is valid');
  } else {
    console.error('   ❌ electron-builder.json not found');
    process.exit(1);
  }
} catch (err) {
  console.error('   ❌ Invalid electron-builder.json:', err.message);
  process.exit(1);
}

// Step 8: Create a .env file for production if needed
console.log('\n📝 Step 8: Creating production .env file...');
try {
  const envPath = path.join(BACKEND_DIR, '.env');
  const envContent = `# Production Environment
NODE_ENV=production
PORT=5001

# SQLite is used for offline/local storage
# Data is stored in ~/.zapeera/data/zapeera.db
# This file is for reference - actual database URL is set by Electron

# Optional: Set this for online sync (uncomment and configure)
# REMOTE_DATABASE_URL=postgresql://user:password@host:port/database
`;

  // Only create if doesn't exist to preserve user settings
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envContent);
    console.log('   ✅ Created default .env file');
  } else {
    console.log('   ✓ .env file already exists (preserved)');
  }
} catch (err) {
  console.log('   ⚠️ Could not create .env file:', err.message);
}

// Step 9: Build executable
console.log('\n📦 Step 9: Building executable...');
try {
  const platform = process.platform;
  let buildCmd = 'npx electron-builder';

  // Determine target based on args
  const args = process.argv.slice(2);
  if (args.includes('--win') || args.includes('-w')) {
    buildCmd += ' --win';
    console.log('   Building for Windows...');
  } else if (args.includes('--mac') || args.includes('-m')) {
    buildCmd += ' --mac';
    console.log('   Building for macOS...');
  } else if (args.includes('--linux') || args.includes('-l')) {
    buildCmd += ' --linux';
    console.log('   Building for Linux...');
  } else {
    // Default to current platform
    if (platform === 'win32') {
      buildCmd += ' --win';
      console.log('   Building for Windows (auto-detected)...');
    } else if (platform === 'darwin') {
      buildCmd += ' --mac';
      console.log('   Building for macOS (auto-detected)...');
    } else {
      buildCmd += ' --linux';
      console.log('   Building for Linux (auto-detected)...');
    }
  }

  execSync(buildCmd, {
    cwd: ROOT,
    stdio: 'inherit'
  });
  console.log('   ✅ Executable built successfully');
} catch (err) {
  console.error('   ❌ Build failed:', err.message);
  process.exit(1);
}

// Final summary
console.log('\n' + '='.repeat(60));
console.log('✅ BUILD COMPLETE!');
console.log('='.repeat(60));
console.log('\n📁 Output location: release/');
console.log('\n📋 What was built:');
console.log('   ✓ Frontend (React + Vite) → dist/');
console.log('   ✓ Backend (Express + Prisma) → bundled in resources/backend/');
console.log('   ✓ Electron app with auto-start backend');
console.log('\n💡 How it works:');
console.log('   1. Open the EXE/DMG - backend starts automatically');
console.log('   2. No manual frontend/backend startup needed');
console.log('   3. Backend runs in background (no terminal window)');
console.log('   4. App works OFFLINE using SQLite');
console.log('   5. Data stored in ~/.zapeera/data/zapeera.db');
console.log('   6. Data is PERSISTENT - never deleted on refresh/restart');
console.log('   7. Backend keeps running even if window is closed');
console.log('='.repeat(60));
