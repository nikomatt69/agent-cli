# NikCLI – Autonomous AI Terminal Assistant (Claude Code style)

> A modern TypeScript CLI for agent-assisted development with a terminal UI, safe tools, autonomous planning, and multi-model support (Anthropic, OpenAI, Google, Ollama).

- Node.js: >= 18
- TypeScript: ^5.3
- Binary: `nikcli` (optional `pkg` build for standalone distributions)
- Config: `~/.nikcli/config.json`
- Package: `@cadcamfun/niko-cli`

---

## ✨ Key Features

- Streaming terminal UI with slash commands (`/help`, `/model`, `/agents`, ...)
- Enterprise Universal Agent with end-to-end capabilities (coding, analysis, refactoring, tests, DevOps)
- Safe tool system (read/write files, grep, run command with approvals)
- Advanced planning and orchestration (autonomous/parallel), integrated diff viewer
- Pluggable AI providers: Anthropic, OpenAI, Google, Ollama (local, no API key)
- Persistent user configuration with validated schema (Zod)

---

## 🚀 Installation

### Option A – Local (development)

```bash
npm install
npm run build
./bin/nikcli
```

### Option B – Quickstart via curl (global, beta)

See `installer/README.md`. Example:

```bash
# Latest beta
curl -fsSL https://raw.githubusercontent.com/nikomatt69/agent-cli/main/installer/install.sh | bash

# Specific version
curl -fsSL https://raw.githubusercontent.com/nikomatt69/agent-cli/main/installer/install.sh | bash -s -- --version 0.1.0-beta
```

Uninstall:

```bash
curl -fsSL https://raw.githubusercontent.com/nikomatt69/agent-cli/main/installer/uninstall.sh | bash
```

> Note: the installer uses `npm i -g`. Using `npm` is preferred (avoid `yarn`).

---

## ⚡ Quickstart

```bash
# Interactive interface
nikcli
# Or from the repo (dev)
./bin/nikcli
```

Quick examples:

```text
/help                      # list commands
/model claude-sonnet-4-20250514
/set-key claude-sonnet-4-20250514 sk-ant-...
/read src/cli/index.ts
/grep "ModelProvider"
/run "npm test"
```

---

## 🤖 Supported (default) Models

| Name                      | Provider  | Model                   | Requires API key |
|--------------------------|-----------|-------------------------|------------------|
| claude-sonnet-4-20250514 | Anthropic | claude-sonnet-4-20250514| Yes              |
| claude-3-haiku-20240229  | Anthropic | claude-3-haiku-20240229 | Yes              |
| gpt-4o-mini              | OpenAI    | gpt-4o-mini             | Yes              |
| gpt-5                    | OpenAI    | gpt-5                   | Yes              |
| gpt-4o                   | OpenAI    | gpt-4o                  | Yes              |
| gpt-4.1                  | OpenAI    | gpt-4.1                 | Yes              |
| gpt-4                    | OpenAI    | gpt-4                   | Yes              |
| gpt-3.5-turbo            | OpenAI    | gpt-3.5-turbo           | Yes              |
| gpt-3.5-turbo-16k        | OpenAI    | gpt-3.5-turbo-16k       | Yes              |
| gemini-pro               | Google    | gemini-pro              | Yes              |
| gemini-1.5-pro           | Google    | gemini-1.5-pro          | Yes              |
| llama3.1:8b              | Ollama    | llama3.1:8b             | No               |
| codellama:7b             | Ollama    | codellama:7b            | No               |
| mistral:7b               | Ollama    | mistral:7b              | No               |

- Change model: `/model <name>` | List: `/models` | API key: `/set-key <model> <key>`
- Ollama does not require keys; ensure `ollama serve` is running (default host `127.0.0.1:11434`).

---

## 🔧 Configuration

- File path: `~/.nikcli/config.json`
- Schema: see `src/cli/core/config-manager.ts` (Zod `ConfigSchema`)

Minimal example:

