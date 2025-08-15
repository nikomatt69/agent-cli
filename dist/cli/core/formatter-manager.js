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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFormatterManager = exports.FormatterManager = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const path_1 = require("path");
const advanced_cli_ui_1 = require("../ui/advanced-cli-ui");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class FormatterManager {
    constructor(workingDirectory, config = {}) {
        this.formatters = new Map();
        this.formatTypeScript = (content) => {
            return content
                .replace(/;\s*\n\s*\n+/g, ';\n\n')
                .replace(/{\s*\n\s*\n+/g, '{\n')
                .replace(/\n\s*\n+}/g, '\n}')
                .replace(/,\s*\n\s*\n+/g, ',\n')
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
        };
        this.formatJSON = (content) => {
            try {
                const parsed = JSON.parse(content);
                return JSON.stringify(parsed, null, 2);
            }
            catch {
                return content;
            }
        };
        this.formatCSS = (content) => {
            return content
                .replace(/{\s*\n\s*\n+/g, '{\n  ')
                .replace(/;\s*\n\s*\n+/g, ';\n  ')
                .replace(/\n\s*\n+}/g, '\n}')
                .replace(/,\s*\n\s*\n+/g, ',\n')
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
        };
        this.formatPython = (content) => {
            return content
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n')
                .replace(/:\s*\n\s*\n+/g, ':\n')
                .replace(/,\s*\n\s*\n+/g, ',\n');
        };
        this.formatRust = (content) => {
            return content
                .replace(/{\s*\n\s*\n+/g, '{\n    ')
                .replace(/;\s*\n\s*\n+/g, ';\n')
                .replace(/\n\s*\n+}/g, '\n}')
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
        };
        this.formatGo = (content) => {
            return content
                .replace(/{\s*\n\s*\n+/g, '{\n\t')
                .replace(/;\s*\n\s*\n+/g, ';\n')
                .replace(/\n\s*\n+}/g, '\n}')
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
        };
        this.formatHTML = (content) => {
            return content
                .replace(/>\s*\n\s*\n+</g, '>\n<')
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
        };
        this.formatMarkdown = (content) => {
            return content
                .replace(/\s+$/gm, '')
                .replace(/\n{4,}/g, '\n\n\n')
                .replace(/^(#{1,6})\s+/gm, '$1 ')
                .replace(/\*\s+/g, '* ')
                .replace(/-\s+/g, '- ');
        };
        this.formatYAML = (content) => {
            return content
                .replace(/:\s*\n\s*\n+/g, ':\n')
                .replace(/\s+$/gm, '')
                .replace(/\n{3,}/g, '\n\n');
        };
        this.workingDirectory = workingDirectory;
        this.config = {
            enabled: true,
            formatOnSave: true,
            respectEditorConfig: true,
            ...config
        };
        this.initializeFormatters();
    }
    static getInstance(workingDirectory, config) {
        if (!FormatterManager.instance) {
            FormatterManager.instance = new FormatterManager(workingDirectory, config);
        }
        return FormatterManager.instance;
    }
    initializeFormatters() {
        this.formatters.set('typescript', {
            name: 'Prettier',
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
            command: 'npx',
            args: ['prettier', '--write'],
            configFiles: ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'],
            installCommand: 'npm install --save-dev prettier',
            fallbackFormatter: this.formatTypeScript
        });
        this.formatters.set('json', {
            name: 'Prettier',
            extensions: ['.json'],
            command: 'npx',
            args: ['prettier', '--write'],
            configFiles: ['.prettierrc'],
            installCommand: 'npm install --save-dev prettier',
            fallbackFormatter: this.formatJSON
        });
        this.formatters.set('css', {
            name: 'Prettier',
            extensions: ['.css', '.scss', '.sass', '.less'],
            command: 'npx',
            args: ['prettier', '--write'],
            configFiles: ['.prettierrc'],
            installCommand: 'npm install --save-dev prettier',
            fallbackFormatter: this.formatCSS
        });
        this.formatters.set('python', {
            name: 'Black',
            extensions: ['.py'],
            command: 'black',
            args: [],
            configFiles: ['pyproject.toml', '.black'],
            installCommand: 'pip install black',
            fallbackFormatter: this.formatPython
        });
        this.formatters.set('rust', {
            name: 'rustfmt',
            extensions: ['.rs'],
            command: 'rustfmt',
            args: [],
            configFiles: ['rustfmt.toml', '.rustfmt.toml'],
            installCommand: 'rustup component add rustfmt',
            fallbackFormatter: this.formatRust
        });
        this.formatters.set('go', {
            name: 'gofmt',
            extensions: ['.go'],
            command: 'gofmt',
            args: ['-w'],
            configFiles: [],
            installCommand: 'go install golang.org/x/tools/cmd/goimports@latest',
            fallbackFormatter: this.formatGo
        });
        this.formatters.set('html', {
            name: 'Prettier',
            extensions: ['.html', '.htm'],
            command: 'npx',
            args: ['prettier', '--write'],
            configFiles: ['.prettierrc'],
            installCommand: 'npm install --save-dev prettier',
            fallbackFormatter: this.formatHTML
        });
        this.formatters.set('markdown', {
            name: 'Prettier',
            extensions: ['.md', '.markdown'],
            command: 'npx',
            args: ['prettier', '--write'],
            configFiles: ['.prettierrc'],
            installCommand: 'npm install --save-dev prettier',
            fallbackFormatter: this.formatMarkdown
        });
        this.formatters.set('yaml', {
            name: 'Prettier',
            extensions: ['.yml', '.yaml'],
            command: 'npx',
            args: ['prettier', '--write'],
            configFiles: ['.prettierrc'],
            installCommand: 'npm install --save-dev prettier',
            fallbackFormatter: this.formatYAML
        });
        if (this.config.customFormatters) {
            for (const [key, formatter] of Object.entries(this.config.customFormatters)) {
                this.formatters.set(key, formatter);
            }
        }
    }
    async formatContent(content, filePath) {
        if (!this.config.enabled) {
            return {
                success: true,
                formatted: false,
                content,
                originalContent: content
            };
        }
        const ext = (0, path_1.extname)(filePath).toLowerCase();
        const formatter = this.getFormatterForExtension(ext);
        if (!formatter) {
            return {
                success: true,
                formatted: false,
                content,
                originalContent: content,
                warnings: [`No formatter available for ${ext} files`]
            };
        }
        advanced_cli_ui_1.advancedUI.logInfo(`🎨 Formatting ${filePath} with ${formatter.name}...`);
        try {
            const externalResult = await this.tryExternalFormatter(content, filePath, formatter);
            if (externalResult.success) {
                return externalResult;
            }
            if (formatter.fallbackFormatter) {
                advanced_cli_ui_1.advancedUI.logInfo(`🔄 Using fallback formatter for ${ext}...`);
                const formattedContent = formatter.fallbackFormatter(content);
                return {
                    success: true,
                    formatted: formattedContent !== content,
                    content: formattedContent,
                    originalContent: content,
                    formatter: `${formatter.name} (fallback)`,
                    warnings: externalResult.error ? [`External formatter failed: ${externalResult.error}`] : undefined
                };
            }
            return {
                success: false,
                formatted: false,
                content,
                originalContent: content,
                error: `No formatter available for ${ext}`,
                formatter: formatter.name
            };
        }
        catch (error) {
            return {
                success: false,
                formatted: false,
                content,
                originalContent: content,
                error: error.message,
                formatter: formatter.name
            };
        }
    }
    async tryExternalFormatter(content, filePath, formatter) {
        try {
            try {
                await execAsync(`which ${formatter.command}`);
            }
            catch {
                if (formatter.installCommand) {
                    advanced_cli_ui_1.advancedUI.logInfo(`📦 Installing ${formatter.name}...`);
                    await execAsync(formatter.installCommand, { cwd: this.workingDirectory });
                }
                else {
                    return {
                        success: false,
                        formatted: false,
                        content,
                        originalContent: content,
                        error: `${formatter.command} not found and no install command provided`
                    };
                }
            }
            const tempFile = (0, path_1.join)(this.workingDirectory, `.temp_format_${Date.now()}${(0, path_1.extname)(filePath)}`);
            (0, fs_1.writeFileSync)(tempFile, content, 'utf-8');
            try {
                const args = [...formatter.args, tempFile];
                const command = `${formatter.command} ${args.join(' ')}`;
                await execAsync(command, { cwd: this.workingDirectory });
                const formattedContent = (0, fs_1.readFileSync)(tempFile, 'utf-8');
                return {
                    success: true,
                    formatted: formattedContent !== content,
                    content: formattedContent,
                    originalContent: content,
                    formatter: formatter.name
                };
            }
            finally {
                try {
                    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                    await fs.unlink(tempFile);
                }
                catch {
                }
            }
        }
        catch (error) {
            return {
                success: false,
                formatted: false,
                content,
                originalContent: content,
                error: error.message
            };
        }
    }
    getFormatterForExtension(ext) {
        for (const formatter of this.formatters.values()) {
            if (formatter.extensions.includes(ext)) {
                return formatter;
            }
        }
        return null;
    }
    detectProjectConfig(filePath) {
        const dir = (0, path_1.dirname)(filePath);
        const configs = {};
        const prettierConfigs = ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'];
        for (const config of prettierConfigs) {
            const configPath = (0, path_1.join)(dir, config);
            if ((0, fs_1.existsSync)(configPath)) {
                try {
                    if (config.endsWith('.json') || config === '.prettierrc') {
                        configs.prettier = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8'));
                    }
                }
                catch {
                }
                break;
            }
        }
        const editorConfigPath = (0, path_1.join)(dir, '.editorconfig');
        if ((0, fs_1.existsSync)(editorConfigPath)) {
            configs.editorconfig = (0, fs_1.readFileSync)(editorConfigPath, 'utf-8');
        }
        const eslintConfigs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'];
        for (const config of eslintConfigs) {
            const configPath = (0, path_1.join)(dir, config);
            if ((0, fs_1.existsSync)(configPath)) {
                configs.eslint = configPath;
                break;
            }
        }
        return configs;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    getConfig() {
        return { ...this.config };
    }
    getAvailableFormatters() {
        return Array.from(this.formatters.keys());
    }
    registerFormatter(name, formatter) {
        this.formatters.set(name, formatter);
    }
}
exports.FormatterManager = FormatterManager;
const createFormatterManager = (workingDirectory, config) => {
    return FormatterManager.getInstance(workingDirectory, config);
};
exports.createFormatterManager = createFormatterManager;
