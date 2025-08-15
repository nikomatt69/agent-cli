"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuidanceManager = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class GuidanceManager {
    constructor() {
        this.files = [
            path_1.default.join(os_1.default.homedir(), '.nikcli', 'AGENTS.md', 'CLAUDE.md', 'NIKOCLI.md', 'CODEX.md'),
            'AGENTS.md',
            path_1.default.join(process.cwd(), 'AGENTS.md'),
        ];
    }
    async getGuidance() {
        let guidance = '';
        for (const f of this.files) {
            try {
                const content = await fs_1.promises.readFile(f, 'utf-8');
                guidance += `
---
# Source: ${f}

${content}
`;
            }
            catch { }
        }
        return guidance.trim();
    }
}
exports.GuidanceManager = GuidanceManager;
