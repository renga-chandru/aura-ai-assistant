/**
 * AURA Core Domain Types & Interfaces
 * Phase 2 Visual System & Core Machine Contracts
 */

/**
 * Fundamental core states for AURA.
 * Strictly typed string union.
 */
export type AuraState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'EXECUTING';

/**
 * Viewport resolution and display metrics.
 */
export interface ViewportResolution {
  width: number;
  height: number;
  dpr: number;
}

/**
 * Real-time 3D WebGL engine rendering diagnostics.
 */
export interface EngineDiagnostics {
  fps: number;
  frameTimeDelta: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/**
 * AURA Theme Configuration supporting environment and state energy signatures.
 */
export interface AuraThemeConfig {
  voidColor: string;
  spaceColor: string;
  amberColor: string;
  orangeColor: string;
  hotspotColor: string;
  listeningColor: string;
  thinkingColor: string;
  executingColor: string;
}

/**
 * Visual and parametric configuration per AuraState.
 */
export interface StateConfig {
  name: AuraState;
  displayName: string;
  description: string;
  colorHex: string;
  glowClass: string;
  core: {
    scaleMultiplier: number;
    noiseFrequency: number;
    noiseAmplitude: number;
    glowIntensity: number;
    colorHex: string;
  };
  rings: {
    rotationSpeed: number;
    tiltAngle: number;
    pulseFrequency: number;
  };
  particles: {
    count: number;
    speedMultiplier: number;
    direction: 'drift' | 'inward' | 'spiral' | 'outward' | 'shockwave';
  };
  bloom: {
    intensity: number;
    radius: number;
  };
  motion: {
    amplitude: number;
    frequency: number;
  };
  hud: {
    telemetryText: string;
    accentColor: string;
  };
  audioReactivity: {
    enabled: boolean;
    sensitivity: number;
    reactivityMode: 'ambient' | 'stt' | 'shader' | 'tts' | 'subbass';
  };
}

/**
 * Security & Controlled Command Pipeline Types
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CommandSchema {
  id: string;
  actionName: string;
  category: 'file' | 'app' | 'system' | 'browser';
  riskLevel: RiskLevel;
  requiresPermission: boolean;
  payload: Record<string, unknown>;
}

export interface CommandIntent {
  intentId: string;
  rawUserInput: string;
  matchedCommand?: CommandSchema;
  confidence: number;
  extractedParameters: Record<string, unknown>;
}

export interface CommandExecutionResult {
  commandId: string;
  success: boolean;
  executionTimeMs: number;
  outputPayload?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Abstract AI Provider Adapter Interface Contract
 */
export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AiStreamChunk {
  delta: string;
  done: boolean;
  metadata?: Record<string, unknown>;
}

export interface AiProviderConfig {
  providerId: string;
  displayName: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
}

export interface IAiProvider {
  readonly config: AiProviderConfig;
  initialize(apiKey?: string): Promise<boolean>;
  generateResponse(messages: AiMessage[]): Promise<string>;
  streamResponse(
    messages: AiMessage[],
    onChunk: (chunk: AiStreamChunk) => void
  ): Promise<void>;
  parseIntent(userInput: string): Promise<CommandIntent>;
}

/**
 * Voice Pipeline & Audio Spectrum Types
 */
export interface AudioSpectrumData {
  fftBins: Uint8Array;
  averageFrequency: number;
  peakAmplitude: number;
  isSpeechDetected: boolean;
}

export interface IVoiceService {
  isListening: boolean;
  startListening(onResult: (transcript: string) => void): Promise<void>;
  stopListening(): Promise<void>;
  speak(text: string, onEnded?: () => void): Promise<void>;
  stopSpeaking(): Promise<void>;
  getSpectrumData(): AudioSpectrumData;
}

/**
 * System Telemetry Metrics
 */
export interface SystemTelemetry {
  fps: number;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  gpuRenderer: string;
  activeState: AuraState;
  uptimeSeconds: number;
}
