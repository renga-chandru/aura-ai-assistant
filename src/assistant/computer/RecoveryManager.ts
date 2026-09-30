import { TaskStep, StepObservation, RecoveryDecision } from './types';

export class RecoveryManager {
  public static readonly MAX_RETRIES_PER_STEP = 1;

  /**
   * Determines if a failed step is eligible for automatic retry.
   */
  public static evaluate(step: TaskStep, observation: StepObservation): RecoveryDecision {
    // If step already succeeded, no recovery needed
    if (observation.success) {
      return {
        shouldRetry: false,
        shouldReplan: false,
        reason: 'Step succeeded.',
      };
    }

    // 1. Max retries check
    if (step.retryCount >= RecoveryManager.MAX_RETRIES_PER_STEP) {
      return {
        shouldRetry: false,
        shouldReplan: true,
        reason: `Maximum automatic retry limit (${RecoveryManager.MAX_RETRIES_PER_STEP}) reached for step.`,
        maxRetriesExceeded: true,
      };
    }

    // 2. High-risk / Dangerous actions MUST NOT automatically retry
    const nonRetryableIntents = ['DELETE_FILE', 'SLEEP', 'RESTART', 'SHUTDOWN'];
    if (nonRetryableIntents.includes(step.intent)) {
      return {
        shouldRetry: false,
        shouldReplan: false,
        reason: `High-risk action "${step.intent}" cannot be automatically retried. User intervention required.`,
      };
    }

    // 3. File not found is non-retryable without user clarification
    if (
      step.intent === 'OPEN_FILE' ||
      step.intent === 'OPEN_FOLDER' ||
      observation.errorCode === 'FILE_NOT_FOUND' ||
      observation.message.toLowerCase().includes('not found')
    ) {
      return {
        shouldRetry: false,
        shouldReplan: false,
        reason: `Target file or folder not found. Automatic retry disabled to prevent redundant failures.`,
      };
    }

    // 4. Security / Permission violations MUST NOT retry
    if (
      observation.errorCode === 'SECURITY_VIOLATION' ||
      observation.errorCode === 'PERMISSION_DENIED' ||
      observation.errorCode === 'INVALID_PATH' ||
      observation.errorCode === 'INVALID_URL' ||
      observation.errorCode === 'PATH_TRAVERSAL_DETECTED'
    ) {
      return {
        shouldRetry: false,
        shouldReplan: false,
        reason: `Security violation or permission failure (${observation.errorCode}) cannot be retried.`,
      };
    }

    // 5. Permit 1 retry for transient application or browser errors
    if (step.intent === 'OPEN_APP' || step.intent === 'WEB_SEARCH' || step.intent === 'OPEN_URL') {
      return {
        shouldRetry: true,
        shouldReplan: false,
        reason: `Transient error for ${step.intent}. Permitting 1 automatic retry attempt.`,
      };
    }

    // Default fallback: do not retry unknown failures automatically
    return {
      shouldRetry: false,
      shouldReplan: true,
      reason: `Action failed with unhandled error. Automatic retry disabled.`,
    };
  }
}
