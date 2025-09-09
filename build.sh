#!/bin/bash

# AP Statistics PoK Blockchain - Production Build Script
# Phase 6: Build, Package, and Deploy

echo "🔨 AP Stats Blockchain Builder"
echo "=============================="

# Step 1: Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist/ app.zip test-deploy/

# Step 2: Run TypeScript type checking (non-blocking)
echo "🔍 Checking TypeScript types..."
npm run typecheck || echo "⚠️  Type errors found (continuing anyway)"

# Step 3: Build with Parcel
echo "🏗️  Building production bundle..."
npx parcel build src/index.html --public-url ./ --no-source-maps --dist-dir dist

# Step 3b: Copy assets to dist
echo "📁 Copying assets to dist..."
cp -r assets dist/

# Step 4: Check build size
DIST_SIZE=$(du -sh dist | cut -f1)
echo "📏 Build size: $DIST_SIZE"

# Step 5: Create distribution package
echo "📦 Creating app.zip..."
zip -r app.zip dist/ assets/

# Step 6: Report package size
ZIP_SIZE=$(ls -lh app.zip | awk '{print $5}')
echo "✅ Package created: app.zip ($ZIP_SIZE)"

# Step 7: Create test deployment
echo "🧪 Creating test deployment..."
mkdir -p test-deploy
cd test-deploy
unzip -q ../app.zip
echo "📂 Test deployment ready at: test-deploy/dist/index.html"
cd ..

# Step 8: Final summary
echo ""
echo "==================================="
echo "✨ Build Complete!"
echo "==================================="
echo "📦 Distribution: app.zip ($ZIP_SIZE)"
echo "📂 Test locally: open test-deploy/dist/index.html"
echo ""
echo "Deployment steps:"
echo "1. Transfer app.zip to target device"
echo "2. Unzip to desired location"
echo "3. Open dist/index.html in browser"
echo ""
echo "Testing checklist:"
echo "☐ Profile creation with seed phrase"
echo "☐ Question loading from assets/"
echo "☐ MCQ and FRQ attestations"
echo "☐ QR code generation/scanning"
echo "☐ Blockchain sync between devices"
echo "☐ Reputation updates"