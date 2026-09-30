import { CommandActionType, DesktopRiskLevel, ParsedCommand } from '../commands/types';
import {
  SecurityValidationResult,
  ConfirmationBinding,
  SecurityAuditEvent,
  SecurityAuditEventType,
  SecurityErrorCode,
} from './types';
import { resolveApp } from '../execution/appRegistry';
import { validateAndNormalizeUrl } from '../execution/BrowserExecutor';
import {
  resolveApprovedDirectory,
  validatePathSecurity,
  validateSafeFileName,
} from '../execution/FilePathResolver';
import { resolveSystemSetting } from '../execution/systemActionRegistry';

export const MAX_PLAN_STEPS = 10;
export const CONFIRMATION_TTL_MS = 60000; // 60 seconds

export const APPROVED_ACTIONS: CommandActionType[] = [
  'OPEN_APP',
  'CLOSE_APP',
  'OPEN_URL',
  'WEB_SEARCH',
  'EXTRACT_INFO',
  'OPEN_FILE',
  'OPEN_FOLDER',
  'CREATE_FOLDER',
  'DELETE_FILE',
  'MOVE_FILE',
  'CREATE_FILE',
  'SYSTEM_SETTING',
  'SLEEP',
  'RESTART',
  'SHUTDOWN',
  'CALCULATE',
];

const PROHIBITED_SHELL_PATTERNS: RegExp[] = [
  /\bsudo\b/i,
  /\bbash\b/i,
  /\bzsh\b/i,
  /\bsh\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\brm\b/i,
  /\bkill\b/i,
  /\bkillall\b/i,
  /\blaunchctl\b/i,
  /\bdefaults\b/i,
  /\bosascript\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bpython\s+-c\b/i,
  /\bnode\s+-e\b/i,
  /\beval\b/i,
  /\bbase64\b/i,
  /\/bin\//i,
  /\/usr\/bin\//i,
  /\/usr\/local\/bin\//i,
  /\/sbin\//i,
  /\/etc\//i,
  /\/dev\//i,
  /\/private\//i,
  /\/System\//i,
  /\bexec\b/i,
  /\bnc\b/i,
];

