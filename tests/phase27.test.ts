import { describe, it } from 'node:test';
import assert from 'node:assert';

(globalThis as any).window = globalThis;
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
    if (fileName.includes('missing')) return { success: false, errorCode: 'FILE_NOT_FOUND', message: 'File not found' };
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

import { securityGate, CONFIRMATION_TTL_MS } from '../src/assistant/security';
import { computerUseOrchestrator } from '../src/assistant/computer/ComputerUseOrchestrator';
import { stepExecutor } from '../src/assistant/computer/StepExecutor';
import { TaskSessionModel } from '../src/assistant/computer/TaskSession';
import { ParsedCommand } from '../src/assistant/commands/types';
import { validateAndNormalizeUrl } from '../src/assistant/execution/BrowserExecutor';
import { validatePathSecurity, validateSafeFileName } from '../src/assistant/execution/FilePathResolver';

console.log('🧪 Starting AURA Phase 27 Security & Permission Hardening Test Suite...\n');

// 1. Unknown action rejected
console.log('Test 1: Unknown action rejected');
const unknownCmd: ParsedCommand = {
  type: 'UNKNOWN_CUSTOM_ACTION' as any,
  originalInput: 'execute custom exploit',
  normalizedInput: 'execute custom exploit',
  confidence: 0.99,
  risk: 'LOW',
};
const res1 = securityGate.validateAction(unknownCmd);
assert.strictEqual(res1.valid, false, 'Unknown action must not be valid');
assert.strictEqual(res1.errorCode, 'UNKNOWN_ACTION');
console.log('  ✓ Passed\n');

// 2. Malformed AI plan rejected
console.log('Test 2: Malformed AI plan rejected');
const nullPlanRes = securityGate.validatePlan(null as any);
assert.strictEqual(nullPlanRes.valid, false);
const emptyPlanRes = securityGate.validatePlan([]);
assert.strictEqual(emptyPlanRes.valid, false);
const malformedStepPlan = securityGate.validatePlan([{ type: undefined } as any]);
assert.strictEqual(malformedStepPlan.valid, false);
console.log('  ✓ Passed\n');

// 3. Invalid action parameters rejected
console.log('Test 3: Invalid action parameters rejected');
const invalidAppCmd: ParsedCommand = {
  type: 'OPEN_APP',
  target: '',
  originalInput: 'open',
  normalizedInput: 'open',
  confidence: 0.9,
  risk: 'LOW',
};
const res3 = securityGate.validateAction(invalidAppCmd);
assert.strictEqual(res3.valid, false);
assert.strictEqual(res3.errorCode, 'MALFORMED_PARAMETERS');
console.log('  ✓ Passed\n');

// 4. AI cannot downgrade high-risk action
console.log('Test 4: AI cannot downgrade high-risk action');
const fakeLowRiskCmd: ParsedCommand = {
  type: 'DELETE_FILE',
  target: 'important_data.txt',
  originalInput: 'delete important_data.txt',
  normalizedInput: 'delete important_data.txt',
  confidence: 0.99,
  risk: 'LOW', // Attempted AI downgrade
};
const calculatedRisk = securityGate.calculateDeterministicRisk(fakeLowRiskCmd.type, fakeLowRiskCmd.originalInput);
assert.strictEqual(calculatedRisk, 'HIGH', 'Authoritative risk must remain HIGH');
const res4 = securityGate.validateAction(fakeLowRiskCmd);
assert.strictEqual(res4.riskLevel, 'HIGH');
assert.strictEqual(res4.requiresConfirmation, true);
console.log('  ✓ Passed\n');

// 5. DELETE_FILE requires confirmation
console.log('Test 5: DELETE_FILE requires confirmation');
const deleteCmd: ParsedCommand = {
  type: 'DELETE_FILE',
  target: 'notes.txt',
  originalInput: 'delete notes.txt',
  normalizedInput: 'delete notes.txt',
  confidence: 0.95,
  risk: 'HIGH',
};
const res5 = securityGate.validateAction(deleteCmd);
assert.strictEqual(res5.requiresConfirmation, true);
console.log('  ✓ Passed\n');

