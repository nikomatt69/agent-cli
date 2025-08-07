"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiEditTool = void 0;
const base_tool_1 = require("./base-tool");
const prompt_manager_1 = require("../prompts/prompt-manager");
const cli_ui_1 = require("../utils/cli-ui");
const edit_tool_1 = require("./edit-tool");
class MultiEditTool extends base_tool_1.BaseTool {
    constructor(workingDirectory) {
        super('multi-edit-tool', workingDirectory);
        this.editTool = new edit_tool_1.EditTool(workingDirectory);
    }
    async execute(params) {
        try {
            // Carica prompt specifico per questo tool
            const promptManager = prompt_manager_1.PromptManager.getInstance();
            const systemPrompt = await promptManager.loadPromptForContext({
                toolName: 'multi-edit-tool',
                parameters: params
            });
            cli_ui_1.CliUI.logDebug(`Using system prompt: ${systemPrompt.substring(0, 100)}...`);
            if (!params.operations || params.operations.length === 0) {
                throw new Error('No operations specified');
            }
            cli_ui_1.CliUI.logInfo(`🔄 Executing ${params.operations.length} edit operations`);
            const result = {
                totalOperations: params.operations.length,
                successfulOperations: 0,
                failedOperations: 0,
                results: [],
                backupsCreated: [],
                rollbackPerformed: false
            };
            // Esegui operazioni in sequenza
            for (let i = 0; i < params.operations.length; i++) {
                const operation = params.operations[i];
                cli_ui_1.CliUI.logInfo(`📝 Operation ${i + 1}/${params.operations.length}: ${operation.filePath}`);
                try {
                    const editParams = {
                        filePath: operation.filePath,
                        oldString: operation.oldString,
                        newString: operation.newString,
                        replaceAll: operation.replaceAll,
                        createBackup: params.createBackup,
                        validateSyntax: params.validateSyntax,
                        previewOnly: params.previewOnly
                    };
                    const editResult = await this.editTool.execute(editParams);
                    if (editResult.success && editResult.data) {
                        result.successfulOperations++;
                        result.results.push({
                            operation,
                            success: true,
                            replacementsMade: editResult.data.replacementsMade
                        });
                        if (editResult.data.backupPath) {
                            result.backupsCreated.push(editResult.data.backupPath);
                        }
                    }
                    else {
                        result.failedOperations++;
                        result.results.push({
                            operation,
                            success: false,
                            error: editResult.error || 'Unknown error'
                        });
                        // Rollback se richiesto
                        if (params.rollbackOnError && !params.previewOnly) {
                            cli_ui_1.CliUI.logWarning('🔄 Rolling back due to error...');
                            await this.performRollback(result.backupsCreated);
                            result.rollbackPerformed = true;
                            break;
                        }
                    }
                }
                catch (error) {
                    result.failedOperations++;
                    result.results.push({
                        operation,
                        success: false,
                        error: error.message
                    });
                    if (params.rollbackOnError && !params.previewOnly) {
                        cli_ui_1.CliUI.logWarning('🔄 Rolling back due to error...');
                        await this.performRollback(result.backupsCreated);
                        result.rollbackPerformed = true;
                        break;
                    }
                }
            }
            if (result.successfulOperations === result.totalOperations) {
                cli_ui_1.CliUI.logSuccess(`✅ All ${result.totalOperations} operations completed successfully`);
            }
            else {
                cli_ui_1.CliUI.logWarning(`⚠️ ${result.successfulOperations}/${result.totalOperations} operations successful`);
            }
            return {
                success: result.failedOperations === 0,
                data: result,
                metadata: {
                    executionTime: Date.now(),
                    toolName: this.name,
                    parameters: params
                }
            };
        }
        catch (error) {
            cli_ui_1.CliUI.logError(`Multi-edit tool failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                data: null,
                metadata: {
                    executionTime: Date.now(),
                    toolName: this.name,
                    parameters: params
                }
            };
        }
    }
    /**
     * Esegue rollback ripristinando i backup
     */
    async performRollback(backupPaths) {
        for (const backupPath of backupPaths) {
            try {
                const originalPath = this.getOriginalPathFromBackup(backupPath);
                const fs = require('fs');
                if (fs.existsSync(backupPath)) {
                    fs.copyFileSync(backupPath, originalPath);
                    cli_ui_1.CliUI.logInfo(`🔄 Restored: ${originalPath}`);
                }
            }
            catch (error) {
                cli_ui_1.CliUI.logError(`Failed to restore ${backupPath}: ${error.message}`);
            }
        }
    }
    /**
     * Ottiene il percorso originale dal percorso di backup
     */
    getOriginalPathFromBackup(backupPath) {
        // Rimuove .backup.timestamp dal nome
        return backupPath.replace(/\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/, '');
    }
}
exports.MultiEditTool = MultiEditTool;
