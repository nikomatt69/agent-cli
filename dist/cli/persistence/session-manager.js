"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class SessionManager {
    constructor(dir) {
        this.baseDir = dir || path_1.default.join(process.cwd(), 'sessions');
    }
    getSessionPath(id) {
        return path_1.default.join(this.baseDir, `${id}.json`);
    }
    async loadSession(id) {
        try {
            const raw = await fs_1.promises.readFile(this.getSessionPath(id), 'utf-8');
            return JSON.parse(raw);
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return null;
            throw e;
        }
    }
    async saveSession(session) {
        await fs_1.promises.mkdir(this.baseDir, { recursive: true });
        session.updatedAt = new Date().toISOString();
        await fs_1.promises.writeFile(this.getSessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
    }
    async listSessions() {
        try {
            const files = await fs_1.promises.readdir(this.baseDir);
            const sessions = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const raw = await fs_1.promises.readFile(path_1.default.join(this.baseDir, file), 'utf-8');
                    sessions.push(JSON.parse(raw));
                }
            }
            return sessions;
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return [];
            throw e;
        }
    }
    async deleteSession(id) {
        await fs_1.promises.unlink(this.getSessionPath(id));
    }
}
exports.SessionManager = SessionManager;
