import { ParsedCommand } from '../commands/types';

export type BrainIntentCategory =
  | 'CHAT'
  | 'QUESTION'
  | 'COMMAND'
  | 'MULTI_STEP_COMMAND'
  | 'CALCULATION'
  | 'UNKNOWN';

export interface ConversationTurn {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intent?: BrainIntentCategory;
}

export interface AssistantCapability {
  id: string;
  name: string;
  category: 'conversation' | 'apps' | 'browser' | 'files' | 'system' | 'calculation' | 'tasks';
  description: string;
}

export interface LastActionContext {
  action: string;
  target?: string;
  timestamp: number;
}

export interface ContextReference {
  type: 'file' | 'folder' | 'app' | 'url' | 'search' | 'calculation' | 'result';
  value: string;
  timestamp: number;
}

export interface BrainContext {
  recentHistory: ConversationTurn[];
  sessionCapabilities?: AssistantCapability[];
  lastAction?: LastActionContext;
  
  // Phase 31 Advanced Context
  activeContext?: Record<string, ContextReference>;
}

export interface CalculationResult {
  expression: string;
  result: number;
  formattedAnswer: string;
}

export interface BrainDecision {
  intent: BrainIntentCategory;
  rawInput: string;
  confidence: number;
  chatResponse?: string;
  calculationResult?: CalculationResult;
  singleCommand?: ParsedCommand;
  shouldSpeak: boolean;
  reasoning?: string;
}

export interface IAssistantBrain {
  process(input: string, context?: BrainContext): Promise<BrainDecision>;
  getCapabilities(): AssistantCapability[];
}
