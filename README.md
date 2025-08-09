# 🚀 Claude Code Clone

**Autonomous AI Developer Assistant with Terminal Velocity**

A powerful CLI tool that brings Claude Code's functionality to your terminal with multi-agent support, real-time streaming, and seamless file operations.

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-4.0+-green)](https://sdk.vercel.ai/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## ✨ Features

### 🧠 **Multi-Agent AI System**

- **6 Specialized Agents**: Full-stack developer, React expert, Backend engineer, DevOps specialist, Testing expert, Code reviewer
- **Smart Agent Selection**: Automatically suggests the best agent for your task
- **Agent Mode**: Switch to specific agents for focused assistance
- **Execution History**: Track all agent activities and performance

### 🛠️ **Real-Time Tool Integration**

- **File Operations**: Read, write, create files seamlessly during conversation
- **Command Execution**: Run terminal commands with proper confirmation
- **Workspace Analysis**: Automatic project structure detection and analysis
- **Live Streaming**: Real-time response streaming with tool execution feedback

### 🤖 **Multi-Model Support**

- **OpenAI**: GPT-4, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku
- **Google**: Gemini Pro, Gemini 1.5 Flash
- **Easy Switching**: Change models on-the-fly
- **API Key Management**: Secure key storage and management

### 💻 **Developer Experience**

- **Modern UI**: Beautiful terminal interface with colors and formatting
- **Context Awareness**: Automatic workspace understanding
- **TypeScript First**: Full TypeScript support with proper types
- **npm Integration**: Uses npm for all package management
- **Configuration**: Flexible configuration system

## 🚀 Quick Start

### **One-Line Setup**

```bash
git clone https://github.com/nikomatt69/agent-cli
cd agent-cli
npm install && npm run build
```

This will:

1. ✅ Check prerequisites (Node.js 18+, npm)
2. ✅ Install dependencies
3. ✅ Build the project
4. ✅ Setup API keys interactively
5. ✅ Install globally (optional)

### **Manual Setup**

```bash
# Clone the repository
git clone https://github.com/nikomatt69/agent-cli
cd agent-cli

# Install dependencies
npm install

# Build the project
npm run build

# Start chatting!
./bin/nikcli
```

## 🎯 Usage Examples

### **Basic Chat Mode**

```bash
# Start interactive chat
nikcli

# Or directly from the repo
./bin/nikcli
```

### **Agent-Specific Tasks**

```bash
# Use specific agents with @
> @react-expert Create a dashboard with charts
> @backend-engineer Add JWT authentication
> @devops-engineer Set up Docker containers
> @testing-specialist Add comprehensive tests
```

### **Auto Mode - Smart Agent Selection**

```bash
# Let AI choose the best agent
> /auto Create a full-stack todo app with React and Node.js
> /auto Optimize this app for production deployment
> /auto Fix all TypeScript errors in this project
```

### **Direct Commands**

```bash
# Quick file operations
nikcli read package.json
nikcli analyze ./src
nikcli create "React component for user profile"

# Model management
nikcli models
nikcli model claude-3-5-sonnet
nikcli key gpt-4 sk-your-openai-key
```

### **Agent Mode**

```bash
# Switch to agent mode
> /use react-expert
✓ Switched to react-expert agent mode

# All subsequent messages go to the React expert
> Build a responsive navigation component
> Add dark mode support
> Optimize performance with React.memo

# Exit agent mode
> /exit-agent
```

## 🤖 Available Agents

| Agent                    | Specialization                  | Best For                                             |
| ------------------------ | ------------------------------- | ---------------------------------------------------- |
| **full-stack-developer** | Complete full-stack development | Building entire applications, complex features       |
| **react-expert**         | React/Next.js specialist        | UI components, frontend optimization, React patterns |
| **backend-engineer**     | API & database expert           | REST APIs, authentication, database design           |
| **devops-engineer**      | Docker, CI/CD, deployment       | Infrastructure, automation, production setup         |
| **testing-specialist**   | Comprehensive testing           | Unit tests, integration tests, test automation       |
| **code-reviewer**        | Code analysis & review          | Code quality, security review, optimization          |

## 📚 Commands Reference

### **Chat Commands**

```bash
/help                    # Show all commands
/agents                  # List available agents
/use <agent>            # Switch to agent mode
/auto <task>            # Auto-select best agent
@<agent> <task>         # Run task with specific agent
/exit-agent             # Exit agent mode
/history                # Show agent execution history
/clear                  # Clear chat history
```

### **Navigation Commands**

```bash
/cd <directory>         # Change working directory
/pwd                    # Show current directory
/ls                     # List current directory
```

### **Configuration Commands**

```bash
/model [name]           # Show/switch AI model
/config                 # Show current configuration
/exit                   # Exit application
```

### **CLI Commands**

```bash
nikcli setup               # Interactive setup
nikcli chat                # Start chat mode
nikcli agents              # List agents
nikcli models              # List models
nikcli config              # Show configuration
nikcli key <model> <key>   # Set API key
nikcli read <file>         # Read file
nikcli analyze [path]      # Analyze project
nikcli create <description> # Create files/components
```

## ⚙️ Configuration

### **API Keys**

```bash
# Interactive setup
nikcli setup

# Manual key setting
nikcli key gpt-4 sk-your-openai-key
nikcli key claude-3-5-sonnet sk-ant-your-claude-key
nikcli key gemini-pro your-google-api-key
```

### **Environment Variables**

```bash
# Alternative to CLI key setting
export OPENAI_API_KEY="sk-your-openai-key"
export ANTHROPIC_API_KEY="sk-ant-your-claude-key"
export GOOGLE_API_KEY="your-google-api-key"
```

### **Configuration File**

Located at: `~/.config/nikcli/config.json`

```json
{
  "currentModel": "claude-3-5-sonnet",
  "temperature": 0.7,
  "maxTokens": 4000,
  "chatHistory": true,
  "maxHistoryLength": 100,
  "autoAnalyzeWorkspace": true,
  "preferredAgent": "full-stack-developer"
}
```

## 🔧 Development

### **Prerequisites**

- Node.js 16+
- Yarn package manager
- TypeScript 5.7+

### **Development Setup**

```bash
# Clone and setup
git clone <repo-url>
cd nikcli
yarn install

# Development mode
yarn cli chat

# Build for production
yarn build:cli

# Run tests
yarn test
```

### **Project Structure**

```
nikcli/
├── src/cli/                    # CLI source code
│   ├── ai/                     # AI providers and models
│   │   └── modern-ai-provider.ts
│   ├── agents/                 # Agent system
│   │   └── modern-agent-system.ts
│   ├── chat/                   # Chat interfaces
│   │   └── claude-code-interface.ts
│   ├── config/                 # Configuration management
│   │   └── config-manager.ts
│   └── index.ts               # Main entry point
├── bin/
│   └── cli.js                 # Binary entry point
├── dist/                      # Compiled TypeScript
├── setup.sh                   # Setup script
├── build.sh                   # Build script
└── package.json
```

### **Adding Custom Agents**

```typescript
// Add to src/cli/agents/modern-agent-system.ts
'my-custom-agent': {
  name: 'My Custom Agent',
  description: 'Specialized in custom tasks',
  systemPrompt: `You are a custom agent specialized in...`,
  examples: [
    'Example task 1',
    'Example task 2',
  ],
},
```

## 🎨 Examples

### **Full-Stack Development**

```bash
> /auto Create a Next.js blog with authentication

🎯 Auto Mode: Analyzing task and selecting best agent...
✨ Selected agent: full-stack-developer

🤖 Starting full-stack-developer agent...
Task: Create a Next.js blog with authentication

🔧 analyze_workspace...
✓ Complete

🔧 write_file...
✓ Created/updated: app/page.tsx
✓ Created/updated: app/layout.tsx
✓ Created/updated: components/Header.tsx
...
```

### **React Component Creation**

```bash
> @react-expert Build a responsive dashboard with charts

🤖 Starting react-expert agent...

🔧 read_file...
✓ Complete

🔧 write_file...
✓ Created/updated: components/Dashboard.tsx
✓ Created/updated: components/Chart.tsx
✓ Created/updated: hooks/useChartData.ts

✨ react-expert completed successfully!
```

### **DevOps Setup**

```bash
> @devops-engineer Set up Docker and CI/CD for this project

🤖 Starting devops-engineer agent...

🔧 write_file...
✓ Created/updated: Dockerfile
✓ Created/updated: docker-compose.yml
✓ Created/updated: .github/workflows/ci.yml

🔧 execute_command...
$ docker --version
Docker version 24.0.6, build ed223bc

✨ devops-engineer completed successfully!
```

## 🚀 Advanced Usage

### **Workflow Automation**

```bash
# Chain multiple agent tasks
> /auto Set up full development environment
> /auto Add user authentication system
> /auto Create admin dashboard
> /auto Set up testing suite
> /auto Configure production deployment
```

### **Project Analysis**

```bash
# Comprehensive project analysis
nikcli analyze

📁 Root Path: /Users/dev/my-project
🎯 Framework: Next.js
💻 Languages: typescript, javascript, css
📦 Dependencies: 45
🔧 Technologies: React, Next.js, TypeScript, Tailwind CSS

📋 Most Important Files:
1. app/page.tsx (typescript, importance: 95)
2. components/Layout.tsx (typescript, importance: 88)
3. lib/auth.ts (typescript, importance: 85)
```

### **Code Review Workflow**

```bash
> @code-reviewer Analyze this codebase for security issues

🤖 Starting code-reviewer agent...

🔧 analyze_workspace...
✓ Complete

🔧 read_file...
✓ Complete

Found 3 security concerns:
1. API keys in environment variables without validation
2. Missing input sanitization in user forms
3. Potential SQL injection in database queries

Recommendations:
- Add input validation with Zod schemas
- Use parameterized queries
- Implement rate limiting
...
```

## 🛠️ Troubleshooting

### **Common Issues**

#### **"No API key found" Error**

```bash
# Set up API keys
nikcli setup

# Or set manually
nikcli key claude-3-5-sonnet sk-ant-your-key
```

#### **TypeScript Build Errors**

```bash
# Clean and rebuild
rm -rf dist/
yarn build:cli
```

#### **Permission Denied on Scripts**

```bash
# Make scripts executable
chmod +x setup.sh build.sh
```

#### **Agent Not Found**

```bash
# List available agents
nikcli agents

# Use correct agent name
> @full-stack-developer (not @fullstack)
```

### **Debug Mode**

```bash
# Enable verbose logging
DEBUG=nikcli:* nikcli chat
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🙏 Acknowledgments

- **Vercel AI SDK** - Modern AI integration
- **OpenAI, Anthropic, Google** - AI model providers
- **Claude Code** - Original inspiration
- **TypeScript** - Type safety and developer experience
- **Yarn** - Package management

## 🚀 Roadmap

### **v2.1 - Enhanced Features**

- [ ] Multi-agent collaboration (agents working together)
- [ ] Visual workspace mapping
- [ ] Plugin system for custom tools
- [ ] Cloud project synchronization

### **v2.2 - Enterprise Features**

- [ ] Team management and sharing
- [ ] Advanced analytics and reporting
- [ ] Custom model fine-tuning
- [ ] Enterprise security features

### **v2.3 - Advanced AI**

- [ ] Vision integration (analyze screenshots)
- [ ] Voice interaction support
- [ ] Learning from user patterns
- [ ] Advanced code generation templates

---

**Built with ❤️ for autonomous development**

_Transform your development workflow with AI agents that understand your code, execute commands, and build applications at terminal velocity._
