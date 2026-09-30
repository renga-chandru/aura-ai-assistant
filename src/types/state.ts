import {
  AuraState,
  StateConfig,
  SystemTelemetry,
  AudioSpectrumData,
  EngineDiagnostics,
  ViewportResolution,
  AuraThemeConfig,
} from './aura';
import { HistoryItem } from './history';
import { AuraSettings } from './settings';
import { ParsedCommand } from '../assistant/commands/types';
import { ConversationTurn, LastActionContext } from '../assistant/brain/types';

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'security';
  message: string;
}

export type ResponseUIState = 'EMPTY' | 'THINKING' | 'RESPONSE' | 'ERROR';

export interface ActiveResponse {
  state: ResponseUIState;
  text: string;
  commandText?: string;
  errorMessage?: string;
}

export interface AuraStoreState {
  // Core State Machine
  currentState: AuraState;
  stateConfig: StateConfig;
  setAuraState: (newState: AuraState) => void;
  
  // Response Area UI State
  activeResponse: ActiveResponse;
  setActiveResponse: (response: Partial<ActiveResponse>) => void;
  submitCommand: (commandText: string) => void;

  // Settings State & Persistence Controls
  settings: AuraSettings;
  updateSettings: (partial: Partial<AuraSettings>) => void;
  settingsPanelOpen: boolean;
  setSettingsPanelOpen: (open: boolean) => void;
  toggleSettingsPanel: () => void;

  // Command History State
  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => string;
  updateHistoryItem: (id: string, partial: Partial<HistoryItem>) => void;
  clearHistory: () => void;

  // History UI Overlay State
  historyPanelOpen: boolean;
  setHistoryPanelOpen: (open: boolean) => void;
  toggleHistoryPanel: () => void;

  // Command text selection for input populating
  selectedCommandText: string | null;
  setSelectedCommandText: (text: string | null) => void;


  // Theme & Environment Config
  themeConfig: AuraThemeConfig;
  
  // Viewport & Rendering Diagnostics
  viewport: ViewportResolution;
  updateViewport: (viewport: Partial<ViewportResolution>) => void;
  
  diagnostics: EngineDiagnostics;
  updateDiagnostics: (diagnostics: Partial<EngineDiagnostics>) => void;

  // System Telemetry
  telemetry: SystemTelemetry;
  updateTelemetry: (partial: Partial<SystemTelemetry>) => void;
  
  // Audio Spectrum (Real-time Web Audio API values)
  spectrum: AudioSpectrumData;
  updateSpectrum: (data: Partial<AudioSpectrumData>) => void;
  
  // Telemetry Log Feed
  logs: TelemetryLogEntry[];
  addLog: (message: string, level?: TelemetryLogEntry['level']) => void;
  clearLogs: () => void;
  
  // UI Overlays & Developer Debug Controls
  debugPanelOpen: boolean;
  setDebugPanelOpen: (open: boolean) => void;
  toggleDebugPanel: () => void;

  specDrawerOpen: boolean;
  setSpecDrawerOpen: (open: boolean) => void;
  
  // Command & Security Pipeline State
  pendingPermissionCheck: boolean;
  activeCommandId: string | null;
  setPendingPermissionCheck: (pending: boolean, commandId?: string | null) => void;

  // System Confirmation Flow State (Phase 21)
  pendingConfirmationCommand: ParsedCommand | null;
  setPendingConfirmationCommand: (command: ParsedCommand | null) => void;

  // Conversational Context State (Phase 23)
  conversationTurns: ConversationTurn[];
  lastActionContext: LastActionContext | null;
  setLastActionContext: (ctx: LastActionContext | null) => void;

  // Phase 31 Advanced Context
  activeContext: Record<string, import('../assistant/brain/types').ContextReference>;
  updateActiveContext: (key: string, ref: import('../assistant/brain/types').ContextReference) => void;
  clearActiveContext: () => void;
}

