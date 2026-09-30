/**
 * AURA AI Assistant Brain (Phase 25)
 *
 * Orchestrates LLM interaction, bounded conversation context, schema validation,
 * and seamless fallback to Phase 24 local understanding when offline.
 */

import {
  IAIAssistantBrain,
  IAIProvider,
  AssistantAIResult,
  AIAction,
  SUPPORTED_ACTION_INTENTS,
  SupportedActionIntent,
  ChatMessage,
} from './types';
import { BrainContext, BrainDecision, BrainIntentCategory } from '../brain/types';
import { ParsedCommand, CommandActionType } from '../commands/types';
import { getCommandRiskLevel } from '../commands/parser';
import { AURA_SYSTEM_PROMPT } from './systemPrompt';
import { LocalBridgeProvider } from './providers/LocalBridgeProvider';
import { localConversationBrain } from '../brain/LocalConversationBrain';
import { SafeCalculator } from '../brain/SafeCalculator';

export class AIAssistantBrain implements IAIAssistantBrain {
  private provider: IAIProvider;
  private fallbackBrain = localConversationBrain;
  private readonly maxContextTurns = 6;

  constructor(provider?: IAIProvider) {
    // Default to LocalBridgeProvider; can be swapped dynamically or in tests
    this.provider = provider || new LocalBridgeProvider();
  }

  public setProvider(provider: IAIProvider): void {
    this.provider = provider;
  }

  public getProvider(): IAIProvider {
    return this.provider;
  }

  /**
   * Main entry point: queries AI brain with bounded context and validation
   */
  public async respond(input: string, context?: BrainContext): Promise<AssistantAIResult> {
    const raw = input.trim();
    if (!raw) {
      return {
        type: 'conversation',
        message: 'I am here. How can I assist you?',
        confidence: 1.0,
      };
    }

    // 1. Prepare bounded context history
    const contextHistory: ChatMessage[] = [];
    if (context?.recentHistory && context.recentHistory.length > 0) {
      const recent = context.recentHistory.slice(-this.maxContextTurns);
      for (const turn of recent) {
        contextHistory.push({
          role: turn.sender === 'user' ? 'user' : 'assistant',
          content: turn.text,
        });
      }
    }

    // 2. Generate response via configured AI provider
    try {
      let finalPrompt = raw;
      
      // Phase 31 Advanced Context Injection
      if (context?.activeContext && Object.keys(context.activeContext).length > 0) {
        let ctxStr = '\\n\\n[SYSTEM CONTEXT: The user is currently in a session with the following recent active context. Use this if the user uses pronouns like "it", "that", "there", "the result" or implies a follow-up action.]\\n';
        for (const [key, ref] of Object.entries(context.activeContext)) {
           ctxStr += `- Current ${key}: ${ref.value}\\n`;
        }
        finalPrompt += ctxStr;
      }

      const providerResp = await this.provider.generate({
        prompt: finalPrompt,
        systemPrompt: AURA_SYSTEM_PROMPT,
        contextHistory,
        temperature: 0.3,
        maxTokens: 500,
        timeoutMs: 10000,
      });

      if (!providerResp.success || !providerResp.content) {
        // Fall back gracefully to local brain
        return await this.fallbackToLocal(raw, context, providerResp.error || 'AI Provider unavailable');
      }

      // 3. Parse and validate structured output
      const parsed = this.parseAndValidate(providerResp.content, raw);
      if (!parsed) {
        return await this.fallbackToLocal(raw, context, 'Malformed response from AI provider');
      }

      // If provider returned a generic conversational fallback message,
      // verify whether local brain can resolve it into an actionable command or calculation
      if (
        parsed.type === 'conversation' &&
        (parsed.message.includes("I'm here to help you with that or assist with your Mac whenever you need") ||
          parsed.message === "I understand.")
      ) {
        const localDecision = await this.fallbackBrain.process(raw, context);
        if (
          localDecision.intent === 'COMMAND' ||
          localDecision.intent === 'MULTI_STEP_COMMAND' ||
          localDecision.intent === 'CALCULATION'
        ) {
          return await this.fallbackToLocal(raw, context, 'Provider returned generic fallback for executable command');
        }
      }

      parsed.providerUsed = providerResp.provider;
      parsed.modelUsed = providerResp.model;
      return parsed;
    } catch {
      // Graceful fallback on unexpected error
      return await this.fallbackToLocal(raw, context, 'AI service connection error');
    }
  }

