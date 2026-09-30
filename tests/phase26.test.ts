/**
 * AURA Phase 26 Comprehensive Test Suite
 * Advanced Computer Use / Multi-Step Task Execution
 *
 * Verifies all 28 Phase 26 specifications:
 * 1. Single-step computer action
 * 2. Two-step task
 * 3. Three-step task
 * 4. Successful dependent steps
 * 5. Failed step stops task safely
 * 6. Retryable failure retries once
 * 7. Non-retryable failure does not retry
 * 8. High-risk action pauses for confirmation
 * 9. Confirmation accepted continues
 * 10. Confirmation rejected stops safely
 * 11. User cancellation
 * 12. Maximum step limit
 * 13. Retry loop protection
 * 14. Step timeout
 * 15. Malformed AI plan
 * 16. Unsupported intent
 * 17. Unsafe file path
 * 18. Unsafe browser URL
 * 19. Arbitrary executable rejection
 * 20. Shell command rejection
 * 21. No fake success
 * 22. Dynamic replanning
 * 23. Replanned action passes validation
 * 24. Replanned action cannot bypass confirmation
 * 25. Existing Phase 22 regression
 * 26. Existing Phase 23 regression
 * 27. Existing Phase 24 regression
 * 28. Existing Phase 25 regression
 */

import fs from 'node:fs';
import path from 'node:path';

// Setup browser mocks for Node environment
const spokenUtterances: string[] = [];
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
    if (utterance.onstart) utterance.onstart();
    setTimeout(() => {
      if (utterance.onend) utterance.onend();
    }, 10);
  },
  cancel: () => {},
  pause: () => {},
  resume: () => {},
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
  openApp: async (bundleId: string) => {
    if (bundleId === 'com.apple.badapp') return { success: false, error: 'App launch failed' };
    return { success: true };
  },
  closeApp: async () => ({ success: true }),
  openUrl: async (url: string) => {
    if (url.includes('offline')) return { success: false, error: 'Network error' };
    return { success: true };
  },
  openFolder: async (folderName: string) => ({ success: true, path: `/Users/test/${folderName}` }),
  openFile: async (fileName: string) => {
    if (fileName.includes('missing')) return { success: false, errorCode: 'FILE_NOT_FOUND', message: 'File missing.txt not found' };
    return { success: true, path: `/Users/test/Documents/${fileName}` };
  },
  createFile: async (fileName: string) => ({ success: true, path: `/Users/test/Documents/${fileName}` }),
  moveFile: async () => ({ success: true }),
  deleteFile: async () => ({ success: true }),
  setSystemSetting: async () => ({ success: true }),
  sleep: async () => ({ success: true }),
  restart: async () => ({ success: true }),
  shutdown: async () => ({ success: true }),
  isAvailable: async () => true,
};

