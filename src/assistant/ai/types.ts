/**
 * AURA AI Brain Subsystem Types (Phase 25)
 *
 * Defines contracts for AI providers, structured responses, action schemas,
 * and AI brain interfaces.
 */

import { BrainContext, BrainDecision } from '../brain/types';
import { ParsedCommand } from '../commands/types';

export type AIResultType =
  | 'conversation'
  | 'explanation'
  | 'action_request'
  | 'multi_action_request'
  | 'clarification'
  | 'calculation'
  | 'unknown';

export const SUPPORTED_ACTION_INTENTS = [
  'OPEN_APP',
  'CLOSE_APP',
  'OPEN_URL',
  'WEB_SEARCH',
  'OPEN_FILE',
  'OPEN_FOLDER',
  'DELETE_FILE',
  'MOVE_FILE',
  'CREATE_FILE',
  'SYSTEM_SETTING',
  'CALCULATE',
  'SLEEP',
  'RESTART',
  'SHUTDOWN',
] as const;

export type SupportedActionIntent = (typeof SUPPORTED_ACTION_INTENTS)[number];

export interface AIAction {
  intent: string;
  app?: string;
  query?: string;
  url?: string;
  folder?: string;
  file?: string;
  destination?: string;
  setting?: string;
  expression?: string;
  rawTarget?: string;
}

export interface AssistantAIResult {
  type: AIResultType;
  message: string;
  actions?: AIAction[];
  parsedCommands?: ParsedCommand[];
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
  confidence: number;
  providerUsed?: string;
  modelUsed?: string;
  error?: string;
  fallbackUsed?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProviderRequest {
  prompt: string;
  systemPrompt?: string;
  contextHistory?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface AIProviderResponse {
  success: boolean;
  content?: string;
  rawStructured?: AssistantAIResult;
  error?: string;
  provider: string;
  model: string;
  durationMs?: number;
}

export interface IAIProvider {
  readonly name: string;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
  isAvailable(): Promise<boolean>;
}

export interface IAIAssistantBrain {
  respond(input: string, context?: BrainContext): Promise<AssistantAIResult>;
  toBrainDecision(aiResult: AssistantAIResult, rawInput: string): BrainDecision;
}
