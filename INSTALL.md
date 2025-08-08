# 📦 Installation Guide - Claude Code Clone

This guide provides step-by-step installation instructions for Claude Code Clone.

## 🚀 Quick Install (Recommended)

### **One-Line Setup**
```bash
git clone <repo-url>
cd claude-code-clone
chmod +x setup.sh && ./setup.sh
```

This automated script will:
- ✅ Check all prerequisites
- ✅ Install dependencies with Yarn
- ✅ Build the TypeScript project
- ✅ Set up API keys interactively  
- ✅ Install globally (optional)
- ✅ Create desktop shortcuts (optional)

## 🔧 Manual Installation

### **Step 1: Prerequisites**

#### **Required:**
- **Node.js 16+** - [Download from nodejs.org](https://nodejs.org/)
- **Yarn** - Package manager (auto-installed if missing)

#### **Check Prerequisites:**
```bash
node --version    # Should be v16+ 
yarn --version    # Will be installed if missing
```

### **Step 2: Clone & Install**

```bash
# Clone the repository
git clone <repo-url>
cd claude-code-clone

# Install dependencies
yarn install

# Build the CLI
yarn build:cli
```

### **Step 3: Make Scripts Executable**

**On macOS/Linux:**
```bash
chmod +x setup.sh
chmod +x build.sh  
chmod +x bin/cli.js
chmod +x test-system.js
```

**On Windows:**
```powershell
# No chmod needed, scripts work with node directly
node bin/cli.js --version
```

### **Step 4: Set Up API Keys**

#### **Option A: Interactive Setup (Recommended)**
```bash
./bin/cli.js setup

# Or if globally installed:
claude-code-clone setup
```

#### **Option B: Manual API Key Setup**
```bash
# OpenAI
./bin/cli.js key gpt-4 "sk-your-openai-api-key"

# Anthropic Claude  
./bin/cli.js key claude-3-5-sonnet "sk-ant-your-anthropic-key"

# Google Gemini
./bin/cli.js key gemini-pro "your-google-api-key"
```

#### **Option C: Environment Variables**
```bash
# Add to your ~/.bashrc or ~/.zshrc
export OPENAI_API_KEY="sk-your-openai-key"
export ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
export GOOGLE_API_KEY="your-google-api-key"
```

### **Step 5: Test Installation**

```bash
# Run system tests
node test-system.js

# Test CLI functionality  
./bin/cli.js --version
./bin/cli.js --help
./bin/cli.js models

# Quick test chat (requires API key)
./bin/cli.js chat
> Hello!
```

## 🌐 Global Installation

### **Option 1: Yarn Link (Recommended)**
```bash
# From the project directory
yarn link

# Now use from anywhere:
claude-code-clone chat
claude-code-clone agents
```

### **Option 2: npm Link**
```bash
npm link

# Use globally
claude-code-clone --help
```

### **Option 3: Add to PATH**
```bash
# Add to your ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/claude-code-clone/bin"

# Reload shell
source ~/.bashrc  # or ~/.zshrc

# Use directly
cli.js chat
```

## 🖥️ Platform-Specific Instructions

### **macOS**

#### **Using Homebrew (if you create a formula):**
```bash
# If you publish to Homebrew
brew tap your-username/claude-code-clone
brew install claude-code-clone
```

#### **Manual Installation:**
```bash
git clone <repo-url>
cd claude-code-clone
chmod +x setup.sh
./setup.sh
```

#### **Desktop Shortcut:**
The setup script can create a `.command` file on your Desktop for easy access.

### **Linux (Ubuntu/Debian)**

#### **Install Dependencies:**
```bash
# Update package list
sudo apt update

# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Yarn
npm install -g yarn
```

#### **Install Claude Code Clone:**
```bash
git clone <repo-url>
cd claude-code-clone
chmod +x setup.sh
./setup.sh
```

### **Windows**

#### **Using Git Bash (Recommended):**
```bash
# Install Node.js from nodejs.org first
# Then use Git Bash terminal:

git clone <repo-url>
cd claude-code-clone
yarn install
yarn build:cli
node bin/cli.js setup
```

#### **Using PowerShell:**
```powershell
# Clone repository
git clone <repo-url>
cd claude-code-clone

# Install and build
yarn install
yarn build:cli

# Setup (interactive)
node bin/cli.js setup

# Create alias (optional)
Set-Alias claude-code-clone "node $PWD/bin/cli.js"
```

#### **Windows Desktop Shortcut:**
1. Right-click on Desktop → New → Shortcut
2. Target: `node "C:\path\to\claude-code-clone\bin\cli.js" chat`
3. Name: `Claude Code Clone`

### **Docker Installation**

#### **Using Docker:**
```bash
# Build Docker image
docker build -t claude-code-clone .

# Run container
docker run -it --rm \
  -v $(pwd):/workspace \
  -e OPENAI_API_KEY="your-key" \
  claude-code-clone chat
```

## 🔑 API Keys Setup Guide

### **Getting API Keys**

#### **1. OpenAI (GPT-4, GPT-3.5)**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up/login and go to API Keys
3. Create new API key (starts with `sk-`)
4. Copy the key and set it up:
   ```bash
   claude-code-clone key gpt-4 "sk-your-key-here"
   ```

#### **2. Anthropic (Claude)**  
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up and navigate to API Keys
3. Create new key (starts with `sk-ant-`)
4. Set it up:
   ```bash
   claude-code-clone key claude-3-5-sonnet "sk-ant-your-key"
   ```

#### **3. Google (Gemini)**
1. Go to [ai.google.dev](https://ai.google.dev)
2. Get API key from Google AI Studio
3. Set it up:
   ```bash
   claude-code-clone key gemini-pro "your-google-key"
   ```

### **Verify API Keys**
```bash
# Check configuration
claude-code-clone config

# Test with simple chat
claude-code-clone chat
> Hello, can you help me code?
```

## 🧪 Troubleshooting Installation

### **Common Issues**

#### **"Node.js version too old"**
```bash
# Update Node.js to 16+
# macOS with Homebrew:
brew install node

# Linux:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows: Download from nodejs.org
```

#### **"Yarn command not found"**
```bash
# Install Yarn globally
npm install -g yarn

# Or use npm instead (less preferred):
npm install
npm run build:cli
```

#### **"Permission denied" on scripts**
```bash
# Make scripts executable
chmod +x setup.sh build.sh bin/cli.js test-system.js

# Or run with node directly:
node bin/cli.js --help
```

#### **"TypeScript compilation failed"**
```bash
# Check TypeScript version
npx tsc --version

# Clean and rebuild
rm -rf dist/
yarn build:cli

# If still failing, check tsconfig.cli.json
```

#### **"API key not found" error**
```bash
# Interactive setup
claude-code-clone setup

# Manual check
claude-code-clone config

# Environment variables
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
```

#### **"Agent not found" error**
```bash
# Check available agents
claude-code-clone agents

# Use correct names:
# ✅ full-stack-developer
# ❌ fullstack-developer
```

### **Testing Your Installation**

#### **System Test:**
```bash
# Comprehensive test
node test-system.js

# Expected output:
# ✅ Passed: 15
# ❌ Failed: 0  
# ⚠️ Warnings: 2
# Overall: 88% passed
```

#### **Functionality Test:**
```bash
# Quick functionality check
claude-code-clone --version     # Should show v2.0.0
claude-code-clone models        # Should list models
claude-code-clone agents        # Should list 6 agents
claude-code-clone chat          # Should start chat (needs API key)
```

## 📱 Advanced Setup Options

### **Development Setup**
```bash
# Clone for development
git clone <repo-url>
cd claude-code-clone

# Install with dev dependencies
yarn install

# Development mode (uses ts-node)
yarn cli chat

# Build and test
yarn build:cli
yarn test:system
yarn test
```

### **CI/CD Setup**
```bash
# For automated deployment
yarn install --frozen-lockfile
yarn build:cli
yarn test:system
yarn validate
```

### **Custom Configuration**
```bash
# Edit configuration directly
~/.config/claude-code-clone/config.json

# Or use CLI
claude-code-clone config
```

## 🎉 Post-Installation

### **Verify Everything Works:**
```bash
# 1. Check version
claude-code-clone --version

# 2. Check configuration  
claude-code-clone config

# 3. List agents
claude-code-clone agents

# 4. Start first chat
claude-code-clone chat
> @react-expert Create a hello world component

# 5. Try auto mode
claude-code-clone chat  
> /auto Create a simple React app
```

### **Next Steps:**
1. 📚 Read [EXAMPLES.md](EXAMPLES.md) for usage examples
2. 🤖 Try different agents with various tasks
3. ⚙️ Customize configuration as needed
4. 🔄 Set up regular updates: `git pull && yarn build:cli`

---

## ✅ Installation Complete!

**You're now ready to experience terminal velocity development!**

```bash
claude-code-clone chat
> /auto Create something amazing!
```

For support, check the [README.md](README.md) or create an issue on GitHub.
