"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatManager = exports.ChatManager = void 0;
const nanoid_1 = require("nanoid");
const config_manager_1 = require("../config/config-manager");
class ChatManager {
    constructor() {
        this.currentSession = null;
        this.sessions = new Map();
    }
    createNewSession(title, systemPrompt) {
        const session = {
            id: (0, nanoid_1.nanoid)(),
            title: title || `Chat ${new Date().toLocaleDateString()}`,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            systemPrompt: systemPrompt || config_manager_1.configManager.get('systemPrompts').default,
        };
        // Add system message if system prompt is provided
        if (session.systemPrompt) {
            session.messages.push({
                role: 'system',
                content: session.systemPrompt,
                timestamp: new Date(),
            });
        }
        this.sessions.set(session.id, session);
        this.currentSession = session;
        return session;
    }
    getCurrentSession() {
        return this.currentSession;
    }
    setCurrentSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.currentSession = session;
        }
        return session || null;
    }
    addMessage(content, role) {
        if (!this.currentSession) {
            this.createNewSession();
        }
        const message = {
            role,
            content,
            timestamp: new Date(),
        };
        this.currentSession.messages.push(message);
        this.currentSession.updatedAt = new Date();
        // Trim history if needed
        this.trimHistory();
        return message;
    }
    getMessages() {
        return this.currentSession?.messages || [];
    }
    getContextMessages() {
        const messages = this.getMessages();
        if (!config_manager_1.configManager.get('chatHistory')) {
            // Return only system message and last user message if history is disabled
            const systemMessage = messages.find(m => m.role === 'system');
            const lastUserMessage = messages.filter(m => m.role === 'user').pop();
            return [
                ...(systemMessage ? [systemMessage] : []),
                ...(lastUserMessage ? [lastUserMessage] : []),
            ];
        }
        return messages;
    }
    trimHistory() {
        if (!this.currentSession)
            return;
        const maxLength = config_manager_1.configManager.get('maxHistoryLength');
        const messages = this.currentSession.messages;
        if (messages.length <= maxLength)
            return;
        // Always keep system message
        const systemMessage = messages.find(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system');
        // Keep only the most recent messages
        const keepMessages = otherMessages.slice(-(maxLength - 1));
        this.currentSession.messages = [
            ...(systemMessage ? [systemMessage] : []),
            ...keepMessages,
        ];
    }
    clearCurrentSession() {
        if (this.currentSession) {
            this.currentSession.messages = [];
            if (this.currentSession.systemPrompt) {
                this.currentSession.messages.push({
                    role: 'system',
                    content: this.currentSession.systemPrompt,
                    timestamp: new Date(),
                });
            }
            this.currentSession.updatedAt = new Date();
        }
    }
    listSessions() {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    deleteSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (this.currentSession?.id === sessionId) {
            this.currentSession = null;
        }
        return deleted;
    }
    exportSession(sessionId) {
        const session = sessionId
            ? this.sessions.get(sessionId)
            : this.currentSession;
        if (!session) {
            throw new Error('No session found');
        }
        const messages = session.messages
            .filter(m => m.role !== 'system')
            .map(m => `**${m.role.toUpperCase()}**: ${m.content}`)
            .join('\n\n---\n\n');
        return `# ${session.title}\n\nCreated: ${session.createdAt.toLocaleString()}\nUpdated: ${session.updatedAt.toLocaleString()}\n\n---\n\n${messages}`;
    }
    getSessionStats() {
        const totalMessages = Array.from(this.sessions.values())
            .reduce((sum, session) => sum + session.messages.length, 0);
        return {
            totalSessions: this.sessions.size,
            totalMessages,
            currentSessionMessages: this.currentSession?.messages.length || 0,
        };
    }
}
exports.ChatManager = ChatManager;
exports.chatManager = new ChatManager();
