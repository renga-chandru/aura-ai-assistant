import { CommandActionType } from '../commands/types';

export type ExecutionStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'WAITING_CONFIRMATION'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'VALIDATION_FAILED'
  | 'TEMPORARY_FAILURE'
  | 'PARTIAL_SUCCESS';

export interface StandardExecutionResult {
  success: boolean;
  status: ExecutionStatus;
  action: CommandActionType;
  message: string;
  userMessage?: string;
  errorCode?: string;
  retryable?: boolean;
  requiresConfirmation?: boolean;
  taskId?: string;
  stepId?: string;
  target?: string;
  destination?: string;
  query?: string;
  executionTimeMs?: number;
  completedSteps?: number;
  totalSteps?: number;
  data?: Record<string, unknown>;
}

/**
 * Creates a standardized execution result with deterministic status and safe messaging
 */
export function createExecutionResult(
  params: Partial<StandardExecutionResult> & {
    success: boolean;
    action: CommandActionType;
    message: string;
  }
): StandardExecutionResult {
  let status = params.status;
  if (!status) {
    if (params.success) {
      status = 'SUCCESS';
    } else if (params.requiresConfirmation || params.errorCode === 'CONFIRMATION_REQUIRED') {
      status = 'WAITING_CONFIRMATION';
    } else if (params.errorCode === 'STEP_TIMEOUT' || params.errorCode === 'TIMEOUT') {
      status = 'TIMEOUT';
    } else if (
      params.errorCode === 'PERMISSION_DENIED' ||
      params.errorCode === 'FILE_PERMISSION_DENIED' ||
      params.errorCode === 'ACCESS_DENIED'
    ) {
      status = 'PERMISSION_DENIED';
    } else if (
      params.errorCode === 'UNSUPPORTED_ACTION' ||
      params.errorCode === 'UNSUPPORTED_INTENT' ||
      params.errorCode === 'APP_NOT_SUPPORTED' ||
      params.errorCode === 'UNSUPPORTED_SETTING'
    ) {
      status = 'UNSUPPORTED';
    } else if (
      params.errorCode === 'SECURITY_VIOLATION' ||
      params.errorCode === 'PROHIBITED_SHELL_COMMAND' ||
      params.errorCode === 'MALFORMED_PARAMETERS' ||
      params.errorCode === 'UNKNOWN_ACTION' ||
      params.errorCode === 'VALIDATION_FAILED'
    ) {
      status = 'VALIDATION_FAILED';
    } else if (params.errorCode === 'NETWORK_ERROR' || params.errorCode === 'BRIDGE_UNAVAILABLE') {
      status = 'TEMPORARY_FAILURE';
    } else {
      status = 'FAILED';
    }
  }

  return {
    success: params.success,
    status,
    action: params.action,
    message: params.message,
    userMessage: params.userMessage,
    errorCode: params.errorCode,
    retryable: params.retryable ?? (status === 'TEMPORARY_FAILURE'),
    requiresConfirmation: params.requiresConfirmation,
    taskId: params.taskId,
    stepId: params.stepId,
    target: params.target,
    destination: params.destination,
    query: params.query,
    executionTimeMs: params.executionTimeMs,
    completedSteps: params.completedSteps,
    totalSteps: params.totalSteps,
    data: params.data,
  };
}
