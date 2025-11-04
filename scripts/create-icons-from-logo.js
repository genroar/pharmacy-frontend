#!/usr/bin/env node

/**
 * Convert Zapeera logo to Electron app icons
 * Creates .ico (Windows), .icns (macOS), and .png (Linux) from existing logo
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
const logoPath = path.join(__dirname, '../public/images/logo.png');
const faviconPath = path.join(__dirname, '../public/images/favicon.png');

// Create icons directory
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('✅ Created icons directory:', iconsDir);
}

// Check if logo exists
if (!fs.existsSync(logoPath) && !fs.existsSync(faviconPath)) {
  console.log('⚠️  Warning: No logo.png or favicon.png found!');
  console.log('   Please add your Zapeera logo to:');
  console.log('   - public/images/logo.png (recommended: 512x512 or larger)');
  console.log('   - public/images/favicon.png (alternative)');
  console.log('');
  console.log('Then run this script again to convert to app icons.');
  process.exit(1);
}

const sourceImage = fs.existsSync(logoPath) ? logoPath : faviconPath;
console.log('📸 Found logo:', sourceImage);

// Instructions for manual icon creation
const instructions = `
# Zapeera Icon Setup Instructions

## Current Status
✅ Icons directory created: ${iconsDir}
📸 Source logo: ${sourceImage}

## Required Icon Files

You need to create these icon files from your Zapeera logo:

### 1. Windows (.ico file)
**File:** \`public/icons/icon.ico\`
**Sizes needed:** 16x16, 32x32, 48x48, 256x256 pixels
**How to create:**
- Option A: Use online converter
  - Go to: https://convertio.co/png-ico/ or https://www.icoconverter.com/
  - Upload your logo.png
  - Select multiple sizes (16, 32, 48, 256)
  - Download as icon.ico
  - Save to: public/icons/icon.ico

- Option B: Use ImageMagick (if installed)
  \`\`\`bash
  magick convert ${sourceImage} -define icon:auto-resize=256,128,64,48,32,16 public/icons/icon.ico
  \`\`\`

### 2. macOS (.icns file)
**File:** \`public/icons/icon.icns\`
**How to create:**
- Option A: Use macOS iconutil (on Mac)
  \`\`\`bash
  # Create iconset directory
  mkdir -p public/icons/icon.iconset

  # Create different sizes
  sips -z 16 16     ${sourceImage} --out public/icons/icon.iconset/icon_16x16.png
  sips -z 32 32     ${sourceImage} --out public/icons/icon.iconset/icon_16x16@2x.png
  sips -z 32 32     ${sourceImage} --out public/icons/icon.iconset/icon_32x32.png
  sips -z 64 64     ${sourceImage} --out public/icons/icon.iconset/icon_32x32@2x.png
  sips -z 128 128   ${sourceImage} --out public/icons/icon.iconset/icon_128x128.png
  sips -z 256 256   ${sourceImage} --out public/icons/icon.iconset/icon_128x128@2x.png
  sips -z 256 256   ${sourceImage} --out public/icons/icon.iconset/icon_256x256.png
  sips -z 512 512   ${sourceImage} --out public/icons/icon.iconset/icon_256x256@2x.png
  sips -z 512 512   ${sourceImage} --out public/icons/icon.iconset/icon_512x512.png
  sips -z 1024 1024 ${sourceImage} --out public/icons/icon.iconset/icon_512x512@2x.png

  # Convert to .icns
  iconutil -c icns public/icons/icon.iconset -o public/icons/icon.icns

  # Clean up
  rm -rf public/icons/icon.iconset
  \`\`\`

- Option B: Use online converter
  - Go to: https://cloudconvert.com/png-to-icns
  - Upload logo.png
  - Download icon.icns
  - Save to: public/icons/icon.icns

### 3. Linux (.png file)
**File:** \`public/icons/icon.png\`
**Size:** 512x512 pixels (recommended)
**How to create:**
\`\`\`bash
# Copy and resize logo
cp ${sourceImage} public/icons/icon.png

# Or resize to 512x512 if needed
sips -z 512 512 ${sourceImage} --out public/icons/icon.png
\`\`\`

## After Creating Icons

Once you have all three icon files:
1. ✅ icon.ico (Windows)
2. ✅ icon.icns (macOS)
3. ✅ icon.png (Linux)

 utilitiesRebuild the executable:
\`\`\`bash
npm run electron:build:win:x64
\`\`\`

The Zapeera logo will now appear as the app icon! 🎉

## Quick Copy Command

If you want to use the existing logo/favicon as Linux icon:
\`\`\`bash
cp ${sourceImage} public/icons/icon.png
\`\`\`
`;

// Write instructions
fs.writeFileSync(path.join(iconsDir, 'ICON_SETUP.md'), instructions);

// Copy logo as Linux icon (if it's PNG)
if (sourceImage.endsWith('.png')) {
  const linuxIconPath = path.join(iconsDir, 'icon.png');
  fs.copyFileSync(sourceImage, linuxIconPath);
  console.log('✅ Copied logo as Linux icon (icon.png)');
}

console.log('');
console.log('📋 Next steps:');
console.log('1. Read: public/icons/ICON_SETUP.md');
console.log('2. Create icon.ico (Windows) and icon.icns (macOS)');
console.log('3. Run: npm run electron:build:win:x64 to rebuild');
console.log('');
console.log('💡 Tip: The Linux icon (icon.png) has been created automatically!');
