#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const agent_manager_1 = require("./core/agent-manager");
const agent_todo_manager_1 = require("./core/agent-todo-manager");
const session_manager_1 = require("./persistence/session-manager");
const config_manager_1 = require("./config/config-manager");
const chat_orchestrator_1 = require("./chat/chat-orchestrator");
const logger_1 = require("./utils/logger");
function parseArgs(argv) {
    const opts = {};
    const pos = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const k = a.slice(2);
            const n = argv[i + 1];
            if (['model', 'temp', 'approval', 'sandbox', 'log-level'].includes(k) && n && !n.startsWith('--')) {
                opts[k] = n;
                i++;
            }
            else if (k === 'help')
                opts.help = true;
        }
        else
            pos.push(a);
    }
    return { opts, pos };
}
async function main() {
    const [, , ...args] = process.argv;
    const { opts, pos } = parseArgs(args);
    if (opts.help || pos.length === 0) {
        console.log('Usage: ai-coder-exec [--model MODEL] [--temp T] [--approval POLICY] [--sandbox POLICY] [--log-level LEVEL] "instruction"');
        process.exit(0);
    }
    const cmd = pos.join(' ').trim();
    const cfgMgr = new config_manager_1.ConfigManager();
    let cfg = await cfgMgr.load();
    const upd = {};
    if (opts.model)
        upd.model = opts.model;
    if (opts['log-level'])
        upd.logLevel = opts['log-level'];
    if (opts.temp)
        upd.temperature = parseFloat(opts.temp);
    if (opts.approval)
        upd.approvalPolicy = opts.approval;
    if (opts.sandbox)
        upd.sandbox = opts.sandbox;
    if (Object.keys(upd).length)
        cfg = await cfgMgr.update(upd);
    const logger = logger_1.Logger.getInstance();
    const logDir = path_1.default.join(os_1.default.homedir(), '.ai-coder-cli', 'log');
    await logger.configure({ level: cfg.logLevel, logDir });
    await logger.info('Non-interactive mode start');
    const agMgr = new agent_manager_1.AgentManager();
    const tdMgr = new agent_todo_manager_1.AgentTodoManager();
    const ssMgr = new session_manager_1.SessionManager();
    const orch = new chat_orchestrator_1.ChatOrchestrator(agMgr, tdMgr, ssMgr, cfgMgr);
    const sid = (0, nanoid_1.nanoid)();
    await logger.debug(`Session: ${sid}`);
    try {
        await orch.handleInput(sid, cmd);
        await logger.info('Done');
    }
    catch (e) {
        await logger.error(`Error: ${e.message}`);
        process.exitCode = 1;
    }
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
