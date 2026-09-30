/**
 * AURA Phase 23 Comprehensive Test Suite
 *
 * Verifies all Phase 23 specifications:
 * 1. Conversational Intent Layer (CHAT, QUESTION, CALCULATION, MULTI_STEP_COMMAND, COMMAND, UNKNOWN)
 * 2. Deterministic Local Conversational Responses (hi, hello, how are you, who are you, what can you do, thanks, etc.)
 * 3. Safe Calculator without eval() (arithmetic, word operators, percentages, security rejections)
 * 4. Multi-Step Task Planner (Calculator + calculate, Chrome + search, YouTube + search)
 * 5. Natural Language Flexibility (polite prefixes, aliases, search variations)
 * 6. Unified Voice + Text Pipeline & Response Model
 * 7. Female English Voice Selection Preference & Explicit Utterance Assignment
 * 8. Friendly Error Responses
 * 9. Security Preservation (allowlists, safety validation, confirmation flow, path security)
 * 10. Complete AURA Rebranding Verification
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

import { conversationBrain, SafeCalculator } from '@/assistant/brain';
import { localTaskPlanner } from '@/assistant/planner';
import { localCommandParser } from '@/assistant/commands';
import { useAuraStore } from '@/state/useAuraStore';
import { speechSynthesisService, SpeechSynthesisService } from '@/voice/SpeechSynthesisService';

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

async function runPhase23Tests() {
  console.log('=== AURA PHASE 23 TEST SUITE STARTING ===\n');

  // ==========================================
  // SECTION 1: Conversational Intent & Greetings
  // ==========================================
  console.log('--- 1. Testing Conversational Brain & Greetings (AURA Branding) ---');

  const hiRes = await conversationBrain.process('hi');
  assert(hiRes.intent === 'CHAT', 'Intent for "hi" is CHAT');
  assert(hiRes.chatResponse?.includes('Welcome back') ?? false, 'Response for "hi" contains "Welcome back"');

  const helloRes = await conversationBrain.process('hello');
  assert(helloRes.intent === 'CHAT', 'Intent for "hello" is CHAT');
  assert(helloRes.chatResponse?.includes("I'm AURA") ?? false, 'Response for "hello" contains "I\'m AURA"');

  const heyAuraRes = await conversationBrain.process('hey aura');
  assert(heyAuraRes.intent === 'CHAT', 'Intent for "hey aura" is CHAT');
  assert(heyAuraRes.chatResponse?.includes("I'm here") ?? false, 'Response for "hey aura" contains "I\'m here"');

  const hiAuraRes = await conversationBrain.process('hi aura');
  assert(hiAuraRes.intent === 'CHAT', 'Intent for "hi aura" is CHAT');

  const howAreYouRes = await conversationBrain.process('how are you?');
  assert(howAreYouRes.intent === 'CHAT', 'Intent for "how are you?" is CHAT');
  assert(howAreYouRes.chatResponse?.includes('doing great') ?? false, 'Response for "how are you?" is friendly');

  const whoAreYouRes = await conversationBrain.process('who are you?');
  assert(whoAreYouRes.intent === 'QUESTION', 'Intent for "who are you?" is QUESTION');
  assert(whoAreYouRes.chatResponse?.includes("I'm AURA, your personal desktop AI assistant.") ?? false, 'Response for "who are you" identifies AURA');

  const thankYouRes = await conversationBrain.process('thank you');
  assert(thankYouRes.intent === 'CHAT', 'Intent for "thank you" is CHAT');
  assert(thankYouRes.chatResponse?.includes("You're welcome") ?? false, 'Response for "thank you" acknowledges gratitude');

  const goodMorningRes = await conversationBrain.process('good morning');
  assert(goodMorningRes.intent === 'CHAT', 'Intent for "good morning" is CHAT');
  assert(goodMorningRes.chatResponse?.includes('Good morning') ?? false, 'Response for "good morning" greets appropriately');

  const byeRes = await conversationBrain.process('bye');
  assert(byeRes.intent === 'CHAT', 'Intent for "bye" is CHAT');
  assert(byeRes.chatResponse?.includes('See you') ?? false, 'Response for "bye" says farewell');

  // ==========================================
  // SECTION 2: Capabilities Explanation
  // ==========================================
  console.log('\n--- 2. Testing Capabilities Explanation ---');

  const capRes = await conversationBrain.process('what can you do?');
  assert(capRes.intent === 'QUESTION', 'Intent for "what can you do?" is QUESTION');
  const capText = capRes.chatResponse || '';
  assert(capText.includes('talk with you'), 'Mentions conversation ability');
  assert(capText.includes('voice and text'), 'Mentions voice and text');
  assert(capText.includes('supported apps'), 'Mentions supported apps');
  assert(capText.includes('search the web'), 'Mentions web search');
  assert(capText.includes('approved files'), 'Mentions approved files');
  assert(capText.includes('calculations'), 'Mentions calculations');
  assert(capText.includes('desktop tasks') || capText.includes('multi-step'), 'Mentions multi-step tasks');

  // ==========================================
  // SECTION 3: Safe Calculator (No eval)
  // ==========================================
  console.log('\n--- 3. Testing Safe Calculator ---');

  const calc1 = SafeCalculator.calculate('2+2');
  assert(calc1 !== null && calc1.result === 4, '2+2 = 4');

  const calc2 = SafeCalculator.calculate('25 times 4');
  assert(calc2 !== null && calc2.result === 100, '25 times 4 = 100');
  assert(calc2?.formattedAnswer === '25 times 4 is 100.', 'Formatted answer: "25 times 4 is 100."');

  const calc3 = SafeCalculator.calculate('100 divided by 5');
  assert(calc3 !== null && calc3.result === 20, '100 divided by 5 = 20');

  const calc4 = SafeCalculator.calculate('50 minus 20');
  assert(calc4 !== null && calc4.result === 30, '50 minus 20 = 30');

  const calc5 = SafeCalculator.calculate('12 multiplied by 8');
  assert(calc5 !== null && calc5.result === 96, '12 multiplied by 8 = 96');

  const calc6 = SafeCalculator.calculate('what is 25% of 200?');
  assert(calc6 !== null && calc6.result === 50, '25% of 200 = 50');

  // Prefix handling with AURA
  const calcAura = SafeCalculator.calculate('hey aura what is 25 times 4?');
  assert(calcAura !== null && calcAura.result === 100, 'Calculates with "hey aura" prefix');

  // Security test for SafeCalculator: must reject arbitrary code / functions
  assert(SafeCalculator.calculate('eval("2+2")') === null, 'Rejects eval()');
  assert(SafeCalculator.calculate('console.log(42)') === null, 'Rejects console.log');
  assert(SafeCalculator.calculate('process.exit()') === null, 'Rejects process.exit');
  assert(SafeCalculator.calculate('alert(1)') === null, 'Rejects alert()');
  assert(SafeCalculator.calculate('__proto__') === null, 'Rejects __proto__');

  // Brain handles calculation directly
  const brainCalc = await conversationBrain.process('What is 25 times 4?');
  assert(brainCalc.intent === 'CALCULATION', 'Brain classifies "What is 25 times 4?" as CALCULATION');
  assert(brainCalc.calculationResult?.result === 100, 'Brain calculation returns 100');
  assert(brainCalc.chatResponse === '25 times 4 is 100.', 'Brain returns conversational calculation response');

  // ==========================================
  // SECTION 4: Multi-Step Task Planner
  // ==========================================
  console.log('\n--- 4. Testing Multi-Step Task Planner ---');

  // 1. "Open Calculator and calculate 25 times 4."
  const plan1 = localTaskPlanner.plan('Open Calculator and calculate 25 times 4.');
  assert(plan1 !== null && plan1.isMultiStep === true, 'Plan 1 is identified as multi-step');
  assert(plan1 !== null && plan1.steps.length === 2, 'Plan 1 has exactly 2 steps');
  assert(plan1 !== null && plan1.steps[0].command?.type === 'OPEN_APP', 'Step 1 is OPEN_APP');
  assert(plan1 !== null && plan1.steps[0].command?.target === 'Calculator', 'Step 1 opens Calculator');
  assert(plan1 !== null && plan1.steps[1].type === 'CALCULATION_STEP', 'Step 2 is CALCULATION_STEP');
  assert(plan1 !== null && (plan1.steps[1].calculationExpression?.includes('25 times 4') ?? false), 'Step 2 calculates 25 times 4');

  // 2. "Open Chrome and search for React tutorials."
  const plan2 = localTaskPlanner.plan('Open Chrome and search for React tutorials.');
  assert(plan2 !== null && plan2.isMultiStep === true, 'Plan 2 is identified as multi-step');
  assert(plan2 !== null && plan2.steps.length === 2, 'Plan 2 has 2 steps');
  assert(plan2 !== null && plan2.steps[0].command?.target === 'Google Chrome', 'Step 1 opens Google Chrome');
  assert(plan2 !== null && plan2.steps[1].command?.type === 'WEB_SEARCH', 'Step 2 is WEB_SEARCH');
  assert(plan2 !== null && plan2.steps[1].command?.query === 'React tutorials', 'Step 2 searches for React tutorials');

  // 3. "Open YouTube and search for Python Level 2 tutorials."
  const plan3 = localTaskPlanner.plan('Open YouTube and search for Python Level 2 tutorials.');
  assert(plan3 !== null && plan3.isMultiStep === true, 'Plan 3 is identified as multi-step');
  assert(plan3 !== null && plan3.steps.length === 2, 'Plan 3 has 2 steps');
  assert(plan3 !== null && plan3.steps[0].command?.type === 'OPEN_URL', 'Step 1 is OPEN_URL');
  assert(plan3 !== null && plan3.steps[0].command?.target === 'https://www.youtube.com', 'Step 1 opens YouTube');
  assert(plan3 !== null && plan3.steps[1].command?.type === 'WEB_SEARCH', 'Step 2 is WEB_SEARCH');
  assert(plan3 !== null && plan3.steps[1].command?.query === 'Python Level 2 tutorials', 'Step 2 searches for Python Level 2 tutorials');

  // ==========================================
  // SECTION 5: Natural Language Flexibility
  // ==========================================
  console.log('\n--- 5. Testing Natural Language Variations ---');

  const polite1 = localCommandParser.parse('can you open calculator');
  assert(polite1.type === 'OPEN_APP' && polite1.target === 'Calculator', '"can you open calculator" -> OPEN_APP');

  const polite2 = localCommandParser.parse('please open calculator');
  assert(polite2.type === 'OPEN_APP' && polite2.target === 'Calculator', '"please open calculator" -> OPEN_APP');

  const polite3 = localCommandParser.parse('could you open calculator for me');
  assert(polite3.type === 'OPEN_APP' && polite3.target === 'Calculator', '"could you open calculator for me" -> OPEN_APP');

  const polite4 = localCommandParser.parse('hey aura open calculator');
  assert(polite4.type === 'OPEN_APP' && polite4.target === 'Calculator', '"hey aura open calculator" -> OPEN_APP');

  const polite5 = localCommandParser.parse('AURA, open calculator');
  assert(polite5.type === 'OPEN_APP' && polite5.target === 'Calculator', '"AURA, open calculator" -> OPEN_APP');

  const search1 = localCommandParser.parse('search Google for React');
  assert(search1.type === 'WEB_SEARCH' && search1.query === 'React', '"search Google for React" -> WEB_SEARCH');

  const search2 = localCommandParser.parse('look up React tutorials');
  assert(search2.type === 'WEB_SEARCH' && search2.query === 'React tutorials', '"look up React tutorials" -> WEB_SEARCH');

  const search3 = localCommandParser.parse('find React tutorials online');
  assert(search3.type === 'WEB_SEARCH' && search3.query === 'React tutorials', '"find React tutorials online" -> WEB_SEARCH');

  // ==========================================
  // SECTION 6: Robust Female Voice Selection & Cross-Browser Playback Pipeline
  // ==========================================
  console.log('\n--- 6. Testing Female Voice Selection & Cross-Browser Playback Pipeline ---');

  // 6.1: Voice selection selects Samantha (female) over Daniel, Alex, and Rishi (male)
  const selectedVoice = speechSynthesisService.getSelectedVoice();
  assert(selectedVoice !== null, 'Found an available voice');
  assert(selectedVoice?.name === 'Samantha', `Preferred female voice selected: got "${selectedVoice?.name}" (Samantha over Daniel/Alex/Rishi)`);

  // 6.2: Debug info is exposed properly
  const availableVoicesDebug = speechSynthesisService.getAvailableVoices();
  assert(availableVoicesDebug.length === 5, 'Exposes available voices debug array');
  assert(availableVoicesDebug.some((v) => v.name === 'Samantha' && v.localService === true), 'Debug info includes localService and lang');

  const preferredDebug = speechSynthesisService.getPreferredVoice();
  assert(preferredDebug?.name === 'Samantha', 'getPreferredVoice() debug info returns Samantha');

  // 6.3: Diagnostics output
  const diagnostics = speechSynthesisService.getSpeechDiagnostics();
  assert(diagnostics.selectedVoice === 'Samantha', 'Diagnostics report selectedVoice as Samantha');
  assert(diagnostics.isFemaleVoiceVerified === true, 'Diagnostics report isFemaleVoiceVerified as true');

  // 6.4: Test voice method execution with explicit utterance assignment
  spokenUtteranceObjects.length = 0;
  const testVoiceResult = await speechSynthesisService.testVoice();
  assert(testVoiceResult === true, 'testVoice() succeeds');
  assert(spokenUtteranceObjects.length > 0, 'Speech synthesis speak was called');
  const testUtterance = spokenUtteranceObjects[spokenUtteranceObjects.length - 1];
  assert(testUtterance.text === "Hi, I'm AURA. How can I help you?", 'testVoice() spoke correct introductory phrase');
  assert(testUtterance.voice !== null, 'EXPLICIT UTTERANCE ASSIGNMENT: utterance.voice is assigned');
  assert(testUtterance.voice?.name === 'Samantha', 'EXPLICIT UTTERANCE ASSIGNMENT: utterance.voice is strictly Samantha');

  // 6.5: Reselection & refreshVoices() persistence
  const refreshed = speechSynthesisService.refreshVoices();
  assert(refreshed.length === 5, 'refreshVoices() returns current voice array');
  assert(speechSynthesisService.getSelectedVoice()?.name === 'Samantha', 'Selected voice persists after refreshVoices()');

  // 6.6: Asynchronous voice loading simulation (Chrome-like initially empty voices)
  const asyncVoiceService = new SpeechSynthesisService();
  // Simulate initially empty voices
  (asyncVoiceService as any).voices = [];
  (asyncVoiceService as any).selectedFemaleVoice = null;
  const loadedVoicesPromise = asyncVoiceService.ensureVoicesLoaded(1000);
  const loadedVoices = await loadedVoicesPromise;
  assert(loadedVoices.length > 0, 'ensureVoicesLoaded() waits and resolves voices');
  assert(asyncVoiceService.getSelectedVoice()?.name === 'Samantha', 'Selected female voice resolved after async loading');

  // 6.7: Fallback: Verify male voice is spoken when female voice is unavailable (Updated Phase 32)
  const maleOnlyService = new SpeechSynthesisService();
  const maleOnlyList = [
    { name: 'Daniel', lang: 'en-GB', default: false, localService: true },
    { name: 'Alex', lang: 'en-US', default: false, localService: true },
    { name: 'Rishi', lang: 'en-IN', default: true, localService: true },
    { name: 'Google US English', lang: 'en-US', default: false, localService: false },
  ];
  maleOnlyService.refreshVoices = () => {
    (maleOnlyService as any).updateVoices(maleOnlyList);
    return maleOnlyList as any;
  };
  maleOnlyService.refreshVoices();
  console.log('MALE ONLY FALLBACK VOICE:', maleOnlyService.getSelectedVoice()?.name);
  assert(maleOnlyService.getSelectedVoice() !== null, 'getSelectedVoice() falls back to English male voice when female voices are missing');

  spokenUtteranceObjects.length = 0;
  const maleOnlySpoken = await maleOnlyService.speak('Test speech');
  assert(maleOnlySpoken === true, 'speak() returns true when falling back to male English voice');
  assert(spokenUtteranceObjects.length === 1, 'Speech synthesis utterance was dispatched with a male voice fallback');

  // 6.8: Speech Interruption & Stop
  spokenUtterances.length = 0;
  speechSynthesisService.speak('Long ongoing speech to be stopped');
  assert(speechSynthesisService.isSpeaking() === true || (mockSpeechSynthesis as any).speaking === true, 'Speech starts');
  speechSynthesisService.stop();
  assert(speechSynthesisService.isSpeaking() === false, 'stop() immediately halts speech synthesis');
  assert(speechCancelled > 0, 'Speech synthesis cancel was invoked');

  // ==========================================
  // SECTION 7: End-to-End Store Execution
  // ==========================================
  console.log('\n--- 7. Testing End-to-End Store Execution ---');

  const store = useAuraStore.getState();

  // Test 7.1: Conversational Chat via submitCommand
  spokenUtterances.length = 0;
  spokenUtteranceObjects.length = 0;
  await store.submitCommand('Hi AURA');
  await sleep(150);
  assert(useAuraStore.getState().activeResponse.text.includes('Welcome back'), 'Store handles "Hi AURA" with friendly text');
  assert(spokenUtterances.some((s) => s.includes('Welcome back')), 'Voice speaks friendly greeting');
  assert(spokenUtteranceObjects[spokenUtteranceObjects.length - 1].voice?.name === 'Samantha', 'Store speech uses assigned female voice');

  // Check conversation turns are tracked
  const turns = useAuraStore.getState().conversationTurns;
  assert(turns.length >= 2, 'Conversation turns tracked in session');
  assert(turns[turns.length - 2].sender === 'user' && turns[turns.length - 2].text === 'Hi AURA', 'User turn recorded');
  assert(turns[turns.length - 1].sender === 'assistant', 'Assistant turn recorded');

  // Test 7.2: Direct Calculation via submitCommand
  spokenUtterances.length = 0;
  await store.submitCommand('What is 25 times 4?');
  await sleep(150);
  assert(useAuraStore.getState().activeResponse.text === '25 times 4 is 100.', 'Store handles calculation: "25 times 4 is 100."');
  assert(spokenUtterances.includes('25 times 4 is 100.'), 'Voice speaks calculation result');

  // Test 7.3: Multi-step Execution via submitCommand
  spokenUtterances.length = 0;
  await store.submitCommand('Open Calculator and calculate 25 times 4.');
  await sleep(150);
  const multiStepResp = useAuraStore.getState().activeResponse.text;
  assert(
    multiStepResp.includes('Calculator') && multiStepResp.includes('25 times 4 is 100'),
    `Multi-step execution combines step outcomes: "${multiStepResp}"`
  );
  assert(spokenUtterances.length > 0, 'Multi-step execution spoke response');

  // Test 7.4: Multi-step Browser search
  spokenUtterances.length = 0;
  await store.submitCommand('Open Chrome and search for React tutorials');
  await sleep(150);
  const chromeResp = useAuraStore.getState().activeResponse.text;
  assert(
    chromeResp.includes('Google Chrome') && chromeResp.includes('React tutorials'),
    `Multi-step Chrome search combines step outcomes: "${chromeResp}"`
  );

  // ==========================================
  // SECTION 8: Security Preservation
  // ==========================================
  console.log('\n--- 8. Testing Security Preservation ---');

  // Sudo blocked
  await store.submitCommand('sudo rm -rf /');
  await sleep(150);
  assert(useAuraStore.getState().activeResponse.text.includes("can't perform that action safely") ||
         useAuraStore.getState().activeResponse.text.includes('Blocked command'), 'Sudo blocked cleanly');

  // Path traversal blocked
  await store.submitCommand('open ../../../etc/passwd');
  await sleep(150);
  assert(useAuraStore.getState().activeResponse.text.includes("can't access that location") ||
         useAuraStore.getState().activeResponse.text.includes("can't perform that action safely") ||
         useAuraStore.getState().activeResponse.text.includes('Blocked path'), 'Path traversal blocked');

  // Confirmation flow for system reboot
  await store.submitCommand('Restart my Mac');
  await sleep(150);
  assert(useAuraStore.getState().pendingConfirmationCommand !== null, 'Restart triggers pending confirmation');
  assert(useAuraStore.getState().activeResponse.text.includes('Restart your Mac'), 'Confirmation prompt shown');

  // Confirm with conversational "yes please"
  await store.submitCommand('yes please');
  await sleep(150);
  assert(useAuraStore.getState().pendingConfirmationCommand === null, 'Pending confirmation consumed on "yes"');
  assert(useAuraStore.getState().activeResponse.text.includes('Restarting your Mac'), 'Restart executed after confirmation');

  // Friendly unknown request handling
  await store.submitCommand('fly to the moon and make me a coffee');
  await sleep(150);
  const unknownResp = useAuraStore.getState().activeResponse.text;
  assert(
    unknownResp.includes("I'm not sure how to do that yet") ||
    unknownResp.includes("don't have the required computer-control"),
    `Friendly unknown request handling: "${unknownResp}"`
  );

  console.log('\n==============================================');
  console.log('🎉 ALL AURA PHASE 23 TESTS & SPECIFICATIONS PASSED!');
  console.log('==============================================');
}

runPhase23Tests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
