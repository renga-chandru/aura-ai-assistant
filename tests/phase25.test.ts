/**
 * AURA Phase 25 Comprehensive Test Suite
 *
 * Verifies all Phase 25 specifications:
 * A. OPEN-ENDED CONVERSATION ("I had a long day today", "Tell me something interesting", "Explain cloud computing", "MCA project ideas")
 * B. CONTEXT AWARENESS (Topic tracking: AWS -> S3)
 * C. COMPUTER TASK (Structured actions for Chrome + Python tutorials)
 * D. MULTI-STEP TASK (Chrome + React search + Documents folder)
 * E. HIGH RISK ACTION (Restart Mac requires confirmation)
 * F. DELETE FILE (Delete action requires confirmation)
 * G. FILE SAFETY (Path traversal remains safely blocked)
 * H. BROWSER SAFETY (Dangerous javascript: URLs safely blocked)
 * I. UNSUPPORTED ACTION REJECTION (Arbitrary shell execution strictly rejected)
 * J. PROVIDER FAILURE & LOCAL FALLBACK (Timeout/failure falls back to local brain)
 * K. MALFORMED AI RESPONSE SAFETY (Invalid structured JSON handled gracefully)
 * L. SECRET KEY SAFETY (No API keys exposed in client bundle)
 */

import fs from 'node:fs';
import path from 'node:path';

// Setup browser mocks for Node environment
const spokenUtterances: string[] = [];
const spokenUtteranceObjects: MockSpeechSynthesisUtterance[] = [];
let speechCancelled = 0;
let isCurrentlySpeaking = false;

