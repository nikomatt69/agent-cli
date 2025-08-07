import hljs from 'highlight.js';

export interface HighlightedLine {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export const highlightCode = (code: string, language: string): HighlightedLine[] => {
  try {
    // Use highlight.js for syntax highlighting
    const highlighted = hljs.highlight(code, { language, ignoreIllegals: true });
    
    // Convert highlighted HTML to terminal colors
    return parseHighlightedCode(highlighted.value);
  } catch (error) {
    // Fallback to plain text with basic formatting
    return code.split('\n').map(line => ({
      text: line,
      color: 'white'
    }));
  }
};

const parseHighlightedCode = (html: string): HighlightedLine[] => {
  // Remove HTML tags and convert to color codes
  const lines = html.split('\n');
  
  return lines.map(line => {
    // Simple HTML to terminal color mapping
    let text = line;
    let color = 'white';
    
    // Keywords
    if (line.includes('class="hljs-keyword"')) {
      color = 'magenta';
      text = stripHtmlTags(line);
    }
    // Strings
    else if (line.includes('class="hljs-string"')) {
      color = 'green';
      text = stripHtmlTags(line);
    }
    // Comments
    else if (line.includes('class="hljs-comment"')) {
      color = 'gray';
      text = stripHtmlTags(line);
    }
    // Numbers
    else if (line.includes('class="hljs-number"')) {
      color = 'cyan';
      text = stripHtmlTags(line);
    }
    // Functions
    else if (line.includes('class="hljs-function"') || line.includes('class="hljs-title"')) {
      color = 'blue';
      text = stripHtmlTags(line);
    }
    // Variables
    else if (line.includes('class="hljs-variable"')) {
      color = 'yellow';
      text = stripHtmlTags(line);
    }
    else {
      text = stripHtmlTags(line);
    }

    return {
      text,
      color,
    };
  });
};

const stripHtmlTags = (html: string): string => {
  return html.replace(/<[^>]*>/g, '');
};

// Language detection utility
export const detectLanguage = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'bash',
    'zsh': 'bash',
    'bash': 'bash',
    'ps1': 'powershell',
    'sql': 'sql',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'md': 'markdown',
    'dockerfile': 'dockerfile',
  };

  return languageMap[extension || ''] || 'plaintext';
};

// Code formatting utilities
export const formatCode = (code: string, language: string): string => {
  // Basic code formatting - in a real implementation you might use prettier or similar
  const lines = code.split('\n');
  let indentLevel = 0;
  const indentSize = 2;
  
  return lines.map(line => {
    const trimmed = line.trim();
    
    // Decrease indent for closing brackets
    if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    const formatted = ' '.repeat(indentLevel * indentSize) + trimmed;
    
    // Increase indent for opening brackets
    if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
      indentLevel++;
    }
    
    return formatted;
  }).join('\n');
};

// Syntax validation
export const validateSyntax = (code: string, language: string): { valid: boolean; errors: string[] } => {
  // Basic syntax validation - implement specific validators as needed
  const errors: string[] = [];
  
  if (language === 'javascript' || language === 'typescript') {
    // Check for common JS/TS syntax errors
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Mismatched braces');
    }
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      errors.push('Mismatched parentheses');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};