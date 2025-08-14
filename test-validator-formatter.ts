/**
 * Test script for ValidatorManager + FormatterManager
 */

import { validatorManager, ValidationContext } from './src/cli/core/validator-manager';
import { createFormatterManager } from './src/cli/core/formatter-manager';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testValidatorAndFormatter() {
  console.log('🧪 Testing ValidatorManager + FormatterManager...\n');

  // Test file path
  const testFilePath = join(process.cwd(), 'test-file-example.tsx');
  
  try {
    // Read test file content
    const content = readFileSync(testFilePath, 'utf-8');
    console.log('📝 Original content:');
    console.log(content);
    console.log('\n---\n');

    // Test validation context
    const context: ValidationContext = {
      filePath: testFilePath,
      content,
      operation: 'create',
      agentId: 'test-agent',
      projectType: 'react'
    };

    // Test validation + formatting
    console.log('🔍 Running validation + formatting...');
    const result = await validatorManager.validateContent(context);

    console.log('\n📊 Results:');
    console.log('- Valid:', result.isValid);
    console.log('- Formatted:', result.formatted || false);
    console.log('- Formatter used:', result.formatter || 'none');
    console.log('- Errors:', result.errors?.length || 0);
    console.log('- Warnings:', result.warnings?.length || 0);

    if (result.fixedContent) {
      console.log('\n✨ Fixed/Formatted content:');
      console.log(result.fixedContent);
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach((error, i) => console.log(`  ${i + 1}. ${error}`));
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach((warning, i) => console.log(`  ${i + 1}. ${warning}`));
    }

    return result;

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testValidatorAndFormatter()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testValidatorAndFormatter };