const PROHIBITED_METACHARACTERS: RegExp[] = [
  />>/,
  /[>|;&]/,
  /\$\(/,
  /`/,
  /[\r\n]/,
];

export class SecurityGate {
  private confirmations: Map<string, ConfirmationBinding> = new Map();
  private auditLogs: SecurityAuditEvent[] = [];

  /**
   * Deterministically calculates the authoritative risk level for an action.
   * Neither AI output nor frontend parameters can downgrade a risk level.
   */
  public calculateDeterministicRisk(
    action: CommandActionType,
    rawInput?: string,
    _params?: Record<string, unknown>
  ): DesktopRiskLevel {
    // If prohibited shell command patterns are present, classify as HIGH risk
    if (rawInput && this.containsProhibitedPatterns(rawInput)) {
      return 'HIGH';
    }

    switch (action) {
      case 'DELETE_FILE':
      case 'SLEEP':
      case 'RESTART':
      case 'SHUTDOWN':
        return 'HIGH';

      case 'CLOSE_APP':
      case 'MOVE_FILE':
      case 'CREATE_FILE':
      case 'CREATE_FOLDER':
      case 'SYSTEM_SETTING':
        return 'MEDIUM';

      case 'OPEN_APP':
      case 'OPEN_URL':
      case 'WEB_SEARCH':
      case 'EXTRACT_INFO':
      case 'OPEN_FILE':
      case 'OPEN_FOLDER':
      case 'CALCULATE':
        return 'LOW';

      case 'UNKNOWN':
      default:
        return 'LOW';
    }
  }

  /**
   * Authoritative validation gate for a single parsed action.
   * Every action must pass through this gate before reaching any executor.
   */
  public validateAction(
    command: ParsedCommand,
    context?: {
      taskId?: string;
      stepId?: string;
      confirmationToken?: string;
      isConfirmed?: boolean;
    }
  ): SecurityValidationResult {
    // 1. Check for missing or malformed command object
    if (!command || typeof command !== 'object') {
      this.logAudit('ACTION_REJECTED', {
        details: 'Command object is null or undefined.',
        errorCode: 'MALFORMED_PLAN',
      });
      return {
        valid: false,
        action: 'UNKNOWN',
        riskLevel: 'HIGH',
        requiresConfirmation: false,
        error: 'Malformed command structure: Command object is required.',
        errorCode: 'MALFORMED_PLAN',
      };
    }

    // 2. Validate action type
    const action = command.type;
    if (!action || !APPROVED_ACTIONS.includes(action) || action === 'UNKNOWN') {
      this.logAudit('ACTION_REJECTED', {
        action: String(action),
        target: command.target,
        details: `Unknown or unapproved action type "${String(action)}".`,
        errorCode: 'UNKNOWN_ACTION',
      });
      return {
        valid: false,
        action: 'UNKNOWN',
        riskLevel: 'HIGH',
        requiresConfirmation: false,
        error: `Action "${String(action)}" is not recognized or permitted.`,
        errorCode: 'UNKNOWN_ACTION',
      };
    }

    // 3. Check for shell injection & dangerous metacharacters in all string fields
    const allInputStrings = [
      command.originalInput,
      command.normalizedInput,
      command.target,
      command.query,
      command.destination,
      JSON.stringify(command.params || {}),
    ]
      .filter((s): s is string => typeof s === 'string')
      .join(' ');

    if (this.containsProhibitedPatterns(allInputStrings)) {
      this.logAudit('SECURITY_VIOLATION', {
        action,
        target: command.target,
        details: 'Prohibited shell command sequence or metacharacters detected.',
        errorCode: 'PROHIBITED_SHELL_COMMAND',
      });
      return {
        valid: false,
        action,
        riskLevel: 'HIGH',
        requiresConfirmation: false,
        error: 'Security violation: Prohibited shell command sequence or executable path detected.',
        errorCode: 'PROHIBITED_SHELL_COMMAND',
      };
    }

    // 4. Calculate authoritative deterministic risk
    const authoritativeRisk = this.calculateDeterministicRisk(action, allInputStrings, command.params);
    const requiresConfirmation = authoritativeRisk === 'HIGH';

    // 5. Domain-specific validation
    switch (action) {
      case 'OPEN_APP':
      case 'CLOSE_APP': {
        const rawTarget = command.target?.trim();
        if (!rawTarget) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Target application name is required.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        // Prohibit arbitrary executable extensions or paths
        if (/\.(sh|exe|bat|py|rb|pl|bin|app)$/i.test(rawTarget) || rawTarget.includes('/') || rawTarget.includes('\\')) {
          this.logAudit('ACTION_REJECTED', {
            action,
            target: rawTarget,
            details: 'Arbitrary executable path was specified for application control.',
            errorCode: 'UNAPPROVED_APPLICATION',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation,
            error: `Arbitrary executable path execution ("${rawTarget}") is strictly prohibited. Only allowlisted applications are supported.`,
            errorCode: 'UNAPPROVED_APPLICATION',
          };
        }

        const appEntry = resolveApp(rawTarget);
        if (!appEntry) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Application "${rawTarget}" is not in the approved application registry.`,
            errorCode: 'UNAPPROVED_APPLICATION',
          };
        }

        if (!appEntry.allowedActions.includes(action)) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Action "${action}" is not permitted for application "${appEntry.canonicalName}".`,
            errorCode: 'UNAPPROVED_APPLICATION',
          };
        }
        break;
      }

      case 'OPEN_URL': {
        const rawUrl = command.target || command.query || command.originalInput;
        if (!rawUrl || !rawUrl.trim()) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Target URL is required for OPEN_URL.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const urlValidation = validateAndNormalizeUrl(rawUrl);
        if (!urlValidation.valid || !urlValidation.normalizedUrl) {
          this.logAudit('ACTION_REJECTED', {
            action,
            target: rawUrl,
            details: urlValidation.error || 'Invalid or dangerous URL.',
            errorCode: 'UNSAFE_PROTOCOL',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation,
            error: `URL Security Violation: ${urlValidation.error || 'Invalid URL protocol.'}`,
            errorCode: 'UNSAFE_PROTOCOL',
          };
        }
        break;
      }

      case 'WEB_SEARCH': {
        const rawQuery = command.query || command.target;
        if (!rawQuery || !rawQuery.trim()) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Search query is required for WEB_SEARCH.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }
        break;
      }

      case 'OPEN_FOLDER': {
        const rawFolder = command.target?.trim();
        if (!rawFolder) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Target folder name is required for OPEN_FOLDER.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const pathSec = validatePathSecurity(rawFolder);
        if (!pathSec.safe) {
          this.logAudit('SECURITY_VIOLATION', {
            action,
            target: rawFolder,
            details: pathSec.reason,
            errorCode: 'PATH_TRAVERSAL',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation,
            error: `Folder security violation: ${pathSec.reason}`,
            errorCode: 'PATH_TRAVERSAL',
          };
        }

        const resolvedDir = resolveApprovedDirectory(rawFolder);
        if (!resolvedDir) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Directory "${rawFolder}" is not an approved user directory. Only Desktop, Documents, Downloads, Pictures, Movies, and Music are permitted.`,
            errorCode: 'UNAPPROVED_DIRECTORY',
          };
        }
        break;
      }

      case 'OPEN_FILE': {
        const rawFile = command.target?.trim();
        if (!rawFile) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Target file name is required for OPEN_FILE.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const pathSec = validatePathSecurity(rawFile);
        if (!pathSec.safe) {
          this.logAudit('SECURITY_VIOLATION', {
            action,
            target: rawFile,
            details: pathSec.reason,
            errorCode: 'PATH_TRAVERSAL',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation,
            error: `File security violation: ${pathSec.reason}`,
            errorCode: 'PATH_TRAVERSAL',
          };
        }

        const fileNameVal = validateSafeFileName(rawFile);
        if (!fileNameVal.valid) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Invalid file name: ${fileNameVal.error}`,
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }
        break;
      }

      case 'CREATE_FILE': {
        const rawFile = command.target?.trim();
        if (!rawFile) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Target file name is required for CREATE_FILE.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const pathSec = validatePathSecurity(rawFile);
        if (!pathSec.safe) {
          this.logAudit('SECURITY_VIOLATION', {
            action,
            target: rawFile,
            details: pathSec.reason,
            errorCode: 'PATH_TRAVERSAL',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation,
            error: `File creation security violation: ${pathSec.reason}`,
            errorCode: 'PATH_TRAVERSAL',
          };
        }

        const fileNameVal = validateSafeFileName(rawFile);
        if (!fileNameVal.valid) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Invalid file name: ${fileNameVal.error}`,
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        if (command.destination) {
          const resolvedDest = resolveApprovedDirectory(command.destination);
          if (!resolvedDest) {
            return {
              valid: false,
              action,
              riskLevel: authoritativeRisk,
              requiresConfirmation,
              error: `Invalid destination directory "${command.destination}". Must be an approved user directory.`,
              errorCode: 'UNAPPROVED_DIRECTORY',
            };
          }
        }
        break;
      }

      case 'MOVE_FILE': {
        const rawFile = command.target?.trim();
        const rawDest = command.destination?.trim();
        if (!rawFile || !rawDest) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: 'Both source file name and destination folder are required for MOVE_FILE.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const pathSec = validatePathSecurity(rawFile);
        if (!pathSec.safe) {
          this.logAudit('SECURITY_VIOLATION', {
            action,
            target: rawFile,
            details: pathSec.reason,
            errorCode: 'PATH_TRAVERSAL',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation,
            error: `File move security violation: ${pathSec.reason}`,
            errorCode: 'PATH_TRAVERSAL',
          };
        }

        const fileNameVal = validateSafeFileName(rawFile);
        if (!fileNameVal.valid) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Invalid file name: ${fileNameVal.error}`,
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const resolvedDest = resolveApprovedDirectory(rawDest);
        if (!resolvedDest) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Invalid destination directory "${rawDest}". Must be an approved user directory.`,
            errorCode: 'UNAPPROVED_DIRECTORY',
          };
        }
        break;
      }

      case 'DELETE_FILE': {
        const rawFile = command.target?.trim();
        if (!rawFile) {
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation: true,
            error: 'File name is required for DELETE_FILE.',
            errorCode: 'MALFORMED_PARAMETERS',
          };
        }

        const pathSec = validatePathSecurity(rawFile);
        if (!pathSec.safe) {
          this.logAudit('SECURITY_VIOLATION', {
            action,
            target: rawFile,
            details: pathSec.reason,
            errorCode: 'PATH_TRAVERSAL',
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation: true,
            error: `File deletion security violation: ${pathSec.reason}`,
            errorCode: 'PATH_TRAVERSAL',
          };
        }
        break;
      }

      case 'SYSTEM_SETTING': {
        const rawSetting = command.target || command.normalizedInput || '';
        const resolved = resolveSystemSetting(rawSetting);
        if (!resolved) {
          return {
            valid: false,
            action,
            riskLevel: authoritativeRisk,
            requiresConfirmation,
            error: `Setting "${rawSetting}" is not a supported system setting. Only volume_up, volume_down, mute, unmute are permitted.`,
            errorCode: 'UNSUPPORTED_SYSTEM_SETTING',
          };
        }
        break;
      }

      case 'SLEEP':
      case 'RESTART':
      case 'SHUTDOWN': {
        // High-risk system operations are valid actions but strictly require explicit confirmation
        break;
      }

      case 'CALCULATE': {
        // Safe math expressions only
        break;
      }
    }

    // 6. Check confirmation requirements for execution
    if (requiresConfirmation) {
      if (context?.confirmationToken) {
        const verifyRes = this.verifyConfirmation(
          context.confirmationToken,
          command,
          context.taskId,
          context.stepId
        );
        if (!verifyRes.valid) {
          this.logAudit('CONFIRMATION_REJECTED', {
            action,
            target: command.target,
            taskId: context.taskId,
            stepId: context.stepId,
            details: verifyRes.reason,
            errorCode: verifyRes.errorCode,
          });
          return {
            valid: false,
            action,
            riskLevel: 'HIGH',
            requiresConfirmation: true,
            error: verifyRes.reason,
            errorCode: verifyRes.errorCode,
          };
        }
      }
    }

    this.logAudit('ACTION_VALIDATED', {
      action,
      target: command.target,
      taskId: context?.taskId,
      stepId: context?.stepId,
      riskLevel: authoritativeRisk,
    });

    const sanitizedCommand: ParsedCommand = {
      ...command,
      risk: authoritativeRisk,
    };

    return {
      valid: true,
      action,
      riskLevel: authoritativeRisk,
      requiresConfirmation,
      sanitizedCommand,
    };
  }

  /**
   * Validates an entire multi-step plan.
   * Every step must pass the authoritative action validation.
   */
  public validatePlan(
    rawCommands: ParsedCommand[],
    _originalRequest?: string
  ): { valid: boolean; errors: string[]; validatedCommands?: ParsedCommand[] } {
    const errors: string[] = [];

    if (!rawCommands || !Array.isArray(rawCommands) || rawCommands.length === 0) {
      return { valid: false, errors: ['Plan must contain at least one step command.'] };
    }

    if (rawCommands.length > MAX_PLAN_STEPS) {
      return {
        valid: false,
        errors: [`Plan exceeds maximum step limit of ${MAX_PLAN_STEPS} steps (received ${rawCommands.length}).`],
      };
    }

    const validatedCommands: ParsedCommand[] = [];

    for (let i = 0; i < rawCommands.length; i++) {
      const cmd = rawCommands[i];
      const validation = this.validateAction(cmd);

      if (!validation.valid) {
        errors.push(`Step ${i + 1} (${cmd?.type || 'UNKNOWN'}): ${validation.error || 'Validation failed.'}`);
      } else if (validation.sanitizedCommand) {
        validatedCommands.push(validation.sanitizedCommand);
      }
    }

    if (errors.length > 0) {
      this.logAudit('ACTION_REJECTED', {
        details: `Plan validation failed with ${errors.length} error(s): ${errors.join('; ')}`,
        errorCode: 'MALFORMED_PLAN',
      });
      return { valid: false, errors };
    }

    return { valid: true, errors: [], validatedCommands };
  }

  /**
   * Creates a cryptographic/unique confirmation binding for a high-risk operation.
   */
  public createConfirmationRequest(
    command: ParsedCommand,
    taskId?: string,
    stepId?: string
  ): ConfirmationBinding {
    this.cleanupExpiredConfirmations();

    const id = `conf-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();
    const binding: ConfirmationBinding = {
      id,
      taskId,
      stepId,
      action: command.type,
      target: command.target,
      destination: command.destination,
      query: command.query,
      createdAt: now,
      expiresAt: now + CONFIRMATION_TTL_MS,
      status: 'PENDING',
    };

    this.confirmations.set(id, binding);
    this.logAudit('CONFIRMATION_REQUESTED', {
      action: command.type,
      target: command.target,
      taskId,
      stepId,
      details: `Confirmation requested token: ${id}`,
    });

    return binding;
  }

  /**
   * Verifies that a confirmation token exists, has not expired, has not been consumed,
   * and matches the exact pending action, target, task ID, and step ID.
   */
  public verifyConfirmation(
    token: string,
    command: ParsedCommand,
    taskId?: string,
    stepId?: string
  ): { valid: boolean; reason?: string; errorCode?: SecurityErrorCode } {
    const binding = this.confirmations.get(token);

    if (!binding) {
      return {
        valid: false,
        reason: 'Confirmation token does not exist or was invalidated.',
        errorCode: 'CONFIRMATION_INVALID',
      };
    }

    if (binding.status === 'CONSUMED') {
      return {
        valid: false,
        reason: 'Confirmation token has already been consumed and cannot be reused.',
        errorCode: 'CONFIRMATION_REUSED',
      };
    }

    if (binding.status === 'CANCELLED' || binding.status === 'INVALIDATED') {
      return {
        valid: false,
        reason: `Confirmation is invalid (status: ${binding.status}).`,
        errorCode: 'CONFIRMATION_INVALID',
      };
    }

    if (Date.now() > binding.expiresAt) {
      binding.status = 'EXPIRED';
      return {
        valid: false,
        reason: 'Confirmation has timed out and expired.',
        errorCode: 'CONFIRMATION_EXPIRED',
      };
    }

    // Exact action mismatch check
    if (binding.action !== command.type) {
      return {
        valid: false,
        reason: `Confirmation action mismatch (confirmed "${binding.action}" but attempted "${command.type}").`,
        errorCode: 'CONFIRMATION_MISMATCH',
      };
    }

    // Exact target mismatch check
    if (binding.target && command.target && binding.target.toLowerCase() !== command.target.toLowerCase()) {
      return {
        valid: false,
        reason: `Confirmation target mismatch (confirmed "${binding.target}" but attempted "${command.target}").`,
        errorCode: 'CONFIRMATION_MISMATCH',
      };
    }

    // Task and Step ID matching check (if provided)
    if (taskId && binding.taskId && binding.taskId !== taskId) {
      return {
        valid: false,
        reason: 'Confirmation was issued for a different task session.',
        errorCode: 'CONFIRMATION_MISMATCH',
      };
    }

    if (stepId && binding.stepId && binding.stepId !== stepId) {
      return {
        valid: false,
        reason: 'Confirmation was issued for a different task step.',
        errorCode: 'CONFIRMATION_MISMATCH',
      };
    }

    return { valid: true };
  }

  /**
   * Consumes a confirmation token upon successful execution.
   */
  public consumeConfirmation(token: string): boolean {
    const binding = this.confirmations.get(token);
    if (!binding || binding.status !== 'PENDING') return false;

    binding.status = 'CONSUMED';
    this.logAudit('CONFIRMATION_CONSUMED', {
      action: binding.action,
      target: binding.target,
      taskId: binding.taskId,
      stepId: binding.stepId,
      details: `Confirmation token consumed: ${token}`,
    });
    return true;
  }

  /**
   * Invalidates all pending confirmations for a specific task or step.
   */
  public cancelPendingConfirmations(taskId?: string): void {
    for (const [id, binding] of this.confirmations.entries()) {
      if (binding.status === 'PENDING') {
        if (!taskId || binding.taskId === taskId) {
          binding.status = 'CANCELLED';
          this.logAudit('CONFIRMATION_INVALIDATED', {
            action: binding.action,
            target: binding.target,
            taskId: binding.taskId,
            stepId: binding.stepId,
            details: `Confirmation token ${id} cancelled.`,
          });
        }
      }
    }
  }

  /**
   * Sanitized security audit logging.
   * Redacts any potential credentials, API keys, passwords, or sensitive payloads.
   */
  public logAudit(
    type: SecurityAuditEventType,
    details?: {
      action?: string;
      target?: string;
      taskId?: string;
      stepId?: string;
      riskLevel?: DesktopRiskLevel;
      details?: string;
      errorCode?: SecurityErrorCode;
    }
  ): void {
    const sanitizedDetails = details?.details ? this.redactSensitiveData(details.details) : undefined;
    const sanitizedTarget = details?.target ? this.redactSensitiveData(details.target) : undefined;

    const event: SecurityAuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      action: details?.action,
      target: sanitizedTarget,
      taskId: details?.taskId,
      stepId: details?.stepId,
      riskLevel: details?.riskLevel,
      details: sanitizedDetails,
      errorCode: details?.errorCode,
    };

    this.auditLogs.unshift(event);
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(): SecurityAuditEvent[] {
    return [...this.auditLogs];
  }

  public clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * Cleans up expired confirmation bindings from memory.
   */
  private cleanupExpiredConfirmations(): void {
    const now = Date.now();
    for (const [id, binding] of this.confirmations.entries()) {
      if (binding.status === 'PENDING' && now > binding.expiresAt) {
        binding.status = 'EXPIRED';
      }
      if (now - binding.createdAt > CONFIRMATION_TTL_MS * 5) {
        this.confirmations.delete(id);
      }
    }
  }

  /**
   * Checks if input contains any prohibited shell command patterns or metacharacters.
   */
  private containsProhibitedPatterns(input: string): boolean {
    for (const pattern of PROHIBITED_SHELL_PATTERNS) {
      if (pattern.test(input)) return true;
    }
    for (const pattern of PROHIBITED_METACHARACTERS) {
      if (pattern.test(input)) return true;
    }
    return false;
  }

  /**
   * Sanitizes and redacts any API keys, tokens, passwords, or credentials from log strings.
   */
  private redactSensitiveData(text: string): string {
    return text
      .replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[REDACTED_API_KEY]')
      .replace(/(?:key|token|secret|password|bearer|auth)[=:\s]+[a-zA-Z0-9_.-]{8,}/gi, '[REDACTED_CREDENTIAL]')
      .replace(/ey[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}/g, '[REDACTED_JWT]');
  }
}

export const securityGate = new SecurityGate();