  /**
   * Safely parses JSON output from LLM and strictly validates proposed action schema
   */
  private parseAndValidate(rawContent: string, originalInput: string): AssistantAIResult | null {
    let cleanJson = rawContent.trim();

    // Strip markdown code fences if present (```json ... ```)
    const codeBlockMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      cleanJson = codeBlockMatch[1].trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // If LLM returned raw plain text instead of JSON, treat as natural conversation
      if (!cleanJson.startsWith('{') && cleanJson.length > 0) {
        return {
          type: 'conversation',
          message: cleanJson,
          confidence: 0.85,
        };
      }
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    // Validate type field
    const validTypes = ['conversation', 'explanation', 'action_request', 'multi_action_request', 'clarification', 'calculation', 'unknown'];
    const type = validTypes.includes(parsed.type) ? parsed.type : 'conversation';
    const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';

    // Handle Clarification
    if (type === 'clarification' || parsed.clarificationNeeded) {
      return {
        type: 'clarification',
        message: message || parsed.clarificationQuestion || 'Could you please clarify what you would like me to do?',
        clarificationNeeded: true,
        clarificationQuestion: parsed.clarificationQuestion || message,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      };
    }

    // Validate actions array if present
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
      const validatedActions: AIAction[] = [];
      const parsedCommands: ParsedCommand[] = [];

      for (const act of parsed.actions) {
        if (!act || typeof act !== 'object' || typeof act.intent !== 'string') {
          // Reject malformed action
          return {
            type: 'conversation',
            message: 'I cannot execute that action because the request was formatted improperly.',
            confidence: 0.1,
            error: 'Malformed action payload',
          };
        }

        const intentUpper = act.intent.toUpperCase().trim();

        // STRICT SCHEMA CHECK: Must be in SUPPORTED_ACTION_INTENTS
        if (!SUPPORTED_ACTION_INTENTS.includes(intentUpper as SupportedActionIntent)) {
          // Reject unsupported action attempt immediately
          return {
            type: 'conversation',
            message: `I cannot execute unsupported action "${act.intent}". Only allowlisted system commands are permitted.`,
            confidence: 0.1,
            error: `Unsupported action intent: ${act.intent}`,
          };
        }

        validatedActions.push({
          intent: intentUpper,
          app: act.app,
          query: act.query,
          url: act.url,
          folder: act.folder,
          file: act.file,
          destination: act.destination,
          setting: act.setting,
          expression: act.expression,
          rawTarget: act.rawTarget,
        });

        // Convert to typed ParsedCommand for existing executors
        const cmd = this.toParsedCommand(intentUpper as SupportedActionIntent, act, originalInput);
        if (cmd) {
          parsedCommands.push(cmd);
        }
      }

      return {
        type: validatedActions.length > 1 ? 'multi_action_request' : 'action_request',
        message: message || `Processing ${validatedActions.length} requested action(s).`,
        actions: validatedActions,
        parsedCommands,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
      };
    }

