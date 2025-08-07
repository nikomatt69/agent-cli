import { glob } from 'glob';
import { BaseTool, ToolExecutionResult } from './base-tool';
import { sanitizePath } from './secure-file-tools';

export class FindFilesTool extends BaseTool {
  constructor(workingDirectory: string) {
    super('find-files-tool', workingDirectory);
  }

  async execute(pattern: string, options: { cwd?: string } = {}): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      const sanitizedCwd = sanitizePath(options.cwd || '.', this.workingDirectory);
      const files = glob.sync(pattern, { cwd: sanitizedCwd, nodir: true });
      
      return {
        success: true,
        data: files,
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: this.name,
          parameters: { pattern, options }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: this.name,
          parameters: { pattern, options }
        }
      };
    }
  }
}
