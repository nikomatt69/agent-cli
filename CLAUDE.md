# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Next.js Web Application
- `npm run dev` - Start Next.js development server on http://localhost:3000
- `npm run build` - Build the Next.js application for production
- `npm run start` - Start the production Next.js server
- `npm run lint` - Run ESLint for code linting

### CLI Tool Development
- `npm run cli` - Run the CLI tool directly with ts-node
- `npm run cli:list` - List all available AI agents
- `npm run cli:run` - Shortcut to run single agents (use with agent name)
- `npm run cli:parallel` - Shortcut to run multiple agents in parallel

### CLI Usage Examples
```bash
# Start interactive chat (main interface)
npm run chat

# Run single agent
npm run cli run ai-analysis -- --task "function add(a, b) { return a + b; }"

# Run multiple agents in parallel
npm run cli run-parallel ai-analysis code-review optimization -- --task "your code here"

# List available agents and models
npm run cli agents
npm run cli models

# Configuration
npm run cli set-model claude-3-5-sonnet
npm run cli set-key claude-3-5-sonnet your-api-key-here
```

## Architecture Overview

This is an autonomous AI-powered CLI coding assistant (like Claude Code) that can interact with multiple AI models, read/write files, debug code, and program autonomously. It combines:

- **Interactive Chat Interface**: Conversational CLI with multi-model support
- **Autonomous Coding Agents**: AI agents that can independently analyze, create, and modify code
- **File System Integration**: Direct file reading, writing, and project analysis
- **Multi-Model Support**: Claude, GPT, Gemini with easy switching
- **Parallel Agent Execution**: Multiple AI agents working together on complex tasks

### Core Components

**Agent System (`src/cli/agents/`)**
- `BaseAgent` - Abstract base class that all agents extend
- `AgentManager` - Registry and factory for managing agent instances  
- **Specialized Coding Agents**:
  - `CodingAgent` - General coding tasks with structured analysis
  - `ReactAgent` - React/Next.js specialist
  - `BackendAgent` - Node.js/API development expert  
  - `DevOpsAgent` - CI/CD, Docker, Kubernetes specialist
  - `AutonomousCoder` - **Full autonomous coding** (reads/writes files, debugs, creates features)
  - `AutonomousOrchestrator` - **Multi-agent task coordination**
- **Legacy Agents** (backward compatibility):
  - `AIAnalysisAgent`, `CodeGeneratorAgent`, `CodeReviewAgent`, `OptimizationAgent`

**Interactive Chat System**
- `ChatInterface` - Main conversational interface with readline
- `SlashCommandHandler` - Extensive slash commands for agent management
- `ChatManager` - Session management and conversation history
- **Multi-Model Support** - Switch between Claude, GPT, Gemini seamlessly

**Tools System (`src/cli/tools/`)**
- `ToolsManager` - **File system operations** (read, write, edit, search)
- **Build & Test Integration** - npm scripts, linting, type checking
- **Error Analysis** - Automatic error detection and parsing
- **Git Operations** - Status, add, commit automation
- **Project Analysis** - Technology detection and structure analysis

**Configuration System**
- `ConfigManager` - Model settings, API keys, preferences  
- `ModelProvider` - AI SDK integration for multiple providers
- Persistent settings with encrypted key storage

**Web Dashboard (`app/` and `src/`)** [Optional]
- Next.js 14 App Router application for web interface
- Can be used alongside CLI or independently

### Agent Registration System

All agents are registered in `src/cli/register-agents.ts`. To add a new agent:
1. Create a class extending `BaseAgent`
2. Implement required methods: `initialize()`, `run()`, `cleanup()`
3. Add to the registration function

### API Integration

The project uses Google's Gemini AI API through the `@ai-sdk/google` package. API key must be set in environment variable `GOOGLE_GENERATIVE_AI_API_KEY`.

### State Management

- CLI: Stateless, each command creates fresh agent instances
- Web: Zustand store manages analysis history and agent states
- Agent lifecycle: initialize → run → cleanup pattern

### File Structure Notes

- `bin/` contains the CLI executable entry point
- `app/` follows Next.js App Router structure
- `src/cli/` contains all CLI-related code
- `src/stores/` and `src/types/` support the web application
- TypeScript configuration supports both ES modules and CommonJS

## Chat Interface Commands

### Slash Commands
- `/help` - Show all available commands
- `/models` - List available AI models  
- `/model <name>` - Switch to different AI model
- `/set-key <model> <key>` - Set API key for model
- `/agents` - List all available agents
- `/agent <name> <task>` - Run specific agent with task
- `/auto <description>` - **Autonomous multi-agent execution**
- `/parallel <agents> <task>` - Run multiple agents in parallel
- `/new [title]` - Start new chat session
- `/clear` - Clear current session
- `/quit` - Exit chat

### Advanced Usage Examples

**Autonomous Feature Development:**
```
/auto "Create a React todo app with CRUD operations, local storage, and TypeScript"
```

**Multi-Agent Analysis:**
```
/parallel "coding-agent,react-expert,backend-expert" "Review this API endpoint and suggest improvements"
```

**Direct Terminal Commands:**
```
/run npm install lodash
/git status
/docker ps
/npm run build
/yarn test
```

**File Operations:**
```
/read src/components/Header.tsx
/write src/utils/helper.ts "export const formatDate = (date: Date) => date.toISOString();"
/search "useState" src/
/ls components/
```

**System Administration:**
```
/install lodash react-query --dev
/ps
/kill 1234
/build
/test
/create next my-awesome-app
```

**Specific Agent Tasks:**
```
/agent autonomous-coder "analyze the current project and fix all TypeScript errors"
/agent system-admin "install docker and setup a development environment"
/agent react-expert "create a responsive navigation component with mobile menu"
/agent devops-expert "setup Docker configuration for this Next.js app"
```

## Environment Requirements

**Required API Keys** (set via environment variables or `/set-key` command):
- `ANTHROPIC_API_KEY` - For Claude models
- `OPENAI_API_KEY` - For GPT models  
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models

**System Requirements:**
- Node.js 18+ with TypeScript support
- Git (for autonomous coding features)
- Access to npm/yarn for dependency management

## Key Dependencies

- **AI SDK** - `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
- **CLI Framework** - Commander.js, Chalk, Boxen, Gradient-string
- **Configuration** - Conf for persistent settings
- **File Operations** - Node.js fs module with enhanced error handling
- **Chat Interface** - Readline with markdown terminal rendering
```