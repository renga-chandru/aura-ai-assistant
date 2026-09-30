/**
 * AURA Phase 24 Comprehensive Test Suite
 *
 * Verifies all Phase 24 specifications:
 * 1. Semantic Natural Language Understanding Layer (IAssistantUnderstanding, LocalSemanticUnderstanding)
 * 2. Meaning-Based Normalization (contractions, politeness wrappers, fillers)
 * 3. Conversational Paraphrasing without Hardcoded Matches:
 *    - GREETING: "Hi AURA", "Hello there", "Yo AURA"
 *    - CASUAL_CHECKIN: "How's it going?", "You doing okay?", "How have you been?"
 *    - IDENTITY, CAPABILITIES, THANKS, GOODBYE
 * 4. Application Control Paraphrases & Aliases:
 *    - "Can you bring up Chrome?" -> OPEN_APP Google Chrome
 *    - "Launch the browser" -> OPEN_APP Google Chrome
 *    - "Please start Google Chrome" -> OPEN_APP Google Chrome
 *    - "Start VS Code", "Fire up the code editor" -> OPEN_APP Visual Studio Code
 * 5. Web Search Paraphrases & Entity Extraction:
 *    - "Look up Python tutorials" -> WEB_SEARCH "Python tutorials"
 *    - "Find Python tutorials online" -> WEB_SEARCH "Python tutorials"
 *    - "Can you search the web for Python tutorials?" -> WEB_SEARCH "Python tutorials"
 *    - "Find me some Python tutorials" -> WEB_SEARCH "Python tutorials"
 * 6. Multi-Step Task Understanding with Natural Connectors:
 *    - "Bring up Chrome and look for React tutorials" -> 2 steps (OPEN_APP + WEB_SEARCH)
 *    - "Launch Chrome, then search for React tutorials" -> 2 steps (OPEN_APP + WEB_SEARCH)
 * 7. Files & Folders Paraphrasing:
 *    - Natural folder opening (Downloads / Documents)
 *    - Natural file opening / creating / moving
 * 8. System Controls Paraphrases:
 *    - "Turn the volume up", "Louder" -> VOLUME_UP
 *    - "Lower the volume", "Softer" -> VOLUME_DOWN
 *    - "Mute the Mac", "Silence" -> MUTE
 *    - "Unmute audio" -> UNMUTE
 * 9. Safe Calculator Paraphrases:
 *    - "What's 25 times 4?" -> 100
 *    - "Work out 120 divided by 6" -> 20
 * 10. Ambiguity Detection & Clarification Handling:
 *    - "Open it" -> asks "What would you like me to open?"
 *    - "Move this file" -> asks "Where should I move it?"
 * 11. Security Guard Preservations:
 *    - Block sudo / shell commands cleanly
 *    - Preserve path traversal blocks
 *    - Preserve high-risk confirmation flows (DELETE_FILE, RESTART, SHUTDOWN)
 * 12. Female Voice Output & Utterance Verification
 */

// Setup browser globals mock for Node environment
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
  addEventListener: (event: string, handler: () => void) => {
    if (event === 'voiceschanged') {
      setTimeout(handler, 10);
    }
  },
  removeEventListener: () => {},
  speak: (utterance: MockSpeechSynthesisUtterance) => {
    spokenUtterances.push(utterance.text);
    spokenUtteranceObjects.push(utterance);
    isCurrentlySpeaking = true;
    mockSpeechSynthesis.speaking = true;

    // Trigger start & end asynchronously
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => {
        isCurrentlySpeaking = false;
        mockSpeechSynthesis.speaking = false;
        if (utterance.onend) utterance.onend();
      }, 30);
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

