import { nanoid } from 'nanoid';
import { ChatMessage } from '../ai/model-provider';
import { configManager } from '../config/config-manager';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  systemPrompt?: string;
}

export class ChatManager {
  private currentSession: ChatSession | null = null;
  private sessions: Map<string, ChatSession> = new Map();

  createNewSession(title?: string, systemPrompt?: string): ChatSession {
    const session: ChatSession = {
      id: nanoid(),
      title: title || `Chat ${new Date().toLocaleDateString()}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      systemPrompt: systemPrompt || configManager.get('systemPrompts').default,
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

  getCurrentSession(): ChatSession | null {
    return this.currentSession;
  }

  setCurrentSession(sessionId: string): ChatSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  addMessage(content: string, role: 'user' | 'assistant'): ChatMessage {
    if (!this.currentSession) {
      this.createNewSession();
    }

    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date(),
    };

    this.currentSession!.messages.push(message);
    this.currentSession!.updatedAt = new Date();

    // Trim history if needed
    this.trimHistory();

    return message;
  }

  getMessages(): ChatMessage[] {
    return this.currentSession?.messages || [];
  }

  getContextMessages(): ChatMessage[] {
    const messages = this.getMessages();
    
    if (!configManager.get('chatHistory')) {
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

  private trimHistory(): void {
    if (!this.currentSession) return;

    const maxLength = configManager.get('maxHistoryLength');
    const messages = this.currentSession.messages;

    if (messages.length <= maxLength) return;

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

  clearCurrentSession(): void {
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

  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }
    return deleted;
  }

  exportSession(sessionId?: string): string {
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

  getSessionStats(): { totalSessions: number; totalMessages: number; currentSessionMessages: number } {
    const totalMessages = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.messages.length, 0);

    return {
      totalSessions: this.sessions.size,
      totalMessages,
      currentSessionMessages: this.currentSession?.messages.length || 0,
    };
  }
}

export const chatManager = new ChatManager();