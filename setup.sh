#!/bin/bash

# Claude Code Clone - Setup Script
echo "🚀 Claude Code Clone Setup"
echo "=========================="

# Colors for output  
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "\n📋 Checking Prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        echo "Please install Node.js 16+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
    
    if [ $NODE_MAJOR -lt 16 ]; then
        print_error "Node.js 16+ is required (found v$NODE_VERSION)"
        exit 1
    fi
    
    print_success "Node.js v$NODE_VERSION ✓"
    
    # Check yarn
    if ! command -v yarn &> /dev/null; then
        print_warning "yarn not found, installing..."
        npm install -g yarn
        
        if [ $? -ne 0 ]; then
            print_error "Failed to install yarn"
            exit 1
        fi
    fi
    
    YARN_VERSION=$(yarn --version)
    print_success "yarn v$YARN_VERSION ✓"
    
    # Check TypeScript
    if ! command -v tsc &> /dev/null; then
        print_warning "TypeScript not found globally, will use local version"
    else
        TS_VERSION=$(tsc --version | cut -d' ' -f2)
        print_success "TypeScript v$TS_VERSION ✓"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "\n📦 Installing Dependencies..."
    
    yarn install
    
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    
    print_success "Dependencies installed"
}

# Build project
build_project() {
    print_header "\n🔨 Building Project..."
    
    # Make build script executable
    chmod +x build.sh
    
    # Run build script
    ./build.sh
    
    if [ $? -ne 0 ]; then
        print_error "Build failed"
        exit 1
    fi
    
    print_success "Project built successfully"
}

# Setup API keys interactively
setup_api_keys() {
    print_header "\n🔑 API Keys Setup"
    echo "Claude Code Clone supports multiple AI providers:"
    echo "1. OpenAI (GPT-4, GPT-3.5)"  
    echo "2. Anthropic (Claude)"
    echo "3. Google (Gemini)"
    echo ""
    echo "You need at least one API key to use the CLI."
    echo ""
    
    read -p "Would you like to set up API keys now? (y/N): " setup_keys
    
    if [[ $setup_keys =~ ^[Yy]$ ]]; then
        # Use the built CLI for interactive setup
        if [ -f "dist/cli/index.js" ]; then
            node dist/cli/index.js setup
        else
            print_error "CLI not built yet. Please run build first."
        fi
    else
        print_warning "API keys not configured. You can set them later using:"
        echo "  claude-code-clone setup"
        echo "  or"
        echo "  claude-code-clone key <model> <api-key>"
    fi
}

# Create symlink for global usage
setup_global_access() {
    print_header "\n🌐 Global Access Setup"
    
    read -p "Would you like to install Claude Code Clone globally? (y/N): " install_global
    
    if [[ $install_global =~ ^[Yy]$ ]]; then
        # Link the package globally
        yarn link
        
        if [ $? -eq 0 ]; then
            print_success "Claude Code Clone installed globally"
            print_status "You can now use 'claude-code-clone' from anywhere"
        else
            print_warning "Global installation failed. You can still use ./bin/cli.js"
        fi
    else
        print_status "You can use Claude Code Clone with: ./bin/cli.js"
        print_status "To install globally later: yarn link"
    fi
}

# Create desktop shortcut (macOS/Linux)
create_shortcut() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        print_header "\n🖥️  Desktop Shortcut (macOS)"
        read -p "Create a desktop shortcut? (y/N): " create_mac_shortcut
        
        if [[ $create_mac_shortcut =~ ^[Yy]$ ]]; then
            SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            
            cat > ~/Desktop/Claude\ Code\ Clone.command << EOF
#!/bin/bash
cd "$SCRIPT_DIR"
./bin/cli.js chat
EOF
            
            chmod +x ~/Desktop/Claude\ Code\ Clone.command
            print_success "Desktop shortcut created"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        print_header "\n🖥️  Desktop Shortcut (Linux)"
        read -p "Create a desktop shortcut? (y/N): " create_linux_shortcut
        
        if [[ $create_linux_shortcut =~ ^[Yy]$ ]]; then
            SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            
            cat > ~/Desktop/claude-code-clone.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Claude Code Clone
Comment=Autonomous AI Developer Assistant
Exec=gnome-terminal --working-directory="$SCRIPT_DIR" -- ./bin/cli.js chat
Icon=utilities-terminal
Terminal=false
Categories=Development;
EOF
            
            chmod +x ~/Desktop/claude-code-clone.desktop
            print_success "Desktop shortcut created"
        fi
    fi
}

# Show completion message
show_completion() {
    print_header "\n🎉 Setup Complete!"
    echo ""
    echo -e "${GREEN}Claude Code Clone is ready to use!${NC}"
    echo ""
    echo "📚 Quick Start:"
    echo "  Start chatting:    claude-code-clone chat"
    echo "  Show help:         claude-code-clone --help"
    echo "  List agents:       claude-code-clone agents"
    echo "  Analyze project:   claude-code-clone analyze"
    echo ""
    echo "💡 Examples:"
    echo '  claude-code-clone create "React todo app with TypeScript"'
    echo '  claude-code-clone chat'
    echo "  > @react-expert Build a dashboard component"
    echo "  > /auto Set up CI/CD with GitHub Actions"
    echo ""
    echo "🔧 Configuration:"
    echo "  Config file: ~/.config/claude-code-clone/config.json"
    echo "  Edit config: claude-code-clone config"
    echo "  Set API key:  claude-code-clone key <model> <key>"
    echo ""
    echo -e "${BLUE}Happy coding! 🚀${NC}"
}

# Main setup flow
main() {
    echo "This will set up Claude Code Clone on your system."
    echo ""
    
    check_prerequisites
    install_dependencies  
    build_project
    setup_api_keys
    setup_global_access
    create_shortcut
    show_completion
}

# Run main function
main "$@"
