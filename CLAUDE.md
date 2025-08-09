# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core CLI Commands
- `npm start` or `npm run dev` - Start the NikCLI autonomous development assistant
- `npm run build` - Compile TypeScript to JavaScript in `dist/`
- `npm run build:start` - Build and run the compiled application
- `npm run lint` - Run ESLint for TypeScript linting

### Testing Commands  
- `npm test` - Run Vitest tests interactively
- `npm run test:run` - Run all tests once
- `npm run test:watch` - Run tests in watch mode

### Binary Execution
- `./bin/cli.ts` - Direct execution via shebang (delegates to `src/cli/index.ts`)
- `nikcli` - NPM binary command (when installed globally)

## Architecture Overview

This is a production-ready autonomous AI development assistant (NikCLI) that provides an intelligent command-line interface for software development. The system combines conversational AI with autonomous code generation, file manipulation, and project management capabilities.

### Key Architectural Principles

**Unified Entry Point**: All functionality flows through `src/cli/index.ts` which orchestrates the entire system startup, initialization, and user interface.

**Service-Oriented Architecture**: Core functionality is organized into modular services:
- Agent Service - Manages AI agent lifecycle and execution
- Tool Service - Handles file operations, command execution, and project analysis  
- Planning Service - Autonomous task planning and decomposition
- LSP Service - Language Server Protocol integration for enhanced code intelligence
- Orchestrator Service - Coordinates multi-agent collaboration

**Stream-Based Processing**: Real-time message processing with queued execution and progress tracking for responsive user experience.

### Core System Components

**Main Orchestrator (`src/cli/index.ts`)**
- Unified entry point that handles system initialization, requirements checking, and startup flow
- Modular design with separate classes for Introduction, System checks, Service initialization, and Streaming interface
- Comprehensive error handling and graceful shutdown procedures

**Agent Architecture (`src/cli/automation/agents/`)**
- `UniversalAgent` - Single comprehensive agent with full-stack development capabilities
- `BaseAgent` - Abstract base class defining the agent interface and lifecycle
- `AgentManager` - Central registry for agent classes and instance management
- **Specialized Agents**: React, Backend, DevOps, Frontend, Autonomous Coder agents for domain-specific tasks

**Service Layer (`src/cli/services/`)**
- `agent-service.ts` - Agent lifecycle, task distribution, and progress tracking
- `tool-service.ts` - File system operations, command execution, project analysis
- `planning-service.ts` - Autonomous task planning and breakdown
- `lsp-service.ts` - Language server integration for code intelligence
- `orchestrator-service.ts` - Multi-agent coordination and workflow management

**Tool System (`src/cli/tools/`)**
- Secure tool registry with permission-based execution
- File operations: read, write, edit, search, multi-edit capabilities
- Command execution: bash, npm, git operations with security policies
- Project analysis: dependency detection, structure analysis, technology identification

**Chat Interface (`src/cli/chat/`)**
- `NikCLI` - Main conversational interface with readline integration
- Stream-based message processing with real-time feedback
- Command completion, history, and interactive help system
- Support for natural language commands and agent-specific targeting

**Context & Memory Management (`src/cli/context/`)**
- Workspace-aware context management with automatic project understanding
- RAG (Retrieval-Augmented Generation) system for intelligent code recommendations
- Dynamic context optimization to manage token limits effectively

**UI Components (`src/cli/ui/`)**
- Diff viewer for code change visualization
- Approval system for reviewing automated changes
- Progress indicators and status displays
- Terminal-optimized display formatting

### Agent Registration & Configuration

**Agent Registration**: All agents are registered in `src/cli/register-agents.ts`. Currently uses a unified `UniversalAgent` approach:
- Single agent class with comprehensive capabilities covering frontend, backend, DevOps, and autonomous coding
- Full permission system with configurable security policies
- Retry logic, timeout handling, and error recovery mechanisms

**Configuration Management**: 
- `ConfigManager` handles persistent settings and API key management
- Support for multiple AI providers (Anthropic Claude, OpenAI GPT, Google Gemini)
- Environment-based configuration with secure key storage

### Technology Stack Integration

**AI Model Support**:
- Primary: Anthropic Claude via `@ai-sdk/anthropic`
- Secondary: OpenAI GPT via `@ai-sdk/openai`  
- Tertiary: Google Gemini via `@ai-sdk/google`
- Unified AI SDK abstraction for consistent model switching

**Development Tools**:
- TypeScript with strict compilation settings
- Vitest for comprehensive testing (80% coverage thresholds)
- ESLint for code quality enforcement
- Path aliases for clean import structure (`@cli/*`, `@agents/*`, etc.)

**Terminal Interface**:
- Chalk for colored output and visual hierarchy
- Boxen for structured information display
- Readline for interactive input with completion and history
- Raw keyboard mode for advanced shortcuts and controls

### Security & Execution Policies

**Execution Policies**: Configurable security framework in `src/cli/policies/`:
- Command execution restrictions with allowlist/blocklist support
- File system access controls with path-based permissions
- Network access policies for external tool integrations
- Sandbox restrictions for safe autonomous operation

**Tool Security**: All tools implement secure execution patterns:
- Input validation and sanitization
- Permission checking before execution
- Error handling with detailed logging
- Resource limit enforcement

### File Structure & Organization

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
└── utils/              # Shared utilities and helpers
```

### Environment Requirements

**System Requirements**:
- Node.js 18+ (enforced at startup)
- Git (for autonomous development features)
- npm/yarn for package management

**API Keys** (at least one required):
- `ANTHROPIC_API_KEY` - For Claude models (recommended)
- `OPENAI_API_KEY` - For GPT models
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Gemini models

**Development Environment**:
- TypeScript 5.3+ for modern language features
- Terminal with color support and UTF-8 encoding
- Sufficient disk space for autonomous file operations

### Usage Patterns & Interface

**Interactive Chat**: Primary interface with natural language processing
- Direct commands: "Create a React component for user authentication"
- Agent targeting: "@react-expert optimize this component for performance"  
- System commands: "/status", "/help", "/agents"
- Keyboard shortcuts: "/" (command menu), "Shift+Tab" (mode switching)

**Autonomous Operation**: Full autonomous development capabilities
- Project analysis and technology detection
- Automatic planning and task breakdown
- File creation, modification, and refactoring
- Build process integration and error resolution
- Git operations with intelligent commit messaging

**Multi-Agent Collaboration**: Parallel execution of specialized agents
- Task distribution across multiple agent instances
- Progress tracking and result aggregation
- Conflict resolution for concurrent file modifications
- Coordinated workflow execution with dependency management

### Testing & Quality Assurance

**Test Configuration** (`vitest.config.ts`):
- Comprehensive test coverage with 80% minimum thresholds
- Node.js test environment with extended timeouts for AI operations
- Path aliases matching the main application structure
- Coverage reporting in multiple formats (text, JSON, HTML)

**Quality Standards**:
- ESLint enforcement with TypeScript-specific rules
- Strict TypeScript compilation settings
- Automated dependency vulnerability scanning
- Performance monitoring for agent execution times