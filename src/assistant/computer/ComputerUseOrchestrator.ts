import { TaskSession, TaskStep, StepObservation, PlanValidationResult, OrchestratorCallbacks } from './types';
import { TaskSessionModel } from './TaskSession';
import { ResultObserver } from './ResultObserver';
import { RecoveryManager } from './RecoveryManager';
import { stepExecutor } from './StepExecutor';
import { ParsedCommand } from '../commands/types';
import { securityGate, MAX_PLAN_STEPS } from '../security';

export { MAX_PLAN_STEPS };

import { SUPPORTED_ACTION_INTENTS } from '../ai/types';
export { SUPPORTED_ACTION_INTENTS };

export class ComputerUseOrchestrator {
  /**
   * Validates an untrusted AI or user plan through the central authoritative SecurityGate.
   * Every step must pass strict schema, intent, parameter, risk, and security validation.
   */
  public validatePlan(rawCommands: ParsedCommand[], _originalRequest?: string): PlanValidationResult {
    if (!rawCommands || !Array.isArray(rawCommands) || rawCommands.length === 0) {
      return { valid: false, errors: ['Plan must contain at least one step command.'] };
    }

    if (rawCommands.length > MAX_PLAN_STEPS) {
      return {
        valid: false,
        errors: [`Plan exceeds maximum step limit of ${MAX_PLAN_STEPS} steps (received ${rawCommands.length}).`],
      };
    }

    const errors: string[] = [];
    const validatedSteps: TaskStep[] = [];

    for (let i = 0; i < rawCommands.length; i++) {
      const cmd = rawCommands[i];
      const stepIndex = i;
      const stepId = `step-${Date.now()}-${stepIndex + 1}`;

      // Validate through authoritative Security Gate
      const secValidation = securityGate.validateAction(cmd);
      if (!secValidation.valid) {
        errors.push(`Step ${stepIndex + 1}: ${secValidation.error || 'Validation failed.'}`);
        continue;
      }

      const sanitizedCmd = secValidation.sanitizedCommand || cmd;
      const isHighRisk = secValidation.requiresConfirmation || secValidation.riskLevel === 'HIGH';
      const stepDescription = `[${sanitizedCmd.type}] ${sanitizedCmd.target || sanitizedCmd.query || ''}`.trim();

      validatedSteps.push({
        id: stepId,
        stepIndex,
        intent: sanitizedCmd.type,
        description: stepDescription,
        command: sanitizedCmd,
        state: 'PENDING',
        retryCount: 0,
        maxRetries: 1,
        timeoutMs: 15000,
        requiresConfirmation: isHighRisk,
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: [],
      validatedSteps,
    };
  }

  /**
   * Initializes a new TaskSession from validated steps.
   */
  public createSession(originalRequest: string, validatedSteps: TaskStep[]): TaskSession {
    const sessionId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return TaskSessionModel.createSession(sessionId, originalRequest, validatedSteps);
  }

  /**
   * Executes the next step in the session sequentially with observation and safe recovery.
   * Enforces session states (cannot execute if cancelled, failed, or completed).
   */
  public async executeNextStep(
    session: TaskSession,
    callbacks?: OrchestratorCallbacks
  ): Promise<{
    session: TaskSession;
    observation?: StepObservation;
    status: 'CONTINUE' | 'WAITING_CONFIRMATION' | 'FAILED' | 'COMPLETED' | 'CANCELLED';
  }> {
    // 0. Session state boundary checks
    if (session.status === 'CANCELLED') {
      return { session, status: 'CANCELLED' };
    }

    if (session.status === 'COMPLETED') {
      return { session, status: 'COMPLETED' };
    }

    if (session.status === 'FAILED') {
      return { session, status: 'FAILED' };
    }

    const step = TaskSessionModel.getCurrentStep(session);
    if (!step) {
      const completedSession = TaskSessionModel.updateSessionStatus(session, 'COMPLETED');
      if (callbacks?.onStatusChange) callbacks.onStatusChange(completedSession);
      return { session: completedSession, status: 'COMPLETED' };
    }

    // Duplicate execution protection: a completed, cancelled, or permanently failed step cannot execute again
    if (step.state === 'SUCCESS') {
      return { session, status: 'COMPLETED' };
    }
    if (step.state === 'CANCELLED') {
      return { session, status: 'CANCELLED' };
    }
    if (step.state === 'FAILED' && step.retryCount >= step.maxRetries) {
      return { session, status: 'FAILED' };
    }

    // Dependency resolution: forward target/destination from previous successful step if current step is missing parameter
    if (session.currentStep > 0) {
      const prevStep = session.steps[session.currentStep - 1];
      if (prevStep && prevStep.result && prevStep.result.success) {
        const prevTarget = prevStep.result.target || prevStep.result.destination;
        if (
          prevTarget &&
          (!step.command.target ||
            step.command.target === 'it' ||
            step.command.target === 'that file' ||
            step.command.target === 'the file')
        ) {
          step.command = {
            ...step.command,
            target: prevTarget,
          };
          step.description = `[${step.intent}] ${prevTarget}`;
        }
      }
    }

    // Authoritative pre-execution security re-check (in case of dynamic modifications)
    const secValidation = securityGate.validateAction(step.command, {
      taskId: session.id,
      stepId: step.id,
      isConfirmed: !!step.command.params?.confirmed,
    });

    if (!secValidation.valid && !secValidation.requiresConfirmation) {
      const failReason = secValidation.error || 'Action rejected by security gate.';
      let failedSession = TaskSessionModel.updateStepState(
        session,
        step.stepIndex,
        'FAILED',
        undefined,
        failReason
      );
      failedSession = TaskSessionModel.updateSessionStatus(
        failedSession,
        'FAILED',
        `Step ${step.stepIndex + 1} (${step.intent}) security rejection: ${failReason}`
      );
      return { session: failedSession, status: 'FAILED' };
    }

    // 1. High-risk confirmation pause
    const requiresConfirm = secValidation.requiresConfirmation || step.requiresConfirmation;
    if (requiresConfirm && step.state !== 'VALIDATING' && step.state !== 'EXECUTING') {
      let updatedSession = TaskSessionModel.updateStepState(session, step.stepIndex, 'WAITING_CONFIRMATION');
      updatedSession = TaskSessionModel.updateSessionStatus(updatedSession, 'WAITING_CONFIRMATION');
      if (callbacks?.onWaitingConfirmation) callbacks.onWaitingConfirmation(updatedSession, step);
      if (callbacks?.onStatusChange) callbacks.onStatusChange(updatedSession);
      return { session: updatedSession, status: 'WAITING_CONFIRMATION' };
    }

    // 2. Mark EXECUTING
    let currentSession = TaskSessionModel.updateStepState(session, step.stepIndex, 'EXECUTING');
    currentSession = TaskSessionModel.updateSessionStatus(currentSession, 'EXECUTING');
    if (callbacks?.onStepStart) callbacks.onStepStart(currentSession, step);
    if (callbacks?.onStatusChange) callbacks.onStatusChange(currentSession);

    // 3. Execute step
    const context = { previousSteps: session.steps.slice(0, step.stepIndex) };
    const rawResult = await stepExecutor.execute(step, context);
    const observation = ResultObserver.observe(rawResult);

    // 4. Handle SUCCESS
    if (observation.success) {
      currentSession = TaskSessionModel.updateStepState(currentSession, step.stepIndex, 'SUCCESS', rawResult);
      if (callbacks?.onStepComplete) callbacks.onStepComplete(currentSession, step, observation);

      // Advance step
      currentSession = TaskSessionModel.advanceStep(currentSession);
      if (callbacks?.onStatusChange) callbacks.onStatusChange(currentSession);

      if (currentSession.currentStep >= currentSession.totalSteps) {
        currentSession = TaskSessionModel.updateSessionStatus(currentSession, 'COMPLETED');
        return { session: currentSession, observation, status: 'COMPLETED' };
      }

      return { session: currentSession, observation, status: 'CONTINUE' };
    }

    // 5. Handle FAILURE & Recovery Evaluation
    const recovery = RecoveryManager.evaluate(step, observation);

    if (recovery.shouldRetry) {
      // Execute 1 retry attempt
      const retriedStep: TaskStep = {
        ...step,
        retryCount: step.retryCount + 1,
        state: 'EXECUTING',
      };

      const retryContext = { previousSteps: session.steps.slice(0, step.stepIndex) };
      const retryRawResult = await stepExecutor.execute(retriedStep, retryContext);
      const retryObservation = ResultObserver.observe(retryRawResult);

      if (retryObservation.success) {
        currentSession = TaskSessionModel.updateStepState(currentSession, step.stepIndex, 'SUCCESS', retryRawResult);
        if (callbacks?.onStepComplete) callbacks.onStepComplete(currentSession, retriedStep, retryObservation);

        currentSession = TaskSessionModel.advanceStep(currentSession);
        if (callbacks?.onStatusChange) callbacks.onStatusChange(currentSession);

        if (currentSession.currentStep >= currentSession.totalSteps) {
          currentSession = TaskSessionModel.updateSessionStatus(currentSession, 'COMPLETED');
          return { session: currentSession, observation: retryObservation, status: 'COMPLETED' };
        }

        return { session: currentSession, observation: retryObservation, status: 'CONTINUE' };
      }

      // Retry also failed
      currentSession = TaskSessionModel.updateStepState(
        currentSession,
        step.stepIndex,
        'FAILED',
        retryRawResult,
        retryObservation.message
      );
      currentSession = TaskSessionModel.updateSessionStatus(
        currentSession,
        'FAILED',
        `Step ${step.stepIndex + 1} (${step.intent}) failed after retry: ${retryObservation.message}`
      );
      if (callbacks?.onStepFailed) callbacks.onStepFailed(currentSession, retriedStep, retryObservation);
      if (callbacks?.onStatusChange) callbacks.onStatusChange(currentSession);

      return { session: currentSession, observation: retryObservation, status: 'FAILED' };
    }

    // Non-retryable failure
    currentSession = TaskSessionModel.updateStepState(
      currentSession,
      step.stepIndex,
      'FAILED',
      rawResult,
      observation.message
    );
    currentSession = TaskSessionModel.updateSessionStatus(
      currentSession,
      'FAILED',
      `Step ${step.stepIndex + 1} (${step.intent}) failed: ${observation.message}`
    );
    if (callbacks?.onStepFailed) callbacks.onStepFailed(currentSession, step, observation);
    if (callbacks?.onStatusChange) callbacks.onStatusChange(currentSession);

    return { session: currentSession, observation, status: 'FAILED' };
  }

  /**
   * Resumes or cancels a session waiting on user confirmation.
   */
  public confirmStep(
    session: TaskSession,
    confirmed: boolean
  ): { session: TaskSession; status: 'EXECUTING' | 'CANCELLED' } {
    const step = TaskSessionModel.getCurrentStep(session);
    if (!step || step.state !== 'WAITING_CONFIRMATION') {
      return { session, status: session.status === 'CANCELLED' ? 'CANCELLED' : 'EXECUTING' };
    }

    if (confirmed) {
      step.command = {
        ...step.command,
        params: { ...step.command.params, confirmed: true },
      };
      let updatedSession = TaskSessionModel.updateStepState(session, step.stepIndex, 'VALIDATING');
      updatedSession = TaskSessionModel.updateSessionStatus(updatedSession, 'EXECUTING');
      return { session: updatedSession, status: 'EXECUTING' };
    }

    securityGate.cancelPendingConfirmations(session.id);
    let updatedSession = TaskSessionModel.updateStepState(session, step.stepIndex, 'CANCELLED');
    updatedSession = TaskSessionModel.updateSessionStatus(
      updatedSession,
      'CANCELLED',
      `Action [${step.intent}] cancelled by user.`
    );
    return { session: updatedSession, status: 'CANCELLED' };
  }

  /**
   * Safe cancellation of an active task session.
   */
  public cancelSession(session: TaskSession): TaskSession {
    securityGate.cancelPendingConfirmations(session.id);
    const currentStep = session.currentStep;
    let updatedSession = session;
    if (currentStep >= 0 && currentStep < session.steps.length) {
      updatedSession = TaskSessionModel.updateStepState(updatedSession, currentStep, 'CANCELLED');
    }
    return TaskSessionModel.updateSessionStatus(updatedSession, 'CANCELLED', 'Task cancelled by user request.');
  }

  /**
   * Safe dynamic replanning after a step failure or context shift.
   * New commands MUST pass the exact same security and validation checks.
   */
  public replanSession(
    session: TaskSession,
    newRawCommands: ParsedCommand[]
  ): { session: TaskSession; valid: boolean; errors?: string[] } {
    const validation = this.validatePlan(newRawCommands, session.originalRequest);
    if (!validation.valid || !validation.validatedSteps) {
      return { session, valid: false, errors: validation.errors };
    }

    // Keep completed steps, replace current and subsequent steps
    const completedSteps = session.steps.slice(0, session.currentStep);
    const reindexedNewSteps = validation.validatedSteps.map((step, idx) => ({
      ...step,
      stepIndex: completedSteps.length + idx,
      id: `step-replan-${Date.now()}-${completedSteps.length + idx + 1}`,
    }));

    const allSteps = [...completedSteps, ...reindexedNewSteps];

    const updatedSession: TaskSession = {
      ...session,
      steps: allSteps,
      totalSteps: allSteps.length,
      status: 'EXECUTING',
    };

    return { session: updatedSession, valid: true };
  }
}

export const computerUseOrchestrator = new ComputerUseOrchestrator();
