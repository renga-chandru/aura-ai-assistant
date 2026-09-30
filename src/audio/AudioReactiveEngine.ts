import { useAuraStore } from '@/state/useAuraStore';

export interface AudioMetrics {
  uAudioAmp: number;       // Overall normalized amplitude [0..1]
  uBass: number;           // Bass frequency band energy [0..1] (20 - 250 Hz)
  uMid: number;            // Mid frequency band energy [0..1] (250 - 2000 Hz)
  uHigh: number;           // High frequency band energy [0..1] (2000 - 8000 Hz)
  speechEnergy: number;    // Normalized speech presence [0..1]
  activity: number;        // Smooth combined activity factor [0..1]
  isMicrophoneActive: boolean;
  permissionState: 'idle' | 'prompt' | 'granted' | 'denied' | 'error';
}

export type AudioInputSource = 'microphone' | 'playback';

/**
 * AURA Audio-Reactive Engine (Phase 11)
 * High-performance Web Audio API manager with FFT frequency band decomposition,
 * attack/release exponential decay smoothing, and zero per-frame object allocations.
 */
export class AudioReactiveEngine {
  private static instance: AudioReactiveEngine | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private inputSource: AudioInputSource = 'microphone';
  private frequencyData: Uint8Array | null = null;
  private timeDomainData: Uint8Array | null = null;

  private metrics: AudioMetrics = {
    uAudioAmp: 0,
    uBass: 0,
    uMid: 0,
    uHigh: 0,
    speechEnergy: 0,
    activity: 0,
    isMicrophoneActive: false,
    permissionState: 'idle',
  };

  private constructor() {}

  public static getInstance(): AudioReactiveEngine {
    if (!AudioReactiveEngine.instance) {
      AudioReactiveEngine.instance = new AudioReactiveEngine();
    }
    return AudioReactiveEngine.instance;
  }

  /**
   * Set active input source (prepared for Phase 17 TTS / Playback)
   */
  public setInputSource(source: AudioInputSource): void {
    this.inputSource = source;
  }

  public getInputSource(): AudioInputSource {
    return this.inputSource;
  }

  /**
   * Request microphone permission and initialize Web Audio pipeline
   */
  public async startMicrophone(): Promise<boolean> {
    if (this.metrics.isMicrophoneActive && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return true;
    }

    try {
      this.metrics.permissionState = 'prompt';

      if (!navigator?.mediaDevices?.getUserMedia) {
        console.warn('[AURA Audio] getUserMedia is not supported in this browser environment.');
        this.metrics.permissionState = 'error';
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      const binCount = this.analyser.frequencyBinCount;
      this.frequencyData = new Uint8Array(binCount);
      this.timeDomainData = new Uint8Array(binCount);

      this.metrics.isMicrophoneActive = true;
      this.metrics.permissionState = 'granted';

      useAuraStore.getState().addLog('Microphone input initialized & audio-reactive pipeline active.', 'info');
      return true;
    } catch (err) {
      console.warn('[AURA Audio] Microphone access error or permission denied:', err);
      this.stopMicrophone();
      this.metrics.permissionState = 'denied';
      useAuraStore.getState().addLog('Microphone access denied or unavailable. Falling back to ambient mode.', 'warn');
      return false;
    }
  }

  /**
   * Stop microphone stream and release all audio resources cleanly
   */
  public stopMicrophone(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Safe ignore disconnect errors during shutdown
      }
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // Safe ignore close errors
      }
      this.audioContext = null;
    }

    this.analyser = null;
    this.frequencyData = null;
    this.timeDomainData = null;

    this.metrics.isMicrophoneActive = false;
    if (this.metrics.permissionState === 'granted') {
      this.metrics.permissionState = 'idle';
    }

    this.metrics.uAudioAmp = 0;
    this.metrics.uBass = 0;
    this.metrics.uMid = 0;
    this.metrics.uHigh = 0;
    this.metrics.speechEnergy = 0;
    this.metrics.activity = 0;
  }

  /**
   * Toggle microphone state ON / OFF
   */
  public async toggleMicrophone(): Promise<boolean> {
    if (this.metrics.isMicrophoneActive) {
      this.stopMicrophone();
      return false;
    } else {
      return await this.startMicrophone();
    }
  }

  /**
   * Process raw FFT frequency data into attack/release smoothed AudioMetrics.
   * Called inside WebGL 60 FPS frame loop without object allocations.
   */
  public update(): AudioMetrics {
    if (!this.analyser || !this.frequencyData || !this.metrics.isMicrophoneActive) {
      const decay = 0.08;
      this.metrics.uAudioAmp *= (1.0 - decay);
      this.metrics.uBass *= (1.0 - decay);
      this.metrics.uMid *= (1.0 - decay);
      this.metrics.uHigh *= (1.0 - decay);
      this.metrics.speechEnergy *= (1.0 - decay);
      this.metrics.activity *= (1.0 - decay);
      return this.metrics;
    }

    // Read frequency & time-domain data
    this.analyser.getByteFrequencyData(this.frequencyData as unknown as Uint8Array<ArrayBuffer>);
    if (this.timeDomainData) {
      this.analyser.getByteTimeDomainData(this.timeDomainData as unknown as Uint8Array<ArrayBuffer>);
    }

    const binCount = this.frequencyData.length; // 512 bins
    const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
    const hzPerBin = sampleRate / (binCount * 2); // ~43 Hz per bin at 44.1kHz

    const bassEndBin = Math.min(Math.floor(250 / hzPerBin), binCount);       // ~20 - 250 Hz
    const midEndBin = Math.min(Math.floor(2000 / hzPerBin), binCount);      // ~250 - 2000 Hz
    const highEndBin = Math.min(Math.floor(8000 / hzPerBin), binCount);     // ~2000 - 8000 Hz

    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;
    let totalSum = 0;

    for (let i = 0; i < binCount; i++) {
      const val = this.frequencyData[i] / 255.0;
      totalSum += val;

      if (i < bassEndBin) {
        bassSum += val;
      } else if (i < midEndBin) {
        midSum += val;
      } else if (i < highEndBin) {
        highSum += val;
      }
    }

    const rawAmp = totalSum / (highEndBin || 1);
    const rawBass = bassSum / (bassEndBin || 1);
    const rawMid = midSum / ((midEndBin - bassEndBin) || 1);
    const rawHigh = highSum / ((highEndBin - midEndBin) || 1);
    const rawSpeech = rawMid * 0.7 + rawBass * 0.3;

    // Attack / Release Exponential Decay Smoothing
    const attack = 0.35;
    const release = 0.08;

    const smooth = (prev: number, target: number) => {
      const alpha = target > prev ? attack : release;
      return prev + (target - prev) * alpha;
    };

    this.metrics.uAudioAmp = smooth(this.metrics.uAudioAmp, Math.min(rawAmp * 1.5, 1.0));
    this.metrics.uBass = smooth(this.metrics.uBass, Math.min(rawBass * 1.4, 1.0));
    this.metrics.uMid = smooth(this.metrics.uMid, Math.min(rawMid * 1.6, 1.0));
    this.metrics.uHigh = smooth(this.metrics.uHigh, Math.min(rawHigh * 1.8, 1.0));
    this.metrics.speechEnergy = smooth(this.metrics.speechEnergy, Math.min(rawSpeech * 1.6, 1.0));

    this.metrics.activity = Math.max(this.metrics.uAudioAmp, this.metrics.speechEnergy);

    return this.metrics;
  }

  public getMetrics(): AudioMetrics {
    return this.metrics;
  }
}

export const audioEngine = AudioReactiveEngine.getInstance();
