import { TaskSession, TaskStep, TaskStepState, TaskSessionState } from './types';
import { ExecutionResult } from '../execution/types';

export class TaskSessionModel {
  public static createSession(id: string, originalRequest: string, steps: TaskStep[]): TaskSession {
    return {
      id,
      originalRequest,
      currentStep: 0,
      totalSteps: steps.length,
      status: 'PLANNING',
      steps,
      createdAt: Date.now(),
    };
  }

  public static getCurrentStep(session: TaskSession): TaskStep | null {
    if (session.currentStep < 0 || session.currentStep >= session.steps.length) {
      return null;
    }
    return session.steps[session.currentStep];
  }

  public static updateStepState(
    session: TaskSession,
    stepIndex: number,
    state: TaskStepState,
    result?: ExecutionResult,
    errorReason?: string
  ): TaskSession {
    if (stepIndex < 0 || stepIndex >= session.steps.length) {
      return session;
    }

    const newSteps = [...session.steps];
    const targetStep = { ...newSteps[stepIndex] };
    targetStep.state = state;
    if (result) {
      targetStep.result = result;
      if (result.executionTimeMs !== undefined) {
        targetStep.executionTimeMs = result.executionTimeMs;
      }
    }
    if (errorReason) {
      targetStep.errorReason = errorReason;
    }

    newSteps[stepIndex] = targetStep;

    return {
      ...session,
      steps: newSteps,
    };
  }

  public static updateSessionStatus(
    session: TaskSession,
    status: TaskSessionState,
    failureReason?: string
  ): TaskSession {
    const isTerminal = status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
    return {
      ...session,
      status,
      failureReason: failureReason || session.failureReason,
      completedAt: isTerminal ? Date.now() : session.completedAt,
    };
  }

  public static advanceStep(session: TaskSession): TaskSession {
    const nextIndex = session.currentStep + 1;
    if (nextIndex >= session.steps.length) {
      return {
        ...session,
        currentStep: session.steps.length,
        status: 'COMPLETED',
        completedAt: Date.now(),
      };
    }

    return {
      ...session,
      currentStep: nextIndex,
    };
  }
}
