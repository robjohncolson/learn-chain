#!/bin/bash

# AP Statistics PoK Blockchain - Clean Build Script
# Handles file locks and ensures fresh builds

echo "🧹 AP Stats Blockchain Clean Builder"
echo "====================================="

# Function to force remove with retries
force_remove() {
    local path=$1
    local attempts=3
    
    for i in $(seq 1 $attempts); do
        echo "  Attempt $i: Removing $path..."
        
        # Try different methods
        rm -rf "$path" 2>/dev/null && return 0
        
        # Windows-specific: try to unlock files
        if command -v cmd.exe &> /dev/null; then
            cmd.exe /c "rmdir /s /q $(wslpath -w "$path")" 2>/dev/null && return 0
            cmd.exe /c "del /f /q $(wslpath -w "$path")" 2>/dev/null && return 0
        fi
        
        # Wait a bit before retry
        sleep 1
    done
    
    echo "  ⚠️  Could not remove $path (may be locked)"
    return 1
}

# Step 0: Kill any running servers
echo "🛑 Stopping any running servers..."
# Kill any node processes serving the app
pkill -f "http-server" 2>/dev/null || true
pkill -f "python.*http.server" 2>/dev/null || true
pkill -f "parcel" 2>/dev/null || true

# Give processes time to release files
sleep 2

# Step 1: Aggressive clean
echo "🧹 Performing aggressive clean..."
force_remove "dist"
force_remove "test-deploy"
force_remove ".parcel-cache"
force_remove "app.zip"

# Create fresh directories
mkdir -p dist
mkdir -p test-deploy

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
# Remove old zip first
rm -f app.zip
zip -r app.zip dist/ assets/

# Step 6: Report package size
ZIP_SIZE=$(ls -lh app.zip | awk '{print $5}')
echo "✅ Package created: app.zip ($ZIP_SIZE)"

# Step 7: Create test deployment
echo "🧪 Creating test deployment..."
cd test-deploy
# Clean extract
rm -rf dist assets
unzip -q ../app.zip
echo "📂 Test deployment ready at: test-deploy/dist/index.html"
cd ..

# Step 8: Final summary
echo ""
echo "==================================="
echo "✨ Clean Build Complete!"
echo "==================================="
echo "📦 Distribution: app.zip ($ZIP_SIZE)"
echo "📂 Test locally: npm run serve"
echo ""
echo "🚀 To run the app:"
echo "   npm run serve"
echo "   Open: http://localhost:8080/dist/"
echo ""
echo "⚠️  Remember: Always stop servers (Ctrl+C) before rebuilding!"