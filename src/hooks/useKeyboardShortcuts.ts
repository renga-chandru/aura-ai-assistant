import { useEffect } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { AuraState } from '@/types';
import { audioEngine } from '@/audio';
import { speechRecognitionService } from '@/voice';

/**
 * Developer & Interface Keyboard Shortcuts Hook (Phase 15 Enhanced)
 * Listens for key presses:
 * '1' (IDLE), '2' (LISTENING), '3' (THINKING), '4' (SPEAKING), '5' (EXECUTING)
 * 'M' or 'm': Toggle Web Speech API Voice Recognition & Web Audio API Microphone.
 */
export const useKeyboardShortcuts = () => {
  const setAuraState = useAuraStore((state) => state.setAuraState);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      let newState: AuraState | null = null;
      if (e.key === '1') newState = 'IDLE';
      else if (e.key === '2') newState = 'LISTENING';
      else if (e.key === '3') newState = 'THINKING';
      else if (e.key === '4') newState = 'SPEAKING';
      else if (e.key === '5') newState = 'EXECUTING';

      if (newState) {
        setAuraState(newState);
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        const isListening = speechRecognitionService.getStatus() === 'listening';
        if (isListening) {
          speechRecognitionService.stop();
          audioEngine.stopMicrophone();
          setAuraState('IDLE');
        } else {
          void audioEngine.startMicrophone().then(() => {
            const started = speechRecognitionService.start();
            if (started) {
              setAuraState('LISTENING');
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setAuraState]);
};
