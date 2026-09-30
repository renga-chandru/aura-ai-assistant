import { CommandActionType } from '../commands/types';
import { ExecutionStatus } from '../execution/resultModel';

export class ErrorTranslator {
  /**
   * Translates internal error codes and statuses into clean, concise, safe user-facing messages.
   * Strips out internal paths, stack traces, and sensitive tokens.
   */
  public static translate(params: {
    errorCode?: string;
    status?: ExecutionStatus;
    action?: CommandActionType;
    target?: string;
    rawMessage?: string;
  }): string {
    const { errorCode, status, action, target, rawMessage } = params;
    const cleanTarget = target ? target.trim() : '';

    // 1. Specific Error Code Mappings
    if (errorCode) {
      switch (errorCode) {
        case 'APP_NOT_SUPPORTED':
        case 'APP_NOT_ALLOWED':
        case 'UNAPPROVED_APPLICATION':
          return cleanTarget
            ? `Application "${cleanTarget}" is not available through AURA.`
            : "That application isn't available through AURA.";

        case 'APP_LAUNCH_FAILED':
        case 'EXECUTION_FAILED':
          if (action === 'CLOSE_APP') {
            return cleanTarget ? `I couldn't close ${cleanTarget}.` : "I couldn't close that application.";
          }
          return cleanTarget ? `I couldn't open ${cleanTarget}.` : "I couldn't open that application.";

        case 'FILE_NOT_FOUND':
          return cleanTarget ? `I couldn't find ${cleanTarget}.` : "I couldn't find that file.";

        case 'FILE_PERMISSION_DENIED':
        case 'ACCESS_DENIED':
          return cleanTarget
            ? `I don't have permission to access "${cleanTarget}".`
            : "I don't have permission to access that file.";

        case 'PATH_BLOCKED':
        case 'PATH_TRAVERSAL_DETECTED':
        case 'INVALID_PATH':
        case 'SECURITY_VIOLATION':
        case 'PROHIBITED_SHELL_COMMAND':
          return "I can't access that location.";

        case 'INVALID_URL':
        case 'UNAPPROVED_URL':
          return "I can't access that location.";

        case 'BROWSER_FAILED':
          return "I couldn't open that website.";

        case 'STEP_TIMEOUT':
        case 'TIMEOUT':
          return "That action took too long and was stopped.";

        case 'CONFIRMATION_REQUIRED':
          return "I need your confirmation before I can do that.";

        case 'EXPIRED_CONFIRMATION':
          return "Confirmation expired.";

        case 'STALE_CONFIRMATION':
          return "Confirmation is no longer valid.";

        case 'VALIDATION_FAILED':
        case 'MALFORMED_PARAMETERS':
          return "I couldn't process that command safely.";

        case 'UNSUPPORTED_INTENT':
        case 'UNSUPPORTED_ACTION':
        case 'UNSUPPORTED_SETTING':
          return "I can't perform that action yet.";

        case 'NETWORK_ERROR':
        case 'BRIDGE_UNAVAILABLE':
        case 'TEMPORARY_FAILURE':
          return "That didn't work right now. I can try again.";
      }
    }

    // 2. Status-based Mappings
    if (status) {
      switch (status) {
        case 'TIMEOUT':
          return "That action took too long and was stopped.";
        case 'CANCELLED':
          return "Cancelled.";
        case 'PERMISSION_DENIED':
          return "I don't have permission to perform that action.";
        case 'VALIDATION_FAILED':
          return "I couldn't process that command safely.";
        case 'UNSUPPORTED':
          return "I can't perform that action yet.";
        case 'TEMPORARY_FAILURE':
          return "That didn't work right now. I can try again.";
        case 'WAITING_CONFIRMATION':
          return "I need your confirmation before I can do that.";
      }
    }

    // 3. Action-based Fallback Messages
    if (action) {
      switch (action) {
        case 'OPEN_APP':
          return cleanTarget ? `I couldn't open ${cleanTarget}.` : "I couldn't open that application.";
        case 'CLOSE_APP':
          return cleanTarget ? `I couldn't close ${cleanTarget}.` : "I couldn't close that application.";
        case 'OPEN_URL':
        case 'WEB_SEARCH':
          return "I couldn't open that website.";
        case 'OPEN_FILE':
        case 'OPEN_FOLDER':
        case 'CREATE_FILE':
        case 'MOVE_FILE':
        case 'DELETE_FILE':
          return "I couldn't complete that file operation.";
        case 'SYSTEM_SETTING':
        case 'SLEEP':
        case 'RESTART':
        case 'SHUTDOWN':
          return "I couldn't perform that system action.";
      }
    }

    // 4. Safe sanitized raw message fallback
    if (rawMessage && !this.containsSensitiveData(rawMessage)) {
      return rawMessage;
    }

    return "I couldn't complete that request.";
  }

  /**
   * Helper to verify a message does not leak system paths, credentials, or stack traces
   */
  public static containsSensitiveData(msg: string): boolean {
    if (!msg) return false;
    const sensitivePatterns = [
      /\/Users\//i,
      /\/home\//i,
      /\/etc\//i,
      /\/private\//i,
      /sk-[a-zA-Z0-9]{20,}/,
      /bearer\s+/i,
      /password=/i,
      /at\s+[a-zA-Z0-9_.]+\s+\(.*:\d+:\d+\)/, // stack trace format
      /node_modules/i,
    ];
    return sensitivePatterns.some((pattern) => pattern.test(msg));
  }
}