    return {
      type,
      message: message || 'Understood.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
    };
  }

  /**
   * Safely maps validated AI action into standard ParsedCommand
   */
  private toParsedCommand(intent: SupportedActionIntent, act: any, rawInput: string): ParsedCommand | null {
    const originalInput = rawInput;
    const normalizedInput = rawInput.toLowerCase();
    const risk = getCommandRiskLevel(intent as CommandActionType);

    switch (intent) {
      case 'CALCULATE':
        return {
          type: 'CALCULATE',
          target: act.expression || act.rawTarget || act.query || '',
          query: act.expression || act.rawTarget || act.query || '',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk: 'LOW',
        };
      case 'OPEN_APP':
        return {
          type: 'OPEN_APP',
          target: act.app || act.rawTarget || 'Google Chrome',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'CLOSE_APP':
        return {
          type: 'CLOSE_APP',
          target: act.app || act.rawTarget || '',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'OPEN_URL':
        return {
          type: 'OPEN_URL',
          target: act.url || act.rawTarget || '',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'WEB_SEARCH':
        return {
          type: 'WEB_SEARCH',
          target: act.query || act.rawTarget || '',
          query: act.query || act.rawTarget || '',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'OPEN_FOLDER':
        return {
          type: 'OPEN_FOLDER',
          target: act.folder || act.rawTarget || 'Downloads',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'OPEN_FILE':
        return {
          type: 'OPEN_FILE',
          target: act.file || act.rawTarget || '',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'CREATE_FILE':
        return {
          type: 'CREATE_FILE',
          target: act.file || act.rawTarget || '',
          destination: act.destination || 'Documents',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'MOVE_FILE':
        return {
          type: 'MOVE_FILE',
          target: act.file || act.rawTarget || '',
          destination: act.destination || 'Documents',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'DELETE_FILE':
        return {
          type: 'DELETE_FILE',
          target: act.file || act.rawTarget || '',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'SYSTEM_SETTING':
        return {
          type: 'SYSTEM_SETTING',
          target: act.setting || act.rawTarget || 'volume_up',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'SLEEP':
        return {
          type: 'SLEEP',
          target: 'System',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'RESTART':
        return {
          type: 'RESTART',
          target: 'System',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      case 'SHUTDOWN':
        return {
          type: 'SHUTDOWN',
          target: 'System',
          originalInput,
          normalizedInput,
          confidence: 0.95,
          risk,
        };
      default:
        return null;
    }
  }

  /**
   * Seamless fallback to Phase 24 LocalConversationBrain + LocalSemanticUnderstanding
   */
  private async fallbackToLocal(input: string, context?: BrainContext, reason?: string): Promise<AssistantAIResult> {
    const localDecision = await this.fallbackBrain.process(input, context);

    if (localDecision.intent === 'CALCULATION' && localDecision.calculationResult) {
      return {
        type: 'calculation',
        message: localDecision.calculationResult.formattedAnswer,
        confidence: 0.95,
        fallbackUsed: true,
      };
    }

    if (localDecision.intent === 'COMMAND' && localDecision.singleCommand) {
      return {
        type: 'action_request',
        message: localDecision.chatResponse || `Executing ${localDecision.singleCommand.type}.`,
        parsedCommands: [localDecision.singleCommand],
        actions: [{ intent: localDecision.singleCommand.type, rawTarget: localDecision.singleCommand.target }],
        confidence: localDecision.confidence,
        fallbackUsed: true,
      };
    }

    if (localDecision.intent === 'MULTI_STEP_COMMAND') {
      return {
        type: 'multi_action_request',
        message: localDecision.chatResponse || 'Processing multi-step plan.',
        confidence: localDecision.confidence,
        fallbackUsed: true,
      };
    }

    return {
      type: 'conversation',
      message: localDecision.chatResponse || "I'm here. How can I assist you?",
      confidence: localDecision.confidence,
      fallbackUsed: true,
      error: reason,
    };
  }

  /**
   * Adapts AssistantAIResult to BrainDecision for useAuraStore
   */
  public toBrainDecision(aiResult: AssistantAIResult, rawInput: string): BrainDecision {
    if (aiResult.type === 'action_request' && aiResult.parsedCommands && aiResult.parsedCommands.length > 0) {
      return {
        intent: 'COMMAND',
        rawInput,
        confidence: aiResult.confidence,
        singleCommand: aiResult.parsedCommands[0],
        chatResponse: aiResult.message,
        shouldSpeak: true,
        reasoning: 'AI Brain structured single command',
      };
    }

    if (aiResult.type === 'multi_action_request') {
      return {
        intent: 'MULTI_STEP_COMMAND',
        rawInput,
        confidence: aiResult.confidence,
        chatResponse: aiResult.message,
        shouldSpeak: true,
        reasoning: 'AI Brain multi-step command request',
      };
    }

    if (aiResult.type === 'calculation') {
      const calcResult = SafeCalculator.calculate(rawInput);
      return {
        intent: 'CALCULATION',
        rawInput,
        confidence: aiResult.confidence,
        calculationResult: calcResult || undefined,
        chatResponse: aiResult.message,
        shouldSpeak: true,
      };
    }

    // Default to CHAT or QUESTION
    const isQuestion = rawInput.trim().endsWith('?') || aiResult.type === 'explanation';
    const intentCategory: BrainIntentCategory = isQuestion ? 'QUESTION' : 'CHAT';

    return {
      intent: intentCategory,
      rawInput,
      confidence: aiResult.confidence,
      chatResponse: aiResult.message,
      shouldSpeak: true,
      reasoning: `AI Brain ${aiResult.type}`,
    };
  }
}

export const aiAssistantBrain = new AIAssistantBrain();
