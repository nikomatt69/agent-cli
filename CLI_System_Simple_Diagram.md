# 🚀 Sistema CLI - Diagramma Semplificato per Desktop

## 📊 Vista Generale del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🎯 ENTRY POINTS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  bin/cli.ts  ──┐                                                               │
│  nik-cli.ts  ──┼──► 🎼 MAIN ORCHESTRATOR ◄── src/cli/main-orchestrator.ts      │
│  unified-cli ──┘                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        🎼 MAIN ORCHESTRATOR                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Streaming       │  │ Autonomous      │  │ Chat            │                  │
│  │ Orchestrator    │  │ Chat Interface  │  │ Manager         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🔧 SERVICES LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Agent       │ │ Tool        │ │ Planning    │ │ LSP         │ │ Orchestrator│ │
│  │ Service     │ │ Service     │ │ Service     │ │ Service     │ │ Service     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🧠 AI PROVIDERS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Advanced        │  │ Modern          │  │ Model           │                  │
│  │ AI Provider     │  │ AI Provider     │  │ Provider        │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ AI Call         │                                          │
│                    │ Manager         │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        🤖 MULTI-AGENT SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Agent           │  │ Agent           │  │ Agent           │                  │
│  │ Manager         │  │ Router          │  │ Factory         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           ▼                     ▼                     ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                    SPECIALIZED AGENTS                                      │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │ │
│  │  │Backend  │ │Frontend │ │Coding   │ │Review   │ │DevOps   │ │Universal│   │ │
│  │  │Agent    │ │Agent    │ │Agent    │ │Agent    │ │Agent    │ │Agent    │   │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                           │ │
│  │  │Autonomous│ │React    │ │System   │ │Event    │                           │ │
│  │  │Coder     │ │Agent    │ │Admin    │ │Bus      │                           │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                           │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     🧩 CONTEXT & INTELLIGENCE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Workspace       │  │ Context-Aware   │  │ Workspace       │                  │
│  │ Context         │  │ RAG             │  │ RAG             │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐  ┌─────────────────┐                     │
│                    │ Context         │  │ Context         │                     │
│                    │ Manager         │  │ Enhancer        │                     │
│                    └─────────────────┘  └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      📋 PLANNING & EXECUTION                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Autonomous      │  │ Plan            │  │ Plan            │                  │
│  │ Planner         │  │ Generator       │  │ Executor        │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐  ┌─────────────────┐                     │
│                    │ Planning        │  │ Agent Todo      │                     │
│                    │ Manager         │  │ Manager         │                     │
│                    └─────────────────┘  └─────────────────┘                     │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ Workflow        │                                          │
│                    │ Orchestrator    │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🛠️ TOOLS SYSTEM                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Tool            │  │ Secure Tools    │  │ Tools           │                  │
│  │ Registry        │  │ Registry        │  │ Manager         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           ▼                     ▼                     ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                        FILE TOOLS                                          │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │ │
│  │  │Read File│ │Write    │ │Edit     │ │Find     │ │Multi-   │               │ │
│  │  │Tool     │ │File Tool│ │Tool     │ │Files    │ │Edit Tool│               │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                       SYSTEM TOOLS                                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                           │ │
│  │  │Bash     │ │Run      │ │Grep     │ │List     │                           │ │
│  │  │Tool     │ │Command  │ │Tool     │ │Tool     │                           │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                           │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ⚙️ CORE MANAGEMENT                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Config          │  │ Logger          │  │ Session         │                  │
│  │ Manager         │  │                 │  │ Manager         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐  ┌─────────────────┐                     │
│                    │ Guidance        │  │ Execution       │                     │
│                    │ Manager         │  │ Policy          │                     │
│                    └─────────────────┘  └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     ⚡ PERFORMANCE & CACHING                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Token           │  │ Completion      │  │ Smart Cache     │                  │
│  │ Cache           │  │ Protocol Cache  │  │ Manager         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ Performance     │                                          │
│                    │ Optimizer       │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🎨 UI COMPONENTS                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Advanced        │  │ Approval        │  │ Diff            │                  │
│  │ CLI UI          │  │ System          │  │ Manager         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ Diff            │                                          │
│                    │ Viewer          │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      🔌 EXTERNAL INTEGRATIONS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ MCP             │  │ LSP             │  │ LSP             │                  │
│  │ Client          │  │ Manager         │  │ Client          │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ Language        │                                          │
│                    │ Detection       │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     💬 CHAT & COMMUNICATION                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Chat            │  │ Chat            │  │ Slash           │                  │
│  │ Manager         │  │ Orchestrator    │  │ Commands        │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ Stream          │                                          │
│                    │ Manager         │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    📊 ANALYTICS & MONITORING                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Analytics       │  │ Agent           │  │ Agent Todo      │                  │
│  │ Manager         │  │ Stream          │  │ Manager         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      🚀 ADVANCED FEATURES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Advanced        │  │ Documentation   │  │ IDE Context     │                  │
│  │ Tools           │  │ Library         │  │ Enricher        │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│           │                     │                     │                         │
│           └─────────────────────┼─────────────────────┘                         │
│                                 │                                               │
│                    ┌─────────────────┐                                          │
│                    │ Web Search      │                                          │
│                    │ Provider        │                                          │
│                    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flusso di Dati Principale

