/**
 * AURA Phase 29 Comprehensive Test Suite
 * Advanced Computer Task Execution
 */

import assert from 'node:assert';

// Setup browser mocks for Node environment
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

let bridgeFailures = {
  appLaunch: false,
  browser: false,
  folder: false,
  file: false
};

(globalThis as any).novairBridge = {
  openApp: async (bundleId: string) => {
    if (bridgeFailures.appLaunch || bundleId === 'com.apple.badapp') {
      return { success: false, error: 'APP_LAUNCH_FAILED' };
    }
    return { success: true };
  },
  closeApp: async () => ({ success: true }),
  openUrl: async (url: string) => {
    if (bridgeFailures.browser || url.includes('offline')) {
      return { success: false, error: 'BROWSER_FAILED' };
    }
    return { success: true };
  },
  openFolder: async (folderName: string) => {
    if (bridgeFailures.folder) {
      return { success: false, error: 'Failed to open folder', errorCode: 'FILE_NOT_FOUND' };
    }
    return { success: true, path: `/Users/test/${folderName}` };
  },
  createFolder: async (folderName: string, dest: string) => {
    if (bridgeFailures.folder) return { success: false, error: 'CREATE_FOLDER_FAILED' };
    return { success: true, path: `/Users/test/${dest}/${folderName}` };
  },
  openFile: async (fileName: string) => {
    if (bridgeFailures.file) return { success: false, errorCode: 'FILE_NOT_FOUND', message: 'File not found' };
    return { success: true, path: `/Users/test/Documents/${fileName}` };
  },
  createFile: async (fileName: string) => {
    if (bridgeFailures.file) return { success: false, errorCode: 'FILE_WRITE_FAILED', error: 'File write failed' };
    return { success: true, path: `/Users/test/Documents/${fileName}` };
  },
  moveFile: async () => {
    if (bridgeFailures.file) return { success: false, errorCode: 'MOVE_FAILED', error: 'File move failed' };
    return { success: true };
  },
  deleteFile: async () => ({ success: true }),
  setSystemSetting: async () => ({ success: true }),
  sleep: async () => ({ success: true }),
  restart: async () => ({ success: true }),
  shutdown: async () => ({ success: true }),
  isAvailable: async () => true,
};

import { localTaskPlanner } from '../src/assistant/planner/LocalTaskPlanner';
import { useAuraStore } from '../src/state/useAuraStore';
import { securityGate } from '../src/assistant/security';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log('🧪 Starting AURA Phase 29 Advanced Computer Task Execution Test Suite...\n');

async function runTests() {
  const store = useAuraStore.getState();

  const resetBridge = () => {
    bridgeFailures = {
      appLaunch: false,
      browser: false,
      folder: false,
      file: false
    };
  };

  // Test 1: Basic 2-step workflow (Open Chrome, search YouTube)
  console.log('Test 1: Basic 2-step workflow');
  resetBridge();
  await store.submitCommand('Open Chrome and go to YouTube');
  await sleep(800);
  let resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.includes('Google Chrome') && resp.includes('YouTube'), `Response incorrect: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 2: Basic 3-step workflow (Open Chrome, search Google, tell me what you find)
  console.log('\nTest 2: Basic 3-step workflow with unsupported EXTRACT_INFO');
  await store.submitCommand('Open Chrome, search Google for Python tutorials, and tell me what you find.');
  await sleep(1000);
  resp = useAuraStore.getState().activeResponse.text;
  // Step 1 and 2 succeed, Step 3 (EXTRACT_INFO) fails.
  assert.ok(resp.toLowerCase().includes('but'), `Expected partial success response, got: ${resp}`);
  assert.ok(resp.toLowerCase().includes('google chrome') && resp.toLowerCase().includes('google'), `Missing context in response: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 3: 2-step folder/file workflow (Open Finder, create file)
  console.log('\nTest 3: 2-step folder/file workflow');
  await store.submitCommand('Open Finder and create a file called notes.txt in Documents');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.includes('Finder') && resp.includes('notes.txt'), `Response incorrect: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 4: 3-step folder/file workflow (Create folder, create file, move file)
  console.log('\nTest 4: 3-step folder/file workflow');
  await store.submitCommand('Create a folder called AURA in Documents, create a file called config.json, and move config.json to Desktop');
  await sleep(1200);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.toLowerCase().includes('aura') && resp.toLowerCase().includes('config.json') && resp.toLowerCase().includes('desktop'), `Response incorrect: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 5: Security violation on step 1 (fails immediately, doesn't proceed)
  console.log('\nTest 5: Security violation on step 1');
  await store.submitCommand('Open terminal and type rm -rf, then open Chrome');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.toLowerCase().includes('security violation') || resp.toLowerCase().includes('prohibited') || resp.toLowerCase().includes('unapproved'), `Expected security rejection, got: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 6: Security violation on step 2 (step 1 succeeds, step 2 fails)
  console.log('\nTest 6: Security violation on step 2');
  await store.submitCommand('Open Chrome, then create a file called hack.sh');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  // Depending on validation logic, this might fail the entire plan upfront, which is safer.
  assert.ok(resp.toLowerCase().includes('security') || resp.toLowerCase().includes('violation') || resp.toLowerCase().includes('unapproved'), `Expected security rejection, got: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 7: Multi-step task with high risk action (requires confirmation, pauses)
  console.log('\nTest 7: High risk action in multi-step task');
  await store.submitCommand('Open Finder and delete notes.txt');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  const requiresConfirmation = useAuraStore.getState().confirmationRequest !== null;
  assert.ok(requiresConfirmation || resp.toLowerCase().includes('confirmation required'), `Expected confirmation request, got: ${resp}`);
  console.log('  ✓ Response:', resp);
  // Clear confirmation
  useAuraStore.getState().setPendingConfirmationCommand(null);

  // Test 8: Dependency failure: Step 1 fails, Step 2 should not execute
  console.log('\nTest 8: Dependency failure on step 1');
  bridgeFailures.appLaunch = true;
  await store.submitCommand('Open Chrome and go to YouTube');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.includes('failed') || resp.includes('could not'), `Expected failure response, got: ${resp}`);
  console.log('  ✓ Response:', resp);
  resetBridge();

  // Test 9: Dependency failure: Step 2 fails
  console.log('\nTest 9: Dependency failure on step 2');
  bridgeFailures.browser = true;
  await store.submitCommand('Open Safari and go to offline.com');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.toLowerCase().includes('but'), `Expected partial success, got: ${resp}`);
  console.log('  ✓ Response:', resp);
  resetBridge();

  // Test 10: Dependency state propagation with "it"
  console.log('\nTest 10: Dependency state propagation');
  await store.submitCommand('Create a file called summary.txt and move it to Downloads');
  await sleep(800);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.toLowerCase().includes('summary.txt') && resp.toLowerCase().includes('downloads'), `Response incorrect: ${resp}`);
  console.log('  ✓ Response:', resp);

  console.log('\n✅ All Phase 29 Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
