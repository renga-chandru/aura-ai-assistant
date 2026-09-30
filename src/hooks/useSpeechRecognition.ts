import { useEffect, useState, useCallback } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';
import { speechRecognitionService } from '@/voice';
import { novairVoiceOutputService } from '@/assistant/voice';

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  errorMessage: string | null;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  toggleListening: () => Promise<boolean>;
}

/**
 * Custom Voice Recognition Hook (Phase 15 Enhanced Phase 22)
 * Coordinates Web Speech API service, Web Audio API visualization engine, and AURA state machine.
 */
export const useSpeechRecognition = (
  onFinalTranscript?: (transcript: string) => void
): UseSpeechRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setAuraState = useAuraStore((state) => state.setAuraState);
  const setActiveResponse = useAuraStore((state) => state.setActiveResponse);
  const isSupported = speechRecognitionService.isSupported();

  useEffect(() => {
    speechRecognitionService.setEvents({
      onStart: () => {
        // Safe interruption: Stop any ongoing speech output immediately
        novairVoiceOutputService.stop();
        setIsListening(true);
        setErrorMessage(null);
        setAuraState('LISTENING');
        setActiveResponse({
          state: 'RESPONSE',
          text: 'AURA is listening... Speak your command or type below.',
        });
      },
      onInterimResult: (transcript) => {
        setInterimTranscript(transcript);
      },
      onFinalResult: (transcript) => {
        setInterimTranscript('');
        if (transcript.trim()) {
          setAuraState('THINKING');
          if (onFinalTranscript) {
            onFinalTranscript(transcript.trim());
          }
        }
      },
      onError: (msg) => {
        setIsListening(false);
        setInterimTranscript('');
        setErrorMessage(msg);
        if (useAuraStore.getState().currentState === 'LISTENING') {
          setAuraState('IDLE');
        }
        setActiveResponse({
          state: 'ERROR',
          text: msg,
          errorMessage: msg,
        });
      },
      onEnd: () => {
        setIsListening(false);
        setInterimTranscript('');
        if (useAuraStore.getState().currentState === 'LISTENING') {
          setAuraState('IDLE');
        }
      },
    });

    return () => {
      speechRecognitionService.setEvents({});
    };
  }, [setAuraState, setActiveResponse, onFinalTranscript]);

  const startListening = useCallback(async (): Promise<boolean> => {
    // Stop any ongoing speech output
    novairVoiceOutputService.stop();
    setErrorMessage(null);
    if (!isSupported) {
      setErrorMessage('Voice recognition is unavailable in this browser.');
      return false;
    }

    // Start audio engine for WebGL visual reactivity
    await audioEngine.startMicrophone();

    // Start browser speech-to-text
    const started = speechRecognitionService.start();
    if (!started) {
      setErrorMessage('Voice recognition could not be started.');
      return false;
    }

    return true;
  }, [isSupported]);

  const stopListening = useCallback(() => {
    speechRecognitionService.stop();
    audioEngine.stopMicrophone();
    setIsListening(false);
    setInterimTranscript('');
    if (useAuraStore.getState().currentState === 'LISTENING') {
      setAuraState('IDLE');
    }
  }, [setAuraState]);

  const toggleListening = useCallback(async (): Promise<boolean> => {
    if (isListening || speechRecognitionService.getStatus() === 'listening') {
      stopListening();
      return false;
    } else {
      return await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isSupported,
    isListening,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
  };
};
