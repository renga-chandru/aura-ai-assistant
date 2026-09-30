import React, { useState } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { AuraState } from '@/types';
import { ChevronDown, Settings } from 'lucide-react';

const STATES: AuraState[] = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'EXECUTING'];

/**
 * Top-Right State Indicator & Settings Control Component (Phase 14)
 * Displays the current AURA state with dynamic color accent dot, interactive state switcher,
 * and Settings trigger button.
 */
export const StateIndicator: React.FC = () => {
  const currentState = useAuraStore((state) => state.currentState);
  const stateConfig = useAuraStore((state) => state.stateConfig);
  const setAuraState = useAuraStore((state) => state.setAuraState);
  const settingsPanelOpen = useAuraStore((state) => state.settingsPanelOpen);
  const toggleSettingsPanel = useAuraStore((state) => state.toggleSettingsPanel);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-6 right-6 md:top-8 md:right-8 z-30 pointer-events-auto flex flex-col items-end">
      <div className="flex items-center gap-2">
        {/* Active State Pill */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#080b18]/60 backdrop-blur-md border border-slate-800/80 hover:border-slate-700 transition-all duration-200 cursor-pointer group shadow-lg"
          aria-label="Current AURA State Indicator"
          aria-expanded={isOpen}
        >
          <span
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: stateConfig.colorHex,
              boxShadow: `0 0 10px ${stateConfig.colorHex}`,
            }}
          />
          <span className="font-state text-[11px] tracking-[0.15em] text-slate-200">
            {currentState}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-amber-400' : ''
            }`}
          />
        </button>

        {/* Settings Overlay Toggle Button */}
        <button
          id="aura-settings-toggle-btn"
          onClick={toggleSettingsPanel}
          aria-label="Open AURA settings"
          aria-expanded={settingsPanelOpen}
          title="Open Settings"
          className={`p-1.5 rounded-full backdrop-blur-md border transition-all duration-200 cursor-pointer ${
            settingsPanelOpen
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(229,169,60,0.3)]'
              : 'bg-[#080b18]/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* State Switcher Dropdown */}
      {isOpen && (
        <div className="mt-2 w-44 rounded-xl bg-[#080b18]/90 backdrop-blur-xl border border-slate-800 p-1.5 shadow-2xl space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2 py-1 text-[9px] font-telemetry text-slate-500 border-b border-slate-800/60 mb-1">
            SELECT AURA STATE
          </div>
          {STATES.map((state) => {
            const isActive = currentState === state;
            return (
              <button
                key={state}
                onClick={() => {
                  setAuraState(state);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[11px] font-state transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{state}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#E5A93C]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