```
User Input
    │
    ▼
┌─────────────┐
│ Entry Point │ ──► bin/cli.ts, nik-cli.ts, unified-cli.ts
└─────────────┘
    │
    ▼
┌─────────────┐
│ Main        │ ──► src/cli/main-orchestrator.ts
│ Orchestrator│
└─────────────┘
    │
    ▼
┌─────────────┐
│ Streaming   │ ──► src/cli/streaming-orchestrator.ts
│ Orchestrator│
└─────────────┘
    │
    ▼
┌─────────────┐
│ Services    │ ──► agent-service, tool-service, planning-service, lsp-service
│ Layer       │
└─────────────┘
    │
    ▼
┌─────────────┐
│ AI          │ ──► advanced-ai-provider, modern-ai-provider, model-provider
│ Providers   │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Multi-Agent │ ──► agent-manager, agent-router, specialized agents
│ System      │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Context &   │ ──► workspace-context, context-aware-rag, context-manager
│ Intelligence│
└─────────────┘
    │
    ▼
┌─────────────┐
│ Planning &  │ ──► autonomous-planner, plan-generator, plan-executor
│ Execution   │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Tools       │ ──► tool-registry, secure-tools-registry, file tools, system tools
│ System      │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Core        │ ──► config-manager, logger, session-manager, execution-policy
│ Management  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Performance │ ──► token-cache, completion-cache, smart-cache, performance-optimizer
│ & Caching   │
└─────────────┘
    │
    ▼
┌─────────────┐
│ UI          │ ──► advanced-cli-ui, approval-system, diff-manager, diff-viewer
│ Components  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ External    │ ──► mcp-client, lsp-manager, lsp-client, language-detection
│ Integrations│
└─────────────┘
    │
    ▼
┌─────────────┐
│ Chat &      │ ──► chat-manager, chat-orchestrator, slash-commands, stream-manager
│ Communication│
└─────────────┘
    │
    ▼
┌─────────────┐
│ Analytics & │ ──► analytics-manager, agent-stream, agent-todo-manager
│ Monitoring  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Advanced    │ ──► advanced-tools, documentation-library, ide-context, web-search
│ Features    │
└─────────────┘
```

## 🎯 Caratteristiche Chiave

### **🤖 Multi-Agent Architecture**

- **9 Agenti Specializzati**: Backend, Frontend, Coding, Review, DevOps, Universal, Autonomous, React, System Admin
- **Agent Manager**: Gestione lifecycle degli agenti
- **Agent Router**: Routing intelligente dei task
- **Event Bus**: Sistema di messaging tra agenti

### **🧠 AI-Powered**

- **3 AI Providers**: Advanced, Modern, Model Provider
- **AI Call Manager**: Orchestrazione delle chiamate AI
- **Multiple Models**: OpenAI, Anthropic, Google AI

### **🔒 Security-First**

- **Execution Policy**: Politiche di sicurezza
- **Secure Tools Registry**: Sistema di approvazioni
- **Approval System**: Controlli di sicurezza

