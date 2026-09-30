import { create } from 'zustand';
import { AuraState, AuraStoreState, TelemetryLogEntry, ActiveResponse, HistoryItem } from '@/types';
import { AURA_STATE_CONFIGS, DEFAULT_AURA_THEME } from '@/core/constants';
import { loadStoredSettings, saveStoredSettings } from '@/utils';

import {
  localCommandParser,
  isConfirmationIntent,
  isCancellationIntent,
} from '@/assistant/commands';
import {
  macAppExecutor,
  browserExecutor,
  fileExecutor,
  systemExecutor,
} from '@/assistant/execution';
import { novairVoiceOutputService } from '@/assistant/voice';
import { ResponseFormatter, AssistantResponse } from '@/assistant/response';
import {
  conversationBrain,
  BrainDecision,
  ConversationTurn,
  LastActionContext,
  SafeCalculator,
} from '@/assistant/brain';
import { localTaskPlanner } from '@/assistant/planner';
import { aiAssistantBrain, AssistantAIResult } from '@/assistant/ai';
import { computerUseOrchestrator } from '@/assistant/computer';
import { securityGate } from '@/assistant/security';


const initialLog: TelemetryLogEntry = {
  id: 'sys-init-001',
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'AURA Phase 1 Core Foundation Initialized Successfully.',
};

const initialResponse: ActiveResponse = {
  state: 'RESPONSE',
  text: 'Ready. Speak or enter a command below.',
};

const getLocalTimestamp = (): string => {
  const d = new Date();
  return d.toTimeString().split(' ')[0]; // Returns "HH:mm:ss"
};

