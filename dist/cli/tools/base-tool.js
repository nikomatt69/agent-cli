"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
class BaseTool {
    constructor(name, workingDirectory) {
        this.workingDirectory = workingDirectory;
        this.name = name;
    }
    /**
     * Verifica se un percorso è sicuro (dentro working directory)
     */
    isPathSafe(path) {
        const fs = require('fs');
        const pathModule = require('path');
        try {
            const resolvedPath = pathModule.resolve(path);
            const resolvedWorkingDir = pathModule.resolve(this.workingDirectory);
            return resolvedPath.startsWith(resolvedWorkingDir);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Ottiene il nome del tool
     */
    getName() {
        return this.name;
    }
    /**
     * Ottiene la working directory
     */
    getWorkingDirectory() {
        return this.workingDirectory;
    }
}
exports.BaseTool = BaseTool;
