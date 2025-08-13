"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextEnhancer = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class ContextEnhancer {
    // Enhance messages with additional context and intelligence
    async enhance(messages, context) {
        const enhancedMessages = [...messages];
        // Add enhanced system prompt if not present
        if (!enhancedMessages.some(msg => msg.role === 'system')) {
            enhancedMessages.unshift({
                role: 'system',
                content: this.getEnhancedSystemPrompt(context)
            });
        }
        // Add workspace context for file-related queries
        const lastUserMessage = enhancedMessages.filter(msg => msg.role === 'user').pop();
        if (lastUserMessage && this.isFileRelatedQuery(lastUserMessage.content)) {
            const workspaceContext = this.getWorkspaceContext(context.workingDirectory);
            enhancedMessages.splice(1, 0, {
                role: 'system',
                content: `📁 **Workspace Context**:\n${workspaceContext}`
            });
        }
        // Add conversation memory for continuity
        if (context.conversationMemory.length > 0) {
            const memoryContext = this.getConversationMemory(context.conversationMemory);
            enhancedMessages.splice(1, 0, {
                role: 'system',
                content: `🧠 **Conversation Memory**:\n${memoryContext}`
            });
        }
        // Add execution context for ongoing operations
        if (context.executionContext.size > 0) {
            const executionContext = this.getExecutionContext(context.executionContext);
            enhancedMessages.splice(1, 0, {
                role: 'system',
                content: `⚙️ **Execution Context**:\n${executionContext}`
            });
        }
        return enhancedMessages;
    }
    getEnhancedSystemPrompt(context) {
        return `You are an advanced AI development assistant with enhanced capabilities:

🧠 **Enhanced Intelligence**:
- Context-aware analysis and reasoning
- Multi-step problem solving
- Pattern recognition and optimization
- Adaptive learning from conversation history

🛠️ **Advanced Tools**:
- File system operations with metadata analysis
- Code generation with syntax validation
- Directory exploration with intelligent filtering
- Command execution with safety checks
- Package management with dependency analysis

📊 **Context Management**:
- Workspace awareness and file structure understanding
- Conversation memory and pattern recognition
- Execution context tracking
- Analysis result caching

🎯 **Optimization Features**:
- Token-aware response generation
- Chained file reading for large analyses
- Intelligent caching strategies
- Performance monitoring and optimization

💡 **Best Practices**:
- Always validate file operations
- Provide clear explanations for complex tasks
- Use appropriate tools for each task type
- Maintain conversation context and continuity

**Current Working Directory**: ${context.workingDirectory}
**Available Tools**: read_file, write_file, explore_directory, run_command, analyze_project, manage_packages, generate_code

Respond in a helpful, professional manner with clear explanations and actionable insights.`;
    }
    isFileRelatedQuery(content) {
        const text = typeof content === 'string' ? content : String(content);
        const fileKeywords = ['file', 'read', 'write', 'create', 'modify', 'delete', 'analyze', 'scan', 'explore', 'directory', 'folder'];
        return fileKeywords.some(keyword => text.toLowerCase().includes(keyword));
    }
    getWorkspaceContext(workingDirectory) {
        try {
            const files = (0, fs_1.readdirSync)(workingDirectory, { withFileTypes: true });
            const fileTypes = this.analyzeFileTypes(files, workingDirectory);
            return `Project structure analysis:
- Total files: ${files.length}
- File types: ${Object.entries(fileTypes).map(([type, count]) => `${type}: ${count}`).join(', ')}
- Main directories: ${files.filter(f => f.isDirectory()).map(f => f.name).slice(0, 5).join(', ')}`;
        }
        catch (error) {
            return 'Unable to analyze workspace structure';
        }
    }
    analyzeFileTypes(files, workingDirectory) {
        const types = {};
        files.forEach(file => {
            if (file.isFile()) {
                const ext = (0, path_1.extname)(file.name).toLowerCase();
                const type = ext || 'no-extension';
                types[type] = (types[type] || 0) + 1;
            }
        });
        return types;
    }
    getConversationMemory(memory) {
        const recentMessages = memory.slice(-5); // Last 5 messages
        const summary = recentMessages.map(msg => {
            const content = typeof msg.content === 'string' ? msg.content : String(msg.content);
            return `${msg.role}: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
        }).join('\n');
        return `Recent conversation context:\n${summary}`;
    }
    getExecutionContext(executionContext) {
        const context = Array.from(executionContext.entries()).slice(0, 3);
        const summary = context.map(([key, value]) => {
            return `${key}: ${typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : String(value)}`;
        }).join('\n');
        return `Current execution context:\n${summary}`;
    }
}
exports.ContextEnhancer = ContextEnhancer;
