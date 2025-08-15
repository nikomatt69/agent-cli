#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Rimuovi la cartella dist se esiste
if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
}

// Crea la cartella dist
fs.mkdirSync('dist', { recursive: true });

// Trova tutti i file TypeScript
const findFiles = (dir) => {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            files.push(...findFiles(fullPath));
        } else if (item.endsWith('.ts')) {
            files.push(fullPath);
        }
    }

    return files;
};

const tsFiles = findFiles('src/cli');
console.log(`Found ${tsFiles.length} TypeScript files`);

// Compila ogni file
for (const file of tsFiles) {
    const relativePath = path.relative('src', file);
    const outputPath = path.join('dist', relativePath.replace('.ts', '.js'));
    const outputDir = path.dirname(outputPath);

    // Crea la directory di output se non esiste
    fs.mkdirSync(outputDir, { recursive: true });

    try {
        execSync(`npx tsc "${file}" --outDir dist --module commonjs --target es2020 --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck --noEmit false`, {
            stdio: 'inherit'
        });
        console.log(`✓ Compiled: ${relativePath}`);
    } catch (error) {
        console.error(`✗ Failed to compile: ${relativePath}`);
    }
}

console.log('Build completed!');