### **📊 Context-Aware**

- **Workspace Context**: Analisi workspace
- **Context-Aware RAG**: Sistema RAG intelligente
- **Context Manager**: Gestione centralizzata

### **⚡ High Performance**

- **4 Cache Systems**: Token, Completion, Smart, Performance
- **Streaming**: Tempo reale
- **Optimization**: Ottimizzazioni automatiche

### **🛠️ Extensible**

- **Tool Registry**: Sistema modulare
- **Agent Factory**: Creazione dinamica
- **Service Layer**: Architettura a servizi

## 📁 Struttura File Principale

```
src/cli/
├── main-orchestrator.ts          # 🎼 Orchestratore principale
├── streaming-orchestrator.ts     # 📡 Orchestrazione streaming
├── unified-cli.ts               # 🔗 Interfaccia unificata
├── nik-cli.ts                   # 🎯 CLI principale
│
├── ai/                          # 🧠 Provider AI
│   ├── advanced-ai-provider.ts
│   ├── modern-ai-provider.ts
│   ├── model-provider.ts
│   └── ai-call-manager.ts
│
├── automation/agents/           # 🤖 Sistema multi-agente
│   ├── agent-manager.ts
│   ├── agent-router.ts
│   ├── base-agent.ts
│   ├── backend-agent.ts
│   ├── frontend-agent.ts
│   ├── coding-agent.ts
│   ├── universal-agent.ts
│   └── autonomous-coder.ts
│
├── services/                    # 🔧 Layer servizi
│   ├── agent-service.ts
│   ├── tool-service.ts
│   ├── planning-service.ts
│   └── lsp-service.ts
│
├── tools/                       # 🛠️ Sistema tools
│   ├── tool-registry.ts
│   ├── secure-tools-registry.ts
│   ├── read-file-tool.ts
│   ├── write-file-tool.ts
│   └── run-command-tool.ts
│
├── context/                     # 🧩 Sistema contesto
│   ├── workspace-context.ts
│   ├── context-aware-rag.ts
│   └── workspace-rag.ts
│
├── planning/                    # 📋 Sistema pianificazione
│   ├── autonomous-planner.ts
│   ├── plan-generator.ts
│   └── plan-executor.ts
│
├── core/                        # ⚙️ Componenti core
│   ├── config-manager.ts
│   ├── logger.ts
│   ├── context-manager.ts
│   └── token-cache.ts
│
├── ui/                          # 🎨 Componenti UI
│   ├── advanced-cli-ui.ts
│   ├── approval-system.ts
│   └── diff-manager.ts
│
└── chat/                        # 💬 Sistema chat
    ├── autonomous-claude-interface.ts
    ├── chat-manager.ts
    └── nik-cli-commands.ts
```

## 🚀 Tecnologie Utilizzate

### **Core**

- **TypeScript** - Linguaggio principale
- **Node.js** - Runtime environment
- **EventEmitter** - Sistema di eventi
- **Readline** - Interfaccia CLI

### **AI & ML**

- **OpenAI API** - GPT models
- **Anthropic API** - Claude models
- **Google AI** - Gemini models
- **Embedding Models** - Text embeddings

### **Development**

- **LSP** - Language Server Protocol
- **MCP** - Model Context Protocol
- **Git Integration** - Operazioni Git
- **Docker Integration** - Containerizzazione

### **Performance**

- **Token Management** - Gestione token AI
- **Completion Caching** - Cache completamenti
- **Smart Caching** - Cache intelligente
- **Streaming** - Streaming in tempo reale

---

## 🎯 Conclusione

Il sistema CLI rappresenta una **CLI di nuova generazione** che combina:

- **🤖 AI avanzata** con multiple AI providers
- **🔄 Multi-agent systems** per task specializzati
- **🔒 Sicurezza first** con sistema di policy
- **📊 Context awareness** con RAG system
- **⚡ High performance** con caching ottimizzato
- **🛠️ Estensibilità** con architettura modulare

Il sistema è progettato per essere **completamente autonomo** ma anche **controllabile dall'utente**, offrendo un'esperienza di sviluppo estremamente avanzata e produttiva.