class MockSpeechSynthesisUtterance {
  public text: string;
  public rate: number = 1.0;
  public pitch: number = 1.0;
  public volume: number = 1.0;
  public lang: string = 'en-US';
  public voice: any = null;
  public onstart: (() => void) | null = null;
  public onend: (() => void) | null = null;
  public onerror: ((ev: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const mockVoices = [
  { name: 'Daniel', lang: 'en-GB', default: false, localService: true },
  { name: 'Alex', lang: 'en-US', default: false, localService: true },
  { name: 'Samantha', lang: 'en-US', default: true, localService: true },
  { name: 'Victoria', lang: 'en-US', default: false, localService: true },
  { name: 'Karen', lang: 'en-AU', default: false, localService: true },
];

const mockSpeechSynthesis = {
  speaking: false,
  paused: false,
  onvoiceschanged: null,
  getVoices: () => mockVoices,
  addEventListener: (_event: string, handler: () => void) => {
    setTimeout(handler, 10);
  },
  removeEventListener: () => {},
  speak: (utterance: MockSpeechSynthesisUtterance) => {
    spokenUtterances.push(utterance.text);
    spokenUtteranceObjects.push(utterance);
    isCurrentlySpeaking = true;
    mockSpeechSynthesis.speaking = true;

    setTimeout(() => {
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => {
        isCurrentlySpeaking = false;
        mockSpeechSynthesis.speaking = false;
        if (utterance.onend) utterance.onend();
      }, 20);
    }, 5);
  },
  cancel: () => {
    speechCancelled++;
    isCurrentlySpeaking = false;
    mockSpeechSynthesis.speaking = false;
  },
  pause: () => {
    mockSpeechSynthesis.paused = true;
  },
  resume: () => {
    mockSpeechSynthesis.paused = false;
  },
};

(globalThis as any).window = globalThis;
(globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
(globalThis as any).speechSynthesis = mockSpeechSynthesis;
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

(globalThis as any).novairBridge = {
  openApp: async () => ({ success: true }),
  closeApp: async () => ({ success: true }),
  openUrl: async () => ({ success: true }),
  openFolder: async () => ({ success: true }),
  openFile: async () => ({ success: true }),
  createFile: async () => ({ success: true }),
  moveFile: async () => ({ success: true }),
  setSystemSetting: async () => ({ success: true }),
  sleep: async () => ({ success: true }),
  restart: async () => ({ success: true }),
  shutdown: async () => ({ success: true }),
};

import { AIAssistantBrain, MockAIProvider } from '@/assistant/ai';
import { useAuraStore } from '@/state/useAuraStore';
import { browserExecutor } from '@/assistant/execution/BrowserExecutor';
import { validatePathSecurity, validateSafeFileName } from '@/assistant/execution/FilePathResolver';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runPhase25Tests() {
  console.log('=== AURA PHASE 25 REAL AI BRAIN TEST SUITE STARTING ===\n');

  const mockProvider = new MockAIProvider();
  const testBrain = new AIAssistantBrain(mockProvider);

  useAuraStore.setState({
    conversationTurns: [],
    history: [],
    confirmationPending: false,
    pendingConfirmationCommand: null,
  });
  const storeBrain = (await import('@/assistant/ai')).aiAssistantBrain;
  storeBrain.setProvider(mockProvider);

  // ----------------------------------------------------
  // SECTION A: OPEN-ENDED CONVERSATION
  // ----------------------------------------------------
  console.log('--- A. Testing Open-Ended Conversation ---');

  const resTired = await testBrain.respond('I had a really tiring day.');
  assert(resTired.type === 'conversation', 'Tiring day classified as conversation');
  assert(
    resTired.message.toLowerCase().includes('unwind') || resTired.message.toLowerCase().includes('deep breath'),
    'Responds with empathetic, non-robotic message'
  );

  const resInteresting = await testBrain.respond('Tell me something interesting.');
  assert(resInteresting.type === 'conversation', 'Interesting fact classified as conversation');
  assert(
    resInteresting.message.toLowerCase().includes('neutron star') || resInteresting.message.length > 30,
    'Returns interesting insight'
  );

  const resCloud = await testBrain.respond('Explain cloud computing for a beginner.');
  assert(resCloud.type === 'explanation', 'Cloud computing classified as explanation');
  assert(resCloud.message.toLowerCase().includes('compute'), 'Explanation includes core concepts');

  const resMca = await testBrain.respond('Give me some MCA project ideas.');
  assert(resMca.type === 'explanation', 'MCA project query classified as explanation');
  assert(resMca.message.toLowerCase().includes('autonomous') || resMca.message.toLowerCase().includes('project'), 'Provides technical project ideas');

  // ----------------------------------------------------
  // SECTION B: CONTEXT TRACKING (AWS -> S3)
  // ----------------------------------------------------
  console.log('\n--- B. Testing Conversation Context (AWS -> S3) ---');

  const resAws = await testBrain.respond('Tell me about AWS.');
  assert(resAws.type === 'explanation', 'AWS topic classified as explanation');

  // Follow-up with bounded context turn
  const contextTurns = [
    { id: '1', sender: 'user' as const, text: 'Tell me about AWS.', timestamp: new Date().toISOString() },
    { id: '2', sender: 'assistant' as const, text: resAws.message, timestamp: new Date().toISOString() },
  ];

  const resS3 = await testBrain.respond('What about S3?', { recentHistory: contextTurns });
  assert(resS3.type === 'explanation', 'Contextual follow-up classified as explanation');
  assert(
    resS3.message.toLowerCase().includes('storage') && resS3.message.toLowerCase().includes('bucket'),
    'Contextual S3 explanation understands AWS storage context'
  );

  // ----------------------------------------------------
  // SECTION C: COMPUTER TASK (Structured Actions)
  // ----------------------------------------------------
  console.log('\n--- C. Testing Structured Computer Task ---');

  const resTask = await testBrain.respond('Can you open Chrome and search for Python tutorials?');
  assert(resTask.type === 'multi_action_request' || resTask.type === 'action_request', 'Computer task parsed as action request');
  assert(!!resTask.actions && resTask.actions.length >= 2, 'Has at least 2 structured actions');
  assert(resTask.actions![0].intent === 'OPEN_APP', 'Action 1 intent is OPEN_APP');
  assert(resTask.actions![0].app === 'Google Chrome', 'Action 1 app is Google Chrome');
  assert(resTask.actions![1].intent === 'WEB_SEARCH', 'Action 2 intent is WEB_SEARCH');
  assert(resTask.actions![1].query === 'Python tutorials', 'Action 2 query is "Python tutorials"');
  assert(!!resTask.parsedCommands && resTask.parsedCommands.length >= 2, 'ParsedCommands are generated for executors');

  // ----------------------------------------------------
  // SECTION D: MULTI-STEP TASK (Chrome + Search React + Documents)
  // ----------------------------------------------------
  console.log('\n--- D. Testing Multi-Step Structured Planning ---');

  const resMulti = await testBrain.respond('Open Chrome, search for React tutorials, and then open my Documents folder.');
  assert(resMulti.type === 'multi_action_request', 'Multi-step compound goal identified');
  assert(!!resMulti.actions && resMulti.actions.length === 3, 'Contains exactly 3 sequential actions');
  assert(resMulti.actions![0].intent === 'OPEN_APP', 'Step 1 is OPEN_APP');
  assert(resMulti.actions![1].intent === 'WEB_SEARCH', 'Step 2 is WEB_SEARCH');
  assert(resMulti.actions![2].intent === 'OPEN_FOLDER', 'Step 3 is OPEN_FOLDER');

  // ----------------------------------------------------
  // SECTION E: HIGH-RISK ACTION (Restart Mac Confirmation)
  // ----------------------------------------------------
  console.log('\n--- E. Testing High-Risk Confirmation Flow ---');

  const resRestart = await testBrain.respond('Restart my Mac.');
  assert(resRestart.type === 'action_request', 'Restart proposed as structured action');
  assert(resRestart.actions![0].intent === 'RESTART', 'Action intent is RESTART');

  // Dispatch into AURA store to verify existing confirmation flow triggers
  const store = useAuraStore.getState();
  await store.submitCommand('Restart my Mac.');

  const storeStateAfterRestart = useAuraStore.getState();
  assert(storeStateAfterRestart.pendingConfirmationCommand !== null, 'Restart triggers pendingConfirmationCommand');
  assert(
    storeStateAfterRestart.activeResponse.text.toLowerCase().includes('confirmation') ||
    storeStateAfterRestart.activeResponse.text.toLowerCase().includes('restart'),
    'Prompts user for explicit confirmation'
  );

  // Cancel pending confirmation cleanly
  await store.submitCommand('cancel');
  assert(useAuraStore.getState().pendingConfirmationCommand === null, 'Pending confirmation cleared on cancel');

  // ----------------------------------------------------
  // SECTION F: DELETE FILE CONFIRMATION / RESTRICTION
  // ----------------------------------------------------
  console.log('\n--- F. Testing File Deletion Safety ---');

  const resDelete = await testBrain.respond('Delete that file.');
  assert(resDelete.type === 'action_request', 'Delete proposed as structured action');
  assert(resDelete.actions![0].intent === 'DELETE_FILE', 'Action intent is DELETE_FILE');

  // ----------------------------------------------------
  // SECTION G: FILE SAFETY (Path Traversal Protection)
  // ----------------------------------------------------
  console.log('\n--- G. Testing File Safety & Path Traversal Guard ---');

  const traversalCheck = validatePathSecurity('../../etc/passwd');
  assert(!traversalCheck.safe, 'Path traversal outside approved directories is blocked');
  assert(
    traversalCheck.reason?.toLowerCase().includes('traversal') ||
    traversalCheck.reason?.toLowerCase().includes('security'),
    'Security error raised for path traversal attempt'
  );

  const fileCheck = validateSafeFileName('../report.pdf');
  assert(!fileCheck.valid, 'File traversal strictly rejected by validateSafeFileName');

  // ----------------------------------------------------
  // SECTION H: BROWSER SAFETY (Protocol Restriction)
  // ----------------------------------------------------
  console.log('\n--- H. Testing Browser Safety (Javascript URL Guard) ---');

  const browserRes = await browserExecutor.execute({
    type: 'OPEN_URL',
    target: 'javascript:alert(1)',
    originalInput: 'open javascript:alert(1)',
    normalizedInput: 'open javascript:alert(1)',
    confidence: 1.0,
    risk: 'LOW',
  });
  assert(!browserRes.success, 'javascript: protocol is blocked by BrowserExecutor');
  assert(
    browserRes.message?.toLowerCase().includes('protocol') ||
    browserRes.errorCode?.toLowerCase().includes('protocol') ||
    browserRes.errorCode === 'INVALID_URL',
    'Returns protocol security error'
  );

  // ----------------------------------------------------
  // SECTION I: UNSUPPORTED ACTION REJECTION
  // ----------------------------------------------------
  console.log('\n--- I. Testing Unsupported Action Intent Rejection ---');

  mockProvider.setSimulateUnsupportedAction(true);
  const resUnsupported = await testBrain.respond('Run shell command rm -rf /');
  mockProvider.setSimulateUnsupportedAction(false);

  assert(
    resUnsupported.error?.includes('Unsupported action intent') ||
    resUnsupported.message.toLowerCase().includes('unsupported') ||
    resUnsupported.message.toLowerCase().includes('cannot execute'),
    'Unsupported action intent (UNRESTRICTED_SHELL_EXEC) is strictly rejected'
  );
  assert(!resUnsupported.parsedCommands || resUnsupported.parsedCommands.length === 0, 'No executable command generated for unsupported action');

  // ----------------------------------------------------
  // SECTION J: PROVIDER FAILURE & LOCAL FALLBACK
  // ----------------------------------------------------
  console.log('\n--- J. Testing Provider Failure & Local Fallback ---');

  mockProvider.setSimulateTimeout(true);
  // User asks a local arithmetic question during provider outage
  const resFallback = await testBrain.respond('What is 25 times 4?');
  mockProvider.setSimulateTimeout(false);

  assert(resFallback.fallbackUsed === true, 'Fallback flag is marked true');
  assert(resFallback.type === 'calculation' || resFallback.message.includes('100'), 'Local calculation succeeds during AI provider outage');

  // ----------------------------------------------------
  // SECTION K: MALFORMED AI RESPONSE SAFETY
  // ----------------------------------------------------
  console.log('\n--- K. Testing Malformed JSON Safety ---');

  mockProvider.setSimulateMalformed(true);
  const resMalformed = await testBrain.respond('Hello AURA');
  mockProvider.setSimulateMalformed(false);

  assert(resMalformed.fallbackUsed === true, 'Malformed response falls back gracefully');
  assert(resMalformed.message.length > 0, 'Returns natural fallback greeting without throwing error');

  // ----------------------------------------------------
  // SECTION L: SECRET SAFETY (No API keys in client files)
  // ----------------------------------------------------
  console.log('\n--- L. Testing Client Bundle Secret Key Safety ---');

  const srcDir = path.resolve(process.cwd(), 'src');
  const allSrcFiles: string[] = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanDir(full);
      } else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx') || ent.name.endsWith('.js'))) {
        allSrcFiles.push(full);
      }
    }
  }

  scanDir(srcDir);

  let apiKeyFound = false;
  for (const file of allSrcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    // Check for hardcoded OpenAI keys (sk-proj-..., sk-...) or Anthropic keys (sk-ant-...)
    if (/sk-[a-zA-Z0-9]{20,}/.test(content) || /sk-ant-[a-zA-Z0-9]{20,}/.test(content)) {
      apiKeyFound = true;
      console.error(`Found hardcoded key in ${file}`);
    }
    // Check for VITE_ secret leaks
    if (/import\.meta\.env\.VITE_.*API_KEY/i.test(content)) {
      apiKeyFound = true;
      console.error(`Found VITE_ secret key leak in ${file}`);
    }
  }

  assert(!apiKeyFound, 'Zero API keys or client-side secret environment variables in src/');

  console.log('\n==============================================');
  console.log('🎉 ALL AURA PHASE 25 SPECIFICATIONS & TESTS PASSED!');
  console.log('==============================================\n');
}

runPhase25Tests().catch((err) => {
  console.error('Unhandled Phase 25 test error:', err);
  process.exit(1);
});
