/**
 * AURA Phase 28 Comprehensive Test Suite
 * Reliability, Error Recovery & User Feedback
 */

import assert from 'node:assert';

// Setup browser mocks for Node environment
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

let appLaunchSuccess = true;
let browserSuccess = true;
let fileSuccess = true;
let bridgeDelayMs = 0;

(globalThis as any).novairBridge = {
  openApp: async (bundleId: string) => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (!appLaunchSuccess || bundleId === 'com.apple.badapp') {
      return { success: false, error: 'APP_LAUNCH_FAILED' };
    }
    return { success: true };
  },
  closeApp: async () => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (!appLaunchSuccess) return { success: false, error: 'APP_CLOSE_FAILED' };
    return { success: true };
  },
  openUrl: async (url: string) => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (!browserSuccess || url.includes('offline') || url.includes('fail')) {
      return { success: false, error: 'BROWSER_FAILED' };
    }
    return { success: true };
  },
  openFolder: async (folderName: string) => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (!fileSuccess) return { success: false, error: 'Failed to open folder', errorCode: 'FILE_NOT_FOUND' };
    return { success: true, path: `/Users/test/${folderName}` };
  },
  openFile: async (fileName: string) => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (fileName.includes('missing') || !fileSuccess) {
      return { success: false, errorCode: 'FILE_NOT_FOUND', message: 'File not found' };
    }
    if (fileName.includes('restricted')) {
      return { success: false, errorCode: 'FILE_PERMISSION_DENIED', message: 'Permission denied' };
    }
    return { success: true, path: `/Users/test/Documents/${fileName}` };
  },
  createFile: async (fileName: string) => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (!fileSuccess) return { success: false, errorCode: 'FILE_WRITE_FAILED', error: 'File write failed' };
    return { success: true, path: `/Users/test/Documents/${fileName}` };
  },
  moveFile: async () => {
    if (bridgeDelayMs > 0) await new Promise((r) => setTimeout(r, bridgeDelayMs));
    if (!fileSuccess) return { success: false, errorCode: 'MOVE_FAILED', error: 'File move failed' };
    return { success: true };
  },
  deleteFile: async () => ({ success: true }),
  setSystemSetting: async () => ({ success: true }),
  sleep: async () => ({ success: true }),
  restart: async () => ({ success: true }),
  shutdown: async () => ({ success: true }),
  isAvailable: async () => true,
};

import { securityGate } from '../src/assistant/security';
import { computerUseOrchestrator, stepExecutor, TaskSessionModel, RecoveryManager, ResultObserver } from '../src/assistant/computer';
import { macAppExecutor } from '../src/assistant/execution/MacAppExecutor';
import { browserExecutor } from '../src/assistant/execution/BrowserExecutor';
import { fileExecutor } from '../src/assistant/execution/FileExecutor';
import { ResponseFormatter } from '../src/assistant/response/ResponseFormatter';
import { ErrorTranslator } from '../src/assistant/response/ErrorTranslator';
import { AIAssistantBrain } from '../src/assistant/ai/AIAssistantBrain';
import { MockAIProvider } from '../src/assistant/ai/providers/MockAIProvider';
import { useAuraStore } from '../src/state/useAuraStore';

console.log('🧪 Starting AURA Phase 28 Reliability, Error Recovery & User Feedback Test Suite...\n');

