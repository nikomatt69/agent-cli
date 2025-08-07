export interface GuidanceFile {
    path: string;
    type: 'claude' | 'codex' | 'agents';
    level: 'global' | 'project' | 'subdirectory';
    content: string;
    lastModified: Date;
    parsed?: {
        frontmatter?: Record<string, any>;
        sections?: Record<string, string>;
        instructions?: string[];
    };
}
export interface GuidanceContext {
    globalGuidance: GuidanceFile[];
    projectGuidance: GuidanceFile[];
    subdirGuidance: GuidanceFile[];
    mergedInstructions: string;
    lastUpdated: Date;
}
/**
 * GuidanceManager - Core system for CLAUDE.md/CODEX.md integration
 * Automatically detects, parses, and injects guidance files into AI context
 */
export declare class GuidanceManager {
    private watchers;
    private guidanceFiles;
    private currentContext;
    private workingDirectory;
    private globalGuidanceDir;
    private onContextUpdate?;
    constructor(workingDirectory: string, globalGuidanceDir?: string);
    private ensureGlobalGuidanceDir;
    /**
     * Initialize the guidance system
     */
    initialize(onContextUpdate?: (context: GuidanceContext) => void): Promise<void>;
    /**
     * Scan for all guidance files in global, project, and subdirectories
     */
    private scanGuidanceFiles;
    private scanProjectGuidance;
    private shouldSkipDirectory;
    /**
     * Load and parse a guidance file
     */
    private loadGuidanceFile;
    /**
     * Parse guidance file content and extract structured information
     */
    private parseGuidanceFile;
    private extractListItems;
    private tokenToText;
    /**
     * Set up file watchers for automatic updates
     */
    private setupFileWatchers;
    private handleFileChange;
    /**
     * Update the merged guidance context
     */
    private updateContext;
    /**
     * Merge instructions from multiple guidance files
     */
    private mergeInstructions;
    /**
     * Get current guidance context
     */
    getContext(): GuidanceContext | null;
    /**
     * Get guidance for a specific context (agent system prompt injection)
     */
    getContextForAgent(agentType?: string, currentDirectory?: string): string;
    /**
     * Create a sample guidance file
     */
    createSampleGuidanceFile(type: 'claude' | 'codex' | 'agents', location: 'global' | 'project'): string;
    /**
     * List all guidance files
     */
    listGuidanceFiles(): GuidanceFile[];
    /**
     * Get guidance file stats
     */
    getStats(): {
        totalFiles: number;
        byType: Record<string, number>;
        byLevel: Record<string, number>;
        totalSize: number;
    };
    /**
     * Cleanup watchers and resources
     */
    cleanup(): Promise<void>;
}
export declare const guidanceManager: GuidanceManager;
