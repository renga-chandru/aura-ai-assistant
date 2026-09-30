import { ExecutionResult } from '../execution/types';
import { StepObservation } from './types';

export class ResultObserver {
  /**
   * Converts raw ExecutionResult from executors into structured StepObservation.
   * Strictly relies on actual runtime executor returns.
   */
  public static observe(result: ExecutionResult): StepObservation {
    const data: Record<string, unknown> = {};

    if (result.target) data.target = result.target;
    if (result.destination) data.destination = result.destination;
    if (result.query) data.query = result.query;
    if (result.executionTimeMs !== undefined) data.executionTimeMs = result.executionTimeMs;
    if (result.data !== undefined) data.resultData = result.data;

    return {
      success: result.success,
      action: result.action,
      message: result.message,
      errorCode: result.errorCode,
      data,
      timestamp: Date.now(),
    };
  }
}
