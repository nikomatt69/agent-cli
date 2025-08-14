"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
class BaseTool {
    constructor(name, workingDirectory) {
        this.workingDirectory = workingDirectory;
        this.name = name;
    }
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
    getName() {
        return this.name;
    }
    getWorkingDirectory() {
        return this.workingDirectory;
    }
}
exports.BaseTool = BaseTool;
