import { ParsedCommand } from '@/assistant/commands/types';

export type CommandHistoryStatus = 'SUCCESS' | 'THINKING' | 'ERROR';

export interface HistoryItem {
  id: string;
  timestamp: string; // Format: HH:mm:ss (local time)
  command: string;
  parsedCommand?: ParsedCommand;
  response?: string;
  status: CommandHistoryStatus;
  durationMs?: number;
}
