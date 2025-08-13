# NikCLI – Autonomous AI Terminal Assistant (Claude Code style)

> A modern TypeScript CLI for agent-assisted development with a terminal UI, safe tools, autonomous planning, and multi-model support (Anthropic, OpenAI, Google, Ollama).

## Introduction

NikCLI is a powerful command-line interface designed to enhance developer productivity by leveraging artificial intelligence (AI) technologies. It integrates various AI models, allowing users to perform tasks like coding, testing, analysis, and operations efficiently.

### System Requirements

- **Node.js**: >= 18
- **TypeScript**: ^5.3
- **Binary**: `nikcli` (optional `pkg` build for standalone distributions)
- **Configuration Path**: `~/.nikcli/config.json`
- **NPM Package**: `@cadcamfun/nikcli`

---

## ✨ Key Features

- **Streaming Terminal UI**: Provides an interactive interface with intuitive slash commands (`/help`, `/model`, `/agents`, ...).
- **Enterprise Universal Agent**: Capable of end-to-end tasks including coding, analysis, refactoring, testing, and DevOps processes.
- **Safe Tool System**: Implements secure read/write file operations, command execution, and approvals before critical actions.
- **Advanced Planning & Orchestration**: Features autonomous and parallel task management, including an integrated diff viewer for reviewing changes.
- **Pluggable AI Providers**: Supports multiple AI providers like Anthropic, OpenAI, Google, and Ollama, with some options for local execution without API keys.
- **Persistent User Configuration**: Utilizes a validated configuration schema for maintaining user preferences and settings.

---

## 🚀 Installation

### Option A – Local Development

To set up NikCLI for local development, execute the following commands:

```bash
npm install
npm run build
./bin/nikcli
```

### Option B – Quickstart via Curl (Global, Beta)

For a quick installation, see the `installer/README.md`. Example commands are as follows:

```bash
# Latest beta version
curl -fsSL https://raw.githubusercontent.com/nikomatt69/agent-cli/main/installer/install.sh | bash

# Specific version installation
curl -fsSL https://raw.githubusercontent.com/nikomatt69/agent-cli/main/installer/install.sh | bash -s -- --version 0.1.0-beta
```

To uninstall NikCLI:

```bash
curl -fsSL https://raw.githubusercontent.com/nikomatt69/agent-cli/main/installer/uninstall.sh | bash
```

> **Note**: The installer uses `npm i -g`. Using npm is preferred over yarn.

---

## ⚡ Quickstart Guide

Run the interactive interface with:

```bash
nikcli
```

Alternatively, you can start it from the repository if you're in development mode:

```bash
./bin/nikcli
```

### Quick Example Commands

Here are some example commands to get you started:

```text
/help                    # List available commands
/model claude-sonnet-4-20250514
/set-key claude-sonnet-4-20250514 sk-ant-...
/read src/cli/index.ts
/grep "ModelProvider"
/run "npm test"
```

---

## 🤖 Supported Models

The following models are available by default:
| Name | Provider | Model | Requires API key |
|--------------------------|-------------|-----------------------------|------------------|
| claude-sonnet-4-20250514 | Anthropic | claude-sonnet-4-20250514 | Yes |
| claude-3-haiku-20240229 | Anthropic | claude-3-haiku-20240229 | Yes |
| gpt-4o-mini | OpenAI | gpt-4o-mini | Yes |
| gpt-5 | OpenAI | gpt-5 | Yes |
| gpt-4o | OpenAI | gpt-4o | Yes |
| gpt-4.1 | OpenAI | gpt-4.1 | Yes |
| gpt-4 | OpenAI | gpt-4 | Yes |
| gpt-3.5-turbo | OpenAI | gpt-3.5-turbo | Yes |
| gpt-3.5-turbo-16k | OpenAI | gpt-3.5-turbo-16k | Yes |
| gemini-pro | Google | gemini-pro | Yes |
| gemini-1.5-pro | Google | gemini-1.5-pro | Yes |
| llama3.1:8b | Ollama | llama3.1:8b | No |
| codellama:7b | Ollama | codellama:7b | No |
| mistral:7b | Ollama | mistral:7b | No |

### Change Model Command

Use the command `/model <name>` to change the model. To view the list of available models, type `/models`. To set an API key for a specific model, use `/set-key <model> <key>`. Note that Ollama does not require keys; ensure that `ollama serve` is running on the default host `127.0.0.1:11434`.

