"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamManager = void 0;
const events_1 = require("events");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/**
 * StreamManager emits events during planning/execution
 * and can export them to a file.
 */
class StreamManager {
    constructor() {
        this.emitter = new events_1.EventEmitter();
        this.events = [];
    }
    on(eventType, listener) {
        this.emitter.on(eventType, listener);
    }
    emit(event) {
        this.events.push(event);
        this.emitter.emit(event.type, event);
    }
    /** Export recorded events to a JSON file. */
    async exportEvents(agentId) {
        const dir = path_1.default.join(os_1.default.homedir(), '.nikcli', 'streams');
        await fs_1.promises.mkdir(dir, { recursive: true });
        const file = path_1.default.join(dir, `${agentId}-stream.json`);
        await fs_1.promises.writeFile(file, JSON.stringify(this.events, null, 2), 'utf-8');
        return file;
    }
}
exports.StreamManager = StreamManager;
