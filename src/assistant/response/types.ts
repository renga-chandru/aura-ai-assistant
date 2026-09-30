import { CommandActionType } from '../commands/types';
import { BrainIntentCategory } from '../brain/types';

export type ResponseCategory =
  | 'SUCCESS'
  | 'FAILURE'
  | 'AMBIGUOUS'
  | 'SECURITY_BLOCK'
  | 'UNSUPPORTED'
  | 'CONFIRMATION'
  | 'CANCELLED'
  | 'CHAT'
  | 'CALCULATION'
  | 'TASK';

export interface TaskProgressInfo {
  currentStep: number;
  totalSteps: number;
  statusText: string;
}

export interface AssistantResponse {
  type?: 'chat' | 'action' | 'task' | 'calculation';
  text: string;
  spokenText: string;
  category: ResponseCategory;
  intent?: BrainIntentCategory;
  action?: CommandActionType;
  target?: string;
  shouldSpeak: boolean;
  speak?: boolean;
  requiresConfirmation?: boolean;
  taskProgress?: TaskProgressInfo;
}
