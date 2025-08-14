# NikCLI - Autonomous AI Development Assistant

**A production-ready autonomous AI development assistant that provides an intelligent command-line interface for software development.**

[![Version](https://img.shields.io/badge/version-0.1.4--beta-blue)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Overview

NikCLI combines conversational AI with autonomous code generation, file manipulation, and project management capabilities. The system features a unified entry point that orchestrates an entire ecosystem of specialized agents, services, and tools for comprehensive software development assistance.

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/nikomatt69/windsurf-project
cd windsurf-project

# Install dependencies
npm install

# Build the project
npm run build

# Start NikCLI
npm start
```

### Requirements

- **Node.js**: 18+ (enforced at startup)
- **Git**: For autonomous development features
- **API Keys**: At least one of:
  - `ANTHROPIC_API_KEY` - for Claude models (recommended)
  - `OPENAI_API_KEY` - for GPT models
  - `GOOGLE_GENERATIVE_AI_API_KEY` - for Gemini models
  - Or use local **Ollama** models without API keys

## 📋 Available NPM Scripts

| Command                  | Description                                 | Usage                           |
| ------------------------ | ------------------------------------------- | ------------------------------- |
| `npm start`              | Start NikCLI development mode (ts-node)     | Primary development command     |
| `npm run dev`            | Alias for `npm start`                       | Alternative start command       |
| `npm run build`          | Compile TypeScript to JavaScript in `dist/` | Required for production use     |
| `npm run build:start`    | Build and run compiled application          | Run compiled version            |
| `npm run build:binary`   | Create platform-specific binaries           | macOS ARM64, Intel, iOS targets |
| `npm test`               | Run Vitest tests interactively              | Interactive test runner         |
| `npm run test:run`       | Run all tests once                          | CI/CD test execution            |
| `npm run test:watch`     | Run tests in watch mode                     | Development test mode           |
| `npm run lint`           | Run ESLint for TypeScript linting           | Code quality checks             |
| `npm run prepublishOnly` | Build before publishing                     | Automated build hook            |

## 🎯 CLI Commands Reference

NikCLI provides an extensive set of commands organized into logical categories:

### Mode Control

| Command        | Description                                    |
| -------------- | ---------------------------------------------- |
| `/plan [task]` | Switch to plan mode or generate execution plan |
| `/auto [task]` | Switch to autonomous mode or execute task      |
| `/default`     | Switch to default conversational mode          |

### File Operations

| Command                   | Description                                |
| ------------------------- | ------------------------------------------ |
| `/read <file> [options]`  | Read file contents with pagination support |
| `/write <file> <content>` | Write content to file with approval        |
| `/edit <file>`            | Open file in system editor (code/open)     |
| `/ls [directory]`         | List files and directories                 |
| `/search <query> [dir]`   | Search text in files (grep functionality)  |

### Terminal Operations

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `/run <command>`      | Execute terminal command with approval |
| `/install <packages>` | Install npm/yarn packages              |
| `/npm <args>`         | Run npm commands                       |
| `/yarn <args>`        | Run yarn commands                      |
| `/git <args>`         | Run git commands                       |
| `/docker <args>`      | Run docker commands                    |
| `/ps`                 | List running processes                 |
| `/kill <pid>`         | Kill process by PID                    |

### Project Operations

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `/build`                | Build the current project       |
| `/test [pattern]`       | Run tests with optional pattern |
| `/lint`                 | Run project linting             |
| `/create <type> <name>` | Create new project or component |

### Agent Management

| Command                     | Description                     |
| --------------------------- | ------------------------------- |
| `/agents`                   | List all available agents       |
| `/agent <name> <task>`      | Run specific agent with task    |
| `/parallel <agents> <task>` | Run multiple agents in parallel |
| `/factory`                  | Show agent factory dashboard    |
| `/create-agent <spec>`      | Create new specialized agent    |
| `/launch-agent <id>`        | Launch agent from blueprint     |

### Session Management

| Command                           | Description                       |
| --------------------------------- | --------------------------------- |
| `/new [title]`                    | Start new chat session            |
| `/sessions`                       | List all chat sessions            |
| `/export [sessionId]`             | Export session to markdown        |
| `/stats`                          | Show usage statistics             |
| `/history <on\|off>`              | Enable/disable chat history       |
| `/debug`                          | Show debug information            |
| `/temp <0.0-2.0>`                 | Set AI temperature                |
| `/system <prompt>`                | Set system prompt for session     |
| `/tokens`                         | Show token usage and optimization |
| `/compact`                        | Force session compaction          |
| `/cache [stats\|clear\|settings]` | Manage token cache system         |

### Configuration

| Command                  | Description                 |
| ------------------------ | --------------------------- |
| `/models`                | List available AI models    |
| `/model <name>`          | Switch to specific AI model |
| `/set-key <model> <key>` | Set API key for model       |
| `/config`                | Show current configuration  |

### MCP (Model Context Protocol)

| Command                             | Description                 |
| ----------------------------------- | --------------------------- |
| `/mcp servers`                      | List configured MCP servers |
| `/mcp test <server>`                | Test MCP server connection  |
| `/mcp call <server> <method>`       | Make MCP call               |
| `/mcp add <name> <type> <endpoint>` | Add new MCP server          |
| `/mcp remove <name>`                | Remove MCP server           |
| `/mcp health`                       | Check all server health     |

### Advanced Features

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `/context [paths]` | Manage workspace context paths     |
| `/stream [clear]`  | Show/clear agent execution streams |
| `/approval [test]` | Approval system controls           |
| `/todo [command]`  | Todo list operations               |
| `/todos`           | Show todo lists                    |

### Basic Commands

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `/init [--force]` | Initialize project context       |
| `/status`         | Show system status and health    |
| `/clear`          | Clear current session context    |
| `/help`           | Show complete help documentation |
| `/exit`           | Exit NikCLI application          |

## 🏗️ Architecture Overview

### Key Architectural Principles

**Unified Entry Point**: All functionality flows through `src/cli/index.ts` which orchestrates system startup, initialization, and user interface.

**Service-Oriented Architecture**: Core functionality is organized into modular services:

- **Agent Service** - Manages AI agent lifecycle and execution
- **Tool Service** - Handles file operations, command execution, and project analysis
- **Planning Service** - Autonomous task planning and decomposition
- **LSP Service** - Language Server Protocol integration for enhanced code intelligence
- **Orchestrator Service** - Coordinates multi-agent collaboration

**Stream-Based Processing**: Real-time message processing with queued execution and progress tracking for responsive user experience.

### Core System Components

#### Main Orchestrator (`src/cli/index.ts`)

- Unified entry point handling system initialization and requirements checking
- Modular design with separate classes for Introduction, System checks, Service initialization
- Comprehensive error handling and graceful shutdown procedures
- Interactive setup for API keys and Ollama model configuration

#### Agent Architecture (`src/cli/automation/agents/`)

- **UniversalAgent** - Single comprehensive agent with full-stack development capabilities
- **BaseAgent** - Abstract base class defining agent interface and lifecycle
- **AgentManager** - Central registry for agent classes and instance management
- **Specialized Agents**: React, Backend, DevOps, Frontend, Autonomous Coder agents for domain-specific tasks

#### Service Layer (`src/cli/services/`)

- `agent-service.ts` - Agent lifecycle, task distribution, and progress tracking
- `tool-service.ts` - File system operations, command execution, project analysis
- `planning-service.ts` - Autonomous task planning and breakdown
- `lsp-service.ts` - Language server integration for code intelligence
- `orchestrator-service.ts` - Multi-agent coordination and workflow management

#### Tool System (`src/cli/tools/`)

- Secure tool registry with permission-based execution
- File operations: read, write, edit, search, multi-edit capabilities
- Command execution: bash, npm, git operations with security policies
- Project analysis: dependency detection, structure analysis, technology identification

#### Chat Interface (`src/cli/nik-cli.ts`)

- Main conversational interface with readline integration
- Stream-based message processing with real-time feedback
- Command completion, history, and interactive help system
- Support for natural language commands and agent-specific targeting

## 🤖 Agent System

### Universal Agent (Primary)

The system uses a unified **UniversalAgent** approach with comprehensive capabilities:

**Capabilities:**

- Code generation, analysis, review, optimization, debugging, refactoring, testing
- Frontend: React, Next.js, TypeScript, JavaScript, HTML, CSS, components, hooks
- Backend: Node.js, API development, databases, server architecture, REST, GraphQL
- DevOps: CI/CD, Docker, Kubernetes, deployment, infrastructure, monitoring
- Autonomous: File operations, project creation, system administration
- Analysis: Performance, security, quality assessment, architecture review

**Configuration:**

- Fully autonomous operation (no guidance required)
- Maximum 3 concurrent tasks
- 5-minute timeout per task
- Retry policy with exponential backoff
- Full file system access with security restrictions
- Command execution with allowlist/blocklist policies

### Agent Registration

All agents are registered in `src/cli/register-agents.ts` with:

- Comprehensive permission systems
- Configurable security policies
- Retry logic and timeout handling
- Error recovery mechanisms

## 🛠️ Technology Stack

### AI Model Support

- **Primary**: Anthropic Claude via `@ai-sdk/anthropic`
- **Secondary**: OpenAI GPT via `@ai-sdk/openai`
- **Tertiary**: Google Gemini via `@ai-sdk/google`
- **Local**: Ollama support for offline models
- Unified AI SDK abstraction for consistent model switching

### Development Tools

- **TypeScript** with strict compilation settings
- **Vitest** for comprehensive testing (80% coverage thresholds)
- **ESLint** for code quality enforcement
- **Path aliases** for clean imports (`@cli/*`, `@agents/*`, etc.)

### Terminal Interface

- **Chalk** for colored output and visual hierarchy
- **Boxen** for structured information display
- **Readline** for interactive input with completion and history
- Raw keyboard mode for advanced shortcuts (/ for commands, Shift+Tab for modes)

## 📁 Project Structure

```
src/cli/
├── index.ts              # Main entry point and orchestrator
├── nik-cli.ts           # Core CLI interface implementation
├── automation/          # Agent system and workflow orchestration
│   └── agents/         # All agent classes and management
├── services/           # Core service implementations
├── tools/              # File and command execution tools
├── chat/               # Interactive chat interface components
├── context/            # Memory and workspace management
├── ui/                 # Terminal UI components
├── core/               # Configuration and type definitions
├── planning/           # Autonomous planning system
├── lsp/                # Language server integration
├── policies/           # Security and execution policies
└── utils/              # Shared utilities and helpers
```

## ⚙️ Configuration

### Environment Variables

| Variable                       | Description                                   | Required        |
| ------------------------------ | --------------------------------------------- | --------------- |
| `ANTHROPIC_API_KEY`            | Claude models API key                         | One of these    |
| `OPENAI_API_KEY`               | GPT models API key                            | One of these    |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini models API key                         | One of these    |
| `OLLAMA_HOST`                  | Ollama server host (default: 127.0.0.1:11434) | For Ollama only |

### Model Configuration

Models are configured via the config manager with support for:

- Multiple AI providers (Anthropic, OpenAI, Google, Ollama)
- Automatic model switching
- Token limit management
- Response caching and optimization

### Security Policies

Configurable security framework in `src/cli/policies/`:

- Command execution restrictions with allowlist/blocklist
- File system access controls with path-based permissions
- Network access policies for external integrations
- Sandbox restrictions for safe autonomous operation

## 🧪 Testing

### Test Configuration (`vitest.config.ts`)

- **Environment**: Node.js test environment
- **Coverage**: 80% minimum thresholds (branches, functions, lines, statements)
- **Timeouts**: Extended for AI operations (30 seconds)
- **Path aliases**: Matching main application structure
- **Coverage reporting**: Multiple formats (text, JSON, HTML)

### Running Tests

```bash
npm test                # Interactive test runner
npm run test:run        # Run all tests once
npm run test:watch      # Watch mode for development
```

## 🔧 Binary Distribution

### Build Binaries

```bash
npm run build:binary    # Creates platform-specific binaries
```

**Generated Binaries:**

- `build/nikcli-aarch64-apple-darwin` - macOS ARM64
- `build/nikcli-aarch64-apple-ios` - iOS ARM64
- `build/nikcli-aarch64-apple-ios-sim` - iOS Simulator ARM64
- `build/nikcli-x86_64-apple-ios` - iOS Simulator Intel

### Binary Execution

- `./bin/cli.ts` - Direct execution via shebang
- `./bin/nikcli` - Bash wrapper with fallback logic
- Global installation: `nikcli` command

## 🔄 Usage Patterns

### Interactive Chat

Primary interface with natural language processing:

- **Direct commands**: "Create a React component for user authentication"
- **Agent targeting**: "@react-expert optimize this component for performance"
- **System commands**: "/status", "/help", "/agents"
- **Keyboard shortcuts**: "/" (command menu), "Shift+Tab" (mode switching)

### Autonomous Operation

Full autonomous development capabilities:

- Project analysis and technology detection
- Automatic planning and task breakdown
- File creation, modification, and refactoring
- Build process integration and error resolution
- Git operations with intelligent commit messaging

### Multi-Agent Collaboration

Parallel execution of specialized agents:

- Task distribution across multiple agent instances
- Progress tracking and result aggregation
- Conflict resolution for concurrent file modifications
- Coordinated workflow execution with dependency management

## 🛡️ Security Features

### Execution Policies

- **Command restrictions**: Configurable allowlist/blocklist for system commands
- **File access controls**: Path-based permissions for file operations
- **Approval system**: Interactive confirmation for potentially dangerous operations
- **Sandbox restrictions**: Safe environment for autonomous operation

### Tool Security

All tools implement secure execution patterns:

- Input validation and sanitization
- Permission checking before execution
- Error handling with detailed logging
- Resource limit enforcement

## 🚀 Advanced Features

### Token Management

- **Smart caching**: Signature-based similarity checks for response optimization
- **Context optimization**: Dynamic context management for token efficiency
- **Usage tracking**: Detailed analytics for token consumption
- **Cache controls**: Manual cache management commands

### MCP Integration

Model Context Protocol support for:

- External tool integrations
- Server management and health monitoring
- Dynamic method calls and server communication
- Extensible protocol implementation

### Planning System

Autonomous planning capabilities:

- Task decomposition and dependency analysis
- Execution plan generation with time estimation
- Progress tracking and completion validation
- Error recovery and plan adaptation

## 🐛 Troubleshooting

### Common Issues

**API Key Setup**

```bash
# If no API keys found, NikCLI will offer to setup Ollama
# Or set keys manually:
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
```

**Node Version**

```bash
# Ensure Node.js 18+
node --version
# If too old, upgrade Node.js
```

**Build Issues**

```bash
# Clean build
rm -rf dist/
npm run build
```

**Ollama Setup**

```bash
# Install Ollama: https://ollama.com
# Start service:
ollama serve
# Pull model:
ollama pull llama3.1:8b
```

## 📈 Development Status

**Current Version**: 0.1.14-beta
**Status**: Production-ready with comprehensive testing
**Coverage**: 80%+ test coverage on core components
**Architecture**: Stable service-oriented design

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with proper TypeScript types
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 🙏 Acknowledgments

- **Anthropic Claude** - Primary AI model provider
- **Vercel AI SDK** - Unified AI model integration
- **OpenAI & Google** - Additional AI model support
- **TypeScript** - Type safety and developer experience
- **Vitest** - Modern testing framework
- **Node.js** - Runtime environment

---

**Built for autonomous software development** - Transform your development workflow with intelligent AI agents that understand your code, execute commands, and build applications autonomously.
