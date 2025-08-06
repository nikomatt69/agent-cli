# 🤖 AI Agents CLI - Autonomous Developer Assistant

Un potente sistema CLI che funziona come Claude Code, con agenti AI autonomi che possono programmare, analizzare codice e gestire progetti complessi in totale autonomia.

## 🚀 Caratteristiche Principali

### 🧠 **Agenti Completamente Autonomi**
- **Todo Management Autonomo**: Ogni agent crea i propri todo e li esegue in autonomia
- **Planning AI-Powered**: Breakdown automatico di task complessi in sotto-attività
- **Workflow Streaming**: Monitoraggio real-time di thinking, planning ed execution
- **Context Awareness**: Consapevolezza completa del workspace e delle dipendenze

### 🏭 **Agent Factory Dinamica**
- **Creazione Agenti Custom**: Genera agenti specializzati usando AI
- **Blueprints Personalizzabili**: Definisce personalità, capabilities e autonomia
- **Livelli di Autonomia**: Supervised, Semi-Autonomous, Fully-Autonomous
- **Specializzazioni Infinite**: React Expert, API Integration, Testing, DevOps, etc.

### 📊 **Sistema di Streaming Avanzato**
- **Live Dashboard**: Monitora tutti gli agenti attivi in tempo reale
- **Eventi Dettagliati**: thinking, planning, executing, progress, result, error
- **Tracking Azioni**: File operations, command execution, analysis
- **Export Streams**: Salva sessioni complete per analisi

### 🌍 **Workspace Context Manager**
- **Analisi Automatica**: Scansiona e analizza file/directory importanti
- **Scoring Intelligente**: Assegna importance scores basati su euristica
- **Dependency Extraction**: Estrae imports, exports e dipendenze
- **Framework Detection**: Identifica automaticamente React, Next.js, Node, etc.

## 📦 Installazione

### Prerequisiti
```bash
node >= 16.0.0
npm >= 8.0.0
```

### Setup
```bash
# Clone il repository
git clone <repo-url>
cd ai-agents-cli

# Installa dipendenze
npm install

# Build del progetto
npm run build

# Setup API keys (almeno una richiesta)
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

### Test del Sistema
```bash
# Test compilazione TypeScript
npm run build

# Avvia CLI interattiva
npm run cli chat

# Test comandi specifici
npm run cli agents
npm run cli models
```

## 🎯 Guida Rapida

### 1. **Avvio Chat Interattiva**
```bash
npm run cli chat
```

### 2. **Comandi Base**
```bash
# Help completo
/help

# Lista agenti disponibili
/agents

# Lista modelli AI
/models

# Configurazione attuale
/config
```

### 3. **Agent Factory - Creazione Agenti Custom**
```bash
# Dashboard factory
/factory

# Crea agente specializzato
/create-agent "React Testing Expert"
/create-agent "API Integration Specialist"
/create-agent "DevOps Automation Master"

# Lancia agente da blueprint
/launch-agent <blueprint-id> "task description"
```

### 4. **Workspace Context Management**
```bash
# Seleziona cartelle per il context
/context src/ components/ pages/

# Mostra summary del workspace
/context

# Analisi automatica del progetto
# Il sistema analizza automaticamente:
# - package.json per dependencies
# - tsconfig.json per configurazione
# - Struttura directory per framework detection
# - File importance scoring
```

### 5. **Autonomous Execution**
```bash
# Crea e lancia agente autonomo per task
/auto "Create a React todo app with backend API"
/auto "Fix all TypeScript errors in the project"
/auto "Add testing suite with Jest and RTL"
/auto "Optimize performance and add caching"
```

### 6. **Live Streaming & Monitoring**
```bash
# Dashboard live di tutti gli agenti
/stream

