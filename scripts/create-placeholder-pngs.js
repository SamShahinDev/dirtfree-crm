#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create minimal PNG placeholders using base64
// These are 1x1 pixel PNGs that browsers will scale - not ideal but functional for testing

const minimalPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const iconsDir = path.join(process.cwd(), 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create placeholder PNG files
const icons = [
  'icon-192x192.png',
  'icon-512x512.png',
  'icon-512x512-maskable.png'
];

icons.forEach(icon => {
  const iconPath = path.join(iconsDir, icon);
  if (!fs.existsSync(iconPath)) {
    fs.writeFileSync(iconPath, minimalPNG);
    console.log(`Created placeholder: ${icon}`);
  } else {
    console.log(`Already exists: ${icon}`);
  }
});

console.log('\n⚠️  Note: These are minimal placeholders for testing.');
console.log('For production, convert the SVG files to proper PNG icons.');
console.log('See public/icons/README.md for instructions.');