```json
{
  "currentModel": "claude-sonnet-4-20250514",
  "temperature": 0.7,
  "maxTokens": 4000,
  "chatHistory": true,
  "maxHistoryLength": 100,
  "systemPrompt": null,
  "autoAnalyzeWorkspace": true,
  "enableAutoApprove": false,
  "models": { /* defaults included */ },
  "apiKeys": { },
  "mcpServers": {},
  "maxConcurrentAgents": 3,
  "enableGuidanceSystem": true,
  "defaultAgentTimeout": 60000,
  "logLevel": "info",
  "requireApprovalForNetwork": true,
  "approvalPolicy": "moderate",
  "sandbox": {
    "enabled": true,
    "allowFileSystem": true,
    "allowNetwork": false,
    "allowCommands": true
  }
}
```

Keys via environment (alternative to `/set-key`):

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
# Ollama: no key, optional OLLAMA_HOST
```

---

## 🧭 Commands (slash interface)

From `src/cli/chat/nik-cli-commands.ts`.

| Command | Description |
|---------|-------------|
| `/help` | Help and command overview |
| `/quit`, `/exit` | Exit the app |
| `/clear` | Clear current chat |
| `/new [title]` | New session |
| `/model <name>` | Select current model |
| `/models` | List available models |
| `/set-key <model> <key>` | Set API key for a model |
| `/config` | Show current configuration |
| `/debug` | Diagnostic info for keys/models |
| `/temp <0.0-2.0>` | Set temperature |
| `/history <on|off>` | Enable/disable history |
| `/system <prompt>` | Set session system prompt |
| `/sessions` | List sessions |
| `/export [id]` | Export session to Markdown |
| `/stats` | Usage stats |
| `/agents` | List agents |
| `/agent <name> <task>` | Run a specific agent |
| `/auto <description>` | Autonomous multi-step execution |
| `/parallel <agents> <task>` | Run agents in parallel |
| `/factory` | Agent factory dashboard |
| `/create-agent <spec>` | Create a specialized agent blueprint |
| `/launch-agent <blueprint-id>` | Launch an agent from blueprint |
| `/context <paths>` | Select workspace context paths |
| `/stream` | Agents stream dashboard |
| `/read <file>` | Read file |
| `/write <file> <content>` | Write file |
| `/edit <file>` | Interactive editor |
| `/ls [dir]` | List files/folders |
| `/search <query>` | Search (grep-like) |
| `/grep <query>` | Search alias |
| `/run <cmd>` | Execute shell command |
| `/install <pkgs>` | Install packages (npm/yarn) |
| `/npm <args>` | npm commands |
| `/yarn <args>` | yarn commands (not recommended) |
| `/git <args>` | git commands |
| `/docker <args>` | docker commands |
| `/ps` | Active processes |
| `/kill <pid>` | Terminate process |
| `/build` | Build project |
| `/test [pattern]` | Tests (vitest) |
| `/lint` | Linting |
| `/create <type> <name>` | Project scaffolding |

> Note: “sensitive” commands may require interactive approval (UI `approval-system`).

---

## 🧩 Agents

Agents registration in `src/cli/register-agents.ts`.

| ID                | Name            | Description |
|-------------------|-----------------|-------------|
| `universal-agent` | Universal Agent | All‑in‑one agent with capabilities for coding, analysis, review, optimization, testing, frontend, backend, DevOps, automation, and file/terminal tools. |

> More agent classes exist under `src/cli/automation/agents/`, but by default `UniversalAgent` is registered (enterprise-oriented).

---

## 🛠️ Tools

Implemented in `src/cli/tools/` with registry and security policies.

| Tool | File | Main features |
|------|------|---------------|
| read-file-tool | `read-file-tool.ts` | Safe reading, configurable encoding, `maxLines`, chunked streaming |
| write-file-tool | `write-file-tool.ts` | Safe writing, creates file if missing |
| edit-tool | `edit-tool.ts` | Interactive editing with diff |
| multi-edit-tool | `multi-edit-tool.ts` | Atomic multi-file edits |
| replace-in-file-tool | `replace-in-file-tool.ts` | Targeted replacements with safety |
| find-files-tool | `find-files-tool.ts` | File search (glob) |
| grep-tool | `grep-tool.ts` | Grep-style content search |
| list-tool | `list-tool.ts` | Safe directory/metadata listing |
| run-command-tool | `run-command-tool.ts` | Controlled command execution |
| secure-command-tool | `secure-command-tool.ts` | Advanced policies/approvals |
| tools-manager | `tools-manager.ts` | Tools registry/orchestration |

> Step-wise reading by line ranges: currently partially supported via `maxLines` and `readStream()`; interactive range stepping is on the roadmap.

---

## 🔒 Security and approvals

- `approval-system` (UI) for sensitive actions (network, commands, file modifications)
- Configurable sandbox in `config.json` (`sandbox.enabled`, `allowNetwork`, `allowCommands` …)
- Execution policies under `src/cli/policies/`

---

## 🏗️ Architecture (main directories)

```
src/cli/
├── ai/                      # Providers and ModelProvider
├── automation/              # Agents and orchestration
├── chat/                    # Chat interfaces and slash commands
├── context/                 # RAG and workspace context
├── core/                    # Config, logger, agent manager, types
├── services/                # Agent/Tool/Planning/LSP services
├── tools/                   # Safe tools and registry
├── ui/                      # Terminal UI, diff and approvals
├── index.ts                 # Unified entrypoint (streaming orchestrator)
└── unified-cli.ts           # Claude-like interface launcher
```

Key components:

- `ModelProvider` (`src/cli/ai/model-provider.ts`) – Anthropic/OpenAI/Google/Ollama integration (incl. streaming)
- `SimpleConfigManager` (`src/cli/core/config-manager.ts`) – load/save config, Zod validation
- `AgentManager` (`src/cli/core/agent-manager.ts`) – agents lifecycle
- `approval-system`, `diff-manager` (UI) – UX for actions and diff review
- `nik-cli-commands.ts` – `/...` commands map

---

## 🧪 Development and scripts

Scripts (`package.json`):

| Script | Command |
|--------|---------|
| start | `ts-node --project tsconfig.cli.json src/cli/index.ts` |
| dev | `npm start` |
| build | `tsc --project tsconfig.cli.json` |
| build:start | `npm run build && node dist/cli/index.js` |
| build:bin | `npm run build && pkg dist/cli/index.js --compress Brotli --output build/nikcli` |
| build:bin:mac | `... --targets node18-macos-arm64,node18-macos-x64 ...` |
| build:bin:linux | `... --targets node18-linux-x64 ...` |
| test | `vitest` |
| test:run | `vitest run` |
| test:watch | `vitest --watch` |
| lint | `eslint src --ext .ts,.tsx` |

Run tests/lint:

```bash
npm test
npm run lint
```

Build standalone binary (optional):

```bash
npm run build:bin      # auto-detect targets
npm run build:bin:mac  # macOS (arm64/x64)
npm run build:bin:linux
```

---

## 🧩 Integrations and LSP

- LSP/JSON-RPC present under `src/cli/lsp/` and `vscode-jsonrpc`
- MCP client placeholder in `src/cli/core/mcp-client.ts` (full MCP server support planned on the roadmap)

---

## 🛠️ Troubleshooting

- Node < 18: upgrade (version check runs on startup)
- Missing API keys: use `/set-key` or environment variables
- Ollama unreachable: start `ollama serve` or app; `OLLAMA_HOST` optional
- TypeScript build errors: `rm -rf dist && npm run build`
- Script permissions: `chmod +x bin/nikcli`

---

## 🗺️ Short roadmap

- Step-wise reader for large files (interactive ranges)
- Client-side MCP server integration (complete)
- External extensions/plugins and API gateway

---

## 📄 License & contributions

- License: MIT
- PRs welcome: open a feature branch, test with `vitest`, provide a clear description

---

Built with ❤️ for developers who want to bring the Claude Code experience to the terminal, safely and productively.
