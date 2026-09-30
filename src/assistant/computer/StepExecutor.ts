import { TaskStep } from './types';
import { ExecutionResult } from '../execution/types';
import { macAppExecutor } from '../execution/MacAppExecutor';
import { browserExecutor } from '../execution/BrowserExecutor';
import { fileExecutor } from '../execution/FileExecutor';
import { systemExecutor } from '../execution/SystemExecutor';
import { SafeCalculator } from '../brain/SafeCalculator';
import { securityGate } from '../security';

export class StepExecutor {
  public static readonly DEFAULT_TIMEOUT_MS = 15000;

  /**
   * Executes a single TaskStep with enforced per-step timeout.
   */
  public async execute(step: TaskStep, context?: { previousSteps: TaskStep[] }, overrideTimeoutMs?: number): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = overrideTimeoutMs || step.timeoutMs || StepExecutor.DEFAULT_TIMEOUT_MS;

    try {
      const executionPromise = this.dispatchExecution(step, context);

      const timeoutPromise = new Promise<ExecutionResult>((resolve) => {
        const timer = setTimeout(() => {
          resolve({
            success: false,
            action: step.intent,
            target: step.command.target,
            query: step.command.query,
            message: `Step execution timed out after ${timeoutMs}ms`,
            errorCode: 'STEP_TIMEOUT',
            executionTimeMs: timeoutMs,
          });
        }, timeoutMs);

        // Ensure timer is cleared if execution completes first
        executionPromise.finally(() => clearTimeout(timer));
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const executionTimeMs = Date.now() - startTime;

      return {
        ...result,
        executionTimeMs,
      };
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        action: step.intent,
        target: step.command.target,
        query: step.command.query,
        message: err?.message || 'Unexpected execution error',
        errorCode: 'EXECUTION_EXCEPTION',
        executionTimeMs,
      };
    }
  }

  private async dispatchExecution(step: TaskStep, context?: { previousSteps: TaskStep[] }): Promise<ExecutionResult> {
    const cmd = step.command;

    // 0. Central Security Gate Validation Gate
    const secValidation = securityGate.validateAction(cmd, {
      stepId: step.id,
      isConfirmed: !!cmd.params?.confirmed,
    });

    if (!secValidation.valid) {
      return {
        success: false,
        action: cmd.type,
        target: cmd.target,
        query: cmd.query,
        destination: cmd.destination,
        message: secValidation.error || 'Action rejected by security gate.',
        errorCode: secValidation.errorCode || 'SECURITY_VIOLATION',
        requiresConfirmation: secValidation.requiresConfirmation,
      };
    }

    // 1. Calculation step
    if (
      step.intent === 'CALCULATE' ||
      cmd.type === 'CALCULATE' ||
      (cmd.query && SafeCalculator.isCalculation(cmd.query)) ||
      (cmd.target && SafeCalculator.isCalculation(cmd.target))
    ) {
      const expr = cmd.query || cmd.target || cmd.originalInput || '';
      const calcRes = SafeCalculator.calculate(expr);
      if (calcRes) {
        return {
          success: true,
          action: 'CALCULATE',
          query: expr,
          message: calcRes.formattedAnswer,
        };
      } else {
        return {
          success: false,
          action: 'CALCULATE',
          query: expr,
          message: "I couldn't calculate that expression.",
          errorCode: 'INVALID_EXPRESSION',
        };
      }
    }

    // 2. Application Actions
    if (cmd.type === 'OPEN_APP' || cmd.type === 'CLOSE_APP') {
      return macAppExecutor.execute(cmd);
    }

    // 3. Browser & Web Actions
    if (cmd.type === 'OPEN_URL' || cmd.type === 'WEB_SEARCH' || cmd.type === 'EXTRACT_INFO') {
      return browserExecutor.execute(cmd, context);
    }

    // 4. File System Actions
    if (
      cmd.type === 'OPEN_FOLDER' ||
      cmd.type === 'OPEN_FILE' ||
      cmd.type === 'CREATE_FILE' ||
      cmd.type === 'CREATE_FOLDER' ||
      cmd.type === 'MOVE_FILE' ||
      cmd.type === 'DELETE_FILE'
    ) {
      return fileExecutor.execute(cmd);
    }

    // 5. System Actions
    if (
      cmd.type === 'SYSTEM_SETTING' ||
      cmd.type === 'SLEEP' ||
      cmd.type === 'RESTART' ||
      cmd.type === 'SHUTDOWN'
    ) {
      return systemExecutor.execute(cmd);
    }

    return {
      success: false,
      action: cmd.type,
      message: `Unsupported command type "${cmd.type}".`,
      errorCode: 'UNSUPPORTED_INTENT',
    };
  }
}

export const stepExecutor = new StepExecutor();