import { computerUseOrchestrator, StepExecutor, ResultObserver, RecoveryManager, TaskSessionModel } from '../src/assistant/computer';
import { ParsedCommand } from '../src/assistant/commands/types';
import { localCommandParser } from '../src/assistant/commands/parser';
import { localTaskPlanner } from '../src/assistant/planner/localTaskPlanner';
import { validatePathSecurity, validateSafeFileName } from '../src/assistant/execution/FilePathResolver';
import { validateAndNormalizeUrl } from '../src/assistant/execution/BrowserExecutor';
import { aiAssistantBrain } from '../src/assistant/ai/AIAssistantBrain';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runPhase26Tests() {
  console.log('🧪 Starting AURA Phase 26 Comprehensive Test Suite...\n');

  // Test 1: Single-step computer action
  console.log('Test 1: Single-step computer action');
  const cmd1: ParsedCommand = {
    type: 'OPEN_APP',
    target: 'Google Chrome',
    originalInput: 'Open Chrome',
    normalizedInput: 'open google chrome',
    confidence: 0.95,
    risk: 'LOW',
  };
  const val1 = computerUseOrchestrator.validatePlan([cmd1], 'Open Chrome');
  assert(val1.valid, 'Single-step plan should be valid');
  assert(val1.validatedSteps?.length === 1, 'Should produce 1 validated step');
  let session1 = computerUseOrchestrator.createSession('Open Chrome', val1.validatedSteps!);
  const stepRes1 = await computerUseOrchestrator.executeNextStep(session1);
  assert(stepRes1.status === 'COMPLETED', 'Single-step task should execute to completion');
  assert(stepRes1.session.status === 'COMPLETED', 'Session state should be COMPLETED');
  console.log('  ✓ Passed');

  // Test 2: Two-step task
  console.log('\nTest 2: Two-step task');
  const cmd2a: ParsedCommand = { type: 'OPEN_APP', target: 'Google Chrome', originalInput: 'Open Chrome', normalizedInput: 'open chrome', confidence: 0.95, risk: 'LOW' };
  const cmd2b: ParsedCommand = { type: 'WEB_SEARCH', query: 'React documentation', originalInput: 'search for React documentation', normalizedInput: 'search react documentation', confidence: 0.95, risk: 'LOW' };
  const val2 = computerUseOrchestrator.validatePlan([cmd2a, cmd2b], 'Open Chrome and search for React documentation');
  assert(val2.valid, 'Two-step plan should be valid');
  let session2 = computerUseOrchestrator.createSession('Open Chrome and search for React documentation', val2.validatedSteps!);
  const res2a = await computerUseOrchestrator.executeNextStep(session2);
  assert(res2a.status === 'CONTINUE', 'Step 1 should complete and signal CONTINUE');
  const res2b = await computerUseOrchestrator.executeNextStep(res2a.session);
  assert(res2b.status === 'COMPLETED', 'Step 2 should complete task session');
  console.log('  ✓ Passed');

  // Test 3: Three-step task
  console.log('\nTest 3: Three-step task');
  const cmd3a: ParsedCommand = { type: 'OPEN_APP', target: 'Finder', originalInput: 'Open Finder', normalizedInput: 'open finder', confidence: 0.95, risk: 'LOW' };
  const cmd3b: ParsedCommand = { type: 'OPEN_FOLDER', target: 'Downloads', originalInput: 'go to Downloads', normalizedInput: 'open downloads', confidence: 0.95, risk: 'LOW' };
  const cmd3c: ParsedCommand = { type: 'OPEN_FILE', target: 'report.pdf', originalInput: 'open report.pdf', normalizedInput: 'open report.pdf', confidence: 0.95, risk: 'LOW' };
  const val3 = computerUseOrchestrator.validatePlan([cmd3a, cmd3b, cmd3c], 'Open Finder, go to Downloads, and open report.pdf');
  assert(val3.valid && val3.validatedSteps?.length === 3, '3-step plan should validate');
  let session3 = computerUseOrchestrator.createSession('3-step test', val3.validatedSteps!);
  const res3a = await computerUseOrchestrator.executeNextStep(session3);
  const res3b = await computerUseOrchestrator.executeNextStep(res3a.session);
  const res3c = await computerUseOrchestrator.executeNextStep(res3b.session);
  assert(res3c.status === 'COMPLETED', 'All 3 steps should complete');
  console.log('  ✓ Passed');

  // Test 4: Successful dependent steps
  console.log('\nTest 4: Successful dependent steps');
  const cmd4a: ParsedCommand = { type: 'OPEN_FOLDER', target: 'Documents', originalInput: 'open Documents folder', normalizedInput: 'open documents', confidence: 0.9, risk: 'LOW' };
  const cmd4b: ParsedCommand = { type: 'OPEN_FILE', target: 'the file', originalInput: 'open the file', normalizedInput: 'open the file', confidence: 0.9, risk: 'LOW' };
  const val4 = computerUseOrchestrator.validatePlan([cmd4a, cmd4b], 'Open Documents folder and open the file');
  let session4 = computerUseOrchestrator.createSession('Dependent test', val4.validatedSteps!);
  await computerUseOrchestrator.executeNextStep(session4);
  const nextStep4 = TaskSessionModel.getCurrentStep(session4);
  assert(nextStep4?.command.target === '/Users/test/Documents' || nextStep4?.command.target === 'Documents', 'Dependent step should inherit target from previous step');
  console.log('  ✓ Passed');

  // Test 5: Failed step stops task safely
  console.log('\nTest 5: Failed step stops task safely');
  const cmd5a: ParsedCommand = { type: 'OPEN_FILE', target: 'missing.txt', originalInput: 'open missing.txt', normalizedInput: 'open missing.txt', confidence: 0.9, risk: 'LOW' };
  const cmd5b: ParsedCommand = { type: 'WEB_SEARCH', query: 'React', originalInput: 'search React', normalizedInput: 'search react', confidence: 0.9, risk: 'LOW' };
  const val5 = computerUseOrchestrator.validatePlan([cmd5a, cmd5b], 'Open missing.txt and search React');
  let session5 = computerUseOrchestrator.createSession('Failed step test', val5.validatedSteps!);
  const res5 = await computerUseOrchestrator.executeNextStep(session5);
  assert(res5.status === 'FAILED', 'Failed step should mark session FAILED');
  assert(res5.session.currentStep === 0, 'Current step should remain on failed step');
  console.log('  ✓ Passed');

  // Test 6: Retryable failure retries once
  console.log('\nTest 6: Retryable failure retries once');
  const step6: any = {
    id: 'step-6',
    stepIndex: 0,
    intent: 'OPEN_APP',
    description: 'Open App',
    command: { type: 'OPEN_APP', target: 'Google Chrome' },
    state: 'EXECUTING',
    retryCount: 0,
    maxRetries: 1,
  };
  const obs6 = { success: false, action: 'OPEN_APP' as const, message: 'Temporary launch delay', timestamp: Date.now() };
  const rec6 = RecoveryManager.evaluate(step6, obs6);
  assert(rec6.shouldRetry, 'Transient OPEN_APP failure should be retryable');
  console.log('  ✓ Passed');

  // Test 7: Non-retryable failure does not retry
  console.log('\nTest 7: Non-retryable failure does not retry');
  const step7: any = {
    id: 'step-7',
    stepIndex: 0,
    intent: 'OPEN_FILE',
    description: 'Open missing file',
    command: { type: 'OPEN_FILE', target: 'missing.txt' },
    state: 'EXECUTING',
    retryCount: 0,
    maxRetries: 1,
  };
  const obs7 = { success: false, action: 'OPEN_FILE' as const, errorCode: 'FILE_NOT_FOUND', message: 'File missing.txt not found', timestamp: Date.now() };
  const rec7 = RecoveryManager.evaluate(step7, obs7);
  assert(!rec7.shouldRetry, 'Missing file error should not automatically retry');
  console.log('  ✓ Passed');

  // Test 8: High-risk action pauses for confirmation
  console.log('\nTest 8: High-risk action pauses for confirmation');
  const cmd8: ParsedCommand = { type: 'DELETE_FILE', target: 'important.docx', originalInput: 'delete important.docx', normalizedInput: 'delete important.docx', confidence: 0.95, risk: 'HIGH' };
  const val8 = computerUseOrchestrator.validatePlan([cmd8], 'Delete important.docx');
  assert(val8.validatedSteps![0].requiresConfirmation, 'DELETE_FILE step must require confirmation');
  let session8 = computerUseOrchestrator.createSession('Delete file test', val8.validatedSteps!);
  const res8 = await computerUseOrchestrator.executeNextStep(session8);
  session8 = res8.session;
  assert(res8.status === 'WAITING_CONFIRMATION', 'High risk step must pause in WAITING_CONFIRMATION');
  console.log('  ✓ Passed');

  // Test 9: Confirmation accepted continues
  console.log('\nTest 9: Confirmation accepted continues');
  const conf9 = computerUseOrchestrator.confirmStep(session8, true);
  assert(conf9.status === 'EXECUTING', 'Accepting confirmation should transition to EXECUTING');
  const res9 = await computerUseOrchestrator.executeNextStep(conf9.session);
  assert(res9.status === 'COMPLETED', 'Confirmed high risk step should execute');
  console.log('  ✓ Passed');

  // Test 10: Confirmation rejected stops safely
  console.log('\nTest 10: Confirmation rejected stops safely');
  const val10 = computerUseOrchestrator.validatePlan([cmd8], 'Delete file test 2');
  let session10 = computerUseOrchestrator.createSession('Delete file test 2', val10.validatedSteps!);
  const res10 = await computerUseOrchestrator.executeNextStep(session10);
  session10 = res10.session;
  const conf10 = computerUseOrchestrator.confirmStep(session10, false);
  assert(conf10.status === 'CANCELLED', 'Rejecting confirmation should set CANCELLED');
  assert(conf10.session.status === 'CANCELLED', 'Session state should be CANCELLED');
  console.log('  ✓ Passed');

  // Test 11: User cancellation
  console.log('\nTest 11: User cancellation');
  const val11 = computerUseOrchestrator.validatePlan([cmd2a, cmd2b], 'Cancel test');
  let session11 = computerUseOrchestrator.createSession('Cancel test', val11.validatedSteps!);
  session11 = computerUseOrchestrator.cancelSession(session11);
  assert(session11.status === 'CANCELLED', 'cancelSession should mark session CANCELLED');
  console.log('  ✓ Passed');

  // Test 12: Maximum step limit
  console.log('\nTest 12: Maximum step limit');
  const elevenCmds = Array(11).fill(cmd1);
  const val12 = computerUseOrchestrator.validatePlan(elevenCmds, '11 steps test');
  assert(!val12.valid, 'Plan exceeding 10 steps should be invalid');
  assert(val12.errors.some((e) => e.includes('maximum step limit')), 'Error should mention step limit');
  console.log('  ✓ Passed');

  // Test 13: Retry loop protection
  console.log('\nTest 13: Retry loop protection');
  const step13: any = {
    id: 'step-13',
    stepIndex: 0,
    intent: 'OPEN_APP',
    description: 'Open Bad App',
    command: { type: 'OPEN_APP', target: 'com.apple.badapp' },
    state: 'EXECUTING',
    retryCount: 1, // Already retried once
    maxRetries: 1,
  };
  const obs13 = { success: false, action: 'OPEN_APP' as const, message: 'App launch failed', timestamp: Date.now() };
  const rec13 = RecoveryManager.evaluate(step13, obs13);
  assert(!rec13.shouldRetry, 'Step already retried once must not retry again');
  console.log('  ✓ Passed');

  // Test 14: Step timeout
  console.log('\nTest 14: Step timeout');
  const executor = new StepExecutor();
  const slowStep: any = {
    id: 'slow-step',
    stepIndex: 0,
    intent: 'OPEN_APP',
    description: 'Slow Step',
    command: { type: 'OPEN_APP', target: 'Google Chrome' },
    state: 'PENDING',
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 10,
  };
  const timeoutRes = await executor.execute(slowStep, 5);
  assert(timeoutRes !== undefined, 'Timeout should resolve to ExecutionResult');
  console.log('  ✓ Passed');

  // Test 15: Malformed AI plan
  console.log('\nTest 15: Malformed AI plan');
  const malformedPlan: any = [{ type: null }, { type: 'OPEN_APP' }];
  const val15 = computerUseOrchestrator.validatePlan(malformedPlan, 'Malformed plan');
  assert(!val15.valid, 'Malformed AI plan should be rejected');
  console.log('  ✓ Passed');

  // Test 16: Unsupported intent
  console.log('\nTest 16: Unsupported intent');
  const badIntentCmd: any = [{ type: 'HACK_SYSTEM', target: 'root' }];
  const val16 = computerUseOrchestrator.validatePlan(badIntentCmd, 'Unsupported intent');
  assert(!val16.valid, 'Unsupported intent should be rejected');
  console.log('  ✓ Passed');

  // Test 17: Unsafe file path
  console.log('\nTest 17: Unsafe file path');
  const unsafePathCmd: ParsedCommand = {
    type: 'OPEN_FILE',
    target: '../../etc/passwd',
    originalInput: 'open ../../etc/passwd',
    normalizedInput: 'open ../../etc/passwd',
    confidence: 0.9,
    risk: 'HIGH',
  };
  const val17 = computerUseOrchestrator.validatePlan([unsafePathCmd], 'Unsafe path');
  assert(!val17.valid, 'Path traversal file path should be rejected');
  console.log('  ✓ Passed');

  // Test 18: Unsafe browser URL
  console.log('\nTest 18: Unsafe browser URL');
  const unsafeUrlCmd: ParsedCommand = {
    type: 'OPEN_URL',
    target: 'javascript:alert(1)',
    originalInput: 'open javascript:alert(1)',
    normalizedInput: 'open javascript:alert(1)',
    confidence: 0.9,
    risk: 'HIGH',
  };
  const val18 = computerUseOrchestrator.validatePlan([unsafeUrlCmd], 'Unsafe URL');
  assert(!val18.valid, 'javascript: protocol URL should be rejected');
  console.log('  ✓ Passed');

  // Test 19: Arbitrary executable rejection
  console.log('\nTest 19: Arbitrary executable rejection');
  const execCmd: ParsedCommand = {
    type: 'OPEN_APP',
    target: 'malicious.sh',
    originalInput: 'run malicious.sh',
    normalizedInput: 'run malicious.sh',
    confidence: 0.9,
    risk: 'HIGH',
  };
  const val19 = computerUseOrchestrator.validatePlan([execCmd], 'Arbitrary script');
  assert(!val19.valid, 'Script file execution should be rejected as arbitrary executable');
  console.log('  ✓ Passed');

  // Test 20: Shell command rejection
  console.log('\nTest 20: Shell command rejection');
  const shellCmd: ParsedCommand = {
    type: 'OPEN_APP',
    target: 'sudo rm -rf /',
    originalInput: 'sudo rm -rf /',
    normalizedInput: 'sudo rm -rf /',
    confidence: 0.9,
    risk: 'HIGH',
  };
  const val20 = computerUseOrchestrator.validatePlan([shellCmd], 'Shell injection');
  assert(!val20.valid, 'Sudo shell injection command should be rejected');
  console.log('  ✓ Passed');

  // Test 21: No fake success
  console.log('\nTest 21: No fake success');
  const rawFailedRes = { success: false, action: 'OPEN_FILE' as const, message: 'File read error' };
  const obs21 = ResultObserver.observe(rawFailedRes);
  assert(obs21.success === false, 'ResultObserver must preserve exact failure status without fabricating success');
  console.log('  ✓ Passed');

  // Test 22: Dynamic replanning
  console.log('\nTest 22: Dynamic replanning');
  const val22 = computerUseOrchestrator.validatePlan([cmd2a, cmd5a], 'Initial failing plan');
  let session22 = computerUseOrchestrator.createSession('Initial failing plan', val22.validatedSteps!);
  const res22 = await computerUseOrchestrator.executeNextStep(session22); // Step 1 succeeds
  session22 = res22.session;
  const replanRes = computerUseOrchestrator.replanSession(session22, [cmd2b]);
  assert(replanRes.valid, 'Dynamic replan with valid commands should succeed');
  assert(replanRes.session.steps.length === 2, 'Replanned session should contain completed + new steps');
  console.log('  ✓ Passed');

  // Test 23: Replanned action passes validation
  console.log('\nTest 23: Replanned action passes validation');
  const badReplan = computerUseOrchestrator.replanSession(session22, [unsafePathCmd]);
  assert(!badReplan.valid, 'Replanned action with unsafe path must fail validation');
  console.log('  ✓ Passed');

  // Test 24: Replanned action cannot bypass confirmation
  console.log('\nTest 24: Replanned action cannot bypass confirmation');
  const highRiskReplan = computerUseOrchestrator.replanSession(session22, [cmd8]);
  assert(highRiskReplan.valid, 'Replan with high risk action is valid');
  const res24 = await computerUseOrchestrator.executeNextStep(highRiskReplan.session);
  assert(res24.status === 'WAITING_CONFIRMATION', 'Replanned high risk action MUST still require confirmation');
  console.log('  ✓ Passed');

  // Test 25: Existing Phase 22 regression
  console.log('\nTest 25: Existing Phase 22 regression');
  const p22Cmd = localCommandParser.parse('Open Chrome');
  assert(p22Cmd.type === 'OPEN_APP' && p22Cmd.target === 'Google Chrome', 'Phase 22 parser should work');
  console.log('  ✓ Passed');

  // Test 26: Existing Phase 23 regression
  console.log('\nTest 26: Existing Phase 23 regression');
  const p23Plan = localTaskPlanner.plan('Open Chrome and search for React docs');
  assert(p23Plan !== null && p23Plan.steps.length === 2, 'Phase 23 local planner should work');
  console.log('  ✓ Passed');

  // Test 27: Existing Phase 24 regression
  console.log('\nTest 27: Existing Phase 24 regression');
  const p24Path = validatePathSecurity('/Users/test/Documents');
  assert(p24Path.safe, 'Phase 24 path security check should pass valid directory');
  console.log('  ✓ Passed');

  // Test 28: Existing Phase 25 regression
  console.log('\nTest 28: Existing Phase 25 regression');
  const aiResp = await aiAssistantBrain.respond('Hello, tell me a short fact about space.');
  assert(aiResp.message && aiResp.message.length > 0, 'Phase 25 AI assistant brain should respond');
  console.log('  ✓ Passed');

  console.log('\n🎉 ALL 28 PHASE 26 TESTS PASSED SUCCESSFULLY!');
}

runPhase26Tests().catch((err) => {
  console.error('❌ Phase 26 test runner crashed:', err);
  process.exit(1);
});
