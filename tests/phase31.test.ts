import assert from 'node:assert';
import { useAuraStore } from '../src/state/useAuraStore';
import { localSemanticUnderstanding } from '../src/assistant/understanding';
import { aiAssistantBrain } from '../src/assistant/ai';

async function runPhase31Tests() {
  console.log('\\n🧪 Starting AURA Phase 31 Advanced AI Context Test Suite...\\n');

  try {
    // Test 1: Follow-up calculation
    process.stdout.write('Test 1: Follow-up calculation... ');
    useAuraStore.getState().clearActiveContext();
    useAuraStore.getState().updateActiveContext('calculation', { type: 'calculation', value: '200', timestamp: Date.now() });

    let context = { activeContext: useAuraStore.getState().activeContext, recentHistory: [] };
    let decision = await localSemanticUnderstanding.understand('Now multiply that by 2', context);

    assert.strictEqual(decision.intent, 'CALCULATE', 'Intent must be CALCULATE');
    assert.ok(decision.normalizedText.includes('multiply 200 by 2'), 'Context should be resolved into the text');
    console.log('✓ Passed');

    // Test 2: "what was the result?"
    process.stdout.write('Test 2: Conversational what was the result... ');
    context = { activeContext: useAuraStore.getState().activeContext, recentHistory: [] };
    decision = await localSemanticUnderstanding.understand('What was the result?', context);
    
    assert.strictEqual(decision.intent, 'QUESTION', 'Intent must be QUESTION');
    assert.ok(decision.chatResponse?.includes('200'), 'Must contain the actual result 200');
    console.log('✓ Passed');

    // Test 3: Ambiguous reference requires clarification
    process.stdout.write('Test 3: Ambiguous reference (stale calculation)... ');
    useAuraStore.getState().clearActiveContext(); // Empty context
    context = { activeContext: useAuraStore.getState().activeContext, recentHistory: [] };
    decision = await localSemanticUnderstanding.understand('What was the result?', context);
    
    assert.strictEqual(decision.intent, 'QUESTION', 'Intent must be QUESTION');
    assert.strictEqual(decision.clarificationNeeded, true, 'Must require clarification');
    console.log('✓ Passed');

    // Test 4: Follow-up browser search
    process.stdout.write('Test 4: Follow-up browser search... ');
    decision = await localSemanticUnderstanding.understand('Now search for Java', { activeContext: {}, recentHistory: [] });
    assert.strictEqual(decision.intent, 'WEB_SEARCH', 'Should parse as WEB_SEARCH');
    console.log('✓ Passed');

    // Test 5: Follow-up website task (What did I search for?)
    process.stdout.write('Test 5: What did I search for?... ');
    useAuraStore.getState().updateActiveContext('search', { type: 'search', value: 'Python tutorials', timestamp: Date.now() });
    context = { activeContext: useAuraStore.getState().activeContext, recentHistory: [] };
    
    decision = await localSemanticUnderstanding.understand('What did I just search for?', context);
    assert.strictEqual(decision.intent, 'QUESTION', 'Must be QUESTION');
    assert.ok(decision.chatResponse?.includes('Python tutorials'), 'Must include the recent search query');
    console.log('✓ Passed');

    // Test 6: Follow-up file reference
    process.stdout.write('Test 6: Follow-up file reference (the file)... ');
    useAuraStore.getState().updateActiveContext('file', { type: 'file', value: 'report.pdf', timestamp: Date.now() });
    context = { activeContext: useAuraStore.getState().activeContext, recentHistory: [] };

    decision = await localSemanticUnderstanding.understand('open the file', context);
    assert.strictEqual(decision.intent, 'OPEN_FILE', 'Must be OPEN_FILE intent');
    console.log('✓ Passed');

    // Test 7: AI provider context injection
    process.stdout.write('Test 7: AI provider context injection... ');
    const result = await aiAssistantBrain.respond('multiply that by 2', { 
        activeContext: { 'calculation': { type: 'calculation', value: '450', timestamp: Date.now() } },
        recentHistory: [] 
    });
    const brainDecision = aiAssistantBrain.toBrainDecision(result, 'multiply that by 2');
    assert.strictEqual(brainDecision.intent, 'CALCULATION', 'Fallback should resolve the intent properly with context');
    console.log('✓ Passed');
    
    console.log('\\n✅ All Phase 31 Tests Passed!\\n');
  } catch (error: any) {
    console.error('\\n❌ Test Failed:');
    console.error(error.message);
    process.exit(1);
  }
}

runPhase31Tests();
