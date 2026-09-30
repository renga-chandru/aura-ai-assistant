import { CommandActionType, ParsedCommand } from '../commands/types';
import { ExecutionResult } from '../execution/types';

export type TaskStepState =
  | 'PENDING'
  | 'VALIDATING'
  | 'WAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type TaskSessionState =
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING_CONFIRMATION'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface TaskStep {
  id: string;
  stepIndex: number;
  intent: CommandActionType;
  description: string;
  command: ParsedCommand;
  state: TaskStepState;
  parameters?: Record<string, unknown>;
  result?: ExecutionResult;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  requiresConfirmation: boolean;
  errorReason?: string;
  executionTimeMs?: number;
}

export interface TaskSession {
  id: string;
  originalRequest: string;
  currentStep: number;
  totalSteps: number;
  status: TaskSessionState;
  steps: TaskStep[];
  createdAt: number;
  completedAt?: number;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface StepObservation {
  success: boolean;
  action: CommandActionType;
  message: string;
  errorCode?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface RecoveryDecision {
  shouldRetry: boolean;
  shouldReplan: boolean;
  reason: string;
  maxRetriesExceeded?: boolean;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  validatedSteps?: TaskStep[];
}

export interface OrchestratorCallbacks {
  onStatusChange?: (session: TaskSession) => void;
  onStepStart?: (session: TaskSession, step: TaskStep) => void;
  onStepComplete?: (session: TaskSession, step: TaskStep, observation: StepObservation) => void;
  onStepFailed?: (session: TaskSession, step: TaskStep, observation: StepObservation) => void;
  onWaitingConfirmation?: (session: TaskSession, step: TaskStep) => void;
}
