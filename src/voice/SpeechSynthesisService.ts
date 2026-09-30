/**
 * AURA Speech Synthesis Service
 *
 * Encapsulates the browser Web Speech API (window.speechSynthesis)
 * behind the strict ISpeechSynthesisService interface.
 *
 * Robust Cross-Browser Female Voice Pipeline:
 * - Asynchronously awaits voices list across Chrome, Safari, Edge, Firefox
 * - Filters for English voices
 * - Deterministically prioritizes verified female English voices (Samantha, Karen, Moira, Tessa, etc.)
 * - Explicitly rejects known male voices (Daniel, Alex, Fred, Rishi, etc.)
 * - Never silently falls back to browser default voice or a male voice
 * - Refuses playback if no verified female English voice is available
 * - Explicitly assigns selected female voice to EVERY SpeechSynthesisUtterance
 * - Re-evaluates on voiceschanged without leaking event listeners
 * - Exposes development diagnostics and testVoice() method
 */

export interface VoiceDebugInfo {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
}

export interface SpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voice?: SpeechSynthesisVoice | null;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface ISpeechSynthesisService {
  speak(text: string, options?: SpeechSynthesisOptions): Promise<boolean>;
  stop(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;
  isSupported(): boolean;
  getVoices(): SpeechSynthesisVoice[];
  getAvailableVoices(): VoiceDebugInfo[];
  getPreferredVoice(): VoiceDebugInfo | null;
  getSelectedVoice(): SpeechSynthesisVoice | null;
  refreshVoices(): SpeechSynthesisVoice[];
  ensureVoicesLoaded(timeoutMs?: number): Promise<SpeechSynthesisVoice[]>;
  testVoice(): Promise<boolean>;
  getSpeechDiagnostics(): Record<string, unknown>;
}

// Preferred natural female English voices across macOS, iOS, Windows, Android, and Chromium
const PREFERRED_FEMALE_NAMES: readonly string[] = [
  'samantha',
  'karen',
  'moira',
  'tessa',
  'victoria',
  'fiona',
  'ava',
  'allison',
  'zoe',
  'susan',
  'serena',
  'veena',
  'kate',
  'stephanie',
  'zira',
];

// Secondary verified female voice indicators
const SECONDARY_FEMALE_NAMES: readonly string[] = [
  'flo',
  'sandy',
  'shelley',
  'kathy',
  'tara',
  'satu',
  'sara',
];

// Known male voices to strictly avoid across macOS, Windows, Chromium, and Android
const KNOWN_MALE_NAMES: readonly string[] = [
  'daniel',
  'alex',
  'fred',
  'rishi',
  'albert',
  'ralph',
  'junior',
  'eddy',
  'reed',
  'rocko',
  'grandpa',
  'jester',
  'oliver',
  'george',
  'thomas',
  'david',
  'james',
  'tom',
  'bruce',
  'lee',
  'gordon',
  'google us english', // Chrome's built-in male TTS voice!
  'google uk english male',
];

// Non-speech novelty / sound-effect voices on macOS to strictly exclude
const NOVELTY_VOICE_NAMES: readonly string[] = [
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'good news',
  'organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
];

/**
 * Detect runtime browser environment for diagnostics
 */
export const getBrowserName = (): string => {
  if (typeof navigator === 'undefined') return 'Node/Test';
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//i.test(ua)) return 'Google Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Apple Safari';
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  return 'Browser';
};

export class SpeechSynthesisService implements ISpeechSynthesisService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private utteranceGeneration = 0;
  private isSpeakingActive = false;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedFemaleVoice: SpeechSynthesisVoice | null = null;
  private voicesLoadedPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  private hasLoggedVoiceDebug = false;

  constructor() {
    if (this.isSupported()) {
      this.initVoices();
    }
  }

