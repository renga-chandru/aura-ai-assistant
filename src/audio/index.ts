import { IVoiceService, AudioSpectrumData } from '@/types';
import { audioEngine, AudioMetrics } from './AudioReactiveEngine';

export * from './AudioReactiveEngine';

/**
 * Web Audio API Engine & Voice Pipeline Implementation
 * Enforces strict IVoiceService abstraction interface.
 */
export class WebAudioVoiceService implements IVoiceService {
  public get isListening(): boolean {
    return audioEngine.getMetrics().isMicrophoneActive;
  }

  public async startListening(onResult: (transcript: string) => void): Promise<void> {
    void onResult;
    await audioEngine.startMicrophone();
  }

  public async stopListening(): Promise<void> {
    audioEngine.stopMicrophone();
  }

  public async speak(text: string, onEnded?: () => void): Promise<void> {
    void text;
    if (onEnded) onEnded();
  }

  public async stopSpeaking(): Promise<void> {}

  public getSpectrumData(): AudioSpectrumData {
    const metrics: AudioMetrics = audioEngine.update();
    return {
      fftBins: new Uint8Array(64),
      averageFrequency: metrics.uAudioAmp * 255,
      peakAmplitude: metrics.activity,
      isSpeechDetected: metrics.speechEnergy > 0.15,
    };
  }
}
