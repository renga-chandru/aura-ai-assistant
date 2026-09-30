import { ParsedCommand } from '../commands/types';
import { ExecutionResult } from '../execution/types';
import { AssistantResponse, ResponseCategory } from './types';
import { SYSTEM_CONFIRMATION_PROMPTS } from '../execution/systemActionRegistry';
import { resolveWebsite } from '../execution/webRegistry';
import { ErrorTranslator } from './ErrorTranslator';

/**
 * AURA Response Formatter (Phase 28)
 *
 * Converts structured execution results and intents into concise, natural,
 * human-readable responses for both visual display and speech synthesis.
 * Strictly avoids exposing internal technical details (HTTP status codes, parser names,
 * risk enums, filesystem paths, security implementation details, stack traces).
 * Integrates authoritative ErrorTranslator to ensure accurate, truthful user feedback.
 */
export class ResponseFormatter {
  /**
   * Main entry point to format an execution result into an AssistantResponse
   */
  public static format(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    // 1. High-risk confirmation required
    if (result.requiresConfirmation || result.errorCode === 'CONFIRMATION_REQUIRED') {
      return this.formatConfirmationRequest(command, result);
    }

    // 2. Format according to command action type
    switch (command.type) {
      case 'OPEN_APP':
      case 'CLOSE_APP':
        return this.formatAppResponse(command, result);

      case 'OPEN_URL':
      case 'WEB_SEARCH':
      case 'EXTRACT_INFO':
        return this.formatBrowserResponse(command, result);

      case 'OPEN_FOLDER':
      case 'OPEN_FILE':
      case 'CREATE_FILE':
      case 'CREATE_FOLDER':
      case 'MOVE_FILE':
      case 'DELETE_FILE':
        return this.formatFileResponse(command, result);

      case 'SYSTEM_SETTING':
      case 'SLEEP':
      case 'RESTART':
      case 'SHUTDOWN':
        return this.formatSystemResponse(command, result);

      case 'CALCULATE':
        if (!result.success) {
          const failMsg = ErrorTranslator.translate({
            errorCode: result.errorCode,
            action: command.type,
            rawMessage: result.message,
          });
          return {
            type: 'calculation',
            text: failMsg,
            spokenText: failMsg,
            category: 'FAILURE',
            intent: 'CALCULATION',
            shouldSpeak: true,
            speak: true,
          };
        }
        return {
          type: 'calculation',
          text: result.message,
          spokenText: result.message,
          category: 'CALCULATION',
          intent: 'CALCULATION',
          shouldSpeak: true,
          speak: true,
        };

      default:
        return this.formatFallback(command, result);
    }
  }