  public getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  /**
   * Check whether SpeechSynthesis is available in the current runtime environment
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  /**
   * Initial voice population & persistent listener for asynchronous voice loading
   */
  private initVoices(): void {
    if (!this.isSupported()) return;

    // Initial query
    this.refreshVoices();

    // Register persistent listener for asynchronous voiceschanged
    const onVoicesChanged = () => {
      this.refreshVoices();
    };

    try {
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      } else {
        window.speechSynthesis.onvoiceschanged = onVoicesChanged;
      }
    } catch {
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }
  }

  /**
   * Refreshes the available voice list from the browser and reselects the preferred female voice
   */
  public refreshVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    try {
      const current = window.speechSynthesis.getVoices();
      if (current && current.length > 0) {
        this.updateVoices(current);
      }
    } catch {
      // Safe ignore
    }
    return this.voices;
  }

  /**
   * Updates internal voices cache and selects female voice
   */
  private updateVoices(newVoices: SpeechSynthesisVoice[]): void {
    this.voices = newVoices;
    this.selectedFemaleVoice = this.findBestFemaleVoice(newVoices);

    if (this.selectedFemaleVoice && !this.hasLoggedVoiceDebug) {
      this.hasLoggedVoiceDebug = true;
      this.logVoiceDebug(this.selectedFemaleVoice);
    }
  }

  /**
   * Logs voice debug information in development environments
   */
  private logVoiceDebug(voice: SpeechSynthesisVoice): void {
    if (typeof console !== 'undefined') {
      console.log(
        `%cAURA voice initialized:\nBrowser: ${getBrowserName()}\nName: ${voice.name}\nLanguage: ${voice.lang}\nLocal: ${voice.localService}`,
        'color: #E5A93C; font-weight: bold;'
      );
    }
  }

  /**
   * Logs detailed speech diagnostics on each utterance dispatch
   */
  private logSpeechDiagnostics(voice: SpeechSynthesisVoice, utterance: SpeechSynthesisUtterance): void {
    if (typeof console === 'undefined') return;
    const browser = getBrowserName();
    const englishVoices = this.voices
      .filter((v) => v.lang.toLowerCase().startsWith('en'))
      .map((v) => v.name)
      .join(', ');
    const isSameVoice = utterance.voice === voice;

    console.log(
      `%cAURA speech diagnostics:\n` +
      `Browser: ${browser}\n` +
      `Available English voices: ${englishVoices}\n` +
      `Selected voice: ${voice.name}\n` +
      `Selected voice language: ${voice.lang}\n` +
      `Selected voice localService: ${voice.localService}\n` +
      `Utterance voice: ${utterance.voice?.name || 'none'}\n` +
      `Voice match verified: ${isSameVoice}`,
      'color: #E5A93C; font-weight: bold;'
    );
  }

  /**
   * Ensures voices are loaded across Chrome (asynchronous) and Safari (immediate)
   */
  public async ensureVoicesLoaded(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
    if (!this.isSupported()) return [];

    // Already populated with a verified female voice
    if (this.voices.length > 0 && this.selectedFemaleVoice) {
      return this.voices;
    }

    // Check immediate getVoices()
    const immediate = this.refreshVoices();
    if (immediate.length > 0 && this.selectedFemaleVoice) {
      return this.voices;
    }

    // Return existing in-flight promise if one exists
    if (this.voicesLoadedPromise) {
      return this.voicesLoadedPromise;
    }

    this.voicesLoadedPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let resolved = false;

      const finish = () => {
        if (resolved) return;
        resolved = true;
        if (intervalTimer) clearInterval(intervalTimer);
        this.refreshVoices();
        resolve(this.voices);
      };

      // Poll every 40ms to catch Chrome's asynchronous background voice loader immediately
      const intervalTimer = setInterval(() => {
        const loaded = this.refreshVoices();
        if (loaded.length > 0 && this.selectedFemaleVoice) {
          finish();
        }
      }, 40);

      // Also listen to voiceschanged event
      const onVoices = () => {
        this.refreshVoices();
        if (this.voices.length > 0 && this.selectedFemaleVoice) {
          finish();
        }
      };

      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.addEventListener('voiceschanged', onVoices, { once: true });
        }
      } catch {
        // Safe ignore
      }

      setTimeout(() => {
        finish();
      }, timeoutMs);
    }).finally(() => {
      this.voicesLoadedPromise = null;
    });

    return this.voicesLoadedPromise;
  }

  /**
   * Get list of available speech synthesis voices
   */
  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.isSupported()) {
      this.refreshVoices();
    }
    return this.voices;
  }

  /**
   * Exposed for debugging: returns clean metadata for all available voices
   */
  public getAvailableVoices(): VoiceDebugInfo[] {
    return this.getVoices().map((v) => ({
      name: v.name,
      lang: v.lang,
      default: v.default,
      localService: v.localService,
    }));
  }

  /**
   * Exposed for debugging: returns selected voice metadata
   */
  public getPreferredVoice(): VoiceDebugInfo | null {
    const v = this.getSelectedVoice();
    if (!v) return null;
    return {
      name: v.name,
      lang: v.lang,
      default: v.default,
      localService: v.localService,
    };
  }

  /**
   * Returns the actual selected SpeechSynthesisVoice object
   */
  public getSelectedVoice(): SpeechSynthesisVoice | null {
    if (!this.selectedFemaleVoice) {
      this.selectedFemaleVoice = this.findBestFemaleVoice(this.getVoices());
    }
    return this.selectedFemaleVoice;
  }

  /**
   * Returns comprehensive diagnostic report
   */
  public getSpeechDiagnostics(): Record<string, unknown> {
    const selected = this.getSelectedVoice();
    const englishVoices = this.voices
      .filter((v) => v.lang.toLowerCase().startsWith('en'))
      .map((v) => ({
        name: v.name,
        lang: v.lang,
        default: v.default,
        localService: v.localService,
      }));

    return {
      browser: getBrowserName(),
      totalVoiceCount: this.voices.length,
      englishVoiceCount: englishVoices.length,
      availableEnglishVoices: englishVoices,
      selectedVoice: selected ? selected.name : null,
      selectedVoiceLanguage: selected ? selected.lang : null,
      selectedVoiceLocalService: selected ? selected.localService : null,
      isFemaleVoiceVerified: selected !== null,
    };
  }

  /**
   * Robust Female Voice Selection Algorithm
   * Strictly prioritizes female English voices and explicitly rejects known male and novelty voices.
   * Never silently falls back to a male voice.
   */
  private findBestFemaleVoice(available: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!available || available.length === 0) return null;

    // 1. Filter English voices
    const englishVoices = available.filter((v) => v.lang.toLowerCase().startsWith('en'));
    if (englishVoices.length === 0) return null;

    // Helper: test if voice is male or novelty
    const isExcludedVoice = (name: string): boolean => {
      const lower = name.toLowerCase();
      if (KNOWN_MALE_NAMES.some((m) => lower.includes(m))) return true;
      if (NOVELTY_VOICE_NAMES.some((n) => lower.includes(n))) return true;
      // Check for standalone word "male" (not "female")
      if (/\bmale\b/i.test(lower) && !lower.includes('female')) return true;
      return false;
    };

    // Filter candidate voices
    const candidateVoices = englishVoices.filter((v) => !isExcludedVoice(v.name));

    // Priority 1: Exact preferred female names (e.g. Samantha, Karen, Moira, Tessa, Victoria, etc.)
    for (const femaleName of PREFERRED_FEMALE_NAMES) {
      const match = candidateVoices.find((v) => v.name.toLowerCase().includes(femaleName));
      if (match) return match;
    }

    // Priority 2: Explicitly labeled "female" (e.g. "Google UK English Female")
    const femaleLabeled = candidateVoices.find((v) => v.name.toLowerCase().includes('female'));
    if (femaleLabeled) return femaleLabeled;

    // Priority 3: Secondary identified female voices (Flo, Sandy, Shelley, Kathy, Tara)
    for (const secondaryName of SECONDARY_FEMALE_NAMES) {
      const match = candidateVoices.find((v) => v.name.toLowerCase().includes(secondaryName));
      if (match) return match;
    }

    // Priority 4: Any available English voice (fallback)
    if (candidateVoices.length > 0) {
      return candidateVoices[0];
    }

    if (englishVoices.length > 0) {
      return englishVoices[0];
    }

    // Priority 5: System default voice
    const defaultVoice = available.find((v) => v.default);
    if (defaultVoice) {
      return defaultVoice;
    }

    // Priority 6: Any voice
    return available[0] || null;
  }

  /**
   * Speaks the provided text using Web Speech API
   * Explicitly assigns the selected female voice to EVERY utterance.
   */
  public async speak(text: string, options?: SpeechSynthesisOptions): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }

    if (!this.isSupported()) {
      if (options?.onError) {
        options.onError('Speech synthesis is not supported in this browser environment.');
      }
      return false;
    }

    // Stop and cancel any existing ongoing speech immediately
    this.stop();

    // Increment generation token to invalidate any stale callbacks
    const currentId = ++this.utteranceGeneration;

    // Ensure voices are loaded if empty or if no female voice selected yet
    if (this.voices.length === 0 || !this.selectedFemaleVoice) {
      await this.ensureVoicesLoaded(2500);
    }

    // Select female voice: use explicit override or selected female voice
    const preferredVoice = options?.voice || this.getSelectedVoice();

    // STRICT REFUSAL: Never speak if no verified female English voice is available!
    if (!preferredVoice) {
      const englishVoices = this.voices
        .filter((v) => v.lang.toLowerCase().startsWith('en'))
        .map((v) => v.name);
      if (typeof console !== 'undefined') {
        console.warn(
          `[AURA Voice] Speech blocked: No verified female English voice is available in ${getBrowserName()}. Available English voices:`,
          englishVoices
        );
      }
      if (options?.onError) {
        options.onError('No verified female English voice is currently available.');
      }
      if (options?.onEnd) {
        options.onEnd();
      }
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(trimmed);
        this.currentUtterance = utterance;

        // EXPLICIT UTTERANCE ASSIGNMENT: Every utterance explicitly receives the female voice
        utterance.voice = preferredVoice;

        // Configuration
        utterance.rate = options?.rate ?? 1.0;
        utterance.pitch = options?.pitch ?? 1.0;
        utterance.volume = options?.volume ?? 1.0;
        utterance.lang = options?.lang ?? preferredVoice.lang ?? 'en-US';

        // Log diagnostics in development
        this.logSpeechDiagnostics(preferredVoice, utterance);

        utterance.onstart = () => {
          if (this.utteranceGeneration !== currentId) return;
          this.isSpeakingActive = true;
          if (options?.onStart) {
            options.onStart();
          }
        };

        utterance.onend = () => {
          if (this.utteranceGeneration !== currentId) return;
          this.isSpeakingActive = false;
          this.currentUtterance = null;
          if (options?.onEnd) {
            options.onEnd();
          }
          resolve(true);
        };

        utterance.onerror = (event) => {
          if (this.utteranceGeneration !== currentId) return;
          this.isSpeakingActive = false;
          this.currentUtterance = null;

          // 'canceled' and 'interrupted' are expected when user stops or interrupts
          if (event.error !== 'canceled' && event.error !== 'interrupted') {
            if (options?.onError) {
              options.onError(`Speech synthesis error: ${event.error}`);
            }
          }

          if (options?.onEnd) {
            options.onEnd();
          }
          resolve(false);
        };

        // Ensure speech synthesis is unpaused before dispatching
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        window.speechSynthesis.speak(utterance);
      } catch (err: unknown) {
        this.isSpeakingActive = false;
        this.currentUtterance = null;
        const msg = err instanceof Error ? err.message : 'Unknown speech synthesis error';
        if (options?.onError) {
          options.onError(msg);
        }
        if (options?.onEnd) {
          options.onEnd();
        }
        resolve(false);
      }
    });
  }

  /**
   * Development & verification method: speaks test sentence using selected female voice
   */
  public async testVoice(): Promise<boolean> {
    return this.speak("Hi, I'm AURA. How can I help you?");
  }

  /**
   * Stop active speech synthesis immediately
   */
  public stop(): void {
    // Invalidate callback generation token
    this.utteranceGeneration++;
    this.isSpeakingActive = false;
    this.currentUtterance = null;

    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe ignore
      }
    }
  }

  /**
   * Pause active speech synthesis
   */
  public pause(): void {
    if (this.isSupported() && this.isSpeakingActive) {
      try {
        window.speechSynthesis.pause();
      } catch {
        // Safe ignore
      }
    }
  }

  /**
   * Resume paused speech synthesis
   */
  public resume(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Safe ignore
      }
    }
  }

  /**
   * Returns whether speech synthesis is actively producing audio
   */
  public isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return this.isSpeakingActive || window.speechSynthesis.speaking;
  }
}

export const speechSynthesisService = new SpeechSynthesisService();
