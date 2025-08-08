"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatInterface = exports.ChatInterface = void 0;
const readline = __importStar(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const marked_1 = require("marked");
const marked_terminal_1 = __importDefault(require("marked-terminal"));
const chat_manager_1 = require("./chat-manager");
const model_provider_1 = require("../ai/model-provider");
const nik_cli_commands_1 = require("./nik-cli-commands");
// Configure marked for terminal rendering
const renderer = new marked_terminal_1.default();
marked_1.marked.setOptions({
    renderer,
});
class ChatInterface {
    constructor() {
        this.isStreaming = false;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 100,
        });
        this.slashCommands = new nik_cli_commands_1.SlashCommandHandler();
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        // Handle Ctrl+C gracefully
        this.rl.on('SIGINT', () => {
            if (this.isStreaming) {
                console.log(chalk_1.default.yellow('\n⏸️  Streaming stopped'));
                this.isStreaming = false;
                this.prompt();
            }
            else {
                console.log(chalk_1.default.yellow('\n👋 Goodbye!'));
                process.exit(0);
            }
        });
        // Handle line input
        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.prompt();
                return;
            }
            await this.handleInput(trimmed);
            this.prompt();
        });
        // Handle close
        this.rl.on('close', () => {
            console.log(chalk_1.default.yellow('\n👋 Goodbye!'));
            process.exit(0);
        });
    }
    getPrompt() {
        const modelInfo = model_provider_1.modelProvider.getCurrentModelInfo();
        const sessionId = chat_manager_1.chatManager.getCurrentSession()?.id.slice(0, 8) || 'new';
        return gradient_string_1.default.rainbow(`┌─[${modelInfo.name}:${sessionId}]\n└─❯ `);
    }
    updatePrompt() {
        this.rl.setPrompt(this.getPrompt());
    }
    async start() {
        this.showWelcome();
        // Validate API key
        if (!model_provider_1.modelProvider.validateApiKey()) {
            console.log(chalk_1.default.red('\n❌ Cannot start chat without valid API key'));
            console.log(chalk_1.default.gray('Use /help for setup instructions\n'));
        }
        // Create initial session
        chat_manager_1.chatManager.createNewSession();
        this.updatePrompt();
        this.prompt();
    }
    showWelcome() {
        const title = gradient_string_1.default.rainbow('🤖 AI Coder CLI');
        const modelInfo = model_provider_1.modelProvider.getCurrentModelInfo();
        const welcomeText = `
${title}
${chalk_1.default.gray('─'.repeat(40))}

Current Model: ${chalk_1.default.green(modelInfo.name)} (${chalk_1.default.gray(modelInfo.config.provider)})
Commands: ${chalk_1.default.cyan('/help')} for help, ${chalk_1.default.cyan('/quit')} to exit
Features: Multi-model support, code generation, chat history

${chalk_1.default.gray('Type your message or use slash commands...')}
    `;
        console.log((0, boxen_1.default)(welcomeText, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
        }));
    }
    async handleInput(input) {
        // Handle slash commands
        if (input.startsWith('/')) {
            const result = await this.slashCommands.handle(input);
            if (result.shouldUpdatePrompt) {
                this.updatePrompt();
            }
            if (result.shouldExit) {
                this.rl.close();
            }
            return;
        }
        // Regular chat message
        await this.handleChatMessage(input);
    }
    async handleChatMessage(input) {
        // Add user message to chat
        chat_manager_1.chatManager.addMessage(input, 'user');
        try {
            console.log(chalk_1.default.blue('\n🤖 '));
            this.isStreaming = true;
            let responseText = '';
            // Stream the response
            const messages = chat_manager_1.chatManager.getContextMessages();
            for await (const chunk of model_provider_1.modelProvider.streamResponse({ messages })) {
                if (!this.isStreaming)
                    break;
                process.stdout.write(chunk);
                responseText += chunk;
            }
            this.isStreaming = false;
            console.log('\n'); // New line after streaming
            // Add assistant message to chat
            chat_manager_1.chatManager.addMessage(responseText, 'assistant');
        }
        catch (error) {
            this.isStreaming = false;
            console.log(chalk_1.default.red(`\n❌ Error: ${error.message}`));
            if (error.message.includes('API key')) {
                console.log(chalk_1.default.gray('Use /set-key command to configure API keys'));
            }
        }
    }
    prompt() {
        if (!this.isStreaming) {
            this.rl.prompt();
        }
    }
    stop() {
        this.rl.close();
    }
}
exports.ChatInterface = ChatInterface;
exports.chatInterface = new ChatInterface();