export const useAuraStore = create<AuraStoreState>((set, get) => ({
  // Core State Machine
  currentState: 'IDLE',
  stateConfig: AURA_STATE_CONFIGS.IDLE,
  
  setAuraState: (newState: AuraState) =>
    set((state) => {
      if (state.currentState === newState) return state;
      const newConfig = AURA_STATE_CONFIGS[newState];
      const newLogEntry: TelemetryLogEntry = {
        id: `state-shift-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `State Transition: ${state.currentState} ➔ ${newState}`,
      };
      return {
        currentState: newState,
        stateConfig: newConfig,
        telemetry: { ...state.telemetry, activeState: newState },
        logs: [newLogEntry, ...state.logs].slice(0, 100),
      };
    }),

  // Response Area UI State
  activeResponse: initialResponse,
  setActiveResponse: (partial) =>
    set((state) => ({
      activeResponse: { ...state.activeResponse, ...partial },
    })),

  // Settings State & Persistence Controls
  settings: loadStoredSettings(),
  updateSettings: (partial) =>
    set((state) => {
      const updated = { ...state.settings, ...partial };
      saveStoredSettings(updated);
      return { settings: updated };
    }),
  settingsPanelOpen: false,
  setSettingsPanelOpen: (open: boolean) => set({ settingsPanelOpen: open }),
  toggleSettingsPanel: () => set((state) => ({ settingsPanelOpen: !state.settingsPanelOpen })),

  // Command History State
  history: [],
  addHistoryItem: (item) => {
    const id = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = getLocalTimestamp();
    const newItem: HistoryItem = { id, timestamp, ...item };
    set((state) => ({
      history: [newItem, ...state.history].slice(0, 30),
    }));
    return id;
  },
  updateHistoryItem: (id, partial) =>
    set((state) => ({
      history: state.history.map((h) => (h.id === id ? { ...h, ...partial } : h)),
    })),
  clearHistory: () => set({ history: [] }),

  // History UI Overlay State
  historyPanelOpen: false,
  setHistoryPanelOpen: (open: boolean) => set({ historyPanelOpen: open }),
  toggleHistoryPanel: () => set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),

  // Command text selection for input populating
  selectedCommandText: null,
  setSelectedCommandText: (text: string | null) => set({ selectedCommandText: text }),

  submitCommand: async (commandText: string) => {
    const trimmed = commandText.trim();
    if (!trimmed) return;

    // Interrupt any active speech output immediately
    novairVoiceOutputService.stop();

    // 0. Duplicate Execution Guard: Prevent duplicate submissions while an action is currently EXECUTING
    if (get().currentState === 'EXECUTING' && !isCancellationIntent(trimmed)) {
      return;
    }

    const startTime = Date.now();
    const timestamp = getLocalTimestamp();
    const histId = `hist-${startTime}-${Math.random().toString(36).substring(2, 6)}`;

    // Helper to speak assistant responses and coordinate SPEAKING visual state
    const speakAssistantResponse = async (resp: AssistantResponse): Promise<void> => {
      if (!resp.shouldSpeak || !resp.spokenText) {
        if (get().currentState === 'EXECUTING' || get().currentState === 'THINKING' || get().currentState === 'SPEAKING') {
          get().setAuraState('IDLE');
        }
        return;
      }

      try {
        const spoken = await novairVoiceOutputService.speak(resp.spokenText, {
          onStart: () => {
            if (get().currentState !== 'LISTENING') {
              get().setAuraState('SPEAKING');
            }
          },
          onEnd: () => {
            if (get().currentState === 'SPEAKING') {
              get().setAuraState('IDLE');
            }
          },
          onError: () => {
            if (get().currentState === 'SPEAKING') {
              get().setAuraState('IDLE');
            }
          },
        });

        if (!spoken && get().currentState === 'SPEAKING') {
          get().setAuraState('IDLE');
        }
      } catch {
        if (get().currentState === 'SPEAKING') {
          get().setAuraState('IDLE');
        }
      } finally {
        if (get().currentState === 'SPEAKING') {
          get().setAuraState('IDLE');
        }
      }
    };

    // Helper to record turn in bounded conversation history (Phase 23)
    const recordTurn = (sender: 'user' | 'assistant', text: string, intent?: string) => {
      const turn: ConversationTurn = {
        id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender,
        text,
        timestamp: getLocalTimestamp(),
        intent: intent as any,
      };
      set((state) => ({
        conversationTurns: [...state.conversationTurns, turn].slice(-20),
      }));
    };

    recordTurn('user', trimmed);

    // 1. Universal Cancellation Handling
    const pendingCmd = get().pendingConfirmationCommand;
    if (isCancellationIntent(trimmed)) {
      securityGate.cancelPendingConfirmations();
      const resp = ResponseFormatter.formatCancellation(pendingCmd);
      const cancelLog: TelemetryLogEntry = {
        id: `cancel-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `User cancelled operation.`,
      };

      set((state) => ({
        pendingConfirmationCommand: null,
        currentState: 'IDLE',
        activeResponse: {
          state: 'RESPONSE',
          text: resp.text,
          commandText: trimmed,
        },
        logs: [cancelLog, ...state.logs].slice(0, 100),
        history: state.settings.commandHistory
          ? [
              {
                id: histId,
                timestamp,
                command: trimmed,
                status: 'SUCCESS' as const,
                response: resp.text,
                durationMs: Date.now() - startTime,
              },
              ...state.history,
            ].slice(0, 30)
          : state.history,
      }));

      recordTurn('assistant', resp.text, 'CANCELLED');
      await speakAssistantResponse(resp);
      return;
    }

    // 1b. Check if a confirmation is currently pending and user confirmed
    if (pendingCmd) {
      if (isConfirmationIntent(trimmed)) {
        const confirmLog: TelemetryLogEntry = {
          id: `confirm-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Confirmation received for [${pendingCmd.type}]. Executing action.`,
        };

        set((state) => ({
          pendingConfirmationCommand: null,
          currentState: 'EXECUTING',
          activeResponse: {
            state: 'RESPONSE',
            text: `Executing confirmed action: [${pendingCmd.type}]...`,
            commandText: trimmed,
          },
          logs: [confirmLog, ...state.logs].slice(0, 100),
        }));

        const execResult = await systemExecutor.execute(pendingCmd, true);
        const durationMs = Date.now() - startTime;
        const resp = ResponseFormatter.formatConfirmedExecution(pendingCmd, execResult);
        const isSuccess = execResult.success;

        const execLog: TelemetryLogEntry = {
          id: `sys-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: isSuccess ? 'info' : 'warn',
          message: `System Action Result: ${resp.text}`,
        };

        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: isSuccess ? 'RESPONSE' : 'ERROR',
            text: resp.text,
            commandText: trimmed,
          },
          logs: [execLog, ...state.logs].slice(0, 100),
          history: state.settings.commandHistory
            ? [
                {
                  id: histId,
                  timestamp,
                  command: trimmed,
                  parsedCommand: pendingCmd,
                  status: isSuccess ? 'SUCCESS' as const : 'ERROR' as const,
                  response: resp.text,
                  durationMs,
                },
                ...state.history,
              ].slice(0, 30)
            : state.history,
        }));

        recordTurn('assistant', resp.text, 'CONFIRMED');
        await speakAssistantResponse(resp);
        return;
      }

      // 1c. If user enters an unrelated command while confirmation was pending, clear pending confirmation and proceed
      set({ pendingConfirmationCommand: null });
    }

    // 2. Security Pre-Filter: Block dangerous shell commands before AI brain query (Phase 25)
    // This ensures that even if the AI brain classifies a dangerous input as "conversation",
    // the local security layer remains the authoritative guardian.
    const securityPrecheck = localCommandParser.parse(trimmed);
    if (
      /^(sudo|defaults|killall|launchctl|chmod|chown|osascript|eval|exec)\b/i.test(trimmed) ||
      /^(?:run|execute)\s+(sudo|defaults|killall|launchctl|chmod|chown|osascript|sh|bash|zsh)/i.test(trimmed.toLowerCase()) ||
      (securityPrecheck.risk === 'HIGH' && securityPrecheck.type === 'UNKNOWN')
    ) {
      const securityResp = ResponseFormatter.formatFallback(securityPrecheck);
      const durationMs = Date.now() - startTime;
      const secLog: TelemetryLogEntry = {
        id: `sec-block-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: `Security Pre-Filter blocked dangerous input: "${trimmed.substring(0, 60)}"`,
      };
      set((state) => ({
        currentState: 'IDLE',
        activeResponse: {
          state: 'ERROR',
          text: securityResp.text,
          commandText: trimmed,
        },
        logs: [secLog, ...state.logs].slice(0, 100),
        history: state.settings.commandHistory
          ? [{ id: histId, timestamp, command: trimmed, status: 'ERROR' as const, response: securityResp.text, durationMs }, ...state.history].slice(0, 30)
          : state.history,
      }));
      recordTurn('assistant', securityResp.text, 'SECURITY_BLOCK');
      await speakAssistantResponse(securityResp);
      return;
    }

    // 3. Query AI Brain (Phase 25)
    const newHistItem: HistoryItem = {
      id: histId,
      timestamp,
      command: trimmed,
      status: 'THINKING',
    };

    const newLogEntry: TelemetryLogEntry = {
      id: `cmd-sub-${startTime}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Analyzing: "${trimmed}"`,
    };

    set((state) => {
      const recordHistory = state.settings.commandHistory;
      return {
        currentState: 'THINKING',
        activeResponse: {
          state: 'THINKING',
          text: `Analyzing: "${trimmed}"`,
          commandText: trimmed,
        },
        history: recordHistory ? [newHistItem, ...state.history].slice(0, 30) : state.history,
        logs: [newLogEntry, ...state.logs].slice(0, 100),
      };
    });

    let aiResult: AssistantAIResult | null = null;
    let brainDecision: BrainDecision;

    try {
      aiResult = await aiAssistantBrain.respond(trimmed, {
        recentHistory: get().conversationTurns,
        lastAction: get().lastActionContext || undefined,
        activeContext: get().activeContext,
      });
      brainDecision = aiAssistantBrain.toBrainDecision(aiResult, trimmed);
    } catch {
      brainDecision = await conversationBrain.process(trimmed, {
        recentHistory: get().conversationTurns,
        lastAction: get().lastActionContext || undefined,
        activeContext: get().activeContext,
      });
    }

    if (localTaskPlanner.isMultiStepIntent(trimmed)) {
      brainDecision.intent = 'MULTI_STEP_COMMAND';
    }

    // 3. Handle CHAT / QUESTION intents
    if (brainDecision.intent === 'CHAT' || brainDecision.intent === 'QUESTION') {
      const durationMs = Date.now() - startTime;
      const resp = ResponseFormatter.formatChat(brainDecision.chatResponse || "Hello! How can I help you today?");

      set((state) => ({
        currentState: 'IDLE',
        activeResponse: {
          state: 'RESPONSE',
          text: resp.text,
          commandText: trimmed,
        },
        history: state.settings.commandHistory
          ? state.history.map((item) =>
              item.id === histId
                ? { ...item, status: 'SUCCESS', response: resp.text, durationMs }
                : item
            )
          : state.history,
      }));

      recordTurn('assistant', resp.text, brainDecision.intent);
      await speakAssistantResponse(resp);
      return;
    }

    // 4. Handle CALCULATION intent
    if (brainDecision.intent === 'CALCULATION') {
      const durationMs = Date.now() - startTime;
      const calcResult = brainDecision.calculationResult || SafeCalculator.calculate(trimmed);
      if (calcResult) {
        const resp = ResponseFormatter.formatCalculation(calcResult);

        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: 'RESPONSE',
            text: resp.text,
            commandText: trimmed,
          },
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? { ...item, status: 'SUCCESS', response: resp.text, durationMs }
                  : item
              )
            : state.history,
        }));

        get().updateActiveContext('calculation', { type: 'calculation', value: calcResult.result.toString(), timestamp: Date.now() });

        recordTurn('assistant', resp.text, 'CALCULATION');
        await speakAssistantResponse(resp);
        return;
      }
    }

    // 5. Handle MULTI_STEP_COMMAND intent
    if (brainDecision.intent === 'MULTI_STEP_COMMAND') {
      const plan =
        localTaskPlanner.plan(trimmed) ||
        (aiResult?.parsedCommands && aiResult.parsedCommands.length >= 2
          ? localTaskPlanner.planFromCommands(aiResult.parsedCommands, trimmed)
          : null);

      const commandsToValidate = plan
        ? plan.steps.map((s) => s.command!).filter(Boolean)
        : aiResult?.parsedCommands || [];

      if (commandsToValidate.length > 0) {
        const validation = computerUseOrchestrator.validatePlan(commandsToValidate, trimmed);

        if (!validation.valid || !validation.validatedSteps || validation.validatedSteps.length === 0) {
          const errors = validation.errors || ['Plan validation failed.'];
          const resp = ResponseFormatter.formatTaskResult('Validation failed: ' + errors[0]);
          
          set((state) => ({
            currentState: 'IDLE',
            activeResponse: {
              state: 'ERROR',
              text: resp.text,
              commandText: trimmed,
            },
            history: state.settings.commandHistory
              ? state.history.map((item) =>
                  item.id === histId
                    ? { ...item, status: 'ERROR', response: resp.text, durationMs: Date.now() - startTime }
                    : item
                )
              : state.history,
          }));
          
          recordTurn('assistant', resp.text, 'MULTI_STEP_COMMAND');
          await speakAssistantResponse(resp);
          return;
        }

        let session = computerUseOrchestrator.createSession(trimmed, validation.validatedSteps);

        set({
          currentState: 'EXECUTING',
          activeResponse: {
            state: 'RESPONSE',
            text: `Executing plan (${session.totalSteps} steps)...`,
            commandText: trimmed,
          },
        });

        const stepSummaries: string[] = [];

        while (session.currentStep < session.totalSteps) {
          const step = session.steps[session.currentStep];
          set({
            currentState: 'EXECUTING',
            activeResponse: {
              state: 'RESPONSE',
              text: `Step ${session.currentStep + 1}/${session.totalSteps}: ${step.description}...`,
              commandText: trimmed,
            },
          });

          const stepResult = await computerUseOrchestrator.executeNextStep(session);
          session = stepResult.session;

          if (stepResult.status === 'WAITING_CONFIRMATION') {
            set({
              pendingConfirmationCommand: step.command,
              currentState: 'IDLE',
              activeResponse: {
                state: 'RESPONSE',
                text: `Confirmation required for step ${session.currentStep + 1}: ${step.description}. Proceed?`,
                commandText: trimmed,
              },
            });
            return;
          }

          if (stepResult.observation) {
            const fmt = ResponseFormatter.format(step.command, {
              success: stepResult.observation.success,
              action: stepResult.observation.action,
              message: stepResult.observation.message,
              errorCode: stepResult.observation.errorCode,
              data: stepResult.observation.data?.resultData,
            });
            stepSummaries.push(fmt.text);

            if (stepResult.observation.success) {
              const ts = Date.now();
              if (step.command.type === 'OPEN_APP' && step.command.target) {
                get().updateActiveContext('app', { type: 'app', value: step.command.target, timestamp: ts });
              } else if (step.command.type === 'OPEN_URL' || step.command.type === 'WEB_SEARCH') {
                get().updateActiveContext('browser', { type: 'url', value: step.command.target || step.command.query || '', timestamp: ts });
                if (step.command.type === 'WEB_SEARCH') {
                  get().updateActiveContext('search', { type: 'search', value: step.command.query || step.command.target || '', timestamp: ts });
                }
              } else if (['OPEN_FILE', 'OPEN_FOLDER', 'CREATE_FILE', 'CREATE_FOLDER'].includes(step.command.type) && step.command.target) {
                get().updateActiveContext(step.command.type.includes('FILE') ? 'file' : 'folder', { type: step.command.type.includes('FILE') ? 'file' : 'folder', value: step.command.target, timestamp: ts });
              } else if (step.command.type === 'EXTRACT_INFO' && stepResult.observation.data?.resultData) {
                const facts = (stepResult.observation.data.resultData as any).facts;
                if (facts && facts.length > 0) {
                  get().updateActiveContext('result', { type: 'result', value: facts.join(' '), timestamp: ts });
                }
              }
            }
          }

          if (stepResult.status === 'FAILED') {
            const durationMs = Date.now() - startTime;
            const completedCount = session.steps.filter((s) => s.state === 'SUCCESS').length;
            const resp = ResponseFormatter.formatPartialSuccess(
              completedCount,
              session.totalSteps,
              session.failureReason,
              stepSummaries
            );

            set((state) => ({
              currentState: 'IDLE',
              activeResponse: {
                state: 'ERROR',
                text: resp.text,
                commandText: trimmed,
              },
              history: state.settings.commandHistory
                ? state.history.map((item) =>
                    item.id === histId
                      ? { ...item, status: 'ERROR', response: resp.text, durationMs }
                      : item
                  )
                : state.history,
            }));
            recordTurn('assistant', resp.text, 'MULTI_STEP_COMMAND');
            await speakAssistantResponse(resp);
            return;
          }

          if (stepResult.status === 'CANCELLED') {
            set(() => ({
              currentState: 'IDLE',
              activeResponse: {
                state: 'RESPONSE',
                text: 'Task cancelled.',
                commandText: trimmed,
              },
            }));
            return;
          }

          // Brief delay between steps for visual feedback
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const durationMs = Date.now() - startTime;
        let finalSummary = stepSummaries.join(' ');
        if (
          stepSummaries.length === 2 &&
          stepSummaries[0].toLowerCase().includes('opening') &&
          stepSummaries[1].toLowerCase().includes('searching')
        ) {
          const appPart = stepSummaries[0].replace(/^opening\s+/i, 'Opened ').replace(/[.]+$/, '');
          const searchPart = stepSummaries[1].replace(/^searching\s+/i, 'searched ');
          finalSummary = `${appPart} and ${searchPart}`;
        } else if (
          stepSummaries.length === 2 &&
          stepSummaries[0].toLowerCase().includes('opening')
        ) {
          const appPart = stepSummaries[0].replace(/^opening\s+/i, 'Opened ');
          finalSummary = `${appPart} ${stepSummaries[1]}`;
        }

        const resp = ResponseFormatter.formatTaskResult(finalSummary);

        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: 'RESPONSE',
            text: resp.text,
            commandText: trimmed,
          },
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? { ...item, status: 'SUCCESS', response: resp.text, durationMs }
                  : item
              )
            : state.history,
        }));

        recordTurn('assistant', resp.text, 'MULTI_STEP_COMMAND');
        await speakAssistantResponse(resp);
        return;
      }
    }

    // 6. Handle SINGLE COMMAND intent (APP, BROWSER, FILE, SYSTEM)
    const parsedCommand =
      brainDecision.singleCommand ||
      (aiResult?.parsedCommands && aiResult.parsedCommands.length > 0
        ? aiResult.parsedCommands[0]
        : localCommandParser.parse(trimmed));

    // Authoritative deterministic risk classification
    parsedCommand.risk = securityGate.calculateDeterministicRisk(parsedCommand.type, parsedCommand.originalInput, parsedCommand.params);

    // Check if command is a supported macOS application action (Phase 18)
    const isAppAction = parsedCommand.type === 'OPEN_APP' || parsedCommand.type === 'CLOSE_APP';
    // Check if command is a supported browser & web action (Phase 19)
    const isBrowserAction = parsedCommand.type === 'OPEN_URL' || parsedCommand.type === 'WEB_SEARCH';
    // Check if command is a supported file & folder action (Phase 20)
    const isFileAction =
      parsedCommand.type === 'OPEN_FOLDER' ||
      parsedCommand.type === 'OPEN_FILE' ||
      parsedCommand.type === 'CREATE_FILE' ||
      parsedCommand.type === 'MOVE_FILE' ||
      parsedCommand.type === 'DELETE_FILE';
    // Check if command is a supported system control action (Phase 21)
    const isSystemAction =
      parsedCommand.type === 'SYSTEM_SETTING' ||
      parsedCommand.type === 'SLEEP' ||
      parsedCommand.type === 'RESTART' ||
      parsedCommand.type === 'SHUTDOWN';
    const isCalculateAction = parsedCommand.type === 'CALCULATE';

    if (isAppAction) {
      // Transition from THINKING to EXECUTING state
      await new Promise((resolve) => setTimeout(resolve, 300));

      set({
        currentState: 'EXECUTING',
        activeResponse: {
          state: 'RESPONSE',
          text: `Executing: [${parsedCommand.type}] ${parsedCommand.target || ''}...`,
          commandText: trimmed,
        },
      });

      // Execute via controlled MacAppExecutor
      const execResult = await macAppExecutor.execute(parsedCommand);
      const durationMs = Date.now() - startTime;
      const resp = ResponseFormatter.format(parsedCommand, execResult);
      const isSuccess = execResult.success;

      const execLog: TelemetryLogEntry = {
        id: `exec-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: isSuccess ? 'info' : 'warn',
        message: `Execution Result: ${resp.text}`,
      };

      set((state) => ({
        currentState: 'IDLE',
        lastActionContext: { action: parsedCommand.type, target: parsedCommand.target, timestamp: Date.now() },
        activeResponse: {
          state: isSuccess ? 'RESPONSE' : 'ERROR',
          text: resp.text,
          commandText: trimmed,
        },
        logs: [execLog, ...state.logs].slice(0, 100),
        history: state.settings.commandHistory
          ? state.history.map((item) =>
              item.id === histId
                ? {
                    ...item,
                    status: isSuccess ? 'SUCCESS' : 'ERROR',
                    response: resp.text,
                    durationMs,
                  }
                : item
            )
          : state.history,
      }));

      recordTurn('assistant', resp.text, parsedCommand.type);
      await speakAssistantResponse(resp);
    } else if (isBrowserAction) {
      // Transition from THINKING to EXECUTING state (Phase 19)
      await new Promise((resolve) => setTimeout(resolve, 300));

      set({
        currentState: 'EXECUTING',
        activeResponse: {
          state: 'RESPONSE',
          text: `Executing: [${parsedCommand.type}] ${parsedCommand.target || parsedCommand.query || ''}...`,
          commandText: trimmed,
        },
      });

      // Execute via controlled BrowserExecutor
      const execResult = await browserExecutor.execute(parsedCommand);
      const durationMs = Date.now() - startTime;
      const resp = ResponseFormatter.format(parsedCommand, execResult);
      const isSuccess = execResult.success;

      const execLog: TelemetryLogEntry = {
        id: `browser-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: isSuccess ? 'info' : 'warn',
        message: `Browser Result: ${resp.text}`,
      };

      set((state) => ({
        currentState: 'IDLE',
        lastActionContext: { action: parsedCommand.type, target: parsedCommand.target, timestamp: Date.now() },
        activeResponse: {
          state: isSuccess ? 'RESPONSE' : 'ERROR',
          text: resp.text,
          commandText: trimmed,
        },
        logs: [execLog, ...state.logs].slice(0, 100),
        history: state.settings.commandHistory
          ? state.history.map((item) =>
              item.id === histId
                ? {
                    ...item,
                    status: isSuccess ? 'SUCCESS' : 'ERROR',
                    response: resp.text,
                    durationMs,
                  }
                : item
            )
          : state.history,
      }));

      recordTurn('assistant', resp.text, parsedCommand.type);
      await speakAssistantResponse(resp);
    } else if (isFileAction) {
      if (parsedCommand.type === 'DELETE_FILE') {
        // DELETE_FILE: Preview / Confirmation-only mode (CRITICAL: Do NOT execute deletion in Phase 20)
        const execResult = await fileExecutor.execute(parsedCommand);
        const durationMs = Date.now() - startTime;
        const resp = ResponseFormatter.format(parsedCommand, execResult);

        const deleteLog: TelemetryLogEntry = {
          id: `delete-preview-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: `Security Guard: ${resp.text}`,
        };

        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: 'RESPONSE',
            text: resp.text,
            commandText: trimmed,
          },
          logs: [deleteLog, ...state.logs].slice(0, 100),
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? {
                      ...item,
                      status: 'SUCCESS',
                      response: resp.text,
                      durationMs,
                    }
                  : item
              )
            : state.history,
        }));

        recordTurn('assistant', resp.text, parsedCommand.type);
        await speakAssistantResponse(resp);
      } else {
        // Transition from THINKING to EXECUTING state (Phase 20)
        await new Promise((resolve) => setTimeout(resolve, 300));

        set({
          currentState: 'EXECUTING',
          activeResponse: {
            state: 'RESPONSE',
            text: `Executing: [${parsedCommand.type}] ${parsedCommand.target || ''}${parsedCommand.destination ? ` ➔ ${parsedCommand.destination}` : ''}...`,
            commandText: trimmed,
          },
        });

        // Execute via controlled FileExecutor
        const execResult = await fileExecutor.execute(parsedCommand);
        const durationMs = Date.now() - startTime;
        const resp = ResponseFormatter.format(parsedCommand, execResult);
        const isSuccess = execResult.success;

        const execLog: TelemetryLogEntry = {
          id: `file-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: isSuccess ? 'info' : 'warn',
          message: `File Action Result: ${resp.text}`,
        };

        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: isSuccess ? 'RESPONSE' : 'ERROR',
            text: resp.text,
            commandText: trimmed,
          },
          logs: [execLog, ...state.logs].slice(0, 100),
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? {
                      ...item,
                      status: isSuccess ? 'SUCCESS' : 'ERROR',
                      response: resp.text,
                      durationMs,
                    }
                  : item
              )
            : state.history,
        }));

        recordTurn('assistant', resp.text, parsedCommand.type);
        await speakAssistantResponse(resp);
      }
    } else if (isSystemAction) {
      if (
        parsedCommand.type === 'SLEEP' ||
        parsedCommand.type === 'RESTART' ||
        parsedCommand.type === 'SHUTDOWN'
      ) {
        // High Risk system actions require explicit confirmation! (Phase 21)
        const execResult = await systemExecutor.execute(parsedCommand, false);
        const durationMs = Date.now() - startTime;
        const resp = ResponseFormatter.format(parsedCommand, execResult);

        const confirmReqLog: TelemetryLogEntry = {
          id: `sys-confirm-req-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: `High-Risk Action: Explicit confirmation required for [${parsedCommand.type}].`,
        };

        set((state) => ({
          pendingConfirmationCommand: parsedCommand,
          currentState: 'IDLE',
          activeResponse: {
            state: 'RESPONSE',
            text: resp.text,
            commandText: trimmed,
          },
          logs: [confirmReqLog, ...state.logs].slice(0, 100),
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? {
                      ...item,
                      status: 'SUCCESS' as const,
                      response: resp.text,
                      durationMs,
                    }
                  : item
              )
            : state.history,
        }));

        recordTurn('assistant', resp.text, parsedCommand.type);
        await speakAssistantResponse(resp);
      } else {
        // Normal SYSTEM_SETTING (Medium Risk) — executes directly
        await new Promise((resolve) => setTimeout(resolve, 300));

        set({
          currentState: 'EXECUTING',
          activeResponse: {
            state: 'RESPONSE',
            text: `Executing: [${parsedCommand.type}] ${parsedCommand.target || ''}...`,
            commandText: trimmed,
          },
        });

        const execResult = await systemExecutor.execute(parsedCommand);
        const durationMs = Date.now() - startTime;
        const resp = ResponseFormatter.format(parsedCommand, execResult);
        const isSuccess = execResult.success;

        const execLog: TelemetryLogEntry = {
          id: `setting-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: isSuccess ? 'info' : 'warn',
          message: `System Setting Result: ${resp.text}`,
        };

        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: isSuccess ? 'RESPONSE' : 'ERROR',
            text: resp.text,
            commandText: trimmed,
          },
          logs: [execLog, ...state.logs].slice(0, 100),
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? {
                      ...item,
                      status: isSuccess ? 'SUCCESS' : 'ERROR',
                      response: resp.text,
                      durationMs,
                    }
                  : item
              )
            : state.history,
        }));

        recordTurn('assistant', resp.text, parsedCommand.type);
        await speakAssistantResponse(resp);
      }
    } else if (isCalculateAction) {
      const expr = parsedCommand.query || parsedCommand.target || parsedCommand.originalInput || trimmed;
      const calcResult = SafeCalculator.calculate(expr);
      const durationMs = Date.now() - startTime;
      if (calcResult) {
        const resp = ResponseFormatter.formatCalculation(calcResult);
        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: 'RESPONSE',
            text: resp.text,
            commandText: trimmed,
          },
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? { ...item, status: 'SUCCESS', response: resp.text, durationMs }
                  : item
              )
            : state.history,
        }));
        recordTurn('assistant', resp.text, 'CALCULATION');
        await speakAssistantResponse(resp);
        return;
      } else {
        const failMsg = "I couldn't calculate that expression.";
        const resp = ResponseFormatter.format(parsedCommand, {
          success: false,
          action: 'CALCULATE',
          message: failMsg,
          errorCode: 'INVALID_EXPRESSION',
        });
        set((state) => ({
          currentState: 'IDLE',
          activeResponse: {
            state: 'ERROR',
            text: resp.text,
            commandText: trimmed,
          },
          history: state.settings.commandHistory
            ? state.history.map((item) =>
                item.id === histId
                  ? { ...item, status: 'ERROR', response: resp.text, durationMs }
                  : item
              )
            : state.history,
        }));
        recordTurn('assistant', resp.text, 'CALCULATION');
        await speakAssistantResponse(resp);
        return;
      }
    } else {
      // 7. Fallback: Security Block or Conversational Unknown
      const durationMs = Date.now() - startTime;
      let resp: AssistantResponse;

      if (
        /^(sudo|defaults|killall|launchctl|chmod|chown|osascript|eval|exec)\b/i.test(parsedCommand.normalizedInput) ||
        parsedCommand.risk === 'HIGH'
      ) {
        resp = ResponseFormatter.formatFallback(parsedCommand);
      } else {
        resp = ResponseFormatter.formatChat(brainDecision.chatResponse || "I'm not sure how to do that yet.");
      }

      set((state) => ({
        currentState: 'IDLE',
        activeResponse: {
          state: resp.category === 'SECURITY_BLOCK' ? 'ERROR' : 'RESPONSE',
          text: resp.text,
          commandText: trimmed,
        },
        history: state.settings.commandHistory
          ? state.history.map((item) =>
              item.id === histId
                ? { ...item, status: 'SUCCESS', response: resp.text, durationMs }
                : item
            )
          : state.history,
      }));

      recordTurn('assistant', resp.text, resp.intent || 'UNKNOWN');
      await speakAssistantResponse(resp);
    }
  },

  // Theme Config
  themeConfig: DEFAULT_AURA_THEME,

  // Viewport Resolution
  viewport: {
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1,
  },
  updateViewport: (partial) =>
    set((state) => ({
      viewport: { ...state.viewport, ...partial },
    })),

  // WebGL Engine Rendering Diagnostics
  diagnostics: {
    fps: 60,
    frameTimeDelta: 16.67,
    drawCalls: 12,
    triangles: 24500,
    geometries: 8,
    textures: 4,
  },
  updateDiagnostics: (partial) =>
    set((state) => ({
      diagnostics: { ...state.diagnostics, ...partial },
    })),

  // System Telemetry Metrics
  telemetry: {
    fps: 60,
    cpuUsagePercent: 4.2,
    memoryUsageMb: 128.5,
    gpuRenderer: 'WebGL 2.0 / Apple M-Series GPU',
    activeState: 'IDLE',
    uptimeSeconds: 0,
  },
  updateTelemetry: (partial) =>
    set((state) => ({
      telemetry: { ...state.telemetry, ...partial },
    })),

  // Audio Spectrum Data
  spectrum: {
    fftBins: new Uint8Array(64),
    averageFrequency: 0,
    peakAmplitude: 0,
    isSpeechDetected: false,
  },
  updateSpectrum: (data) =>
    set((state) => ({
      spectrum: { ...state.spectrum, ...data },
    })),

  // Telemetry Log Feed
  logs: [initialLog],
  addLog: (message: string, level: TelemetryLogEntry['level'] = 'info') =>
    set((state) => ({
      logs: [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          level,
          message,
        },
        ...state.logs,
      ].slice(0, 100),
    })),
  clearLogs: () => set({ logs: [] }),

  // UI Overlays & Developer Controls
  debugPanelOpen: false,
  setDebugPanelOpen: (open: boolean) => set({ debugPanelOpen: open }),
  toggleDebugPanel: () => set((state) => ({ debugPanelOpen: !state.debugPanelOpen })),

  specDrawerOpen: false,
  setSpecDrawerOpen: (open: boolean) => set({ specDrawerOpen: open }),

  // Controlled Command Pipeline State
  pendingPermissionCheck: false,
  activeCommandId: null,
  setPendingPermissionCheck: (pending: boolean, commandId: string | null = null) =>
    set({ pendingPermissionCheck: pending, activeCommandId: commandId }),

  // System Confirmation Flow State (Phase 21)
  pendingConfirmationCommand: null,
  setPendingConfirmationCommand: (command) =>
    set({ pendingConfirmationCommand: command }),

  // Conversational Context State (Phase 23)
  conversationTurns: [] as ConversationTurn[],
  lastActionContext: null as LastActionContext | null,
  setLastActionContext: (ctx: LastActionContext | null) =>
    set({ lastActionContext: ctx }),

  // Phase 31 Advanced Context
  activeContext: {} as Record<string, import('../assistant/brain/types').ContextReference>,
  updateActiveContext: (key, ref) => set((state) => {
    const now = Date.now();
    const newContext = { ...state.activeContext, [key]: ref };
    for (const k in newContext) {
      if (now - newContext[k].timestamp > 5 * 60 * 1000) {
        delete newContext[k];
      }
    }
    return { activeContext: newContext };
  }),
  clearActiveContext: () => set({ activeContext: {} }),
}));

export const useNovairStore = useAuraStore;