---

## 🔧 Configuration

The configuration file is located at `~/.nikcli/config.json` and follows a predefined schema. For details, refer to `src/cli/core/config-manager.ts`.

### Minimal Configuration Example

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
  "models": {
    /* defaults included */
  },
  "apiKeys": {},
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

### Setting API Keys via Environment Variables

Alternatively to `/set-key`, you can set keys via environment variables:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
# Ollama: no key, optional OLLAMA_HOST
```

---

## 🧭 Commands (Slash Interface)

The following commands are integrated within `src/cli/chat/nik-cli-commands.ts`.
| Command | Description |
|-------------------------|------------------------------------|
| `/help` | Help and command overview |
| `/quit`, `/exit` | Exit the app |
| `/clear` | Clear current chat |
| `/new [title]` | Start a new session |
| `/model <name>` | Select the current model |
| `/models` | List available models |
| `/set-key <model> <key>`| Set API key for a specific model |
| `/config` | Show current configuration |
| `/debug` | Diagnostic information |
| `/temp <0.0-2.0>` | Set the temperature |
| `/history <on|off>` | Enable or disable history |
| `/system <prompt>` | Set the session system prompt |
| `/sessions` | List existing sessions |
| `/export [id]` | Export session to Markdown |
| `/stats` | Display usage stats |
| `/agents` | List available agents |
| `/agent <name> <task>` | Run a specific agent |
| `/auto <description>` | Execute tasks autonomously |
| `/parallel <agents> <task>` | Run agents in parallel |
| `/factory` | Agent factory dashboard |
| `/create-agent <spec>` | Create a specialized agent |
| `/launch-agent <blueprint-id>` | Launch an agent from blueprint|
| `/context <paths>` | Specify workspace context paths |
| `/stream` | Access agents stream dashboard |
| `/read <file>` | Read a file |
| `/write <file> <content>` | Write to a file |
| `/edit <file>` | Enter interactive file editor |
| `/ls [dir]` | List files and folders |
| `/search <query>` | Search operations (grep-like) |
| `/grep <query>` | Alias for search |
| `/run <cmd>` | Execute shell commands |
| `/install <pkgs>` | Install packages (npm/yarn) |
| `/npm <args>` | Execute npm commands |
| `/yarn <args>` | Execute yarn commands (not recommended) |
| `/git <args>` | Execute git commands |
| `/docker <args>` | Execute docker commands |
| `/ps` | Display active processes |
| `/kill <pid>` | Terminate a process |
| `/build` | Build the project |
| `/test [pattern]` | Run tests (using vitest) |
| `/lint` | Execute linting |

> **Note**: Sensitive commands may require interactive approval via the `approval-system` UI.

---

## 🧩 Agents

Agents are registered in `src/cli/register-agents.ts`.
| ID | Name | Description |
|-----------------------|----------------------|-------------|
| `universal-agent` | Universal Agent | All-in-one agent capable of coding, analysis, review, optimization, testing, frontend/backend duties, DevOps, automation, and file/terminal tools. |

> Other agent classes are saved under `src/cli/automation/agents/`, but by default, the `UniversalAgent` is registered, focusing on enterprise functionalities.

---

## 🛠️ Tools

Tools are implemented in `src/cli/tools/` and managed with security policies.
| Tool | File | Main Features |
|--------------------------|----------------------------|----------------|
| read-file-tool | `read-file-tool.ts` | Safe reading methods, configurable encoding, `maxLines`, chunked streaming. |
| write-file-tool | `write-file-tool.ts` | Safe writing capabilities, creates file if missing. |
| edit-tool | `edit-tool.ts` | Interactive file editing with diff viewing. |
| multi-edit-tool | `multi-edit-tool.ts` | Atomic multi-file editing operations. |
| replace-in-file-tool | `replace-in-file-tool.ts` | Targeted replacements with safety checks. |
| find-files-tool | `find-files-tool.ts` | File search capabilities (glob support). |
| grep-tool | `grep-tool.ts` | Grep-style content search functionality. |
| list-tool | `list-tool.ts` | Safe directory/metadata listing features. |
| run-command-tool | `run-command-tool.ts` | Controlled shell command execution. |
| secure-command-tool | `secure-command-tool.ts` | Advanced policies and approval requirements. |
| tools-manager | `tools-manager.ts` | Tools registry and orchestration. |

> Note: Step-wise reading by line ranges is partially supported via `maxLines` and `readStream()`; interactive range stepping is planned for future releases.

---

## 🔒 Security and Approvals

The security framework includes the following features:

- UI approval system for sensitive actions, including network access, command execution, and file modifications.
- Configurable sandbox settings in `config.json` (check options like `sandbox.enabled`, `allowNetwork`, `allowCommands`, etc.).
- Execution policies defined in `src/cli/policies/` to enforce secure interactions.

---

## 🏗️ Architecture Overview

The main directory structure is as follows:

```
src/cli/
├── ai/                     # Handles Providers and ModelProvider
├── automation/             # Manages Agents and orchestration
├── chat/                   # Contains chat interfaces and slash commands
├── context/                # Responsible for RAG and workspace context
├── core/                   # Core configurations, logger, agent manager, data types
├── services/               # Provides Agent, Tool, Planning, and LSP services
├── tools/                  # Implements safe tools with a registry
├── ui/                     # User Interface management including diff and approvals
├── index.ts                # Unified entry point for streaming orchestration
└── unified-cli.ts          # Launcher for Claude-like interface
```

### Key Components:

- `ModelProvider` located in `src/cli/ai/model-provider.ts`: Integrates functionalities from Anthropic, OpenAI, Google, and Ollama (including streaming).
- `SimpleConfigManager` in `src/cli/core/config-manager.ts`: Manages loading and saving configurations with Zod validation.
- `AgentManager` in `src/cli/core/agent-manager.ts`: Handles the agent lifecycle and management.
- Includes components for the `approval-system` and `diff-manager` to make user experience better and efficient.
- Command mappings are defined in `nik-cli-commands.ts`, managing the functionality of `/...` commands.

---

## 🧪 Development and Available Scripts

Here are the available scripts from `package.json`:
| Script | Command |
|------------|------------------------------------|
| start | `ts-node --project tsconfig.cli.json src/cli/index.ts` |
| dev | `npm start` |
| build | `tsc --project tsconfig.cli.json` |
| build:start| `npm run build && node dist/cli/index.js` |
| build:bin | `npm run build && pkg dist/cli/index.js --compress Brotli --output build/nikcli` |
| build:bin:mac | `... --targets node18-macos-arm64,node18-macos-x64 ...` |
| build:bin:linux | `... --targets node18-linux-x64 ...` |
| test | `vitest` |
| test:run | `vitest run` |
| test:watch | `vitest --watch` |
| lint | `eslint src --ext .ts,.tsx` |

### Testing and Building the Project

Run the following commands to run tests or lint the project:

```bash
npm test
npm run lint
```

To build the standalone binary (optional), use:

```bash
npm run build:bin      # auto-detect targets
npm run build:bin:mac   # macOS (arm64/x64)
npm run build:bin:linux  # Linux
dist/nikcli # or just 'dist/nikcli' to execute the binary
```

---

## 🧩 Integrations and LSP Support

- Language Server Protocol (LSP) and JSON-RPC are implemented in `src/cli/lsp/` and utilize `vscode-jsonrpc`.
- The MCP client placeholder can be found in `src/cli/core/mcp-client.ts`, with full MCP server support planned for future releases.

---

## 🛠️ Troubleshooting Common Issues

If you encounter issues, check the following:

- Ensure your Node version is >= 18.
- API keys not set: you may need to use `/set-key` or set them as environment variables.
- If the Ollama model is unreachable, make sure to start `ollama serve` or the app and set the `OLLAMA_HOST` appropriately.
- For TypeScript build issues, run `rm -rf dist && npm run build` to clean and rebuild.
- If you experience script permission errors, try running `chmod +x bin/nikcli` to ensure execution permissions.

---

## 🗺️ Short Roadmap for Future Features

Future enhancements may include:

- An interactive step-wise reader for large files that supports range selections.
- Complete integration of a client-side MCP server.
- Support for external extensions, plugins, and an API gateway to facilitate more extensive features.

---

## 📄 License & Contributions

- License: This project is licensed under the MIT License.
- Contributions are welcome: Open a feature branch, run tests using `vitest`, and provide clear descriptions in your pull requests.

---

Built with ❤️ for developers aspiring to integrate advanced AI functionalities into their terminal workflow safely and productively.
