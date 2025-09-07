#!/bin/bash

echo "Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi

echo "Zipping dist/ and assets/ into app.zip..."
# Verify dist/ directory exists
if [ ! -d "dist/" ]; then
    echo "Error: dist/ directory not found. Build may have failed."
    exit 1
fi

# Remove existing app.zip if it exists
if [ -f "app.zip" ]; then
    rm app.zip
fi

# Create zip file containing dist/ and assets/
zip -rq app.zip dist/ assets/

if [ $? -ne 0 ]; then
    echo "Failed to create zip file. Exiting."
    exit 1
fi

echo "Opening dist/index.html for testing..."
# Verify dist/index.html exists before attempting to open
if [ ! -f "dist/index.html" ]; then
    echo "Error: dist/index.html not found. Build may have failed."
    exit 1
fi

# Enhanced cross-platform support including WSL
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start dist/index.html 2>/dev/null || echo "Please manually open dist/index.html in your browser"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open dist/index.html 2>/dev/null || echo "Please manually open dist/index.html in your browser"
elif [[ -n "$WSL_DISTRO_NAME" ]] || [[ -d "/mnt/c" ]]; then
    # WSL environment - try multiple methods
    if command -v wslview >/dev/null 2>&1; then
        wslview dist/index.html 2>/dev/null || echo "Please manually open dist/index.html in your browser"
    elif command -v cmd.exe >/dev/null 2>&1; then
        cmd.exe /c start "" "$(wslpath -w "$(pwd)/dist/index.html")" 2>/dev/null || echo "Please manually open dist/index.html in your browser"
    else
        echo "Please manually open dist/index.html in your browser"
    fi
else
    xdg-open dist/index.html 2>/dev/null || echo "Please manually open dist/index.html in your browser"
fi

echo "Build script completed successfully!"
echo "app.zip created with dist/ and assets/"
echo "dist/index.html opened for testing"
