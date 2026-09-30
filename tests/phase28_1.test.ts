/**
 * AURA Phase 28.1 Test Suite
 * Natural-Language Multi-Intent Task Understanding
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

(globalThis as any).novairBridge = {
  openApp: async (bundleId: string) => {
    if (!appLaunchSuccess || bundleId === 'com.apple.badapp') {
      return { success: false, error: 'APP_LAUNCH_FAILED' };
    }
    return { success: true };
  },
  closeApp: async () => ({ success: true }),
  openUrl: async () => ({ success: true }),
  openFolder: async () => ({ success: true, path: '/Users/test/Documents' }),
  openFile: async () => ({ success: true, path: '/Users/test/Documents/test.txt' }),
  createFile: async () => ({ success: true, path: '/Users/test/Documents/test.txt' }),
  moveFile: async () => ({ success: true }),
  deleteFile: async () => ({ success: true }),
  setSystemSetting: async () => ({ success: true }),
  sleep: async () => ({ success: true }),
  restart: async () => ({ success: true }),
  shutdown: async () => ({ success: true }),
  isAvailable: async () => true,
};

import { SafeCalculator } from '../src/assistant/brain/SafeCalculator';
import { localTaskPlanner } from '../src/assistant/planner/LocalTaskPlanner';
import { localSemanticUnderstanding } from '../src/assistant/understanding/LocalSemanticUnderstanding';
import { securityGate } from '../src/assistant/security';
import { computerUseOrchestrator } from '../src/assistant/computer';
import { useAuraStore } from '../src/state/useAuraStore';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log('🧪 Starting AURA Phase 28.1 Multi-Intent Task Understanding Test Suite...\n');

async function runTests() {
  const store = useAuraStore.getState();

  // 1. "open Calculator and perform 9 * 9"
  console.log('Test 1: "open Calculator and perform 9 * 9"');
  const input1 = 'Open Calculator and perform 9 * 9';
  const plan1 = localTaskPlanner.plan(input1);
  assert.ok(plan1, 'Plan must be created');
  assert.strictEqual(plan1.steps.length, 2, 'Must create 2 steps');
  assert.strictEqual(plan1.steps[0].command?.type, 'OPEN_APP');
  assert.strictEqual(plan1.steps[0].command?.target, 'Calculator');
  assert.strictEqual(plan1.steps[1].command?.type, 'CALCULATE');
  
  await store.submitCommand(input1);
  await sleep(600);
  const resp1 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp1.includes('81'), `Response "${resp1}" must contain 81`);
  assert.ok(resp1.toLowerCase().includes('calculator'), `Response "${resp1}" must mention Calculator`);
  console.log(`  ✓ Response: "${resp1}"\n`);

  // 2. "open Calculator and calculate 15 times 6"
  console.log('Test 2: "open Calculator and calculate 15 times 6"');
  const input2 = 'Open Calculator and calculate 15 times 6';
  const plan2 = localTaskPlanner.plan(input2);
  assert.ok(plan2);
  assert.strictEqual(plan2.steps.length, 2);
  assert.strictEqual(plan2.steps[0].command?.type, 'OPEN_APP');
  assert.strictEqual(plan2.steps[1].command?.type, 'CALCULATE');

  await store.submitCommand(input2);
  await sleep(600);
  const resp2 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp2.includes('90'), `Response "${resp2}" must contain 90`);
  console.log(`  ✓ Response: "${resp2}"\n`);

  // 3. "calculate 45 plus 78"
  console.log('Test 3: "calculate 45 plus 78"');
  const input3 = 'Calculate 45 plus 78';
  const calc3 = SafeCalculator.calculate(input3);
  assert.ok(calc3);
  assert.strictEqual(calc3.result, 123);

  await store.submitCommand(input3);
  await sleep(300);
  const resp3 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp3.includes('123'), `Response "${resp3}" must contain 123`);
  console.log(`  ✓ Response: "${resp3}"\n`);

  // 4. "open Calculator, do 100 minus 37"
  console.log('Test 4: "open Calculator, do 100 minus 37"');
  const input4 = 'Open Calculator, do 100 minus 37';
  const plan4 = localTaskPlanner.plan(input4);
  assert.ok(plan4);
  assert.strictEqual(plan4.steps.length, 2);

  await store.submitCommand(input4);
  await sleep(600);
  const resp4 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp4.includes('63'), `Response "${resp4}" must contain 63`);
  console.log(`  ✓ Response: "${resp4}"\n`);

  // 5. "open Calculator and find 125 divided by 5"
  console.log('Test 5: "open Calculator and find 125 divided by 5"');
  const input5 = 'Open Calculator and find 125 divided by 5';
  const plan5 = localTaskPlanner.plan(input5);
  assert.ok(plan5);
  assert.strictEqual(plan5.steps.length, 2);

  await store.submitCommand(input5);
  await sleep(600);
  const resp5 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp5.includes('25'), `Response "${resp5}" must contain 25`);
  console.log(`  ✓ Response: "${resp5}"\n`);

  // 6. "calculate 9 * 9"
  console.log('Test 6: "calculate 9 * 9"');
  const input6 = 'calculate 9 * 9';
  await store.submitCommand(input6);
  await sleep(300);
  const resp6 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp6.includes('81'), `Response "${resp6}" must contain 81`);
  console.log(`  ✓ Response: "${resp6}"\n`);

  // 7. "open Calculator and calculate 9 squared"
  console.log('Test 7: "open Calculator and calculate 9 squared"');
  const input7 = 'Open Calculator and calculate 9 squared';
  const plan7 = localTaskPlanner.plan(input7);
  assert.ok(plan7);
  assert.strictEqual(plan7.steps.length, 2);

  await store.submitCommand(input7);
  await sleep(600);
  const resp7 = useAuraStore.getState().activeResponse.text;
  assert.ok(resp7.includes('81'), `Response "${resp7}" must contain 81`);
  console.log(`  ✓ Response: "${resp7}"\n`);

  // 8. Invalid/Ambiguous calculation
  console.log('Test 8: Invalid / ambiguous calculation handling');
  const badCalc = SafeCalculator.calculate('calculate xyz plus abc');
  assert.strictEqual(badCalc, null, 'Unparsable expression must return null');
  console.log('  ✓ Passed\n');

  // 9. Verify calculation result reaches the final response
  console.log('Test 9: Verify calculation result reaches final response in multi-step task');
  const multiPlan = localTaskPlanner.plan('Open Calculator and perform 250 + 750');
  assert.ok(multiPlan);
  const validation = computerUseOrchestrator.validatePlan(multiPlan.steps.map((s) => s.command!).filter(Boolean), 'Open Calculator and perform 250 + 750');
  assert.strictEqual(validation.valid, true);
  let session = computerUseOrchestrator.createSession('Open Calculator and perform 250 + 750', validation.validatedSteps!);
  
  // Step 1: Open Calculator
  const step1Res = await computerUseOrchestrator.executeNextStep(session);
  assert.strictEqual(step1Res.status, 'CONTINUE');
  assert.strictEqual(step1Res.observation?.success, true);
  
  // Step 2: Calculate
  const step2Res = await computerUseOrchestrator.executeNextStep(step1Res.session);
  assert.strictEqual(step2Res.status, 'COMPLETED');
  assert.strictEqual(step2Res.observation?.success, true);
  assert.ok(step2Res.observation?.message.includes('1000'));
  console.log('  ✓ Passed\n');

  // 10. Verify Calculator opening and calculation are separate ordered steps
  console.log('Test 10: Verify Calculator opening and calculation are separate ordered steps');
  const orderedPlan = localTaskPlanner.plan('Open Calculator and do 50 * 5');
  assert.ok(orderedPlan);
  assert.strictEqual(orderedPlan.steps[0].command?.type, 'OPEN_APP');
  assert.strictEqual(orderedPlan.steps[0].stepNumber, 1);
  assert.strictEqual(orderedPlan.steps[1].command?.type, 'CALCULATE');
  assert.strictEqual(orderedPlan.steps[1].stepNumber, 2);
  console.log('  ✓ Passed\n');

  // 11. Verify security validation still occurs before executable actions
  console.log('Test 11: Verify security validation still occurs before executable actions');
  const secCalcRes = securityGate.validateAction({
    type: 'CALCULATE',
    target: '9 * 9',
    query: '9 * 9',
    originalInput: 'calculate 9 * 9',
    normalizedInput: 'calculate 9 * 9',
    confidence: 1,
    risk: 'LOW',
  });
  assert.strictEqual(secCalcRes.valid, true);
  assert.strictEqual(secCalcRes.riskLevel, 'LOW');

  // Verify prohibited shell injection inside calculation target is blocked
  const maliciousCmd = {
    type: 'CALCULATE' as const,
    target: '9 * 9; rm -rf /',
    originalInput: 'calculate 9 * 9; rm -rf /',
    normalizedInput: 'calculate 9 * 9; rm -rf /',
    confidence: 1,
    risk: 'LOW' as const,
  };
  const secMaliciousRes = securityGate.validateAction(maliciousCmd);
  assert.strictEqual(secMaliciousRes.valid, false, 'Shell injection in calculate must be blocked');
  console.log('  ✓ Passed\n');

  console.log('====================================================');
  console.log('🎉 ALL PHASE 28.1 MULTI-INTENT TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Phase 28.1 test failure:', err);
  process.exit(1);
});
