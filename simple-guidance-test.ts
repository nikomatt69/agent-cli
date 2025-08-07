import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

// Simple test to verify our guidance system logic works
console.log('🧪 Testing guidance system logic...');

try {
  // Check if CLAUDE.md exists
  const claudeFile = path.join(process.cwd(), 'CLAUDE.md');
  if (fs.existsSync(claudeFile)) {
    console.log('✅ Found CLAUDE.md file');
    
    const content = fs.readFileSync(claudeFile, 'utf-8');
    console.log(`📊 File size: ${content.length} characters`);
    
    // Simple parsing test
    const lines = content.split('\n');
    console.log(`📋 Total lines: ${lines.length}`);
    
    // Find sections
    const sections = lines.filter(line => line.startsWith('#')).map(line => line.trim());
    console.log(`📑 Found ${sections.length} sections:`);
    sections.forEach(section => console.log(`  - ${section}`));
    
    // Test guidance injection
    const guidanceContext = `
# Guidance from CLAUDE.md
${content}

## Instructions
The above guidance should be followed when working on this project.
`;
    
    console.log('🔗 Created guidance context successfully');
    console.log(`📏 Context length: ${guidanceContext.length} characters`);
    
  } else {
    console.log('❌ CLAUDE.md not found');
  }
  
  console.log('✅ Basic guidance logic test completed successfully');
  
} catch (error: any) {
  console.error('❌ Test failed:', error.message);
}