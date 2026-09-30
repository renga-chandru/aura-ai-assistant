/**
 * AURA Semantic Natural Language Understanding Types (Phase 24)
 *
 * Defines the structured contract between raw user voice/text input
 * and the assistant's conversation, planning, and execution layers.
 */

import { BrainContext } from '../brain/types';
import { ParsedCommand } from '../commands/types';

export type UnderstandingMode =
  | 'conversation'
  | 'action'
  | 'multi_action'
  | 'ambiguous'
  | 'unknown';

export type ConversationIntent =
  | 'GREETING'
  | 'CASUAL_CHECKIN'
  | 'THANKS'
  | 'IDENTITY'
  | 'CAPABILITIES'
  | 'GOODBYE'
  | 'QUESTION'
  | 'GENERAL_CONVERSATION'
  | 'UNKNOWN_CONVERSATION';

export type ComputerIntent =
  | 'OPEN_APP'
  | 'CLOSE_APP'
  | 'OPEN_URL'
  | 'WEB_SEARCH'
  | 'OPEN_FILE'
  | 'OPEN_FOLDER'
  | 'DELETE_FILE'
  | 'MOVE_FILE'
  | 'CREATE_FILE'
  | 'SYSTEM_SETTING'
  | 'CALCULATE'
  | 'SLEEP'
  | 'RESTART'
  | 'SHUTDOWN'
  | 'MULTI_STEP'
  | 'UNKNOWN_ACTION';

export type UnderstandingIntent = ConversationIntent | ComputerIntent;

export interface ExtractedEntities {
  appName?: string;
  query?: string;
  url?: string;
  filename?: string;
  folderName?: string;
  destination?: string;
  systemSetting?: string;
  settingValue?: string | number | boolean;
  mathExpression?: string;
  rawTarget?: string;
}

export interface StructuredAction {
  intent: ComputerIntent;
  entities: ExtractedEntities;
  confidence: number;
  parsedCommand?: ParsedCommand;
  rawSegment?: string;
}

export interface UnderstandingResult {
  mode: UnderstandingMode;
  intent: UnderstandingIntent;
  confidence: number;
  entities: ExtractedEntities;
  actions: StructuredAction[];
  originalText: string;
  normalizedText: string;
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
  chatResponse?: string;
}

/**
 * Clean Interface for Assistant Natural Language Understanding
 * Enables drop-in replacement by future LLMUnderstandingProvider without UI or executor rewrites.
 */
export interface IAssistantUnderstanding {
  understand(input: string, context?: BrainContext): Promise<UnderstandingResult>;
}
