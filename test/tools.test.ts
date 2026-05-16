// Basic tests for ZIP CODE tools

import {
  readFile,
  writeFile,
  listDir,
  executeBash,
  globSearch,
  grepSearch,
} from '../src/tools';
import { existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';

// Test file operations
async function testFileOperations() {
  console.log('Testing file operations...');
  
  const testFile = resolve('./test-file.txt');
  const testContent = 'Hello, ZIP CODE!';
  
  // Test write
  const writeResult = await writeFile(testFile, testContent);
  console.assert(writeResult.success, 'Write should succeed');
  console.assert(existsSync(testFile), 'File should exist');
  
  // Test read
  const readResult = await readFile(testFile);
  console.assert(readResult.success, 'Read should succeed');
  console.assert(readResult.output === testContent, 'Content should match');
  
  // Cleanup
  if (existsSync(testFile)) {
    unlinkSync(testFile);
  }
  
  console.log('✓ File operations tests passed');
}

// Test directory listing
async function testListDir() {
  console.log('Testing directory listing...');
  
  const result = await listDir('.');
  console.assert(result.success, 'List dir should succeed');
  console.assert(result.output.includes('package.json'), 'Should list package.json');
  
  console.log('✓ Directory listing tests passed');
}

// Test glob & grep
async function testGlobAndGrep() {
  console.log('Testing glob & grep...');

  const globResult = await globSearch('src/**/*.ts');
  console.assert(globResult.success, 'glob should succeed');
  console.assert(globResult.output.includes('store.ts'), 'glob should find store.ts');

  const grepResult = await grepSearch('export function', 'src');
  console.assert(grepResult.success, 'grep should succeed');
  console.assert(
    grepResult.output.includes('export function'),
    'grep output should include matches'
  );

  console.log('✓ Glob & grep tests passed');
}

// Test bash execution
async function testBashExecution() {
  console.log('Testing bash execution...');
  
  // Test simple command
  const result = await executeBash('echo "test"');
  console.assert(result.success, 'Echo should succeed');
  console.assert(result.output.includes('test'), 'Output should contain test');
  
  console.log('✓ Bash execution tests passed');
}

// Test error handling
async function testErrorHandling() {
  console.log('Testing error handling...');
  
  // Test reading non-existent file
  const readResult = await readFile('./non-existent-file.txt');
  console.assert(!readResult.success, 'Should fail for non-existent file');
  console.assert(readResult.error !== undefined, 'Should have error message');
  
  // Test listing non-existent directory
  const listResult = await listDir('./non-existent-dir');
  console.assert(!listResult.success, 'Should fail for non-existent directory');
  
  console.log('✓ Error handling tests passed');
}

// Run all tests
async function runTests() {
  console.log('\n=== Running ZIP CODE Tests ===\n');
  
  try {
    await testFileOperations();
    await testListDir();
    await testGlobAndGrep();
    await testBashExecution();
    await testErrorHandling();
    
    console.log('\n=== All Tests Passed ===\n');
    process.exit(0);
  } catch (error) {
    console.error('\n=== Tests Failed ===');
    console.error(error);
    process.exit(1);
  }
}

runTests();