  /**
   * Formats confirmation prompt when a high-risk operation is requested
   */
  public static formatConfirmationRequest(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    let prompt = result.message;

    if (command.type === 'RESTART') {
      prompt = SYSTEM_CONFIRMATION_PROMPTS.RESTART;
    } else if (command.type === 'SHUTDOWN') {
      prompt = SYSTEM_CONFIRMATION_PROMPTS.SHUTDOWN;
    } else if (command.type === 'SLEEP') {
      prompt = SYSTEM_CONFIRMATION_PROMPTS.SLEEP;
    } else if (command.type === 'DELETE_FILE') {
      const fileName = command.target || 'this file';
      prompt = `Confirmation required: Deletion is restricted. File "${fileName}" will not be deleted without explicit confirmation.`;
    }

    // Clean spoken text: strip quotes if present
    const spoken = prompt.replace(/"/g, '');

    return {
      text: prompt,
      spokenText: spoken,
      category: 'CONFIRMATION',
      action: command.type,
      target: command.target,
      shouldSpeak: true,
      requiresConfirmation: true,
    };
  }

  /**
   * Formats response when a pending high-risk action is confirmed by user
   */
  public static formatConfirmedExecution(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    if (result.success) {
      let text = 'Action executed.';
      if (command.type === 'RESTART') {
        text = 'Restarting your Mac.';
      } else if (command.type === 'SHUTDOWN') {
        text = 'Shutting down your Mac.';
      } else if (command.type === 'SLEEP') {
        text = 'Putting your Mac to sleep.';
      }

      return {
        text,
        spokenText: text,
        category: 'SUCCESS',
        action: command.type,
        target: command.target,
        shouldSpeak: true,
      };
    } else {
      const text = ErrorTranslator.translate({
        errorCode: result.errorCode,
        action: command.type,
        target: command.target,
        rawMessage: result.message,
      });
      return {
        text,
        spokenText: text,
        category: 'FAILURE',
        action: command.type,
        target: command.target,
        shouldSpeak: true,
      };
    }
  }

  /**
   * Formats response when user cancels a pending high-risk action
   */
  public static formatCancellation(command?: ParsedCommand | null): AssistantResponse {
    const text = 'Cancelled.';
    return {
      text,
      spokenText: text,
      category: 'CANCELLED',
      action: command?.type,
      target: command?.target,
      shouldSpeak: true,
    };
  }

  /**
   * Formats application command responses
   */
  private static formatAppResponse(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    const appName = result.target || command.target || 'Application';

    if (result.success) {
      const actionVerb = command.type === 'OPEN_APP' ? 'Opening' : 'Closing';
      const text = `${actionVerb} ${appName}.`;
      return {
        text,
        spokenText: text,
        category: 'SUCCESS',
        action: command.type,
        target: appName,
        shouldSpeak: true,
      };
    }

    // Failure cases: Never claim success!
    const text = ErrorTranslator.translate({
      errorCode: result.errorCode,
      action: command.type,
      target: appName,
      rawMessage: result.message,
    });

    let category: ResponseCategory = 'FAILURE';
    if (
      result.errorCode === 'APP_NOT_SUPPORTED' ||
      result.errorCode === 'APP_NOT_ALLOWED' ||
      result.errorCode === 'UNAPPROVED_APPLICATION'
    ) {
      category = 'UNSUPPORTED';
    } else if (result.errorCode === 'SECURITY_VIOLATION') {
      category = 'SECURITY_BLOCK';
    }

    return {
      text,
      spokenText: text,
      category,
      action: command.type,
      target: appName,
      shouldSpeak: true,
    };
  }

  /**
   * Formats browser and web search responses
   */
  private static formatBrowserResponse(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    if (result.success) {
      if (command.type === 'OPEN_URL') {
        const rawTarget = result.target || command.target || 'website';
        const webEntry = resolveWebsite(rawTarget);
        let siteName = webEntry ? webEntry.name : rawTarget;
        if (siteName.startsWith('http://') || siteName.startsWith('https://')) {
          try {
            const host = new URL(siteName).hostname.replace(/^www\./, '');
            const dotIdx = host.indexOf('.');
            siteName = dotIdx > 0 ? host.substring(0, dotIdx) : host;
            siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
          } catch {
            // Keep siteName
          }
        }
        const text = `Opening ${siteName}.`;
        return {
          text,
          spokenText: text,
          category: 'SUCCESS',
          action: command.type,
          target: siteName,
          shouldSpeak: true,
        };
      }

      if (command.type === 'WEB_SEARCH') {
        const query = command.query || result.query || '';
        const provider = result.target || 'Google';
        const text = provider.toLowerCase() === 'the web'
          ? `Searching the web for ${query}.`
          : `Searching ${provider} for ${query}.`;
        return {
          text,
          spokenText: text,
          category: 'SUCCESS',
          action: command.type,
          target: provider,
          shouldSpeak: true,
        };
      }

      if (command.type === 'EXTRACT_INFO') {
        let text = 'Extracted information from the page.';
        let spokenText = text;

        if (result.data && result.data.facts && result.data.facts.length > 0) {
          text = `Here is what I found:\n- ${result.data.facts.join('\n- ')}`;
          spokenText = `Here is what I found: ${result.data.facts.join('. ')}`;
        }

        return {
          text,
          spokenText,
          category: 'SUCCESS',
          action: command.type,
          shouldSpeak: true,
        };
      }
    }

    // Failure cases: Never claim success!
    const text = ErrorTranslator.translate({
      errorCode: result.errorCode,
      action: command.type,
      target: command.target || command.query,
      rawMessage: result.message,
    });

    let category: ResponseCategory = 'FAILURE';
    if (result.errorCode === 'INVALID_URL' || result.errorCode === 'SECURITY_VIOLATION') {
      category = 'SECURITY_BLOCK';
    } else if (result.errorCode === 'STEP_TIMEOUT') {
      category = 'FAILURE';
    }

    return {
      text,
      spokenText: text,
      category,
      action: command.type,
      shouldSpeak: true,
    };
  }

  /**
   * Formats file and folder command responses
   */
  private static formatFileResponse(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    const target = result.target || command.target || 'file';
    const dest = result.destination || command.destination;

    // Security violation
    if (result.errorCode === 'SECURITY_VIOLATION' || result.errorCode === 'PATH_TRAVERSAL_DETECTED') {
      const text = ErrorTranslator.translate({ errorCode: result.errorCode, action: command.type, target });
      return {
        text,
        spokenText: text,
        category: 'SECURITY_BLOCK',
        action: command.type,
        target,
        shouldSpeak: true,
      };
    }

    // Ambiguous file resolution
    if (result.errorCode === 'AMBIGUOUS_FILE') {
      const text = 'I found multiple files with that name. Please specify the location.';
      return {
        text,
        spokenText: text,
        category: 'AMBIGUOUS',
        action: command.type,
        target,
        shouldSpeak: true,
      };
    }

    if (result.success) {
      let text = 'Operation completed.';
      switch (command.type) {
        case 'OPEN_FOLDER':
          text = `Opening ${target}.`;
          break;
        case 'OPEN_FILE':
          text = `Opening ${target}.`;
          break;
        case 'CREATE_FILE':
          text = `Created ${target}.`;
          break;
        case 'CREATE_FOLDER':
          text = `Created folder ${target}.`;
          break;
        case 'MOVE_FILE':
          text = dest ? `Moved ${target} to ${dest}.` : `Moved ${target}.`;
          break;
        case 'DELETE_FILE':
          text = `Deleted ${target}.`;
          break;
      }

      return {
        text,
        spokenText: text,
        category: 'SUCCESS',
        action: command.type,
        target,
        shouldSpeak: true,
      };
    }

    // General file failures: Never claim success!
    const text = ErrorTranslator.translate({
      errorCode: result.errorCode,
      action: command.type,
      target,
      rawMessage: result.message,
    });

    return {
      text,
      spokenText: text,
      category: 'FAILURE',
      action: command.type,
      target,
      shouldSpeak: true,
    };
  }

  /**
   * Formats system control command responses
   */
  private static formatSystemResponse(command: ParsedCommand, result: ExecutionResult): AssistantResponse {
    if (result.success) {
      if (command.type === 'SYSTEM_SETTING') {
        const rawTarget = (command.target || command.normalizedInput || '').toLowerCase();
        let text = 'Setting adjusted.';

        if (rawTarget.includes('up') || rawTarget.includes('increase') || rawTarget.includes('louder')) {
          text = 'Volume increased.';
        } else if (rawTarget.includes('down') || rawTarget.includes('decrease') || rawTarget.includes('lower')) {
          text = 'Volume decreased.';
        } else if (rawTarget === 'unmute' || rawTarget.includes('unmute')) {
          text = 'Unmuted.';
        } else if (rawTarget === 'mute' || rawTarget.includes('mute') || rawTarget.includes('silence')) {
          text = 'Muted.';
        } else {
          text = `${result.target || 'System setting'} applied.`;
        }

        return {
          text,
          spokenText: text,
          category: 'SUCCESS',
          action: command.type,
          target: result.target,
          shouldSpeak: true,
        };
      }

      // Confirmed high-risk actions
      return this.formatConfirmedExecution(command, result);
    }

    // Failure cases: Never claim success!
    const text = ErrorTranslator.translate({
      errorCode: result.errorCode,
      action: command.type,
      target: command.target,
      rawMessage: result.message,
    });

    let category: ResponseCategory = 'FAILURE';
    if (result.errorCode === 'UNSUPPORTED_SETTING') {
      category = 'UNSUPPORTED';
    }

    return {
      text,
      spokenText: text,
      category,
      action: command.type,
      shouldSpeak: true,
    };
  }

  /**
   * Formats fallback/unknown command responses
   */
  public static formatFallback(command: ParsedCommand, result?: ExecutionResult): AssistantResponse {
    if (
      /^(sudo|defaults|killall|launchctl|chmod|chown|osascript|eval|exec)\b/i.test(command.normalizedInput) ||
      command.risk === 'HIGH'
    ) {
      const text = "I can't perform that action safely.";
      return {
        text,
        spokenText: text,
        category: 'SECURITY_BLOCK',
        action: command.type,
        shouldSpeak: true,
      };
    }

    const text = ErrorTranslator.translate({
      errorCode: result?.errorCode,
      action: command.type,
      target: command.target,
      rawMessage: result?.message || "I didn't recognize that command.",
    });

    return {
      text,
      spokenText: text,
      category: 'FAILURE',
      action: command.type,
      shouldSpeak: true,
    };
  }

  /**
   * Formats a conversational chat or question response (Phase 23)
   */
  public static formatChat(text: string, spokenText?: string): AssistantResponse {
    const cleanSpoken = spokenText || text;
    return {
      type: 'chat',
      text,
      spokenText: cleanSpoken,
      category: 'CHAT',
      intent: 'CHAT',
      shouldSpeak: true,
      speak: true,
    };
  }

  /**
   * Formats an arithmetic calculation response (Phase 23)
   */
  public static formatCalculation(calc: { expression: string; result: number; formattedAnswer: string }): AssistantResponse {
    return {
      type: 'calculation',
      text: calc.formattedAnswer,
      spokenText: calc.formattedAnswer,
      category: 'CALCULATION',
      intent: 'CALCULATION',
      shouldSpeak: true,
      speak: true,
    };
  }

  /**
   * Formats a multi-step task execution completion (Phase 23)
   */
  public static formatTaskResult(summary: string, spokenSummary?: string): AssistantResponse {
    return {
      type: 'task',
      text: summary,
      spokenText: spokenSummary || summary,
      category: 'TASK',
      intent: 'MULTI_STEP_COMMAND',
      shouldSpeak: true,
      speak: true,
    };
  }

  /**
   * Formats partial multi-step task success / failure (Phase 28)
   */
  public static formatPartialSuccess(
    completedSteps: number,
    totalSteps: number,
    failureReason?: string,
    stepSummaries?: string[]
  ): AssistantResponse {
    let text: string;
    if (completedSteps > 0 && stepSummaries && stepSummaries.length > 0) {
      // Natural language aggregation: "I opened Chrome and YouTube, but the search failed."
      const safeReason = failureReason
        ? ErrorTranslator.translate({ rawMessage: failureReason })
        : 'the next step failed.';

      let summaryPrefix = stepSummaries.join(' and ');
      if (stepSummaries.length > 1) {
          const lastSummary = stepSummaries.pop();
          summaryPrefix = stepSummaries.join(', ') + ', and ' + lastSummary;
      }
      // simplify common verbs if needed, but simple join is usually okay
      summaryPrefix = summaryPrefix.replace(/Opening /ig, 'opened ').replace(/Searching /ig, 'searched ').replace(/Created /ig, 'created ').replace(/Opening\./ig, 'opened');

      text = `I ${summaryPrefix}, but ${safeReason.toLowerCase()}`;
      
      // Cleanup any messy punctuation
      text = text.charAt(0).toUpperCase() + text.slice(1);
      text = text.replace(/\.,/g, ',').replace(/\.\s+but/g, ' but');
      if (!text.endsWith('.')) {
        text += '.';
      }
    } else if (completedSteps > 0) {
      text = `I completed ${completedSteps} of ${totalSteps} steps, but the last step failed.`;
      if (failureReason) {
        const safeReason = ErrorTranslator.translate({ rawMessage: failureReason });
        text = `I completed ${completedSteps} of ${totalSteps} steps, but stopped because: ${safeReason}`;
      }
    } else {
      text = failureReason
        ? ErrorTranslator.translate({ rawMessage: failureReason })
        : 'Task execution failed on the first step.';
    }

    return {
      type: 'task',
      text,
      spokenText: text,
      category: completedSteps > 0 ? 'FAILURE' : 'FAILURE',
      intent: 'MULTI_STEP_COMMAND',
      shouldSpeak: true,
      speak: true,
    };
  }
}
