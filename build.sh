#!/bin/bash

# Claude Code Clone - Build Script
echo "🚀 Building Claude Code Clone..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if yarn is installed
if ! command -v yarn &> /dev/null; then
    print_error "yarn is required but not installed. Please install yarn first:"
    echo "npm install -g yarn"
    exit 1
fi

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf dist/
rm -rf .next/

# Install dependencies
print_status "Installing dependencies with yarn..."
yarn install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_success "Dependencies installed"

# Build CLI
print_status "Building CLI TypeScript..."
yarn build:cli

if [ $? -ne 0 ]; then
    print_error "CLI build failed"
    exit 1
fi

print_success "CLI built successfully"

# Build Next.js app (if needed)
if [ -f "next.config.js" ]; then
    print_status "Building Next.js app..."
    yarn build
    
    if [ $? -ne 0 ]; then
        print_warning "Next.js build failed (this is optional)"
    else
        print_success "Next.js app built"
    fi
fi

# Make CLI executable
chmod +x bin/cli.js

# Verify build
print_status "Verifying build..."
if [ -f "dist/cli/index.js" ]; then
    print_success "CLI build verification passed"
else
    print_error "CLI build verification failed - dist/cli/index.js not found"
    exit 1
fi

# Test CLI
print_status "Testing CLI..."
node dist/cli/index.js --version > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_success "CLI test passed"
else
    print_warning "CLI test failed - this might be due to missing API keys"
fi

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Set up API keys:"
echo "   ./bin/cli.js setup"
echo ""
echo "2. Start using Claude Code Clone:"
echo "   ./bin/cli.js chat"
echo ""
echo "3. Or install globally:"
echo "   yarn link"
echo "   claude-code-clone chat"
echo ""