# Pulisci history degli streams
/stream clear
```

## 🤖 Agenti Pre-configurati

### **Coding Specialists**
- **`coding-agent`**: Programmatore generale con focus su clean code
- **`react-expert`**: Specialista React/Next.js, components, hooks, SSR
- **`backend-agent`**: API design, database, server-side logic
- **`devops-agent`**: Docker, CI/CD, deployment, infrastructure

### **Analysis & Quality**
- **`ai-analysis`**: Code analysis, architecture review, best practices
- **`code-review-agent`**: Pull request review, code quality assessment
- **`optimization-agent`**: Performance optimization, memory management

### **Autonomous Systems**
- **`autonomous-coder`**: Full-stack autonomous development
- **`autonomous-orchestrator`**: Multi-agent task coordination
- **`system-admin-agent`**: System commands, automation, maintenance

## 🔧 Comandi CLI Completi

### **Session Management**
```bash
/new [title]              # Nuova chat session
/sessions                 # Lista tutte le sessions
/clear                    # Pulisci session corrente
/export [sessionId]       # Esporta session in markdown
```

### **Model & Configuration**
```bash
/models                   # Lista modelli disponibili
/model <name>             # Cambia modello AI
/set-key <model> <key>    # Imposta API key
/temp <0.0-2.0>          # Imposta temperature (creatività)
/system <prompt>          # System prompt personalizzato
```

### **File Operations**
```bash
/read <file>              # Leggi contenuto file
/write <file> <content>   # Scrivi contenuto in file
/edit <file>              # Apri file nell'editor
/ls [directory]           # Lista files in directory
/search <query>           # Cerca testo nei files (grep)
```

### **Terminal Operations**
```bash
/run <command>            # Esegui comando terminal
/install <packages>       # Installa pacchetti npm/yarn
/npm <args>               # Comandi npm
/yarn <args>              # Comandi yarn
/git <args>               # Comandi git
/docker <args>            # Comandi docker
/ps                       # Processi attivi
/kill <pid>               # Termina processo
```

### **Project Operations**
```bash
/build                    # Build progetto
/test [pattern]           # Esegui tests
/lint                     # Esegui linting
/create <type> <name>     # Crea nuovo progetto
```

### **Agent Management**
```bash
/agents                   # Lista agenti disponibili
/agent <name> <task>      # Esegui agente specifico
/parallel <agents> <task> # Esegui agenti in parallelo
```

## 🏗️ Architettura del Sistema

### **Core Components**

#### 1. **Agent Factory (`src/cli/core/agent-factory.ts`)**
```typescript
// Creazione dinamica di agenti specializzati
export class AgentFactory {
  async createAgentBlueprint(requirements: {
    specialization: string;
    autonomyLevel: 'supervised' | 'semi-autonomous' | 'fully-autonomous';
    contextScope: 'file' | 'directory' | 'project' | 'workspace';
    personality: {
      proactive: number;      // 0-100
      collaborative: number;  // 0-100
      analytical: number;     // 0-100
      creative: number;       // 0-100
    };
  }): Promise<AgentBlueprint>;
}
```

#### 2. **Todo Management (`src/cli/core/agent-todo-manager.ts`)**
```typescript
// Sistema autonomo di todo per ogni agent
export class AgentTodoManager {
  async planTodos(agentId: string, goal: string, context?: any): Promise<AgentTodo[]>;
  async executeTodos(agentId: string): Promise<void>;
  getAgentStats(agentId: string): AgentStats;
}

export interface AgentTodo {
  id: string;
  agentId: string;
  title: string;
  description: string;
  status: 'planning' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number;
  tags: string[];
  context: {
    files?: string[];
    commands?: string[];
    reasoning?: string;
  };
  progress: number; // 0-100
}
```

#### 3. **Stream Management (`src/cli/core/agent-stream.ts`)**
```typescript
// Real-time monitoring di tutti gli agenti
export class AgentStreamManager extends EventEmitter {
  emitEvent(agentId: string, type: StreamEventType, message: string): void;
  streamThinking(agentId: string, thoughts: string[]): Promise<void>;
  streamPlanning(agentId: string, planSteps: string[]): Promise<void>;
  streamProgress(agentId: string, current: number, total: number): void;
  showLiveDashboard(): void;
  exportStream(agentId: string): string;
}

export interface StreamEvent {
  type: 'thinking' | 'planning' | 'executing' | 'progress' | 'result' | 'error' | 'info';
  agentId: string;
  message: string;
  timestamp: Date;
  progress?: number;
}
```

#### 4. **Workspace Context (`src/cli/core/workspace-context.ts`)**
```typescript
// Context awareness completa del workspace
export class WorkspaceContextManager {
  async selectPaths(paths: string[]): Promise<void>;
  getContextForAgent(agentId: string, maxFiles?: number): ContextData;
  analyzeProject(): Promise<ProjectMetadata>;
  showContextSummary(): void;
}

export interface FileContext {
  path: string;
  content: string;
  language: string;
  importance: number; // 0-100
  summary: string;
  dependencies: string[];
  exports: string[];
}
```

### **Dynamic Agent System**

#### **Agent Blueprint**
```typescript
export interface AgentBlueprint {
  id: string;
  name: string;
  specialization: string;
  systemPrompt: string;
  capabilities: string[];
  requiredTools: string[];
  personality: {
    proactive: number;
    collaborative: number;
    analytical: number;
    creative: number;
  };
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'fully-autonomous';
  contextScope: 'file' | 'directory' | 'project' | 'workspace';
  workingStyle: 'sequential' | 'parallel' | 'adaptive';
}
```

#### **Dynamic Agent Implementation**
```typescript
export class DynamicAgent extends BaseAgent {
  async run(task: string): Promise<any> {
    // 1. Analizza task e crea todos autonomamente
    await this.createAutonomousTodos(task);
    
    // 2. Esegue workflow con streaming real-time
    const result = await this.executeAutonomousWorkflow();
    
    // 3. Reporta risultati completi
    return result;
  }

