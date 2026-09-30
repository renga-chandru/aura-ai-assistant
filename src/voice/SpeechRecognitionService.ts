import {
  SpeechRecognitionEvents,
  SpeechRecognitionConfig,
  SpeechRecognitionStatus,
} from './types';

// Web Speech API Types fallback for TypeScript window extension
/* eslint-disable @typescript-eslint/no-explicit-any */
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * Isolated Browser Speech Recognition Service (Phase 15)
 * Wraps Web Speech API (SpeechRecognition / webkitSpeechRecognition) safely with fallback detection,
 * interim result tracking, friendly error mapping, and zero duplicate recognition instances.
 */
export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService | null = null;
  private recognition: any = null;
  private status: SpeechRecognitionStatus = 'idle';
  private config: SpeechRecognitionConfig = {
    language: 'en-US',
    continuous: false,
    interimResults: true,
  };
  private events: SpeechRecognitionEvents = {};
  private isListeningActive = false;
  private currentInterimTranscript = '';
  private currentFinalTranscript = '';

  private constructor() {
    this.initRecognition();
  }

  public static getInstance(): SpeechRecognitionService {
    if (!SpeechRecognitionService.instance) {
      SpeechRecognitionService.instance = new SpeechRecognitionService();
    }
    return SpeechRecognitionService.instance;
  }

  /**
   * Safely check if Web Speech Recognition API is supported by the current browser
   */
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public getStatus(): SpeechRecognitionStatus {
    return this.status;
  }

  public getCurrentTranscript(): string {
    return this.currentInterimTranscript;
  }

  public getFinalTranscript(): string {
    return this.currentFinalTranscript;
  }

  public setEvents(events: SpeechRecognitionEvents): void {
    this.events = events;
  }

  public setLanguage(lang: string): void {
    this.config.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  private initRecognition(): void {
    if (!this.isSupported()) {
      this.status = 'unavailable';
      return;
    }

    const win = window as IWindowWithSpeech;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    try {
      this.recognition = new SpeechClass();
      this.recognition.continuous = this.config.continuous ?? false;
      this.recognition.interimResults = this.config.interimResults ?? true;
      this.recognition.lang = this.config.language ?? 'en-US';

      this.recognition.onstart = () => {
        this.status = 'listening';
        this.isListeningActive = true;
        this.currentInterimTranscript = '';
        this.currentFinalTranscript = '';
        if (this.events.onStart) this.events.onStart();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }

        this.currentInterimTranscript = interimTranscript;
        if (finalTranscript) {
          this.currentFinalTranscript += finalTranscript;
        }

        if (interimTranscript.trim() && this.events.onInterimResult) {
          this.events.onInterimResult(interimTranscript);
        }

        if (finalTranscript.trim() && this.events.onFinalResult) {
          this.events.onFinalResult(finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error || 'unknown';
        let friendlyMessage = 'Voice recognition stopped. Try again.';

        if (error === 'not-allowed' || error === 'permission-denied') {
          this.status = 'denied';
          friendlyMessage = 'Microphone permission is required for voice input.';
        } else if (error === 'no-speech') {
          friendlyMessage = 'No speech detected.';
        } else if (error === 'service-not-allowed' || error === 'audio-capture') {
          this.status = 'unavailable';
          friendlyMessage = 'Voice recognition is unavailable.';
        }

        if (this.events.onError) {
          this.events.onError(friendlyMessage, error);
        }
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        if (this.status === 'listening' || this.status === 'requesting') {
          this.status = 'idle';
        }
        if (this.events.onEnd) this.events.onEnd();
      };
    } catch {
      this.status = 'unavailable';
    }
  }

  /**
   * Request and start speech recognition session
   */
  public start(): boolean {
    if (!this.isSupported() || !this.recognition) {
      this.status = 'unavailable';
      if (this.events.onError) {
        this.events.onError('Voice recognition is unavailable in this browser.', 'unsupported');
      }
      return false;
    }

    if (this.isListeningActive) {
      return true;
    }

    try {
      this.status = 'requesting';
      this.recognition.start();
      return true;
    } catch {
      this.status = 'idle';
      return false;
    }
  }

  /**
   * Gracefully stop recognition session
   */
  public stop(): void {
    if (this.recognition && this.isListeningActive) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop errors if already stopping
      }
    }
    this.isListeningActive = false;
    this.status = 'idle';
  }

  /**
   * Abort recognition session immediately
   */
  public abort(): void {
    if (this.recognition && this.isListeningActive) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore abort errors
      }
    }
    this.isListeningActive = false;
    this.status = 'idle';
  }
}

export const speechRecognitionService = SpeechRecognitionService.getInstance();
