import { CommandActionType, DesktopRiskLevel, ParsedCommand } from '../commands/types';

export type SecurityErrorCode =
  | 'UNKNOWN_ACTION'
  | 'MALFORMED_PLAN'
  | 'MALFORMED_PARAMETERS'
  | 'PROHIBITED_SHELL_COMMAND'
  | 'UNSAFE_PROTOCOL'
  | 'UNAPPROVED_APPLICATION'
  | 'UNAPPROVED_DIRECTORY'
  | 'PATH_TRAVERSAL'
  | 'PROTECTED_SYSTEM_PATH'
  | 'UNSAFE_SYMLINK'
  | 'UNSUPPORTED_SYSTEM_SETTING'
  | 'CONFIRMATION_REQUIRED'
  | 'CONFIRMATION_MISMATCH'
  | 'CONFIRMATION_EXPIRED'
  | 'CONFIRMATION_REUSED'
  | 'CONFIRMATION_INVALID'
  | 'TASK_CANCELLED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'STEP_LIMIT_EXCEEDED'
  | 'RETRY_LIMIT_EXCEEDED'
  | 'EXECUTION_ERROR';

export interface SecurityValidationResult {
  valid: boolean;
  action: CommandActionType;
  riskLevel: DesktopRiskLevel;
  requiresConfirmation: boolean;
  error?: string;
  errorCode?: SecurityErrorCode;
  sanitizedCommand?: ParsedCommand;
}

export type ConfirmationStatus = 'PENDING' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED' | 'INVALIDATED';

export interface ConfirmationBinding {
  id: string;
  taskId?: string;
  stepId?: string;
  action: CommandActionType;
  target?: string;
  destination?: string;
  query?: string;
  createdAt: number;
  expiresAt: number;
  status: ConfirmationStatus;
}

export type SecurityAuditEventType =
  | 'ACTION_VALIDATED'
  | 'ACTION_REJECTED'
  | 'CONFIRMATION_REQUESTED'
  | 'CONFIRMATION_ACCEPTED'
  | 'CONFIRMATION_REJECTED'
  | 'CONFIRMATION_EXPIRED'
  | 'CONFIRMATION_CONSUMED'
  | 'CONFIRMATION_INVALIDATED'
  | 'TASK_CANCELLED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'SECURITY_VIOLATION'
  | 'REPLAN_VALIDATED'
  | 'REPLAN_REJECTED';

export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  type: SecurityAuditEventType;
  action?: string;
  target?: string;
  taskId?: string;
  stepId?: string;
  riskLevel?: DesktopRiskLevel;
  details?: string;
  errorCode?: SecurityErrorCode;
}