  private async executeAutonomousTodo(todo: AgentTodo): Promise<any> {
    // Esecuzione basata sui tags del todo
    if (todo.tags.includes('filesystem')) {
      return await this.executeFileSystemTodo(todo);
    } else if (todo.tags.includes('implementation')) {
      return await this.executeImplementationTodo(todo);
    }
    // ... altri tipi di todo
  }
}
```

## 🎨 Esempi di Utilizzo Avanzato

### **1. Creazione Agente React Testing Expert**

```bash
# Nel CLI
/create-agent "React Testing Expert con Jest e RTL"
```

L'AI creerà un blueprint simile a:
```json
{
  "name": "react-testing-expert",
  "specialization": "React Testing Expert con Jest e RTL",
  "systemPrompt": "You are a React testing expert specializing in Jest, React Testing Library, and modern testing patterns...",
  "capabilities": [
    "unit test creation",
    "integration test design", 
    "mock creation and management",
    "test debugging and optimization",
    "coverage analysis",
    "accessibility testing"
  ],
  "requiredTools": ["Read", "Write", "Bash", "InstallPackage"],
  "personality": {
    "proactive": 85,
    "analytical": 95,
    "collaborative": 70,
    "creative": 60
  },
  "autonomyLevel": "fully-autonomous"
}
```

### **2. Workflow Autonomo Completo**

```bash
/auto "Create a full-stack todo application with React frontend, Node.js backend, MongoDB database, user authentication, and comprehensive testing"
```

Il sistema:
1. **Crea agente specializzato** per il task
2. **Analizza il workspace** corrente
3. **Genera plan dettagliato** con todos:
   - Setup project structure
   - Create database models and connection
   - Implement authentication system
   - Create React components and pages
   - Set up API endpoints
   - Add comprehensive testing
   - Configure build and deployment
4. **Esegue autonomamente** ogni todo con streaming real-time
5. **Installa dipendenze** necessarie
6. **Crea file** di codice completi
7. **Esegue tests** per validare il risultato

### **3. Context-Aware Development**

```bash
# Seleziona workspace context
/context src/components src/pages src/api

# Mostra analisi del context
/context

# Output esempio:
🌍 Workspace Context Summary
════════════════════════════════════════════════
📁 Root Path: /Users/dev/my-project
🎯 Selected Paths: 3
  • src/components
  • src/pages  
  • src/api
📄 Files: 45
📁 Directories: 12
🔧 Framework: React/Next.js
💻 Languages: typescript, javascript, css
📦 Dependencies: 23
🕐 Last Updated: 2:30:45 PM

📋 Most Important Files:
  1. src/pages/_app.tsx (typescript, importance: 95)
     Next.js app configuration with providers and global styles
  2. src/components/Layout/index.tsx (typescript, importance: 88)
     Main layout component with navigation and footer
  3. src/api/auth/route.ts (typescript, importance: 85)
     Authentication API endpoints with JWT handling
```

### **4. Live Streaming Dashboard**

```bash
/stream

# Output esempio:
📺 Live Agent Dashboard
═══════════════════════════════════════════════════════════

🤖 Agent: react-testing-expert
──────────────────────────────
📊 Actions: 12 completed, 0 failed
🕐 Last Activity: 2:31:22 PM
Recent Events:
  ✅ Created test file: components/__tests__/TodoList.test.tsx
  ⚡ Installing @testing-library/jest-dom
  • Running test suite validation

🤖 Agent: fullstack-developer
──────────────────────────────
📊 Actions: 8 completed, 1 failed
🕐 Last Activity: 2:30:45 PM  
Recent Events:
  ✅ API endpoint /api/todos created successfully
  ❌ Database connection failed - retrying
  ⚡ Setting up MongoDB connection