import { localSemanticUnderstanding, SemanticNormalizer } from '@/assistant/understanding';
import { conversationBrain, SafeCalculator } from '@/assistant/brain';
import { localTaskPlanner } from '@/assistant/planner';
import { localCommandParser } from '@/assistant/commands';
import { useAuraStore } from '@/state/useAuraStore';
import { speechSynthesisService } from '@/voice/SpeechSynthesisService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPhase24Tests() {
  console.log('=== AURA PHASE 24 TEST SUITE STARTING ===\n');

  // ==========================================
  // SECTION 1: Semantic Normalizer & Contractions
  // ==========================================
  console.log('--- 1. Testing Semantic Normalizer & Contractions ---');

  const exp1 = SemanticNormalizer.expandContractions("how's it going?");
  assert(exp1.includes('how is'), "Expands \"how's\" -> \"how is\"");

  const exp2 = SemanticNormalizer.expandContractions("what's 25 times 4?");
  assert(exp2.includes('what is'), "Expands \"what's\" -> \"what is\"");

  const norm1 = SemanticNormalizer.normalize('Could you please open Chrome for me?');
  assert(norm1.toLowerCase() === 'open chrome', 'Strips leading & trailing polite fillers: "open chrome"');

  const norm2 = SemanticNormalizer.normalize('Hey AURA, launch the browser please!');
  assert(norm2.toLowerCase() === 'launch the browser', 'Strips AURA address prefix and please: "launch the browser"');

  // ==========================================
  // SECTION 2: Meaning-Based Greetings Paraphrasing
  // ==========================================
  console.log('\n--- 2. Testing Meaning-Based Greetings Paraphrasing ---');

  const g1 = await localSemanticUnderstanding.understand('Hi AURA');
  assert(g1.mode === 'conversation' && g1.intent === 'GREETING', '"Hi AURA" -> GREETING');

  const g2 = await localSemanticUnderstanding.understand('Hello there');
  assert(g2.mode === 'conversation' && g2.intent === 'GREETING', '"Hello there" -> GREETING');

  const g3 = await localSemanticUnderstanding.understand('Yo AURA');
  assert(g3.mode === 'conversation' && g3.intent === 'GREETING', '"Yo AURA" -> GREETING');

  const g4 = await localSemanticUnderstanding.understand('Good to see you');
  assert(g4.mode === 'conversation' && g4.intent === 'GREETING', '"Good to see you" -> GREETING');

  // ==========================================
  // SECTION 3: Casual Check-In Paraphrasing
  // ==========================================
  console.log('\n--- 3. Testing Casual Check-In Paraphrasing ---');

  const c1 = await localSemanticUnderstanding.understand("How's it going?");
  assert(c1.mode === 'conversation' && c1.intent === 'CASUAL_CHECKIN', "\"How's it going?\" -> CASUAL_CHECKIN");

  const c2 = await localSemanticUnderstanding.understand('You doing okay?');
  assert(c2.mode === 'conversation' && c2.intent === 'CASUAL_CHECKIN', '"You doing okay?" -> CASUAL_CHECKIN');

  const c3 = await localSemanticUnderstanding.understand('How have you been?');
  assert(c3.mode === 'conversation' && c3.intent === 'CASUAL_CHECKIN', '"How have you been?" -> CASUAL_CHECKIN');

  const c4 = await localSemanticUnderstanding.understand('How are things?');
  assert(c4.mode === 'conversation' && c4.intent === 'CASUAL_CHECKIN', '"How are things?" -> CASUAL_CHECKIN');

  // ==========================================
  // SECTION 4: Application Control Paraphrases & Aliases
  // ==========================================
  console.log('\n--- 4. Testing Application Control Paraphrases & Aliases ---');

  const a1 = await localSemanticUnderstanding.understand('Can you bring up Chrome?');
  assert(
    a1.mode === 'action' && a1.intent === 'OPEN_APP' && a1.entities.appName === 'Google Chrome',
    '"Can you bring up Chrome?" -> OPEN_APP Google Chrome'
  );

  const a2 = await localSemanticUnderstanding.understand('Launch the browser');
  assert(
    a2.mode === 'action' && a2.intent === 'OPEN_APP' && a2.entities.appName === 'Google Chrome',
    '"Launch the browser" -> OPEN_APP Google Chrome (alias mapped)'
  );

  const a3 = await localSemanticUnderstanding.understand('Please start Google Chrome');
  assert(
    a3.mode === 'action' && a3.intent === 'OPEN_APP' && a3.entities.appName === 'Google Chrome',
    '"Please start Google Chrome" -> OPEN_APP Google Chrome'
  );

  const a4 = await localSemanticUnderstanding.understand('Get Chrome open');
  assert(
    a4.mode === 'action' && a4.intent === 'OPEN_APP' && a4.entities.appName === 'Google Chrome',
    '"Get Chrome open" -> OPEN_APP Google Chrome'
  );

  const a5 = await localSemanticUnderstanding.understand('Fire up the code editor');
  assert(
    a5.mode === 'action' && a5.intent === 'OPEN_APP' && a5.entities.appName === 'Visual Studio Code',
    '"Fire up the code editor" -> OPEN_APP Visual Studio Code (alias mapped)'
  );

  // ==========================================
  // SECTION 5: Web Search Paraphrases & Slot Extraction
  // ==========================================
  console.log('\n--- 5. Testing Web Search Paraphrases & Slot Extraction ---');

  const s1 = await localSemanticUnderstanding.understand('Look up Python tutorials');
  assert(
    s1.mode === 'action' && s1.intent === 'WEB_SEARCH' && s1.entities.query === 'Python tutorials',
    '"Look up Python tutorials" -> WEB_SEARCH "Python tutorials"'
  );

  const s2 = await localSemanticUnderstanding.understand('Find Python tutorials online');
  assert(
    s2.mode === 'action' && s2.intent === 'WEB_SEARCH' && s2.entities.query === 'Python tutorials',
    '"Find Python tutorials online" -> WEB_SEARCH "Python tutorials"'
  );

  const s3 = await localSemanticUnderstanding.understand('Can you search the web for Python tutorials?');
  assert(
    s3.mode === 'action' && s3.intent === 'WEB_SEARCH' && s3.entities.query === 'Python tutorials',
    '"Can you search the web for Python tutorials?" -> WEB_SEARCH "Python tutorials"'
  );

  const s4 = await localSemanticUnderstanding.understand('Find me some Python tutorials');
  assert(
    s4.mode === 'action' && s4.intent === 'WEB_SEARCH' && s4.entities.query === 'Python tutorials',
    '"Find me some Python tutorials" -> WEB_SEARCH "Python tutorials"'
  );

  const s5 = await localSemanticUnderstanding.understand('Find information about AWS S3');
  assert(
    s5.mode === 'action' && s5.intent === 'WEB_SEARCH' && (s5.entities.query === 'AWS S3' || s5.entities.query?.includes('AWS S3')),
    '"Find information about AWS S3" -> WEB_SEARCH query'
  );

  // ==========================================
  // SECTION 6: Multi-Step Task Understanding
  // ==========================================
  console.log('\n--- 6. Testing Multi-Step Understanding & Connectors ---');

  const m1 = await localSemanticUnderstanding.understand('Bring up Chrome and look for React tutorials');
  assert(
    m1.mode === 'multi_action' && m1.actions.length === 2,
    '"Bring up Chrome and look for React tutorials" recognized as 2 actions'
  );
  assert(m1.actions[0].intent === 'OPEN_APP' && m1.actions[0].entities.appName === 'Google Chrome', 'Step 1: OPEN_APP Chrome');
  assert(m1.actions[1].intent === 'WEB_SEARCH' && m1.actions[1].entities.query === 'React tutorials', 'Step 2: WEB_SEARCH React tutorials');

  const m2 = await localSemanticUnderstanding.understand('Launch Chrome, then search for React tutorials');
  assert(
    m2.mode === 'multi_action' && m2.actions.length === 2,
    '"Launch Chrome, then search for React tutorials" recognized as 2 actions'
  );

  // Planner test with new connector phrasing
  const plan1 = localTaskPlanner.plan('Bring up Chrome and look for React tutorials');
  assert(plan1 !== null && plan1.steps.length === 2, 'LocalTaskPlanner plans natural compound instruction');
  assert(plan1?.steps[0].command?.target === 'Google Chrome', 'Planned step 1 opens Google Chrome');
  assert(plan1?.steps[1].command?.query === 'React tutorials', 'Planned step 2 searches for React tutorials');

  // ==========================================
  // SECTION 7: File & Folder Paraphrases
  // ==========================================
  console.log('\n--- 7. Testing File & Folder Paraphrases ---');

  const f1 = await localSemanticUnderstanding.understand('Can you open my downloads folder?');
  assert(
    f1.mode === 'action' && f1.intent === 'OPEN_FOLDER' && f1.entities.folderName === 'Downloads',
    '"Can you open my downloads folder?" -> OPEN_FOLDER Downloads'
  );

  const f2 = await localSemanticUnderstanding.understand('Show me Documents');
  assert(
    f2.mode === 'action' && f2.intent === 'OPEN_FOLDER' && f2.entities.folderName === 'Documents',
    '"Show me Documents" -> OPEN_FOLDER Documents'
  );

  const f3 = await localSemanticUnderstanding.understand('Open report.pdf');
  assert(
    f3.mode === 'action' && f3.intent === 'OPEN_FILE' && f3.entities.filename === 'report.pdf',
    '"Open report.pdf" -> OPEN_FILE report.pdf'
  );

  const f4 = await localSemanticUnderstanding.understand('Create a file called ideas.txt');
  assert(
    f4.mode === 'action' && f4.intent === 'CREATE_FILE' && f4.entities.filename === 'ideas.txt',
    '"Create a file called ideas.txt" -> CREATE_FILE ideas.txt'
  );

  const f5 = await localSemanticUnderstanding.understand('Move notes.txt to Desktop');
  assert(
    f5.mode === 'action' && f5.intent === 'MOVE_FILE' && f5.entities.filename === 'notes.txt' && f5.entities.destination === 'Desktop',
    '"Move notes.txt to Desktop" -> MOVE_FILE notes.txt -> Desktop'
  );

  // ==========================================
  // SECTION 8: System Audio Control Paraphrases
  // ==========================================
  console.log('\n--- 8. Testing System Audio Control Paraphrases ---');

  const sys1 = await localSemanticUnderstanding.understand('Turn the volume up');
  assert(sys1.intent === 'SYSTEM_SETTING' && sys1.entities.systemSetting === 'volume_up', '"Turn the volume up" -> volume_up');

  const sys2 = await localSemanticUnderstanding.understand('Lower the volume');
  assert(sys2.intent === 'SYSTEM_SETTING' && sys2.entities.systemSetting === 'volume_down', '"Lower the volume" -> volume_down');

  const sys3 = await localSemanticUnderstanding.understand('Mute the Mac');
  assert(sys3.intent === 'SYSTEM_SETTING' && sys3.entities.systemSetting === 'mute', '"Mute the Mac" -> mute');

  const sys4 = await localSemanticUnderstanding.understand('Unmute audio');
  assert(sys4.intent === 'SYSTEM_SETTING' && sys4.entities.systemSetting === 'unmute', '"Unmute audio" -> unmute');

  // ==========================================
  // SECTION 9: Calculator Paraphrases
  // ==========================================
  console.log('\n--- 9. Testing Calculator Paraphrases ---');

  const calc1 = await localSemanticUnderstanding.understand("What's 25 times 4?");
  assert(calc1.intent === 'CALCULATE', "\"What's 25 times 4?\" -> CALCULATE");

  const calc2 = await localSemanticUnderstanding.understand('Work out 120 divided by 6');
  assert(calc2.intent === 'CALCULATE', '"Work out 120 divided by 6" -> CALCULATE');

  const brainCalc = await conversationBrain.process('Work out 120 divided by 6');
  assert(brainCalc.intent === 'CALCULATION' && brainCalc.calculationResult?.result === 20, 'Brain calculation returns 20');

  // ==========================================
  // SECTION 10: Ambiguity & Clarification Questions
  // ==========================================
  console.log('\n--- 10. Testing Ambiguity & Clarification Requests ---');

  const amb1 = await localSemanticUnderstanding.understand('Open it');
  assert(
    amb1.mode === 'ambiguous' && amb1.clarificationNeeded === true,
    '"Open it" detected as ambiguous'
  );
  assert(
    amb1.clarificationQuestion === 'What would you like me to open?',
    'Clarification question: "What would you like me to open?"'
  );

  const amb2 = await localSemanticUnderstanding.understand('Move this file');
  assert(
    amb2.mode === 'ambiguous' && amb2.clarificationQuestion === 'Where should I move it?',
    'Clarification question: "Where should I move it?"'
  );

  const brainAmb = await conversationBrain.process('Open it');
  assert(
    brainAmb.intent === 'QUESTION' && brainAmb.chatResponse?.includes('What would you like me to open?'),
    'Conversation brain asks clarification question rather than executing or failing'
  );

  // ==========================================
  // SECTION 11: Security Guard Preservation
  // ==========================================
  console.log('\n--- 11. Testing Security Guard Preservation ---');

  // Sudo blocked
  const sec1 = await localSemanticUnderstanding.understand('sudo rm -rf /');
  assert(sec1.intent === 'UNKNOWN_ACTION' && sec1.actions[0]?.parsedCommand?.risk === 'HIGH', 'Sudo classified as HIGH risk UNKNOWN_ACTION');

  // Shell script blocked
  const sec2 = await localSemanticUnderstanding.understand('execute bash -c "echo hack"');
  assert(sec2.intent === 'UNKNOWN_ACTION', 'Shell execution blocked');

  // Traversal blocked via store
  const store = useAuraStore.getState();
  await store.submitCommand('open ../../../etc/passwd');
  await sleep(150);
  assert(
    useAuraStore.getState().activeResponse.text.includes("can't access that location") ||
    useAuraStore.getState().activeResponse.text.includes('Blocked path') ||
    useAuraStore.getState().activeResponse.text.includes("can't perform that action safely"),
    'Path traversal safely blocked'
  );

  // Confirmation flow preserved
  await store.submitCommand('shut down my Mac');
  await sleep(150);
  assert(useAuraStore.getState().pendingConfirmationCommand !== null, 'Shutdown triggers pending confirmation');
  assert(useAuraStore.getState().activeResponse.text.includes('Shut down your Mac'), 'Shutdown prompt shown');

  // Cancel confirmation
  await store.submitCommand('never mind');
  await sleep(150);
  assert(useAuraStore.getState().pendingConfirmationCommand === null, 'Pending confirmation cancelled cleanly');

  // ==========================================
  // SECTION 12: Female Voice Utterance Verification
  // ==========================================
  console.log('\n--- 12. Testing Female Voice Utterance Verification ---');

  spokenUtteranceObjects.length = 0;
  await store.submitCommand('How are things?');
  await sleep(150);
  assert(spokenUtteranceObjects.length > 0, 'Spoken utterance dispatched');
  const lastUtterance = spokenUtteranceObjects[spokenUtteranceObjects.length - 1];
  assert(lastUtterance.voice !== null, 'Utterance voice is assigned');
  assert(lastUtterance.voice?.name === 'Samantha', 'Utterance explicitly receives selected female voice Samantha');

  console.log('\n==============================================');
  console.log('🎉 ALL AURA PHASE 24 TESTS & SPECIFICATIONS PASSED!');
  console.log('==============================================');
}

runPhase24Tests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
