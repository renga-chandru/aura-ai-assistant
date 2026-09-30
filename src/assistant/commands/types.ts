/**
 * NOVAIR Assistant Desktop Command & Natural Language Architecture Types
 * Phase 17 Natural-Language Command Understanding
 */

export type CommandActionType =
  | 'OPEN_APP'
  | 'CLOSE_APP'
  | 'OPEN_URL'
  | 'WEB_SEARCH'
  | 'EXTRACT_INFO'
  | 'OPEN_FILE'
  | 'OPEN_FOLDER'
  | 'CREATE_FOLDER'
  | 'DELETE_FILE'
  | 'MOVE_FILE'
  | 'CREATE_FILE'
  | 'SYSTEM_SETTING'
  | 'SLEEP'
  | 'RESTART'
  | 'SHUTDOWN'
  | 'CALCULATE'
  | 'UNKNOWN';

export type DesktopActionType = CommandActionType;

export type DesktopCommandCategory = 'file' | 'app' | 'system' | 'browser';

export type DesktopRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ParsedCommand {
  type: CommandActionType;
  target?: string;
  query?: string;
  destination?: string;
  originalInput: string;
  normalizedInput: string;
  confidence: number;
  risk: DesktopRiskLevel;
  params?: Record<string, unknown>;
}

export interface DesktopCommandPayload {
  action: CommandActionType;
  target?: string;
  query?: string;
  params?: Record<string, unknown>;
}

export interface NovairCommandSchema {
  id: string;
  action: CommandActionType;
  target?: string;
  category: DesktopCommandCategory;
  riskLevel: DesktopRiskLevel;
  requiresPermission: boolean;
  params?: Record<string, unknown>;
}

export interface NovairCommandIntent {
  intentId: string;
  rawUserInput: string;
  matchedCommand?: NovairCommandSchema;
  parsedCommand: ParsedCommand;
  confidence: number;
  extractedParameters: Record<string, unknown>;
}
