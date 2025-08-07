"use strict";
/**
 * Theme Manager Utility
 * Manages themes and styling for the TUI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeManager = void 0;
const events_1 = require("events");
class ThemeManager extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.themes = new Map();
        this.config = config;
        this.initializeThemes();
        this.currentTheme = this.themes.get('default') || this.createDefaultTheme();
    }
    /**
     * Initialize built-in themes
     */
    initializeThemes() {
        // Default theme
        this.themes.set('default', this.createDefaultTheme());
        // Dark theme
        this.themes.set('dark', this.createDarkTheme());
        // Light theme
        this.themes.set('light', this.createLightTheme());
        // High contrast theme
        this.themes.set('high-contrast', this.createHighContrastTheme());
        // Cyberpunk theme
        this.themes.set('cyberpunk', this.createCyberpunkTheme());
    }
    /**
     * Create default theme
     */
    createDefaultTheme() {
        return {
            name: 'default',
            colors: {
                primary: 'blue',
                secondary: 'cyan',
                accent: 'yellow',
                background: 'black',
                foreground: 'white',
                border: 'cyan',
                success: 'green',
                warning: 'yellow',
                error: 'red',
                info: 'blue',
                muted: 'gray'
            },
            styles: {
                border: 'line',
                focusBorder: 'yellow',
                selectedBg: 'blue',
                selectedFg: 'white'
            }
        };
    }
    /**
     * Create dark theme
     */
    createDarkTheme() {
        return {
            name: 'dark',
            colors: {
                primary: '#2563eb',
                secondary: '#64748b',
                accent: '#f59e0b',
                background: '#0f172a',
                foreground: '#f8fafc',
                border: '#334155',
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#3b82f6',
                muted: '#64748b'
            },
            styles: {
                border: 'line',
                focusBorder: '#f59e0b',
                selectedBg: '#2563eb',
                selectedFg: '#f8fafc'
            }
        };
    }
    /**
     * Create light theme
     */
    createLightTheme() {
        return {
            name: 'light',
            colors: {
                primary: '#1d4ed8',
                secondary: '#6b7280',
                accent: '#d97706',
                background: '#ffffff',
                foreground: '#111827',
                border: '#d1d5db',
                success: '#059669',
                warning: '#d97706',
                error: '#dc2626',
                info: '#2563eb',
                muted: '#6b7280'
            },
            styles: {
                border: 'line',
                focusBorder: '#d97706',
                selectedBg: '#1d4ed8',
                selectedFg: '#ffffff'
            }
        };
    }
    /**
     * Create high contrast theme
     */
    createHighContrastTheme() {
        return {
            name: 'high-contrast',
            colors: {
                primary: 'white',
                secondary: 'white',
                accent: 'yellow',
                background: 'black',
                foreground: 'white',
                border: 'white',
                success: 'green',
                warning: 'yellow',
                error: 'red',
                info: 'cyan',
                muted: 'white'
            },
            styles: {
                border: 'line',
                focusBorder: 'yellow',
                selectedBg: 'white',
                selectedFg: 'black'
            }
        };
    }
    /**
     * Create cyberpunk theme
     */
    createCyberpunkTheme() {
        return {
            name: 'cyberpunk',
            colors: {
                primary: 'magenta',
                secondary: 'cyan',
                accent: 'yellow',
                background: 'black',
                foreground: 'green',
                border: 'magenta',
                success: 'green',
                warning: 'yellow',
                error: 'red',
                info: 'cyan',
                muted: 'gray'
            },
            styles: {
                border: 'line',
                focusBorder: 'yellow',
                selectedBg: 'magenta',
                selectedFg: 'black'
            }
        };
    }
    /**
     * Load theme from configuration
     */
    async loadTheme() {
        try {
            // For now, use default theme since config doesn't support nested keys
            this.setTheme('default');
        }
        catch (error) {
            // Use default theme if config loading fails
            this.setTheme('default');
        }
    }
    /**
     * Set current theme
     */
    setTheme(themeName) {
        const theme = this.themes.get(themeName);
        if (!theme) {
            throw new Error(`Theme '${themeName}' not found`);
        }
        const previousTheme = this.currentTheme;
        this.currentTheme = theme;
        // Note: Config saving disabled for now due to type constraints
        // TODO: Extend ConfigManager to support UI settings
        this.emit('theme-changed', theme, previousTheme);
    }
    /**
     * Get current theme
     */
    getCurrentTheme() {
        return { ...this.currentTheme };
    }
    /**
     * Get available themes
     */
    getAvailableThemes() {
        return Array.from(this.themes.keys());
    }
    /**
     * Get theme by name
     */
    getTheme(name) {
        const theme = this.themes.get(name);
        return theme ? { ...theme } : undefined;
    }
    /**
     * Add a custom theme
     */
    addTheme(theme) {
        this.themes.set(theme.name, theme);
        this.emit('theme-added', theme);
    }
    /**
     * Remove a theme
     */
    removeTheme(name) {
        if (name === 'default') {
            throw new Error('Cannot remove default theme');
        }
        if (this.currentTheme.name === name) {
            this.setTheme('default');
        }
        const removed = this.themes.delete(name);
        if (removed) {
            this.emit('theme-removed', name);
        }
        return removed;
    }
    /**
     * Create a theme variant
     */
    createVariant(baseName, variantName, overrides) {
        const baseTheme = this.themes.get(baseName);
        if (!baseTheme) {
            throw new Error(`Base theme '${baseName}' not found`);
        }
        const variant = {
            ...baseTheme,
            ...overrides,
            name: variantName,
            colors: {
                ...baseTheme.colors,
                ...(overrides.colors || {})
            },
            styles: {
                ...baseTheme.styles,
                ...(overrides.styles || {})
            }
        };
        this.addTheme(variant);
        return variant;
    }
    /**
     * Get theme color palette
     */
    getColorPalette(themeName) {
        const theme = themeName ? this.themes.get(themeName) : this.currentTheme;
        return theme ? { ...theme.colors } : {};
    }
    /**
     * Validate theme structure
     */
    validateTheme(theme) {
        if (!theme || typeof theme !== 'object')
            return false;
        if (!theme.name || typeof theme.name !== 'string')
            return false;
        if (!theme.colors || typeof theme.colors !== 'object')
            return false;
        if (!theme.styles || typeof theme.styles !== 'object')
            return false;
        const requiredColors = [
            'primary', 'secondary', 'accent', 'background', 'foreground',
            'border', 'success', 'warning', 'error', 'info', 'muted'
        ];
        for (const color of requiredColors) {
            if (!theme.colors[color])
                return false;
        }
        const requiredStyles = ['border', 'focusBorder', 'selectedBg', 'selectedFg'];
        for (const style of requiredStyles) {
            if (!theme.styles[style])
                return false;
        }
        return true;
    }
    /**
     * Import theme from JSON
     */
    importTheme(themeJson) {
        try {
            const theme = JSON.parse(themeJson);
            if (!this.validateTheme(theme)) {
                throw new Error('Invalid theme structure');
            }
            this.addTheme(theme);
            return theme;
        }
        catch (error) {
            throw new Error(`Failed to import theme: ${error.message}`);
        }
    }
    /**
     * Export theme to JSON
     */
    exportTheme(themeName) {
        const theme = this.themes.get(themeName);
        if (!theme) {
            throw new Error(`Theme '${themeName}' not found`);
        }
        return JSON.stringify(theme, null, 2);
    }
    /**
     * Get theme preview
     */
    getThemePreview(themeName) {
        const theme = this.themes.get(themeName);
        if (!theme) {
            return 'Theme not found';
        }
        return `
Theme: ${theme.name}
Colors:
  Primary: ${theme.colors.primary}
  Secondary: ${theme.colors.secondary}
  Accent: ${theme.colors.accent}
  Background: ${theme.colors.background}
  Foreground: ${theme.colors.foreground}
  Success: ${theme.colors.success}
  Warning: ${theme.colors.warning}
  Error: ${theme.colors.error}
    `.trim();
    }
    /**
     * Apply theme to blessed element style
     */
    applyToStyle(style, colorKey) {
        const color = this.currentTheme.colors[colorKey];
        if (color) {
            style.fg = color;
        }
    }
    /**
     * Get contrast color
     */
    getContrastColor(backgroundColor) {
        // Simple contrast logic - in a real implementation you might use a color library
        const darkColors = ['black', 'blue', 'red', 'green', 'magenta'];
        return darkColors.includes(backgroundColor.toLowerCase()) ? 'white' : 'black';
    }
    /**
     * Cycle to next theme
     */
    nextTheme() {
        const themes = this.getAvailableThemes();
        const currentIndex = themes.indexOf(this.currentTheme.name);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
    }
    /**
     * Cycle to previous theme
     */
    previousTheme() {
        const themes = this.getAvailableThemes();
        const currentIndex = themes.indexOf(this.currentTheme.name);
        const prevIndex = (currentIndex - 1 + themes.length) % themes.length;
        this.setTheme(themes[prevIndex]);
    }
}
exports.ThemeManager = ThemeManager;
