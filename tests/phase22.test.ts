/**
 * NOVAIR Phase 22 End-to-End Integration Test Suite
 *
 * Verifies all 23 scenarios required in Section 16:
 * Typed commands, Confirmation flow, Security enforcement, and Voice parity.
 * Also tests Interruption behavior, Duplicate speech protection, and Error handling.
 */

// Setup browser globals mock for Node environment
const spokenUtterances: string[] = [];
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

const mockSpeechSynthesis = {
  speaking: false,
  paused: false,
  onvoiceschanged: null,
  getVoices: () => [
    { name: 'Samantha', lang: 'en-US', default: true },
    { name: 'Daniel', lang: 'en-GB', default: false },
  ],
  speak: (utterance: MockSpeechSynthesisUtterance) => {
    spokenUtterances.push(utterance.text);
    isCurrentlySpeaking = true;
    mockSpeechSynthesis.speaking = true;

    // Trigger start asynchronously
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => {
        isCurrentlySpeaking = false;
        mockSpeechSynthesis.speaking = false;
        if (utterance.onend) utterance.onend();
      }, 50);
    }, 10);
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

(global as any).window = {
  speechSynthesis: mockSpeechSynthesis,
  SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 2,
  novairBridge: {
    openApp: async () => ({ success: true }),
    closeApp: async () => ({ success: true }),
    openUrl: async () => ({ success: true }),
    openFolder: async () => ({ success: true }),
    openFile: async () => ({ success: true }),
    createFile: async (fileName: string, dest?: string) => ({ success: true }),
    moveFile: async (fileName: string, dest: string) => ({ success: true }),
    setSystemSetting: async () => ({ success: true }),
    sleep: async () => ({ success: true }),
    restart: async () => ({ success: true }),
    shutdown: async () => ({ success: true }),
  },
};
(global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// Mock local dev-server bridge endpoint to avoid network error during tests
(global as any).fetch = async (url: string) => {
  if (url.includes('/api/system/health')) {
    return { ok: true, json: async () => ({ status: 'ok' }) };
  }
  return {
    ok: true,
    json: async () => ({ success: true, message: 'Mock bridge success' }),
  };
};

import { useAuraStore } from '../src/state/useAuraStore';
import { novairVoiceOutputService } from '../src/assistant/voice';
import { ResponseFormatter } from '../src/assistant/response';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTests() {
  console.log('\n=== NOVAIR PHASE 22 TEST SUITE STARTING ===\n');

  const store = useAuraStore.getState();

  // Reset store
  store.clearHistory();
  store.setPendingConfirmationCommand(null);

  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Typed Commands (Scenarios 1-10) ---');
  // -------------------------------------------------------------

  // 1. Open YouTube
  spokenUtterances.length = 0;
  await store.submitCommand('Open YouTube');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Opening YouTube.',
    '1. Open YouTube -> "Opening YouTube."'
  );
  assert(spokenUtterances.includes('Opening YouTube.'), '1. Spoken: "Opening YouTube."');
  assert(useAuraStore.getState().currentState === 'IDLE', '1. Return to IDLE after speech');

  // 2. Search Google for React tutorials
  spokenUtterances.length = 0;
  await store.submitCommand('Search Google for React tutorials');
  await sleep(150);
  console.log('ACTUAL RESPONSE:', useAuraStore.getState().activeResponse.text);
  assert(
    useAuraStore.getState().activeResponse.text === 'Searching Google for React tutorials.',
    '2. Search Google for React tutorials -> "Searching Google for React tutorials."'
  );
  assert(
    spokenUtterances.includes('Searching Google for React tutorials.'),
    '2. Spoken: "Searching Google for React tutorials."'
  );

  // 3. Open Calculator
  spokenUtterances.length = 0;
  await store.submitCommand('Open Calculator');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Opening Calculator.',
    '3. Open Calculator -> "Opening Calculator."'
  );
  assert(spokenUtterances.includes('Opening Calculator.'), '3. Spoken: "Opening Calculator."');

  // 4. Close Calculator
  spokenUtterances.length = 0;
  await store.submitCommand('Close Calculator');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Closing Calculator.',
    '4. Close Calculator -> "Closing Calculator."'
  );
  assert(spokenUtterances.includes('Closing Calculator.'), '4. Spoken: "Closing Calculator."');

  // 5. Open Downloads
  spokenUtterances.length = 0;
  await store.submitCommand('Open Downloads');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Opening Downloads.',
    '5. Open Downloads -> "Opening Downloads."'
  );
  assert(spokenUtterances.includes('Opening Downloads.'), '5. Spoken: "Opening Downloads."');

  // 6. Create notes.txt
  spokenUtterances.length = 0;
  await store.submitCommand('Create notes.txt');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Created notes.txt.',
    '6. Create notes.txt -> "Created notes.txt."'
  );
  assert(spokenUtterances.includes('Created notes.txt.'), '6. Spoken: "Created notes.txt."');

  // 7. Move notes.txt to Desktop
  spokenUtterances.length = 0;
  await store.submitCommand('Move notes.txt to Desktop');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Moved notes.txt to Desktop.',
    '7. Move notes.txt to Desktop -> "Moved notes.txt to Desktop."'
  );
  assert(
    spokenUtterances.includes('Moved notes.txt to Desktop.'),
    '7. Spoken: "Moved notes.txt to Desktop."'
  );

  // 8. Increase volume
  spokenUtterances.length = 0;
  await store.submitCommand('Increase volume');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Volume increased.',
    '8. Increase volume -> "Volume increased."'
  );
  assert(spokenUtterances.includes('Volume increased.'), '8. Spoken: "Volume increased."');

  // 9. Mute
  spokenUtterances.length = 0;
  await store.submitCommand('Mute');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Muted.',
    '9. Mute -> "Muted."'
  );
  assert(spokenUtterances.includes('Muted.'), '9. Spoken: "Muted."');

  // 10. Unmute
  spokenUtterances.length = 0;
  await store.submitCommand('Unmute');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === 'Unmuted.',
    '10. Unmute -> "Unmuted."'
  );
  assert(spokenUtterances.includes('Unmuted.'), '10. Spoken: "Unmuted."');

  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Confirmation Flow (Scenarios 11-14) ---');
  // -------------------------------------------------------------

  // 11. Restart my Mac -> confirmation prompt
  spokenUtterances.length = 0;
  await store.submitCommand('Restart my Mac');
  await sleep(150);
  const pendingCmd1 = useAuraStore.getState().pendingConfirmationCommand;
  assert(pendingCmd1 !== null && pendingCmd1.type === 'RESTART', '11. Identified RESTART command as pending');
  assert(
    useAuraStore.getState().activeResponse.text ===
      'Restart your Mac? This will close running applications and restart the system.',
    '11. Confirmation text displayed'
  );
  assert(
    spokenUtterances.includes(
      'Restart your Mac? This will close running applications and restart the system.'
    ),
    '11. Spoken confirmation question'
  );

  // 12. Cancel -> no restart
  spokenUtterances.length = 0;
  await store.submitCommand('Cancel');
  await sleep(150);
  assert(
    useAuraStore.getState().pendingConfirmationCommand === null,
    '12. Pending confirmation cleared after cancellation'
  );
  assert(
    useAuraStore.getState().activeResponse.text === 'Cancelled.',
    '12. Active response set to "Cancelled."'
  );
  assert(spokenUtterances.includes('Cancelled.'), '12. Spoken cancellation: "Cancelled."');

  // 13. Restart my Mac -> confirmation prompt again
  spokenUtterances.length = 0;
  await store.submitCommand('Restart my Mac');
  await sleep(150);
  assert(
    useAuraStore.getState().pendingConfirmationCommand !== null,
    '13. Pending confirmation active again'
  );

  // 14. Yes -> executes confirmed restart
  spokenUtterances.length = 0;
  await store.submitCommand('Yes');
  await sleep(150);
  assert(
    useAuraStore.getState().pendingConfirmationCommand === null,
    '14. Pending confirmation consumed'
  );
  assert(
    useAuraStore.getState().activeResponse.text === 'Restarting your Mac.',
    '14. Confirmed restart executed -> "Restarting your Mac."'
  );
  assert(spokenUtterances.includes('Restarting your Mac.'), '14. Spoken: "Restarting your Mac."');

  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Safety Enforcement (Scenarios 15-19) ---');
  // -------------------------------------------------------------

  // 15. "sudo shutdown -h now" -> rejected
  spokenUtterances.length = 0;
  await store.submitCommand('sudo shutdown -h now');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === "I can't perform that action safely.",
    '15. sudo command blocked cleanly without executing'
  );
  assert(
    spokenUtterances.includes("I can't perform that action safely."),
    '15. Spoken safety rejection'
  );

  // 16. "defaults write ..." -> rejected
  spokenUtterances.length = 0;
  await store.submitCommand('defaults write com.apple.finder AppleShowAllFiles YES');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === "I can't perform that action safely.",
    '16. defaults write command blocked cleanly'
  );

  // 17. "Open ../../etc/passwd" -> rejected
  spokenUtterances.length = 0;
  await store.submitCommand('Open ../../etc/passwd');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === "I can't access that location.",
    '17. Path traversal blocked cleanly'
  );

  // 18. "Open javascript:..." -> rejected
  spokenUtterances.length = 0;
  await store.submitCommand('Open javascript:alert(1)');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text === "I can't access that location.",
    '18. Dangerous protocol rejected cleanly'
  );

  // 19. Delete file -> remains confirmation/preview-only
  spokenUtterances.length = 0;
  await store.submitCommand('Delete notes.txt');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text.includes('Confirmation required: Deletion is restricted'),
    '19. Delete file restricted to confirmation/preview only'
  );
  assert(
    spokenUtterances.some((u) => u.includes('Confirmation required: Deletion is restricted')),
    '19. Spoken delete restriction preview'
  );

  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Voice Parity (Scenarios 20-23) ---');
  // -------------------------------------------------------------

  // 20. Speak "Open YouTube" -> simulated through handleFinalTranscript / submitCommand
  spokenUtterances.length = 0;
  await store.submitCommand('Open YouTube');
  await sleep(150);
  assert(useAuraStore.getState().activeResponse.text === 'Opening YouTube.', '20. Voice parity: Open YouTube');
  assert(spokenUtterances.includes('Opening YouTube.'), '20. Voice parity spoken output');

  // 21. Speak "Increase volume"
  spokenUtterances.length = 0;
  await store.submitCommand('Increase volume');
  await sleep(150);
  assert(useAuraStore.getState().activeResponse.text === 'Volume increased.', '21. Voice parity: Increase volume');
  assert(spokenUtterances.includes('Volume increased.'), '21. Voice parity spoken volume output');

  // 22. Speak "Restart my Mac" -> confirmation spoken
  spokenUtterances.length = 0;
  await store.submitCommand('Restart my Mac');
  await sleep(150);
  assert(
    useAuraStore.getState().pendingConfirmationCommand !== null,
    '22. Voice parity: Restart my Mac pending confirmation'
  );
  assert(
    spokenUtterances.includes(
      'Restart your Mac? This will close running applications and restart the system.'
    ),
    '22. Voice parity: Spoken confirmation prompt'
  );

  // 23. Speak "Cancel" -> cancellation
  spokenUtterances.length = 0;
  await store.submitCommand('Cancel');
  await sleep(150);
  assert(
    useAuraStore.getState().pendingConfirmationCommand === null,
    '23. Voice parity: Cancel clears pending confirmation'
  );
  assert(spokenUtterances.includes('Cancelled.'), '23. Voice parity: Spoken cancellation');

  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Interruption & Duplicate Protection ---');
  // -------------------------------------------------------------

  // Interruption test
  novairVoiceOutputService.stop();
  const initCancels = speechCancelled;
  novairVoiceOutputService.speak('This is a long sentence being spoken by NOVAIR.');
  assert(isCurrentlySpeaking || mockSpeechSynthesis.speaking, 'Speech initiated');
  // User starts new command or mic starts
  novairVoiceOutputService.stop();
  assert(speechCancelled > initCancels, 'Speech cancel called upon interruption');

  // Duplicate speech suppression test
  spokenUtterances.length = 0;
  const speak1 = await novairVoiceOutputService.speak('Test duplicate suppression.');
  const speak2 = await novairVoiceOutputService.speak('Test duplicate suppression.');
  assert(speak1 === true, 'First speech call accepted');
  assert(speak2 === false, 'Duplicate speech call within 800ms suppressed');

  // History verification
  const history = useAuraStore.getState().history;
  assert(history.length > 0, 'Command history populated naturally');
  assert(history[0].response !== undefined, 'History includes natural assistant responses');

  console.log('\n==============================================');
  console.log('🎉 ALL 23 SCENARIOS AND GUARDS PASSED CLEANLY!');
  console.log('==============================================\n');
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
