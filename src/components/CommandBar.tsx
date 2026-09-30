import React, { useState, useCallback } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { useSpeechRecognition } from '@/hooks';
import { Mic, MicOff, Send, Sparkles } from 'lucide-react';

/**
 * AURA Production Command Bar Component (Phase 15 Enhanced)
 * Bottom-centered translucent glass bar with Web Speech API voice recognition,
 * live interim transcript preview, text command input, and manual submit action.
 */
export const CommandBar: React.FC = () => {
  const [inputValue, setInputValue] = useState('');

  const currentState = useAuraStore((state) => state.currentState);
  const submitCommand = useAuraStore((state) => state.submitCommand);
  const selectedCommandText = useAuraStore((state) => state.selectedCommandText);
  const setSelectedCommandText = useAuraStore((state) => state.setSelectedCommandText);

  const isListening = currentState === 'LISTENING';
  const isThinking = currentState === 'THINKING';

  const [prevSelectedText, setPrevSelectedText] = useState<string | null>(null);

  // Synchronize input value when a command is selected from History panel
  if (selectedCommandText !== prevSelectedText) {
    setPrevSelectedText(selectedCommandText);
    if (selectedCommandText !== null) {
      setInputValue(selectedCommandText);
      setSelectedCommandText(null);
    }
  }

  // Handle final speech-to-text transcript from Web Speech API
  const handleFinalTranscript = useCallback((finalText: string) => {
    const trimmed = finalText.trim();
    if (trimmed) {
      setInputValue(trimmed);
      submitCommand(trimmed);
    }
  }, [submitCommand]);

  // Web Speech Recognition hook
  const {
    isSupported: isSpeechSupported,
    isListening: isSpeechListening,
    interimTranscript,
    errorMessage: speechError,
    toggleListening,
  } = useSpeechRecognition(handleFinalTranscript);

  const handleMicToggle = async () => {
    await toggleListening();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetText = (inputValue || interimTranscript).trim();
    if (!targetText || isThinking) return;

    setInputValue('');
    submitCommand(targetText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setInputValue('');
    }
  };

  const displayInputValue = interimTranscript ? interimTranscript : inputValue;

  return (
    <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-30 w-[90vw] sm:w-[80vw] max-w-[520px] px-2 pointer-events-auto">
      {/* Concisely formatted mic error feedback overlay if permission denied or unsupported */}
      {speechError && (
        <div className="mb-2 text-center text-[11px] font-telemetry tracking-wider text-red-400 bg-red-950/60 backdrop-blur-md border border-red-800/60 rounded-lg py-1 px-3 shadow-lg animate-in fade-in duration-200">
          {speechError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`relative h-12 md:h-13 w-full rounded-full bg-[#080b18]/70 backdrop-blur-xl border transition-all duration-300 flex items-center px-3.5 gap-3 shadow-[0_0_30px_rgba(0,0,0,0.7)] group ${
          isListening || isSpeechListening
            ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(60,229,217,0.25)]'
            : isThinking
            ? 'border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
            : 'border-slate-800/80 focus-within:border-amber-500/40 focus-within:shadow-[0_0_25px_rgba(229,169,60,0.2)]'
        }`}
        aria-label="AURA Command Bar Interface"
      >
        {/* Dedicated Microphone Control Button */}
        <button
          type="button"
          onClick={handleMicToggle}
          disabled={isThinking || !isSpeechSupported}
          aria-pressed={isSpeechListening || isListening}
          className={`shrink-0 p-2 rounded-full transition-all duration-200 cursor-pointer ${
            isSpeechListening || isListening
              ? 'text-cyan-300 bg-cyan-500/20 shadow-[0_0_12px_rgba(60,229,217,0.4)] animate-pulse'
              : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label={
            isSpeechListening ? 'Stop voice input' : 'Start voice input'
          }
          title={
            !isSpeechSupported
              ? 'Voice recognition is unavailable in this browser'
              : isSpeechListening
              ? 'Stop Listening (M)'
              : 'Start Listening (M)'
          }
        >
          {isSpeechListening || isListening ? (
            <Mic className="w-4 h-4 md:w-4.5 md:h-4.5 text-cyan-300 animate-pulse" />
          ) : (
            <MicOff className="w-4 h-4 md:w-4.5 md:h-4.5 opacity-70" />
          )}
        </button>

        {/* Command Input Field with Live Interim Transcript */}
        <input
          type="text"
          value={displayInputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
          placeholder={
            isThinking
              ? 'Processing...'
              : isSpeechListening
              ? 'Listening...'
              : 'Ask AURA anything...'
          }
          className={`w-full bg-transparent text-slate-100 placeholder:text-slate-500/80 text-sm md:text-base font-sans focus:outline-none tracking-wide disabled:opacity-50 ${
            interimTranscript ? 'text-cyan-300 italic' : ''
          }`}
          aria-label="Ask AURA anything"
        />

        {/* Submit / Action Button */}
        {displayInputValue.trim() ? (
          <button
            type="submit"
            disabled={isThinking}
            className="shrink-0 p-2 rounded-full text-amber-400 hover:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all duration-200 cursor-pointer shadow-[0_0_10px_rgba(229,169,60,0.3)] disabled:opacity-40"
            aria-label="Submit Command"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <div className="shrink-0 p-2 text-slate-600">
            <Sparkles className="w-3.5 h-3.5 opacity-40" />
          </div>
        )}
      </form>
    </div>
  );
};
