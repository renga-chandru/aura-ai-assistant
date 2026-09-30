/**
 * AURA Phase 30 Comprehensive Test Suite
 * Grounded Web Information Retrieval & Result Understanding
 */

import assert from 'node:assert';

// Setup browser mocks for Node environment
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

(globalThis as any).novairBridge = {
  openApp: async () => ({ success: true }),
  closeApp: async () => ({ success: true }),
  openUrl: async () => ({ success: true }),
  openFolder: async () => ({ success: true, path: '/Mock/Path' }),
  openFile: async () => ({ success: true, path: '/Mock/Path/File.txt' }),
  createFile: async () => ({ success: true, path: '/Mock/Path/File.txt' }),
  createFolder: async () => ({ success: true, path: '/Mock/Path/Folder' }),
  moveFile: async () => ({ success: true }),
};

import { useAuraStore } from '../src/state/useAuraStore';
import { localTaskPlanner } from '../src/assistant/planner/LocalTaskPlanner';
import { webInformationService } from '../src/services/WebInformationService';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetBridge() {
  (globalThis as any).novairBridge.openUrl = async () => ({ success: true });
}

async function runTests() {
  const store = useAuraStore.getState();

  // Mock the webInformationService for testing
  let searchShouldFail = false;
  let extractShouldFail = false;

  webInformationService.search = async (query: string) => {
    if (searchShouldFail) {
      return { success: false, error: 'Simulated network timeout' };
    }
    return {
      success: true,
      results: [
        { title: 'Python 3.14 Release', url: 'https://python.org', snippet: 'Python 3.14 introduces new async features.' }
      ]
    };
  };

  webInformationService.extract = async (query: string, sources: any[]) => {
    if (extractShouldFail) {
      return { success: false, facts: [], sources, error: 'Extraction failed' };
    }
    return {
      success: true,
      facts: ['Python 3.14 introduces new async features.'],
      sources
    };
  };

  console.log('🧪 Starting AURA Phase 30 Information Retrieval Test Suite...\n');

  // Test 1: Successful web search result retrieval -> extraction
  console.log('Test 1: Successful web search and extraction');
  searchShouldFail = false;
  extractShouldFail = false;
  await store.submitCommand('Search Google for Python 3.14 and tell me what you find.');
  await sleep(1000);
  let resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.includes('Here is what I found'), `Missing extraction text: ${resp}`);
  assert.ok(resp.includes('Python 3.14 introduces new async features.'), `Missing fact in response: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 2: Search failure prevents extraction
  console.log('\nTest 2: Search failure prevents extraction');
  searchShouldFail = true;
  await store.submitCommand('Search Google for React and tell me what you find.');
  await sleep(1000);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.toLowerCase().includes('but'), `Expected partial success/failure response, got: ${resp}`);
  assert.ok(resp.toLowerCase().includes('simulated network timeout') || resp.toLowerCase().includes('search api'), `Missing failure reason: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 3: Extraction failure prevents fabricated response
  console.log('\nTest 3: Extraction failure prevents fabricated response');
  searchShouldFail = false;
  extractShouldFail = true;
  await store.submitCommand('Search Google for Nodejs and tell me what you find.');
  await sleep(1000);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.toLowerCase().includes('but step 2 (extract_info) failed: extraction failed'), `Expected extraction failure, got: ${resp}`);
  console.log('  ✓ Response:', resp);

  // Test 4: Natural-language "look up and summarize"
  console.log('\nTest 4: Natural-language "look up and summarize"');
  searchShouldFail = false;
  extractShouldFail = false;
  await store.submitCommand('Look up Python tutorials and extract the information');
  await sleep(1000);
  resp = useAuraStore.getState().activeResponse.text;
  assert.ok(resp.includes('Here is what I found'), `Missing extraction text: ${resp}`);
  console.log('  ✓ Response:', resp);
  
  // Test 5: Verify planner structures
  console.log('\nTest 5: Verify planner structures separately');
  const plan = localTaskPlanner.plan('Open Chrome, search Google for Python, and tell me what you find.');
  assert.ok(plan);
  assert.strictEqual(plan.steps.length, 3);
  assert.strictEqual(plan.steps[0].command.type, 'OPEN_APP');
  assert.strictEqual(plan.steps[1].command.type, 'WEB_SEARCH');
  assert.strictEqual(plan.steps[2].command.type, 'EXTRACT_INFO');
  console.log('  ✓ Planner correctly separated open browser and web search info extraction');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 30 TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
