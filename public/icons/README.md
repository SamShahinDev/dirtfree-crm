# PWA Icons

This directory contains the icon files for the Progressive Web App.

## Required Files

- `icon-192x192.png` - Standard app icon (192x192px)
- `icon-512x512.png` - Large app icon (512x512px)
- `icon-512x512-maskable.png` - Maskable icon for adaptive icons (512x512px)

## Source Files

SVG source files are provided:
- `icon-192x192.svg`
- `icon-512x512.svg`
- `icon-512x512-maskable.svg`

## Converting SVG to PNG

### Option 1: Using Sharp (Recommended)
```bash
npm install sharp
node scripts/convert-icons.js
```

### Option 2: Online Converters
- [Convertio](https://convertio.co/svg-png/)
- [CloudConvert](https://cloudconvert.com/svg-to-png)

### Option 3: Design Tools
- Open SVG files in Figma, Sketch, or Adobe Illustrator
- Export as PNG with the correct dimensions

## Icon Guidelines

- **Standard Icons**: Use rounded corners (12-24px radius)
- **Maskable Icons**: Keep important content within 80% safe zone
- **Colors**: Use brand primary #3060A0 with white text/elements
- **Format**: PNG with transparent background (except maskable)

## Testing

After creating PNG files, test the PWA manifest at:
- Chrome DevTools > Application > Manifest
- [Web App Manifest Validator](https://manifest-validator.appspot.com/)