```

## 🔄 Workflow Tipici

### **Development Workflow**

1. **Project Setup**
   ```bash
   /context src/ tests/ config/
   /create-agent "Full-stack Developer"
   /auto "Setup complete development environment with linting, testing, and CI/CD"
   ```

2. **Feature Development**
   ```bash
   /auto "Add user profile management with avatar upload, settings page, and profile validation"
   ```

3. **Code Review & Optimization**
   ```bash
   /agent code-review-agent "Review recent changes and suggest improvements"
   /agent optimization-agent "Optimize performance and bundle size"
   ```

4. **Testing & Quality**
   ```bash
   /create-agent "Testing Specialist for this codebase"
   /auto "Add comprehensive test coverage for all components and APIs"
   ```

### **Bug Fixing Workflow**

```bash
# Analisi del problema
/agent ai-analysis "Analyze the authentication bug in login flow"

# Fix autonomo
/auto "Fix authentication issue where users can't login with valid credentials"

# Validazione
/test
/agent system-admin-agent "Run comprehensive system health check"
```

## 📊 Monitoring e Analytics

### **Agent Performance Metrics**
```typescript
interface AgentStats {
  totalTodos: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed: number;
  averageCompletionTime: number;
  efficiency: number; // Ratio estimated/actual time
}
```

### **Stream Analytics**
- **Events Per Minute**: Rate di attività degli agenti
- **Action Duration**: Tempo medio per tipo di azione
- **Success Rate**: Percentuale di azioni completate con successo
- **Context Utilization**: Quanti file del workspace vengono utilizzati

### **Workspace Insights**
- **File Importance Scoring**: Algoritmo che considera:
  - File size e complexity
  - Number of imports/exports
  - Directory importance (src/, components/, etc.)
  - Framework-specific patterns
- **Dependency Analysis**: Mappa completa delle dipendenze
- **Framework Detection**: Automatic identification di React, Next.js, Node.js, etc.

## 🛠️ Configurazione Avanzata

### **Environment Variables**
```bash
# AI Model API Keys
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_API_KEY="..."

# CLI Configuration
AI_CODER_CONFIG_PATH="~/.ai-coder-cli.json"
AI_CODER_LOG_LEVEL="info"
AI_CODER_MAX_CONTEXT_FILES="50"
AI_CODER_DEFAULT_MODEL="claude-3-5-sonnet"
```

### **Configuration File (~/.ai-coder-cli.json)**
```json
{
  "currentModel": "claude-3-5-sonnet",
  "temperature": 0.7,
  "chatHistory": true,
  "maxHistoryLength": 100,
  "models": {
    "claude-3-5-sonnet": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022"
    },
    "gpt-4": {
      "provider": "openai", 
      "model": "gpt-4"
    },
    "gemini-pro": {
      "provider": "google",
      "model": "gemini-pro"
    }
  },
  "agentDefaults": {
    "autonomyLevel": "semi-autonomous",
    "contextScope": "project",
    "maxConcurrentAgents": 3
  }
}
```

## 📁 Struttura del Progetto Completa

```
ai-agents-cli/
├── src/cli/                         # Sistema CLI completo
│   ├── core/                        # Core system components
│   │   ├── agent-factory.ts         # 🏭 Dynamic agent creation
│   │   ├── agent-todo-manager.ts    # 📋 Autonomous todo system
│   │   ├── agent-stream.ts          # 📊 Real-time streaming
│   │   └── workspace-context.ts     # 🌍 Context awareness
│   ├── agents/                      # Agent implementations
│   │   ├── base-agent.ts            # Base agent class
│   │   ├── coding-agent.ts          # General coding agent
│   │   ├── react-expert.ts          # React specialist
│   │   ├── backend-agent.ts         # Backend specialist
│   │   ├── devops-agent.ts          # DevOps specialist
│   │   ├── autonomous-coder.ts      # Fully autonomous developer
│   │   ├── autonomous-orchestrator.ts # Multi-agent coordinator
│   │   ├── system-admin-agent.ts    # System administration
│   │   ├── ai-agent.ts              # AI analysis
│   │   ├── code-review-agent.ts     # Code review specialist
│   │   └── optimization-agent.ts    # Performance optimization
│   ├── ai/                          # AI model integration
│   │   └── model-provider.ts        # Multi-model support (OpenAI, Anthropic, Google)
│   ├── tools/                       # System tools and utilities
│   │   └── tools-manager.ts         # File ops, terminal, package management
│   ├── chat/                        # Interactive interface
│   │   ├── chat-interface.ts        # Main chat loop
│   │   ├── chat-manager.ts          # Session management
│   │   └── slash-commands.ts        # All command handlers
│   ├── config/                      # Configuration management
│   │   └── config-manager.ts        # Settings and API keys
│   ├── index.ts                     # CLI entry point
│   └── register-agents.ts           # Agent registration
├── app/                             # Next.js Dashboard (legacy)
│   ├── api/                         # API routes
│   └── page.tsx                     # Web interface
├── bin/
│   └── cli.js                       # CLI executable
├── package.json                     # Project dependencies
├── tsconfig.json                    # TypeScript configuration
├── tsconfig.cli.json               # CLI-specific TypeScript config
└── README.md                       # This file
```

## 🔍 Troubleshooting

### **Common Issues**

#### **1. API Key Issues**
```bash
# Error: No API key found
⚠️  No API key found for claude-3-5-sonnet

