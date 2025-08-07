#!/usr/bin/env node

// Simple test script to verify the guidance system works
const { GuidanceManager } = require('./dist/cli/guidance/guidance-manager');

async function testGuidance() {
  console.log('🧪 Testing Guidance System...');
  
  const guidanceManager = new GuidanceManager(process.cwd());
  
  try {
    await guidanceManager.initialize();
    console.log('✅ Guidance system initialized successfully');
    
    const context = guidanceManager.getContext();
    console.log('📋 Found', context ? context.globalGuidance.length + context.projectGuidance.length + context.subdirGuidance.length : 0, 'guidance files');
    
    const stats = guidanceManager.getStats();
    console.log('📊 Stats:', stats);
    
    const mergedGuidance = guidanceManager.getContextForAgent('general');
    if (mergedGuidance) {
      console.log('🔗 Merged guidance length:', mergedGuidance.length);
      console.log('📝 Sample guidance (first 200 chars):', mergedGuidance.substring(0, 200) + '...');
    }
    
    await guidanceManager.cleanup();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testGuidance();