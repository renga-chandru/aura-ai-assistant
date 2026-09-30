import { speechRecognitionService, SpeechRecognitionService } from '@/voice/SpeechRecognitionService';
import {
  speechSynthesisService,
  ISpeechSynthesisService,
  VoiceDebugInfo,
} from '@/voice/SpeechSynthesisService';
import { audioEngine } from '@/audio';

export type AuraVoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';
export type NovairVoiceState = AuraVoiceState;

export interface VoiceSpectrumData {
  fftBins: Uint8Array;
  averageFrequency: number;
  peakAmplitude: number;
  isSpeechDetected: boolean;
}

/**
 * Voice Input Service Interface
 */
export interface IAuraVoiceService {
  readonly voiceState: AuraVoiceState;
  startListening(onResult?: (transcript: string) => void): Promise<boolean>;
  stopListening(): void;
  isListening(): boolean;
  isSupported(): boolean;
  getCurrentTranscript(): string;
  getFinalTranscript(): string;
  getSpectrumData(): VoiceSpectrumData;
}
export type INovairVoiceService = IAuraVoiceService;

/**
 * Concrete AuraVoiceAdapter implementing IAuraVoiceService (Voice Input)
 * Connects browser Web Speech API recognition, Web Audio spectrum analyzer, and assistant state architecture.
 */
export class AuraVoiceAdapter implements IAuraVoiceService {
  private service: SpeechRecognitionService = speechRecognitionService;

  public get voiceState(): AuraVoiceState {
    if (auraVoiceOutputService.isSpeaking) return 'SPEAKING';
    const status = this.service.getStatus();
    if (status === 'listening') return 'LISTENING';
    if (status === 'requesting') return 'PROCESSING';
    return 'IDLE';
  }

  public async startListening(onResult?: (transcript: string) => void): Promise<boolean> {
    // If output is speaking, safely stop speech before listening starts
    auraVoiceOutputService.stop();

    if (onResult) {
      this.service.setEvents({
        onFinalResult: onResult,
      });
    }
    await audioEngine.startMicrophone();
    return this.service.start();
  }

  public stopListening(): void {
    this.service.stop();
    audioEngine.stopMicrophone();
  }

  public isListening(): boolean {
    return this.service.getStatus() === 'listening';
  }

  public isSupported(): boolean {
    return this.service.isSupported();
  }

  public getCurrentTranscript(): string {
    return this.service.getCurrentTranscript();
  }

  public getFinalTranscript(): string {
    return this.service.getFinalTranscript();
  }

  public getSpectrumData(): VoiceSpectrumData {
    const metrics = audioEngine.update();
    return {
      fftBins: new Uint8Array(64),
      averageFrequency: metrics.uAudioAmp * 255,
      peakAmplitude: metrics.activity * 255,
      isSpeechDetected: metrics.speechEnergy > 0.15,
    };
  }
}
export const auraVoiceService = new AuraVoiceAdapter();
export const novairVoiceService = auraVoiceService;
export const NovairVoiceAdapter = AuraVoiceAdapter;

/**
 * Voice Output Service Interface
 */
export interface VoiceOutputCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (errorMessage: string) => void;
}

export interface IAuraVoiceOutputService {
  readonly isSpeaking: boolean;
  speak(text: string, callbacks?: VoiceOutputCallbacks): Promise<boolean>;
  stop(): void;
  pause(): void;
  resume(): void;
  isSupported(): boolean;
  getSelectedVoice(): SpeechSynthesisVoice | null;
  getPreferredVoice(): SpeechSynthesisVoice | null;
  getPreferredVoiceDebug(): VoiceDebugInfo | null;
  getAvailableVoices(): VoiceDebugInfo[];
  refreshVoices(): SpeechSynthesisVoice[];
  getSpeechDiagnostics(): Record<string, unknown>;
  testVoice(): Promise<boolean>;
}
export type INovairVoiceOutputService = IAuraVoiceOutputService;

/**
 * Concrete AuraVoiceOutputAdapter implementing IAuraVoiceOutputService (Voice Output)
 * Decouples speech synthesis from React components and connects browser TTS to the assistant loop.
 */
export class AuraVoiceOutputAdapter implements IAuraVoiceOutputService {
  private service: ISpeechSynthesisService;
  private lastSpokenText: string = '';
  private lastSpokenTimestamp: number = 0;

  constructor(service: ISpeechSynthesisService = speechSynthesisService) {
    this.service = service;
  }

  public get isSpeaking(): boolean {
    return this.service.isSpeaking();
  }

  public async speak(text: string, callbacks?: VoiceOutputCallbacks): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Duplicate speech protection: Ignore identical speech triggers within 800ms
    const now = Date.now();
    if (this.lastSpokenText === trimmed && now - this.lastSpokenTimestamp < 800) {
      return false;
    }

    this.lastSpokenText = trimmed;
    this.lastSpokenTimestamp = now;

    return this.service.speak(trimmed, {
      onStart: callbacks?.onStart,
      onEnd: callbacks?.onEnd,
      onError: callbacks?.onError,
    });
  }

  public stop(): void {
    this.service.stop();
  }

  public pause(): void {
    this.service.pause();
  }

  public resume(): void {
    this.service.resume();
  }

  public isSupported(): boolean {
    return this.service.isSupported();
  }

  public getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.service.getSelectedVoice();
  }

  public getPreferredVoice(): SpeechSynthesisVoice | null {
    return this.service.getSelectedVoice();
  }

  public getPreferredVoiceDebug(): VoiceDebugInfo | null {
    return this.service.getPreferredVoice();
  }

  public getAvailableVoices(): VoiceDebugInfo[] {
    return this.service.getAvailableVoices();
  }

  public refreshVoices(): SpeechSynthesisVoice[] {
    return this.service.refreshVoices();
  }

  public getSpeechDiagnostics(): Record<string, unknown> {
    return this.service.getSpeechDiagnostics();
  }

  public async testVoice(): Promise<boolean> {
    return this.service.testVoice();
  }
}

export const auraVoiceOutputService = new AuraVoiceOutputAdapter();
export const novairVoiceOutputService = auraVoiceOutputService;
export const NovairVoiceOutputAdapter = AuraVoiceOutputAdapter;