# Solutions:
export ANTHROPIC_API_KEY="sk-ant-..."
# OR
/set-key claude-3-5-sonnet sk-ant-...
```

#### **2. TypeScript Compilation Errors**
```bash
# Check for errors
npx tsc --noEmit --project tsconfig.cli.json

# Common fixes:
npm install @types/node
npm run build
```

#### **3. Agent Factory Issues**
```bash
# Debug agent creation
/factory  # Check available blueprints
/agents   # List all registered agents

# Reset factory
rm ~/.ai-coder-cli.json
```

#### **4. Context Analysis Problems**
```bash
# Reset context
/context  # Shows current context
/context src/  # Re-analyze specific folder

# Check workspace permissions
ls -la src/
```

### **Debug Mode**
```bash
# Enable verbose logging
AI_CODER_LOG_LEVEL=debug npm run cli chat

# Export agent streams for analysis
/stream
# Then use /export in stream dashboard
```

## 🚀 Performance Optimization

### **Context Management**
- **Smart File Filtering**: Skip binary files, node_modules, build directories
- **Importance Scoring**: Focus on most relevant files first
- **Lazy Loading**: Analyze files only when needed
- **Caching**: Cache analysis results for repeated access

### **Agent Efficiency**  
- **Parallel Execution**: Multiple agents can work simultaneously
- **Task Breakdown**: Complex tasks split into manageable todos
- **Resource Pooling**: Share context analysis between agents
- **Stream Buffering**: Efficient real-time event handling

### **Memory Management**
- **Context Pruning**: Remove old analysis data automatically  
- **Stream Cleanup**: Automatic cleanup of old stream events
- **Agent Lifecycle**: Proper initialization and cleanup
- **Config Optimization**: Lightweight JSON configuration

## 📈 Roadmap e Future Features

### **Planned Enhancements**

#### **v2.0 - Advanced AI Features**
- [ ] **Multi-Agent Collaboration**: Agents che comunicano tra loro
- [ ] **Learning System**: Agenti che imparano dai pattern di utilizzo
- [ ] **Vision Integration**: Analisi di UI screenshots e mockups
- [ ] **Code Generation Templates**: Template predefiniti per framework

#### **v2.1 - Enterprise Features**
- [ ] **Team Management**: Multi-user support con permessi
- [ ] **Project Templates**: Setup automatico per tipi di progetto
- [ ] **CI/CD Integration**: Hook diretti con GitHub Actions
- [ ] **Analytics Dashboard**: Web interface per monitoring

#### **v2.2 - Advanced Tooling**
- [ ] **Database Integration**: Connection diretta con PostgreSQL, MongoDB
- [ ] **Cloud Deployment**: Deploy automatico su Vercel, Netlify, AWS
- [ ] **Performance Profiling**: Analisi automatica delle performance
- [ ] **Security Scanning**: Vulnerability detection e fixes

## 🤝 Contributing

### **Development Setup**
```bash
git clone <repo-url>
cd ai-agents-cli
npm install
npm run dev  # Watch mode per development
```

### **Adding New Agents**
```typescript
// 1. Extend BaseAgent
export class MyCustomAgent extends BaseAgent {
  name = 'my-custom-agent';
  description = 'Custom agent for specific tasks';

  async run(task: string): Promise<any> {
    // Implementation
  }
}

// 2. Register in src/cli/register-agents.ts
agentManager.registerAgent(MyCustomAgent);
```

### **Adding New Commands**
```typescript
// In src/cli/chat/slash-commands.ts
private registerCommands(): void {
  this.commands.set('my-command', this.myCommandHandler.bind(this));
}

private async myCommandHandler(args: string[]): Promise<CommandResult> {
  // Implementation
  return { shouldExit: false, shouldUpdatePrompt: false };
}
```

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Vercel AI SDK** per l'integrazione multi-model
- **OpenAI, Anthropic, Google** per i modelli AI
- **chalk** per la colorazione terminale
- **inquirer** per l'interfaccia interattiva
- **marked-terminal** per il rendering markdown

---

**Built with ❤️ for autonomous development**

*Questo sistema rappresenta il futuro dello sviluppo software: agenti AI che lavorano autonomamente, comprendono il context completo, e possono gestire workflow complessi senza intervento umano.*