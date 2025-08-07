"use strict";
/**
 * Content Panel Component
 * Main content area for code editing and viewing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentPanel = void 0;
const blessed_1 = __importDefault(require("blessed"));
const events_1 = require("events");
const syntaxHighlighter_1 = require("../utils/syntaxHighlighter");
class ContentPanel extends events_1.EventEmitter {
    constructor(parent, config, logger) {
        super();
        this.openFiles = new Map();
        this.currentFile = null;
        this.focused = false;
        this.readOnly = false;
        this.config = config;
        this.logger = logger;
        this.createComponents(parent);
        this.setupEventHandlers();
    }
    /**
     * Create content panel components
     */
    createComponents(parent) {
        // Main container
        this.container = blessed_1.default.box({
            parent,
            top: 0,
            left: '25%',
            width: '50%',
            height: '70%',
            border: 'line',
            style: {
                border: { fg: 'cyan' },
                bg: 'black',
                fg: 'white'
            },
            label: ' Content ',
            tags: true
        });
        // Tab bar for open files
        this.tabBar = blessed_1.default.box({
            parent: this.container,
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            border: 'line',
            style: {
                border: { fg: 'blue' },
                bg: 'black',
                fg: 'white'
            },
            scrollable: true,
            tags: true
        });
        // Code viewer/editor
        this.codeViewer = blessed_1.default.textarea({
            parent: this.container,
            top: 3,
            left: 0,
            width: '100%',
            bottom: 1,
            style: {
                bg: 'black',
                fg: 'white',
                focus: {
                    bg: 'black',
                    fg: 'white'
                }
            },
            keys: true,
            vi: true,
            mouse: true,
            scrollable: true,
            alwaysScroll: true,
            inputOnFocus: true,
            wrap: false
        });
        // Status line (bottom)
        this.statusLine = blessed_1.default.box({
            parent: this.container,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            style: {
                bg: 'blue',
                fg: 'white'
            },
            content: ' Ready ',
            tags: true
        });
    }
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Code viewer events
        this.codeViewer.on('submit', () => {
            this.saveCurrentFile();
        });
        this.codeViewer.on('keypress', (ch, key) => {
            if (key.name === 'escape') {
                this.blur();
            }
            else if (key.ctrl && key.name === 's') {
                this.saveCurrentFile();
            }
            else if (key.ctrl && key.name === 'w') {
                this.closeCurrentFile();
            }
            else if (key.ctrl && key.name === 'n') {
                this.createNewFile();
            }
            else {
                // Update status on content change
                this.updateStatus();
            }
        });
        // Tab bar navigation
        this.container.key(['C-t'], () => {
            this.switchToNextTab();
        });
        this.container.key(['C-S-t'], () => {
            this.switchToPreviousTab();
        });
    }
    /**
     * Open a file
     */
    async openFile(filePath, content) {
        try {
            this.logger.info(`Opening file: ${filePath}`);
            // If file is already open, switch to it
            if (this.openFiles.has(filePath)) {
                this.switchToFile(filePath);
                return;
            }
            // Load file content if not provided
            if (!content) {
                content = await this.loadFileContent(filePath);
            }
            // Detect language for syntax highlighting
            const language = (0, syntaxHighlighter_1.detectLanguage)(filePath);
            // Add to open files
            this.openFiles.set(filePath, {
                path: filePath,
                content,
                originalContent: content,
                language,
                modified: false,
                cursorPosition: { line: 0, column: 0 }
            });
            // Switch to the new file
            this.switchToFile(filePath);
            this.updateTabBar();
            this.emit('file-opened', filePath);
        }
        catch (error) {
            this.logger.error(`Failed to open file ${filePath}:`, error);
            this.emit('error', error);
        }
    }
    /**
     * Load file content (mock implementation)
     */
    async loadFileContent(filePath) {
        // Mock implementation - in real app, this would read from filesystem
        return `// File: ${filePath}\n// Content loaded from filesystem\n\nfunction example() {\n  console.log('Hello, World!');\n}\n`;
    }
    /**
     * Switch to a specific file
     */
    switchToFile(filePath) {
        if (!this.openFiles.has(filePath))
            return;
        // Save current file state
        if (this.currentFile) {
            this.saveCurrentFileState();
        }
        this.currentFile = filePath;
        const fileData = this.openFiles.get(filePath);
        // Load content into viewer
        this.codeViewer.setValue(fileData.content);
        // Apply syntax highlighting
        this.applySyntaxHighlighting(fileData.content, fileData.language);
        // Update status
        this.updateStatus();
        this.updateTabBar();
        this.emit('file-switched', filePath);
    }
    /**
     * Save current file state
     */
    saveCurrentFileState() {
        if (!this.currentFile)
            return;
        const fileData = this.openFiles.get(this.currentFile);
        if (fileData) {
            fileData.content = this.codeViewer.getValue();
            fileData.modified = fileData.content !== fileData.originalContent;
        }
    }
    /**
     * Save current file
     */
    async saveCurrentFile() {
        if (!this.currentFile)
            return;
        try {
            const fileData = this.openFiles.get(this.currentFile);
            if (!fileData)
                return;
            // Save current state
            this.saveCurrentFileState();
            // Mock save operation
            this.logger.info(`Saving file: ${this.currentFile}`);
            // Update original content
            fileData.originalContent = fileData.content;
            fileData.modified = false;
            this.updateStatus();
            this.updateTabBar();
            this.emit('file-saved', this.currentFile);
        }
        catch (error) {
            this.logger.error(`Failed to save file ${this.currentFile}:`, error);
            this.emit('error', error);
        }
    }
    /**
     * Close current file
     */
    closeCurrentFile() {
        if (!this.currentFile)
            return;
        const fileData = this.openFiles.get(this.currentFile);
        if (fileData && fileData.modified) {
            // In a real implementation, show confirmation dialog
            this.logger.warn(`File ${this.currentFile} has unsaved changes`);
        }
        this.openFiles.delete(this.currentFile);
        // Switch to another open file or clear content
        const remainingFiles = Array.from(this.openFiles.keys());
        if (remainingFiles.length > 0) {
            this.switchToFile(remainingFiles[0]);
        }
        else {
            this.currentFile = null;
            this.codeViewer.setValue('');
            this.updateStatus();
        }
        this.updateTabBar();
        this.emit('file-closed', this.currentFile);
    }
    /**
     * Create new file
     */
    createNewFile() {
        const fileName = `untitled-${Date.now()}.txt`;
        this.openFile(fileName, '');
    }
    /**
     * Switch to next tab
     */
    switchToNextTab() {
        const files = Array.from(this.openFiles.keys());
        if (files.length <= 1)
            return;
        const currentIndex = files.indexOf(this.currentFile || '');
        const nextIndex = (currentIndex + 1) % files.length;
        this.switchToFile(files[nextIndex]);
    }
    /**
     * Switch to previous tab
     */
    switchToPreviousTab() {
        const files = Array.from(this.openFiles.keys());
        if (files.length <= 1)
            return;
        const currentIndex = files.indexOf(this.currentFile || '');
        const prevIndex = (currentIndex - 1 + files.length) % files.length;
        this.switchToFile(files[prevIndex]);
    }
    /**
     * Update tab bar
     */
    updateTabBar() {
        const files = Array.from(this.openFiles.keys());
        let tabContent = '';
        files.forEach((filePath, index) => {
            const fileName = filePath.split('/').pop() || filePath;
            const fileData = this.openFiles.get(filePath);
            const isActive = filePath === this.currentFile;
            const isModified = fileData?.modified ? '*' : '';
            const tabStyle = isActive ? '{inverse}' : '';
            const endStyle = isActive ? '{/inverse}' : '';
            tabContent += `${tabStyle} ${fileName}${isModified} ${endStyle}`;
            if (index < files.length - 1) {
                tabContent += ' | ';
            }
        });
        this.tabBar.setContent(tabContent || ' No files open ');
    }
    /**
     * Update status line
     */
    updateStatus() {
        if (!this.currentFile) {
            this.statusLine.setContent(' Ready ');
            return;
        }
        const fileData = this.openFiles.get(this.currentFile);
        if (!fileData)
            return;
        const fileName = this.currentFile.split('/').pop() || this.currentFile;
        const language = fileData.language;
        const modified = fileData.modified ? ' [Modified]' : '';
        const readOnlyStatus = this.readOnly ? ' [Read Only]' : '';
        const content = ` ${fileName} | ${language}${modified}${readOnlyStatus} `;
        this.statusLine.setContent(content);
    }
    /**
     * Apply syntax highlighting
     */
    applySyntaxHighlighting(content, language) {
        try {
            const highlightedLines = (0, syntaxHighlighter_1.highlightCode)(content, language);
            // In a real implementation, this would apply the highlighting to the textarea
            // For now, we'll just log that highlighting was applied
            this.logger.debug(`Applied syntax highlighting for ${language}`);
        }
        catch (error) {
            this.logger.warn('Failed to apply syntax highlighting:', error);
        }
    }
    /**
     * Set position
     */
    setPosition(position) {
        if (position.top !== undefined)
            this.container.top = position.top;
        if (position.left !== undefined)
            this.container.left = position.left;
        if (position.width !== undefined)
            this.container.width = position.width;
        if (position.height !== undefined)
            this.container.height = position.height;
    }
    /**
     * Initialize the content panel
     */
    async initialize() {
        this.logger.info('Initializing ContentPanel...');
        this.updateStatus();
        this.logger.info('ContentPanel initialized successfully');
    }
    /**
     * Cleanup the content panel
     */
    async cleanup() {
        this.logger.info('Cleaning up ContentPanel...');
        // Update related tasks
        for (const [filePath, fileData] of Array.from(this.openFiles.entries())) {
            if (fileData.modified) {
                this.logger.warn(`File ${filePath} has unsaved changes`);
            }
        }
    }
    /**
     * Refresh the content panel
     */
    refresh() {
        this.updateTabBar();
        this.updateStatus();
    }
    /**
     * Focus the content panel
     */
    focus() {
        this.focused = true;
        this.container.style.border = { fg: 'yellow' };
        this.codeViewer.focus();
    }
    /**
     * Blur the content panel
     */
    blur() {
        this.focused = false;
        this.container.style.border = { fg: 'cyan' };
        this.saveCurrentFileState();
    }
    /**
     * Handle window resize
     */
    handleResize() {
        // Content panel handles resize automatically through blessed
    }
    /**
     * Apply theme to the content panel
     */
    applyTheme(theme) {
        this.container.style.border = { fg: theme.colors.border };
        this.container.style.bg = theme.colors.background;
        this.container.style.fg = theme.colors.foreground;
        this.codeViewer.style.bg = theme.colors.background;
        this.codeViewer.style.fg = theme.colors.foreground;
        this.statusLine.style.bg = theme.colors.primary;
        this.statusLine.style.fg = theme.colors.foreground;
        if (this.focused) {
            this.container.style.border = { fg: theme.styles.focusBorder };
        }
    }
    /**
     * Get current file
     */
    getCurrentFile() {
        return this.currentFile;
    }
    /**
     * Get open files
     */
    getOpenFiles() {
        return Array.from(this.openFiles.keys());
    }
    /**
     * Set read-only mode
     */
    setReadOnly(readOnly) {
        this.readOnly = readOnly;
        // Note: readOnly property not available in blessed textarea
        this.updateStatus();
    }
    /**
     * Get content of current file
     */
    getCurrentContent() {
        return this.codeViewer.getValue();
    }
    /**
     * Set content of current file
     */
    setCurrentContent(content) {
        this.codeViewer.setValue(content);
        this.saveCurrentFileState();
    }
}
exports.ContentPanel = ContentPanel;
