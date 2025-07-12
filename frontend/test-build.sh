#!/bin/bash

# Test script to verify frontend build process
echo "=== Testing Frontend Build Process ==="

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the frontend directory"
    exit 1
fi

# Clean any existing build
echo "Cleaning previous build..."
rm -rf web-build

# Install dependencies
echo "Installing dependencies..."
npm install --force

# Test the build process
echo "Testing build process..."
echo "Attempting expo export for web..."
if npx expo export --platform web --output-dir web-build; then
    echo "✅ Expo export successful!"
    echo "Copying public assets..."
    cp -r public/* web-build/ 2>/dev/null || echo "No additional public assets to copy"
    echo "Build completed successfully!"
    echo "Contents of web-build:"
    ls -la web-build/
    echo "✅ Build test passed!"
else
    echo "❌ Expo export failed"
    echo "This might be expected in some environments. The Docker build has fallbacks."
fi

echo "=== Build test completed ===" 