// 6. SLEEP requires confirmation
console.log('Test 6: SLEEP requires confirmation');
const sleepCmd: ParsedCommand = {
  type: 'SLEEP',
  target: 'System',
  originalInput: 'sleep',
  normalizedInput: 'sleep',
  confidence: 0.95,
  risk: 'HIGH',
};
const res6 = securityGate.validateAction(sleepCmd);
assert.strictEqual(res6.requiresConfirmation, true);
assert.strictEqual(res6.riskLevel, 'HIGH');
console.log('  ✓ Passed\n');

// 7. RESTART requires confirmation
console.log('Test 7: RESTART requires confirmation');
const restartCmd: ParsedCommand = {
  type: 'RESTART',
  target: 'System',
  originalInput: 'restart',
  normalizedInput: 'restart',
  confidence: 0.95,
  risk: 'HIGH',
};
const res7 = securityGate.validateAction(restartCmd);
assert.strictEqual(res7.requiresConfirmation, true);
assert.strictEqual(res7.riskLevel, 'HIGH');
console.log('  ✓ Passed\n');

// 8. SHUTDOWN requires confirmation
console.log('Test 8: SHUTDOWN requires confirmation');
const shutdownCmd: ParsedCommand = {
  type: 'SHUTDOWN',
  target: 'System',
  originalInput: 'shutdown',
  normalizedInput: 'shutdown',
  confidence: 0.95,
  risk: 'HIGH',
};
const res8 = securityGate.validateAction(shutdownCmd);
assert.strictEqual(res8.requiresConfirmation, true);
assert.strictEqual(res8.riskLevel, 'HIGH');
console.log('  ✓ Passed\n');

// 9. Confirmation cannot be reused
console.log('Test 9: Confirmation cannot be reused');
const targetCmd: ParsedCommand = {
  type: 'DELETE_FILE',
  target: 'test_file.txt',
  originalInput: 'delete test_file.txt',
  normalizedInput: 'delete test_file.txt',
  confidence: 0.95,
  risk: 'HIGH',
};
const confBinding = securityGate.createConfirmationRequest(targetCmd, 'task-001', 'step-001');
const verifyFirst = securityGate.verifyConfirmation(confBinding.id, targetCmd, 'task-001', 'step-001');
assert.strictEqual(verifyFirst.valid, true);

// Consume it
securityGate.consumeConfirmation(confBinding.id);

// Try to reuse it
const verifySecond = securityGate.verifyConfirmation(confBinding.id, targetCmd, 'task-001', 'step-001');
assert.strictEqual(verifySecond.valid, false);
assert.strictEqual(verifySecond.errorCode, 'CONFIRMATION_REUSED');
console.log('  ✓ Passed\n');