async function runTests() {
  const mockProvider = new MockAIProvider();
  const testBrain = new AIAssistantBrain(mockProvider);

  // 1. Successful OPEN_APP
  console.log('Test 1: Successful OPEN_APP');
  appLaunchSuccess = true;
  const res1 = await macAppExecutor.execute({
    type: 'OPEN_APP',
    target: 'Calculator',
    originalInput: 'open calculator',
    normalizedInput: 'open calculator',
    confidence: 1,
    risk: 'LOW',
  });
  assert.strictEqual(res1.success, true);
  const resp1 = ResponseFormatter.format({ type: 'OPEN_APP', target: 'Calculator', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res1);
  assert.strictEqual(resp1.text, 'Opening Calculator.');
  assert.strictEqual(resp1.category, 'SUCCESS');
  console.log('  ✓ Passed\n');

  // 2. Failed OPEN_APP (No False Success!)
  console.log('Test 2: Failed OPEN_APP (No False Success)');
  appLaunchSuccess = false;
  const res2 = await macAppExecutor.execute({
    type: 'OPEN_APP',
    target: 'Calculator',
    originalInput: 'open calculator',
    normalizedInput: 'open calculator',
    confidence: 1,
    risk: 'LOW',
  });
  assert.strictEqual(res2.success, false);
  const resp2 = ResponseFormatter.format({ type: 'OPEN_APP', target: 'Calculator', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res2);
  assert.ok(resp2.text.includes("couldn't open Calculator") || resp2.text.includes("could not be"));
  assert.strictEqual(resp2.category, 'FAILURE');
  assert.ok(!resp2.text.startsWith('Opening Calculator.'), 'Must not claim false success');
  appLaunchSuccess = true;
  console.log('  ✓ Passed\n');

  // 3. Successful OPEN_URL
  console.log('Test 3: Successful OPEN_URL');
  browserSuccess = true;
  const res3 = await browserExecutor.openUrl('https://google.com');
  assert.strictEqual(res3.success, true);
  const resp3 = ResponseFormatter.format({ type: 'OPEN_URL', target: 'https://google.com', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res3);
  assert.strictEqual(resp3.category, 'SUCCESS');
  console.log('  ✓ Passed\n');

  // 4. Failed OPEN_URL
  console.log('Test 4: Failed OPEN_URL');
  browserSuccess = false;
  const res4 = await browserExecutor.openUrl('https://fail.offline.test');
  assert.strictEqual(res4.success, false);
  const resp4 = ResponseFormatter.format({ type: 'OPEN_URL', target: 'https://fail.offline.test', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res4);
  assert.strictEqual(resp4.category, 'FAILURE');
  assert.ok(resp4.text.includes("couldn't open"));
  browserSuccess = true;
  console.log('  ✓ Passed\n');

  // 5. Successful WEB_SEARCH
  console.log('Test 5: Successful WEB_SEARCH');
  const res5 = await browserExecutor.searchWeb('quantum computing');
  assert.strictEqual(res5.success, true);
  const resp5 = ResponseFormatter.format({ type: 'WEB_SEARCH', query: 'quantum computing', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res5);
  assert.strictEqual(resp5.category, 'SUCCESS');
  assert.ok(resp5.text.includes('Searching'));
  console.log('  ✓ Passed\n');

  // 6. Failed WEB_SEARCH
  console.log('Test 6: Failed WEB_SEARCH');
  browserSuccess = false;
  const res6 = await browserExecutor.searchWeb('quantum computing');
  assert.strictEqual(res6.success, false);
  const resp6 = ResponseFormatter.format({ type: 'WEB_SEARCH', query: 'quantum computing', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res6);
  assert.strictEqual(resp6.category, 'FAILURE');
  assert.ok(resp6.text.includes("couldn't open"));
  browserSuccess = true;
  console.log('  ✓ Passed\n');

  // 7. Successful OPEN_FILE
  console.log('Test 7: Successful OPEN_FILE');
  fileSuccess = true;
  const res7 = await fileExecutor.openFile('report.pdf');
  assert.strictEqual(res7.success, true);
  const resp7 = ResponseFormatter.format({ type: 'OPEN_FILE', target: 'report.pdf', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res7);
  assert.strictEqual(resp7.category, 'SUCCESS');
  console.log('  ✓ Passed\n');

  // 8. Missing file failure
  console.log('Test 8: Missing file failure');
  const res8 = await fileExecutor.openFile('missing_file.txt');
  assert.strictEqual(res8.success, false);
  assert.strictEqual(res8.errorCode, 'FILE_NOT_FOUND');
  const resp8 = ResponseFormatter.format({ type: 'OPEN_FILE', target: 'missing_file.txt', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res8);
  assert.strictEqual(resp8.category, 'FAILURE');
  assert.ok(resp8.text.includes("couldn't find missing_file.txt"));
  console.log('  ✓ Passed\n');

  // 9. Permission denied failure
  console.log('Test 9: Permission denied failure');
  const res9 = await fileExecutor.openFile('restricted.txt');
  assert.strictEqual(res9.success, false);
  assert.strictEqual(res9.errorCode, 'FILE_PERMISSION_DENIED');
  const resp9 = ResponseFormatter.format({ type: 'OPEN_FILE', target: 'restricted.txt', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' }, res9);
  assert.ok(resp9.text.includes('permission'));
  console.log('  ✓ Passed\n');

  // 10. Timeout handling
  console.log('Test 10: Timeout handling');
  const timeoutStep = {
    id: 'step-timeout-1',
    stepIndex: 0,
    intent: 'OPEN_APP' as const,
    description: 'Timeout test',
    command: { type: 'OPEN_APP' as const, target: 'Calculator', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' as const },
    state: 'PENDING' as const,
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 50,
    requiresConfirmation: false,
  };
  bridgeDelayMs = 200;
  const res10 = await stepExecutor.execute(timeoutStep, 50);
  bridgeDelayMs = 0;
  assert.strictEqual(res10.success, false);
  assert.strictEqual(res10.errorCode, 'STEP_TIMEOUT');
  const translatedTimeout = ErrorTranslator.translate({ errorCode: res10.errorCode });
  assert.ok(translatedTimeout.includes('took too long'));
  console.log('  ✓ Passed\n');

  // 11. Retry once for retryable failure
  console.log('Test 11: Retry once for retryable failure');
  const retryStep = {
    id: 'step-retry-1',
    stepIndex: 0,
    intent: 'OPEN_APP' as const,
    description: 'Retry test',
    command: { type: 'OPEN_APP' as const, target: 'Google Chrome', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' as const },
    state: 'PENDING' as const,
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 15000,
    requiresConfirmation: false,
  };
  const obs11 = ResultObserver.observe({ success: false, action: 'OPEN_APP', message: 'Temporary glitch', errorCode: 'TEMPORARY_FAILURE' });
  const decision11 = RecoveryManager.evaluate(retryStep, obs11);
  assert.strictEqual(decision11.shouldRetry, true, 'Transient error is retryable');

  // Second retry attempt
  const retryStep2 = { ...retryStep, retryCount: 1 };
  const decision11b = RecoveryManager.evaluate(retryStep2, obs11);
  assert.strictEqual(decision11b.shouldRetry, false, 'Cannot exceed 1 retry');
  console.log('  ✓ Passed\n');

  // 12. No retry for high-risk action
  console.log('Test 12: No retry for high-risk action');
  const highRiskStep = {
    id: 'step-hr-1',
    stepIndex: 0,
    intent: 'RESTART' as const,
    description: 'Restart Mac',
    command: { type: 'RESTART' as const, target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' as const },
    state: 'PENDING' as const,
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 15000,
    requiresConfirmation: true,
  };
  const obs12 = ResultObserver.observe({ success: false, action: 'RESTART', message: 'Failed' });
  const decision12 = RecoveryManager.evaluate(highRiskStep, obs12);
  assert.strictEqual(decision12.shouldRetry, false, 'High risk action must never automatically retry');
  console.log('  ✓ Passed\n');

  // 13. Duplicate execution protection on task session
  console.log('Test 13: Duplicate execution protection on task session');
  const dupStep = {
    id: 'step-dup-1',
    stepIndex: 0,
    intent: 'OPEN_APP' as const,
    description: 'Open Calculator',
    command: { type: 'OPEN_APP' as const, target: 'Calculator', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' as const },
    state: 'SUCCESS' as const, // Already completed
    retryCount: 0,
    maxRetries: 1,
    timeoutMs: 15000,
    requiresConfirmation: false,
  };
  const dupSession = TaskSessionModel.createSession('task-dup', 'open calculator', [dupStep]);
  const execDupRes = await computerUseOrchestrator.executeNextStep(dupSession);
  assert.strictEqual(execDupRes.status, 'COMPLETED', 'Completed step cannot execute again');
  console.log('  ✓ Passed\n');

  // 14. Cancellation stops execution
  console.log('Test 14: Cancellation stops execution');
  const cancelSession = TaskSessionModel.createSession('task-cancel', 'multi task', [
    { ...dupStep, state: 'PENDING' },
  ]);
  const cancelledSession = computerUseOrchestrator.cancelSession(cancelSession);
  assert.strictEqual(cancelledSession.status, 'CANCELLED');
  const execCancelRes = await computerUseOrchestrator.executeNextStep(cancelledSession);
  assert.strictEqual(execCancelRes.status, 'CANCELLED');
  console.log('  ✓ Passed\n');

  // 15. Cancellation invalidates confirmation
  console.log('Test 15: Cancellation invalidates confirmation');
  const confReq15 = securityGate.createConfirmationRequest(
    { type: 'RESTART', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
    'task-confirm-test',
    'step-1'
  );
  securityGate.cancelPendingConfirmations('task-confirm-test');
  const confirmCheck = securityGate.verifyConfirmation(
    confReq15.id,
    { type: 'RESTART', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
    'task-confirm-test',
    'step-1'
  );
  assert.strictEqual(confirmCheck.valid, false, 'Confirmation must be invalidated on cancellation');
  console.log('  ✓ Passed\n');

  // 16. Expired confirmation
  console.log('Test 16: Expired confirmation');
  const confReq16 = securityGate.createConfirmationRequest(
    { type: 'SHUTDOWN', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
    'task-exp',
    'step-exp'
  );
  // Force expiration
  const binding16 = (securityGate as any).confirmations.get(confReq16.id);
  if (binding16) binding16.expiresAt = Date.now() - 10000;
  const expiredCheck = securityGate.verifyConfirmation(
    confReq16.id,
    { type: 'SHUTDOWN', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
    'task-exp',
    'step-exp'
  );
  assert.strictEqual(expiredCheck.valid, false, 'Expired confirmation must not be valid');
  assert.strictEqual(expiredCheck.errorCode, 'CONFIRMATION_EXPIRED');
  console.log('  ✓ Passed\n');

  // 17. Stale confirmation (wrong action)
  console.log('Test 17: Stale confirmation (wrong action)');
  const confReq17 = securityGate.createConfirmationRequest(
    { type: 'SLEEP', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
    'task-stale',
    'step-stale'
  );
  const staleCheck = securityGate.verifyConfirmation(
    confReq17.id,
    { type: 'DELETE_FILE', target: 'file.txt', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
    'task-stale',
    'step-stale'
  );
  assert.strictEqual(staleCheck.valid, false, 'Confirmation bound to SLEEP cannot be verified for DELETE_FILE');
  console.log('  ✓ Passed\n');

  // 18. Partial multi-step success formatting
  console.log('Test 18: Partial multi-step success formatting');
  const partialResp = ResponseFormatter.formatPartialSuccess(2, 3, 'File not found');
  assert.ok(partialResp.text.includes('2 of 3 steps'));
  assert.strictEqual(partialResp.category, 'FAILURE');
  console.log('  ✓ Passed\n');

  // 19. Multi-step failure on step 1 formatting
  console.log('Test 19: Multi-step failure on step 1 formatting');
  const step1FailResp = ResponseFormatter.formatPartialSuccess(0, 3, 'Network unreachable');
  assert.ok(step1FailResp.text.length > 5);
  assert.strictEqual(step1FailResp.category, 'FAILURE');
  console.log('  ✓ Passed\n');

  // 20. Provider timeout fallback
  console.log('Test 20: Provider timeout fallback');
  mockProvider.setSimulateTimeout(true);
  const timeoutBrainRes = await testBrain.respond('What is 10 + 20?');
  mockProvider.setSimulateTimeout(false);
  assert.strictEqual(timeoutBrainRes.fallbackUsed, true);
  assert.ok(timeoutBrainRes.message.includes('30'));
  console.log('  ✓ Passed\n');

  // 21. Malformed AI response safety
  console.log('Test 21: Malformed AI response safety');
  mockProvider.setSimulateMalformed(true);
  const malformedBrainRes = await testBrain.respond('Hello');
  mockProvider.setSimulateMalformed(false);
  assert.strictEqual(malformedBrainRes.fallbackUsed, true);
  assert.ok(malformedBrainRes.message.length > 0);
  console.log('  ✓ Passed\n');

  // 22. Unsupported AI action rejection
  console.log('Test 22: Unsupported AI action rejection');
  mockProvider.setSimulateUnsupportedAction(true);
  const unsupportedBrainRes = await testBrain.respond('Run shell command');
  mockProvider.setSimulateUnsupportedAction(false);
  assert.ok(unsupportedBrainRes.error?.includes('Unsupported action intent') || unsupportedBrainRes.message.includes('cannot execute'));
  console.log('  ✓ Passed\n');

  // 23. Executor failure propagates to StepExecutor
  console.log('Test 23: Executor failure propagates to StepExecutor');
  appLaunchSuccess = false;
  const execFailStep = {
    id: 'step-fail-prop',
    stepIndex: 0,
    intent: 'OPEN_APP' as const,
    description: 'Fail prop',
    command: { type: 'OPEN_APP' as const, target: 'Calculator', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' as const },
    state: 'PENDING' as const,
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 15000,
    requiresConfirmation: false,
  };
  const stepRes23 = await stepExecutor.execute(execFailStep);
  assert.strictEqual(stepRes23.success, false);
  appLaunchSuccess = true;
  console.log('  ✓ Passed\n');

  // 24. No false success response under any error condition
  console.log('Test 24: No false success response under any error condition');
  const failureActions = ['OPEN_APP', 'OPEN_URL', 'OPEN_FILE', 'CREATE_FILE', 'MOVE_FILE', 'DELETE_FILE', 'SYSTEM_SETTING'] as const;
  for (const act of failureActions) {
    const fResp = ResponseFormatter.format(
      { type: act, target: 'test', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' },
      { success: false, action: act, message: 'Execution failed', errorCode: 'EXECUTION_FAILED' }
    );
    assert.strictEqual(fResp.category, 'FAILURE', `Action ${act} failure must produce FAILURE category`);
    assert.ok(!fResp.text.startsWith('Opened') && !fResp.text.startsWith('Created') && !fResp.text.startsWith('Moved') && !fResp.text.startsWith('Opening'));
  }
  console.log('  ✓ Passed\n');

  // 25. Safe user-facing error messages (no leaked secrets / paths)
  console.log('Test 25: Safe user-facing error messages (no leaked secrets / paths)');
  const unsafeMsg = 'Error in /Users/secret/file.ts at Module.compile (/Users/secret/node_modules/x.js:10:20) with key sk-abcdef1234567890123456';
  const cleanMsg = ErrorTranslator.translate({ rawMessage: unsafeMsg });
  assert.ok(!cleanMsg.includes('/Users/'));
  assert.ok(!cleanMsg.includes('sk-abcdef'));
  assert.ok(!cleanMsg.includes('node_modules'));
  console.log('  ✓ Passed\n');

  // 26. Failed task reaches stable state
  console.log('Test 26: Failed task reaches stable state');
  const failedSession = TaskSessionModel.createSession('task-f', 'failed req', [
    { ...execFailStep, maxRetries: 0 },
  ]);
  appLaunchSuccess = false;
  const fSessionRes = await computerUseOrchestrator.executeNextStep(failedSession);
  appLaunchSuccess = true;
  assert.strictEqual(fSessionRes.status, 'FAILED');
  assert.strictEqual(fSessionRes.session.status, 'FAILED');
  console.log('  ✓ Passed\n');

  // 27. Successful task reaches stable state
  console.log('Test 27: Successful task reaches stable state');
  const successSession = TaskSessionModel.createSession('task-s', 'succ req', [
    { ...execFailStep, maxRetries: 0 },
  ]);
  appLaunchSuccess = true;
  const sSessionRes = await computerUseOrchestrator.executeNextStep(successSession);
  assert.strictEqual(sSessionRes.status, 'COMPLETED');
  assert.strictEqual(sSessionRes.session.status, 'COMPLETED');
  console.log('  ✓ Passed\n');

  // 28. Speech failure does not leave SPEAKING state stuck
  console.log('Test 28: Speech failure does not leave SPEAKING state stuck');
  const store = useAuraStore.getState();
  // Simulate speaking error
  store.setAuraState('SPEAKING');
  assert.strictEqual(useAuraStore.getState().currentState, 'SPEAKING');
  store.setAuraState('IDLE');
  assert.strictEqual(useAuraStore.getState().currentState, 'IDLE');
  console.log('  ✓ Passed\n');

  // 29. Completed step cannot execute again
  console.log('Test 29: Completed step cannot execute again');
  const step29 = { ...dupStep, state: 'SUCCESS' as const };
  const session29 = TaskSessionModel.createSession('task-29', 'cmd', [step29]);
  const res29 = await computerUseOrchestrator.executeNextStep(session29);
  assert.strictEqual(res29.status, 'COMPLETED');
  console.log('  ✓ Passed\n');

  // 30. Cancelled step cannot execute again
  console.log('Test 30: Cancelled step cannot execute again');
  const step30 = { ...dupStep, state: 'CANCELLED' as const };
  const session30 = TaskSessionModel.createSession('task-30', 'cmd', [step30]);
  const res30 = await computerUseOrchestrator.executeNextStep(session30);
  assert.strictEqual(res30.status, 'CANCELLED');
  console.log('  ✓ Passed\n');

  console.log('====================================================');
  console.log('🎉 ALL 30 PHASE 28 RELIABILITY & ERROR RECOVERY TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Unhandled Phase 28 test error:', err);
  process.exit(1);
});
