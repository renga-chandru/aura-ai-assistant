import {
  IAssistantBrain,
  BrainDecision,
  BrainContext,
  AssistantCapability,
} from './types';
import { SafeCalculator } from './SafeCalculator';
import { localTaskPlanner } from '../planner/LocalTaskPlanner';
import { localCommandParser } from '../commands/parser';
import { localSemanticUnderstanding, ConversationIntent } from '../understanding';

export const AURA_CAPABILITIES: AssistantCapability[] = [
  {
    id: 'conversation',
    name: 'Conversational Dialogue',
    category: 'conversation',
    description: 'Natural voice and text conversation with female voice synthesis.',
  },
  {
    id: 'apps',
    name: 'macOS Application Control',
    category: 'apps',
    description: 'Open and close allowlisted macOS applications.',
  },
  {
    id: 'browser',
    name: 'Web Navigation & Search',
    category: 'browser',
    description: 'Open allowlisted websites and perform web searches.',
  },
  {
    id: 'files',
    name: 'File & Folder Management',
    category: 'files',
    description: 'Access approved user folders, open files, create files, and move files safely.',
  },
  {
    id: 'system',
    name: 'System Audio Controls',
    category: 'system',
    description: 'Control volume up/down, mute, and unmute with confirmation for power states.',
  },
  {
    id: 'calculation',
    name: 'Arithmetic Calculations',
    category: 'calculation',
    description: 'Safe arithmetic and percentage calculations without arbitrary code execution.',
  },
  {
    id: 'tasks',
    name: 'Multi-Step Task Execution',
    category: 'tasks',
    description: 'Decompose and execute compound requests sequentially.',
  },
];
export const NOVAIR_CAPABILITIES = AURA_CAPABILITIES;

export class LocalConversationBrain implements IAssistantBrain {
  public getCapabilities(): AssistantCapability[] {
    return AURA_CAPABILITIES;
  }

  public async process(rawInput: string, context?: BrainContext): Promise<BrainDecision> {
    const input = rawInput.trim();
    if (!input) {
      return {
        intent: 'CHAT',
        rawInput,
        confidence: 1.0,
        chatResponse: 'Hello! I’m AURA. How can I help you today?',
        shouldSpeak: true,
      };
    }

    // Pass through Semantic Natural Language Understanding Engine (Phase 24)
    const understanding = await localSemanticUnderstanding.understand(input, context);

    // 1. Ambiguity / Incomplete Request Handling (Clarification Question)
    if (understanding.mode === 'ambiguous') {
      return {
        intent: 'QUESTION',
        rawInput: input,
        confidence: understanding.confidence,
        chatResponse: understanding.clarificationQuestion || 'What would you like me to do?',
        shouldSpeak: true,
      };
    }

    // 2. Conversational Intent Handling (GREETING, CASUAL_CHECKIN, IDENTITY, CAPABILITIES, THANKS, GOODBYE, QUESTION)
    if (understanding.mode === 'conversation') {
      const responseText = understanding.chatResponse || this.generateConversationalResponse(
        understanding.intent as ConversationIntent,
        input
      );
      const isQuestion =
        understanding.intent === 'IDENTITY' || understanding.intent === 'CAPABILITIES';
      return {
        intent: isQuestion ? 'QUESTION' : 'CHAT',
        rawInput: input,
        confidence: understanding.confidence,
        chatResponse: responseText,
        shouldSpeak: true,
      };
    }

    // 3. Calculation Intent Handling
    if (understanding.mode === 'action' && understanding.intent === 'CALCULATE') {
      const expr = understanding.entities.mathExpression || input;
      const calcResult = SafeCalculator.calculate(expr) || SafeCalculator.calculate(input);
      if (calcResult) {
        return {
          intent: 'CALCULATION',
          rawInput: input,
          confidence: understanding.confidence,
          chatResponse: calcResult.formattedAnswer,
          calculationResult: calcResult,
          shouldSpeak: true,
        };
      }
    }

    // 4. Multi-Step Intent Handling
    if (understanding.mode === 'multi_action') {
      return {
        intent: 'MULTI_STEP_COMMAND',
        rawInput: input,
        confidence: understanding.confidence,
        shouldSpeak: true,
      };
    }

    if (localTaskPlanner.isMultiStepIntent(input)) {
      const plan = localTaskPlanner.plan(input);
      if (plan && plan.steps.length >= 2) {
        return {
          intent: 'MULTI_STEP_COMMAND',
          rawInput: input,
          confidence: 0.95,
          shouldSpeak: true,
        };
      }
    }

    // 5. Single Computer Action Handling
    if (understanding.mode === 'action' && understanding.actions.length > 0) {
      const action = understanding.actions[0];
      if (action.parsedCommand && action.parsedCommand.type !== 'UNKNOWN') {
        return {
          intent: 'COMMAND',
          rawInput: input,
          confidence: action.confidence,
          singleCommand: action.parsedCommand,
          shouldSpeak: true,
        };
      }
    }

    // 6. Direct Command Parser Fallback for backwards compatibility
    const parsedCommand = localCommandParser.parse(input);
    if (parsedCommand.type !== 'UNKNOWN') {
      return {
        intent: 'COMMAND',
        rawInput: input,
        confidence: parsedCommand.confidence,
        singleCommand: parsedCommand,
        shouldSpeak: true,
      };
    }

    // 7. Conversational Fallback
    return {
      intent: 'UNKNOWN',
      rawInput: input,
      confidence: 0.2,
      chatResponse: "I'm not sure how to do that yet.",
      shouldSpeak: true,
    };
  }

  /**
   * Generates natural conversational responses driven by intent and context
   */
  private generateConversationalResponse(intent: ConversationIntent, input: string): string {
    const lower = input.toLowerCase();

    switch (intent) {
      case 'GREETING': {
        if (lower.includes('good morning')) return 'Good morning! How can I help you today?';
        if (lower.includes('good afternoon')) return 'Good afternoon! How can I help you today?';
        if (lower.includes('good evening')) return 'Good evening! What would you like to do?';
        if (lower.includes('good to see you')) return 'Good to see you too! How can I help you today?';
        if (lower.includes('hello')) return "Hello! I'm AURA. What would you like me to do?";
        if (lower.includes('hey')) return "Hey! I'm here. What can I help you with?";
        return 'Hey! Welcome back. How can I help?';
      }

      case 'CASUAL_CHECKIN': {
        return "I'm doing great and ready to help.";
      }

      case 'IDENTITY': {
        return "I'm AURA, your personal desktop AI assistant.";
      }

      case 'CAPABILITIES': {
        return 'I can talk with you, understand voice and text, open supported apps, search the web, work with approved files, perform calculations, and handle supported desktop tasks.';
      }

      case 'THANKS': {
        if (lower.includes('thank you so much') || lower.includes('appreciate')) {
          return "You're welcome. I'm here if you need anything.";
        }
        return "You're welcome!";
      }

      case 'GOODBYE': {
        return 'See you later!';
      }

      case 'GENERAL_CONVERSATION':
      case 'UNKNOWN_CONVERSATION':
      default:
        return "I'm here and ready to help. What would you like to do?";
    }
  }
}

export const localConversationBrain = new LocalConversationBrain();
export const conversationBrain = localConversationBrain;