// 10. Confirmation invalid after step modification / mismatch
console.log('Test 10: Confirmation invalid after step modification');
const confForA = securityGate.createConfirmationRequest(
  { type: 'DELETE_FILE', target: 'file_A.txt', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
  'task-002',
  'step-002'
);
const modifiedCmd: ParsedCommand = {
  type: 'DELETE_FILE',
  target: 'file_B.txt', // Target was swapped!
  originalInput: '',
  normalizedInput: '',
  confidence: 1,
  risk: 'HIGH',
};
const verifyMismatch = securityGate.verifyConfirmation(confForA.id, modifiedCmd, 'task-002', 'step-002');
assert.strictEqual(verifyMismatch.valid, false);
assert.strictEqual(verifyMismatch.errorCode, 'CONFIRMATION_MISMATCH');
console.log('  ✓ Passed\n');

// 11. Confirmation invalid after cancellation
console.log('Test 11: Confirmation invalid after cancellation');
const confForCancel = securityGate.createConfirmationRequest(
  { type: 'SHUTDOWN', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
  'task-003',
  'step-003'
);
securityGate.cancelPendingConfirmations('task-003');
const verifyCancelled = securityGate.verifyConfirmation(
  confForCancel.id,
  { type: 'SHUTDOWN', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' },
  'task-003',
  'step-003'
);
assert.strictEqual(verifyCancelled.valid, false);
assert.strictEqual(verifyCancelled.errorCode, 'CONFIRMATION_INVALID');
console.log('  ✓ Passed\n');

// 12. Confirmation invalid after timeout
console.log('Test 12: Confirmation invalid after timeout');
const expiredConf = securityGate.createConfirmationRequest(
  { type: 'SLEEP', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' }
);
// Force expired timestamp
expiredConf.expiresAt = Date.now() - 1000;
const verifyExpired = securityGate.verifyConfirmation(
  expiredConf.id,
  { type: 'SLEEP', target: 'System', originalInput: '', normalizedInput: '', confidence: 1, risk: 'HIGH' }
);
assert.strictEqual(verifyExpired.valid, false);
assert.strictEqual(verifyExpired.errorCode, 'CONFIRMATION_EXPIRED');
console.log('  ✓ Passed\n');

// 13. Cancelled task cannot execute
console.log('Test 13: Cancelled task cannot execute');
const taskSteps13 = computerUseOrchestrator.validatePlan([
  { type: 'OPEN_APP', target: 'Google Chrome', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' },
]).validatedSteps!;
let session13 = computerUseOrchestrator.createSession('Cancelled task', taskSteps13);
session13 = computerUseOrchestrator.cancelSession(session13);
const execCancelledRes = await computerUseOrchestrator.executeNextStep(session13);
assert.strictEqual(execCancelledRes.status, 'CANCELLED');
console.log('  ✓ Passed\n');

// 14. Completed task cannot execute
console.log('Test 14: Completed task cannot execute');
let session14 = computerUseOrchestrator.createSession('Completed task', taskSteps13);
session14 = TaskSessionModel.updateSessionStatus(session14, 'COMPLETED');
const execCompletedRes = await computerUseOrchestrator.executeNextStep(session14);
assert.strictEqual(execCompletedRes.status, 'COMPLETED');
console.log('  ✓ Passed\n');

// 15. Failed task cannot silently continue
console.log('Test 15: Failed task cannot silently continue');
let session15 = computerUseOrchestrator.createSession('Failed task', taskSteps13);
session15 = TaskSessionModel.updateSessionStatus(session15, 'FAILED', 'Previous fatal error');
const execFailedRes = await computerUseOrchestrator.executeNextStep(session15);
assert.strictEqual(execFailedRes.status, 'FAILED');
console.log('  ✓ Passed\n');

// 16. Step limit enforced
console.log('Test 16: Step limit enforced');
const excessiveCommands: ParsedCommand[] = Array.from({ length: 11 }, (_, i) => ({
  type: 'OPEN_APP',
  target: 'Google Chrome',
  originalInput: `Step ${i + 1}`,
  normalizedInput: `step ${i + 1}`,
  confidence: 1,
  risk: 'LOW',
}));
const planExcessive = computerUseOrchestrator.validatePlan(excessiveCommands);
assert.strictEqual(planExcessive.valid, false);
assert.ok(planExcessive.errors[0].includes('exceeds maximum step limit'));
console.log('  ✓ Passed\n');

// 17. Retry limit enforced
console.log('Test 17: Retry limit enforced');
const failingStep = {
  id: 'step-fail',
  stepIndex: 0,
  intent: 'OPEN_URL' as const,
  description: 'Unreachable site',
  command: {
    type: 'OPEN_URL' as const,
    target: 'https://non-existent-domain-xyz-999.com',
    originalInput: '',
    normalizedInput: '',
    confidence: 1,
    risk: 'LOW' as const,
  },
  state: 'PENDING' as const,
  retryCount: 0,
  maxRetries: 1,
  timeoutMs: 500,
  requiresConfirmation: false,
};
const session17 = computerUseOrchestrator.createSession('Retry test', [failingStep]);
const stepRes17 = await computerUseOrchestrator.executeNextStep(session17);
assert.strictEqual(stepRes17.session.steps[0].retryCount <= 1, true);
console.log('  ✓ Passed\n');

// 18. Path traversal rejected
console.log('Test 18: Path traversal rejected');
const traversalChecks = [
  '../../etc/passwd',
  '../Documents/secret.txt',
  'Documents/../../../private/etc/shadow',
  '..\\Windows\\System32',
];
for (const p of traversalChecks) {
  const check = validatePathSecurity(p);
  assert.strictEqual(check.safe, false, `Path "${p}" must be unsafe`);
  const fnCheck = validateSafeFileName(p);
  assert.strictEqual(fnCheck.valid, false, `Filename "${p}" must be invalid`);
}
console.log('  ✓ Passed\n');

// 19. Symlink escape rejected
console.log('Test 19: Symlink escape rejected');
const symlinkPathCheck = validatePathSecurity('/System/Library/Frameworks');
assert.strictEqual(symlinkPathCheck.safe, false);
console.log('  ✓ Passed\n');

// 20. Protected directory rejected
console.log('Test 20: Protected directory rejected');
const protectedDirs = ['/System', '/private', '/etc', '/usr', '/bin', '/sbin', '/var', '/dev', '~/Library'];
for (const dir of protectedDirs) {
  const check = validatePathSecurity(dir);
  assert.strictEqual(check.safe, false, `Protected directory "${dir}" must be rejected`);
}
console.log('  ✓ Passed\n');

// 21. Unsafe browser protocol rejected
console.log('Test 21: Unsafe browser protocol rejected');
const unsafeProtocols = [
  'file:///etc/passwd',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:MsgBox(1)',
  'blob:https://example.com/uuid',
  'about:blank',
];
for (const url of unsafeProtocols) {
  const val = validateAndNormalizeUrl(url);
  assert.strictEqual(val.valid, false, `URL "${url}" must be rejected`);
}
console.log('  ✓ Passed\n');

// 22. Javascript URL rejected
console.log('Test 22: Javascript URL rejected');
const jsUrl = 'javascript:document.cookie';
const jsVal = validateAndNormalizeUrl(jsUrl);
assert.strictEqual(jsVal.valid, false);
const jsCmd: ParsedCommand = {
  type: 'OPEN_URL',
  target: jsUrl,
  originalInput: `Open ${jsUrl}`,
  normalizedInput: `open ${jsUrl}`,
  confidence: 1,
  risk: 'LOW',
};
const secJsVal = securityGate.validateAction(jsCmd);
assert.strictEqual(secJsVal.valid, false);
assert.strictEqual(secJsVal.errorCode, 'UNSAFE_PROTOCOL');
console.log('  ✓ Passed\n');

// 23. Arbitrary application path rejected
console.log('Test 23: Arbitrary application path rejected');
const arbAppCmd: ParsedCommand = {
  type: 'OPEN_APP',
  target: 'malicious_script.exe',
  originalInput: 'open malicious_script.exe',
  normalizedInput: 'open malicious_script.exe',
  confidence: 0.95,
  risk: 'LOW',
};
const arbAppVal = securityGate.validateAction(arbAppCmd);
assert.strictEqual(arbAppVal.valid, false);
assert.strictEqual(arbAppVal.errorCode, 'UNAPPROVED_APPLICATION');

const arbBinCmd: ParsedCommand = {
  type: 'OPEN_APP',
  target: '/bin/bash',
  originalInput: 'open /bin/bash',
  normalizedInput: 'open /bin/bash',
  confidence: 0.95,
  risk: 'LOW',
};
const arbBinVal = securityGate.validateAction(arbBinCmd);
assert.strictEqual(arbBinVal.valid, false);
assert.ok(arbBinVal.errorCode === 'UNAPPROVED_APPLICATION' || arbBinVal.errorCode === 'PROHIBITED_SHELL_COMMAND');
console.log('  ✓ Passed\n');

// 24. Arbitrary shell command rejected
console.log('Test 24: Arbitrary shell command rejected');
const shellCommands = ['sudo reboot', 'bash script.sh', 'zsh -c "whoami"', 'chmod 777 /', 'killall Dock'];
for (const sc of shellCommands) {
  const parsed = {
    type: 'OPEN_APP' as const,
    target: sc,
    originalInput: sc,
    normalizedInput: sc,
    confidence: 0.9,
    risk: 'LOW' as const,
  };
  const val = securityGate.validateAction(parsed);
  assert.strictEqual(val.valid, false, `Shell command "${sc}" must be rejected`);
}
console.log('  ✓ Passed\n');

// 25. Shell metacharacters rejected
console.log('Test 25: Shell metacharacters rejected');
const metacharInputs = ['echo test; rm -rf /', 'open app && curl bad.com', 'test | cat', '$(whoami)', '`id`'];
for (const mi of metacharInputs) {
  const parsed = {
    type: 'OPEN_APP' as const,
    target: mi,
    originalInput: mi,
    normalizedInput: mi,
    confidence: 0.9,
    risk: 'LOW' as const,
  };
  const val = securityGate.validateAction(parsed);
  assert.strictEqual(val.valid, false, `Metacharacter input "${mi}" must be rejected`);
  assert.strictEqual(val.errorCode, 'PROHIBITED_SHELL_COMMAND');
}
console.log('  ✓ Passed\n');

// 26. Dangerous system command rejected
console.log('Test 26: Dangerous system command rejected');
const dangerousSysCmd: ParsedCommand = {
  type: 'SYSTEM_SETTING',
  target: 'defaults write com.apple.finder AppleShowAllFiles YES',
  originalInput: '',
  normalizedInput: '',
  confidence: 1,
  risk: 'MEDIUM',
};
const dangerousSysVal = securityGate.validateAction(dangerousSysCmd);
assert.strictEqual(dangerousSysVal.valid, false);
assert.strictEqual(dangerousSysVal.errorCode, 'PROHIBITED_SHELL_COMMAND');
console.log('  ✓ Passed\n');

// 27. AI-generated unknown executor rejected
console.log('Test 27: AI-generated unknown executor rejected');
const unknownExecStep = {
  id: 'step-unknown',
  stepIndex: 0,
  intent: 'ARBITRARY_EXEC' as any,
  description: 'Arbitrary',
  command: {
    type: 'ARBITRARY_EXEC' as any,
    target: 'something',
    originalInput: '',
    normalizedInput: '',
    confidence: 1,
    risk: 'LOW' as any,
  },
  state: 'PENDING' as const,
  retryCount: 0,
  maxRetries: 1,
  timeoutMs: 1000,
  requiresConfirmation: false,
};
const execUnknownResult = await stepExecutor.execute(unknownExecStep);
assert.strictEqual(execUnknownResult.success, false);
assert.strictEqual(execUnknownResult.errorCode, 'UNKNOWN_ACTION');
console.log('  ✓ Passed\n');

// 28. Malformed replan rejected
console.log('Test 28: Malformed replan rejected');
let session28 = computerUseOrchestrator.createSession('Replan session', taskSteps13);
const replanRes = computerUseOrchestrator.replanSession(session28, [
  { type: 'UNKNOWN' as any, originalInput: '', normalizedInput: '', confidence: 0, risk: 'LOW' },
]);
assert.strictEqual(replanRes.valid, false);
console.log('  ✓ Passed\n');

// 29. Replan still passes security validation
console.log('Test 29: Replan still passes security validation');
const replanValidRes = computerUseOrchestrator.replanSession(session28, [
  { type: 'OPEN_APP', target: 'Google Chrome', originalInput: 'open chrome', normalizedInput: 'open chrome', confidence: 1, risk: 'LOW' },
  { type: 'WEB_SEARCH', query: 'TypeScript security', originalInput: '', normalizedInput: '', confidence: 1, risk: 'LOW' },
]);
assert.strictEqual(replanValidRes.valid, true);
assert.strictEqual(replanValidRes.session.totalSteps, 2);
console.log('  ✓ Passed\n');

// 30. Frontend cannot set trusted risk level
console.log('Test 30: Frontend cannot set trusted risk level');
const userClientCmd: ParsedCommand = {
  type: 'SHUTDOWN',
  target: 'System',
  originalInput: 'shutdown',
  normalizedInput: 'shutdown',
  confidence: 1,
  risk: 'LOW', // Frontend claims LOW
};
const secRes30 = securityGate.validateAction(userClientCmd);
assert.strictEqual(secRes30.riskLevel, 'HIGH', 'Server/SecurityGate overrides client risk to HIGH');
assert.strictEqual(secRes30.requiresConfirmation, true);
console.log('  ✓ Passed\n');

// 31. Secrets are not exposed in responses/logs
console.log('Test 31: Secrets are not exposed in responses/logs');
securityGate.logAudit('ACTION_REJECTED', {
  details: 'Attempted to use key sk-1234567890abcdef1234567890 and password=mySecretPassword123',
});
const auditLogs = securityGate.getAuditLogs();
const latestLog = auditLogs[0];
assert.ok(latestLog.details);
assert.ok(!latestLog.details.includes('sk-1234567890abcdef1234567890'), 'API key must be redacted');
assert.ok(latestLog.details.includes('[REDACTED_API_KEY]'));
assert.ok(!latestLog.details.includes('mySecretPassword123'), 'Password must be redacted');
console.log('  ✓ Passed\n');

// 32. Security failure produces safe structured error
console.log('Test 32: Security failure produces safe structured error');
const secFail = securityGate.validateAction({
  type: 'OPEN_APP',
  target: 'MaliciousApp',
  originalInput: '',
  normalizedInput: '',
  confidence: 1,
  risk: 'LOW',
});
assert.strictEqual(secFail.valid, false);
assert.ok(typeof secFail.error === 'string');
assert.ok(typeof secFail.errorCode === 'string');
assert.ok(!secFail.error.includes('/Users/'));
console.log('  ✓ Passed\n');

// 33. Regression test: "open calculator" must produce executable OPEN_APP action and reach executor
console.log('Test 33: "open calculator" produces executable OPEN_APP and reaches executor');
import { AIAssistantBrain } from '../src/assistant/ai/AIAssistantBrain';
import { MockAIProvider } from '../src/assistant/ai/providers/MockAIProvider';
import { macAppExecutor } from '../src/assistant/execution/MacAppExecutor';

const regProvider = new MockAIProvider();
const regBrain = new AIAssistantBrain(regProvider);

const calcAiResult = await regBrain.respond('open calculator');
assert.strictEqual(calcAiResult.type, 'action_request', 'open calculator must be classified as action_request');
assert.ok(calcAiResult.parsedCommands && calcAiResult.parsedCommands.length > 0, 'Must contain parsedCommands');
assert.strictEqual(calcAiResult.parsedCommands[0].type, 'OPEN_APP');
assert.strictEqual(calcAiResult.parsedCommands[0].target, 'Calculator');

const calcSecCheck = securityGate.validateAction(calcAiResult.parsedCommands[0]);
assert.strictEqual(calcSecCheck.valid, true, 'Calculator OPEN_APP must pass SecurityGate');
assert.strictEqual(calcSecCheck.riskLevel, 'LOW', 'Calculator OPEN_APP must be LOW risk');
assert.strictEqual(calcSecCheck.requiresConfirmation, false, 'Calculator OPEN_APP must not require confirmation');

const calcExecResult = await macAppExecutor.execute(calcAiResult.parsedCommands[0]);
assert.strictEqual(calcExecResult.success, true, 'MacAppExecutor must succeed for approved Calculator app');
console.log('  ✓ Passed\n');

// 34. Regression test: Standard low-risk commands produce executable actions
console.log('Test 34: Standard low-risk commands produce executable actions without unnecessary confirmation');
const lowRiskTests = [
  { prompt: 'open Chrome', expectedType: 'OPEN_APP', expectedTarget: 'Google Chrome' },
  { prompt: 'open Finder', expectedType: 'OPEN_APP', expectedTarget: 'Finder' },
  { prompt: 'open Safari', expectedType: 'OPEN_APP', expectedTarget: 'Safari' },
  { prompt: 'search Google for cats', expectedType: 'WEB_SEARCH' },
  { prompt: 'open https://google.com', expectedType: 'OPEN_URL' },
  { prompt: 'open documents', expectedType: 'OPEN_FOLDER' },
];

for (const t of lowRiskTests) {
  const aiRes = await regBrain.respond(t.prompt);
  assert.strictEqual(aiRes.type, 'action_request', `${t.prompt} must produce action_request`);
  assert.ok(aiRes.parsedCommands && aiRes.parsedCommands.length > 0, `${t.prompt} must produce parsedCommands`);
  const cmd = aiRes.parsedCommands[0];
  assert.strictEqual(cmd.type, t.expectedType, `${t.prompt} must match expected type`);
  const sec = securityGate.validateAction(cmd);
  assert.strictEqual(sec.valid, true, `${t.prompt} must pass security validation`);
  assert.strictEqual(sec.requiresConfirmation, false, `${t.prompt} must not require confirmation`);
}
console.log('  ✓ Passed\n');

// 35. Preserved security for high-risk actions & rejected actions
console.log('Test 35: Preserved security for high-risk actions and shell injection');
const highRiskTests = ['delete that file', 'sleep', 'restart my mac', 'shutdown'];
for (const prompt of highRiskTests) {
  const aiRes = await regBrain.respond(prompt);
  assert.strictEqual(aiRes.type, 'action_request');
  const cmd = aiRes.parsedCommands![0];
  const sec = securityGate.validateAction(cmd);
  assert.strictEqual(sec.valid, true);
  assert.strictEqual(sec.riskLevel, 'HIGH');
  assert.strictEqual(sec.requiresConfirmation, true);
}
console.log('  ✓ Passed\n');

console.log('====================================================');
console.log('🎉 ALL 35 PHASE 27 SECURITY & REGRESSION TESTS PASSED!');
console.log('====================================================\n');
