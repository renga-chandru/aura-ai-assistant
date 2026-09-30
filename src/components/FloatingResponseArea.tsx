import React from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface FloatingResponseAreaProps {
  overrideText?: string;
}

/**
 * AURA Production Floating Response Area Component (Phase 12)
 * Center-aligned floating cinematic response display positioned above the command bar (~72-78% vertical height).
 * Supports EMPTY, THINKING, RESPONSE, and ERROR UI states with smooth opacity transitions.
 */
export const FloatingResponseArea: React.FC<FloatingResponseAreaProps> = ({
  overrideText,
}) => {
  const activeResponse = useAuraStore((state) => state.activeResponse);
  const stateConfig = useAuraStore((state) => state.stateConfig);
  const currentState = useAuraStore((state) => state.currentState);

  const responseState = activeResponse.state;
  const isThinking = currentState === 'THINKING' || responseState === 'THINKING';
  const isError = responseState === 'ERROR';

  const textToDisplay =
    overrideText ||
    activeResponse.text ||
    (currentState === 'LISTENING'
      ? 'AURA is listening...'
      : isThinking
      ? 'Processing query parameters...'
      : currentState === 'SPEAKING'
      ? 'Synthesizing voice response...'
      : currentState === 'EXECUTING'
      ? 'Executing authorized system command...'
      : 'Ready. Speak or enter a command below.');

  return (
    <div
      className="absolute bottom-22 md:bottom-26 left-1/2 -translate-x-1/2 z-20 w-[92vw] sm:w-[85vw] max-w-[680px] px-4 text-center pointer-events-none transition-all duration-300"
      aria-live="polite"
      role="status"
    >
      <div
        className={`inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#080b18]/50 backdrop-blur-xl border transition-all duration-300 shadow-[0_0_35px_rgba(0,0,0,0.5)] ${
          isError
            ? 'border-red-500/40 text-red-300'
            : isThinking
            ? 'border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
            : 'border-slate-800/60'
        }`}
      >
        {/* State Icon Indicator */}
        {isThinking ? (
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : (
          <Sparkles
            className="w-4 h-4 shrink-0 transition-colors duration-300"
            style={{ color: stateConfig.colorHex }}
          />
        )}

        {/* Cinematic Response Text */}
        <p
          className="font-sans text-slate-200 text-sm sm:text-base md:text-lg leading-relaxed font-normal tracking-wide transition-all duration-300"
          style={{
            textShadow: `0 0 20px ${stateConfig.colorHex}25`,
          }}
        >
          {textToDisplay}
        </p>
      </div>
    </div>
  );
};
