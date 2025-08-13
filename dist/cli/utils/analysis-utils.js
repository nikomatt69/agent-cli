"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateForPrompt = truncateForPrompt;
exports.safeStringifyContext = safeStringifyContext;
exports.chunkArray = chunkArray;
exports.compactAnalysis = compactAnalysis;
function truncateForPrompt(s, maxChars = 60000) {
    if (!s)
        return '';
    return s.length > maxChars ? s.slice(0, maxChars) + '…[truncated]' : s;
}
function safeStringifyContext(ctx, maxChars = 32000) {
    if (!ctx)
        return '{}';
    try {
        const str = JSON.stringify(ctx, (key, value) => {
            if (typeof value === 'string') {
                return value.length > 4000 ? value.slice(0, 4000) + '…[truncated]' : value;
            }
            if (Array.isArray(value)) {
                const limited = value.slice(0, 100);
                if (value.length > 100)
                    limited.push(`…[+${value.length - 100} more]`);
                return limited;
            }
            return value;
        });
        return str.length > maxChars ? str.slice(0, maxChars) + '…[truncated]' : str;
    }
    catch {
        return '[unstringifiable context]';
    }
}
function chunkArray(arr, size) {
    if (size <= 0)
        return [arr];
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
function compactAnalysis(analysis, opts = {}) {
    const maxDirs = opts.maxDirs ?? 500;
    const maxFiles = opts.maxFiles ?? 1000;
    const maxChars = opts.maxChars ?? 80000;
    const header = {
        name: analysis?.name,
        version: analysis?.version,
        framework: analysis?.framework,
        languages: analysis?.languages,
        fileCount: analysis?.fileCount,
        dependencies: analysis?.dependencies ? {
            production: analysis.dependencies.production?.length ?? 0,
            development: analysis.dependencies.development?.length ?? 0,
            total: analysis.dependencies.total ?? 0,
        } : undefined,
        directory: analysis?.directory,
        timestamp: analysis?.timestamp,
    };
    const dirEntries = [];
    const fileEntries = [];
    const walk = (node) => {
        if (!node)
            return;
        if (Array.isArray(node.files)) {
            for (const f of node.files) {
                if (fileEntries.length >= maxFiles)
                    break;
                fileEntries.push({ name: f.name, path: f.path, ext: f.extension, size: f.size });
            }
        }
        if (Array.isArray(node.directories)) {
            for (const d of node.directories) {
                if (dirEntries.length < maxDirs) {
                    dirEntries.push({ name: d.name, path: d.path, files: (d.files?.length ?? 0) });
                }
                if (dirEntries.length >= maxDirs && fileEntries.length >= maxFiles)
                    return;
                walk(d);
                if (dirEntries.length >= maxDirs && fileEntries.length >= maxFiles)
                    return;
            }
        }
    };
    if (analysis?.structure) {
        walk(analysis.structure);
    }
    const moreDirs = Math.max(0, (countDirs(analysis?.structure) - dirEntries.length));
    const moreFiles = Math.max(0, (analysis?.fileCount ?? 0) - fileEntries.length);
    const summaryObj = {
        ...header,
        sampleDirectories: dirEntries,
        sampleFiles: fileEntries,
        note: `Truncated for safety${moreDirs ? `, +${moreDirs} more dirs` : ''}${moreFiles ? `, +${moreFiles} more files` : ''}`,
    };
    let json = JSON.stringify(summaryObj);
    if (json.length > maxChars) {
        while (json.length > maxChars && (fileEntries.length > 50 || dirEntries.length > 20)) {
            if (fileEntries.length > 50)
                fileEntries.length = Math.floor(fileEntries.length * 0.8);
            if (dirEntries.length > 20)
                dirEntries.length = Math.floor(dirEntries.length * 0.8);
            json = JSON.stringify({ ...header, sampleDirectories: dirEntries, sampleFiles: fileEntries, note: summaryObj.note });
        }
        if (json.length > maxChars) {
            json = json.slice(0, maxChars) + '…[truncated]';
            return json;
        }
    }
    try {
        return JSON.parse(json);
    }
    catch {
        return json;
    }
}
function countDirs(node) {
    if (!node || !Array.isArray(node.directories))
        return 0;
    let count = node.directories.length;
    for (const d of node.directories)
        count += countDirs(d);
    return count;
}
