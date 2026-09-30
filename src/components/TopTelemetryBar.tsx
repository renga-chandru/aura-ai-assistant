import React, { useEffect, useState } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { formatUptime } from '@/utils';
import { History } from 'lucide-react';
import { AuraState } from '@/types';

/**
 * Helper mapping for state-driven activity indicator colors and animation speeds.
 */
const ACTIVITY_INDICATORS: Record<
  AuraState,
  { colorClass: string; shadowStyle: string; pingSpeedClass: string }
> = {
  IDLE: {
    colorClass: 'bg-amber-400',
    shadowStyle: '0 0 8px #E5A93C',
    pingSpeedClass: 'animate-pulse',
  },
  LISTENING: {
    colorClass: 'bg-cyan-400',
    shadowStyle: '0 0 10px #3CE5D9',
    pingSpeedClass: 'animate-ping',
  },
  THINKING: {
    colorClass: 'bg-amber-300',
    shadowStyle: '0 0 12px #FFD700',
    pingSpeedClass: 'animate-pulse duration-300',
  },
  SPEAKING: {
    colorClass: 'bg-amber-400',
    shadowStyle: '0 0 10px #E5A93C',
    pingSpeedClass: 'animate-pulse duration-500',
  },
  EXECUTING: {
    colorClass: 'bg-orange-500',
    shadowStyle: '0 0 12px #FF5500',
    pingSpeedClass: 'animate-ping duration-200',
  },
};

/**
 * Top Telemetry Bar Component (Phase 14 Enhanced)
 * Displays system metrics, FPS, audio/microphone status, activity pulse indicator,
 * and History Panel trigger button. Respects HUD telemetry and history settings.
 */
export const TopTelemetryBar: React.FC = () => {
  const currentState = useAuraStore((state) => state.currentState);
  const telemetry = useAuraStore((state) => state.telemetry);
  const viewport = useAuraStore((state) => state.viewport);
  const history = useAuraStore((state) => state.history);
  const historyPanelOpen = useAuraStore((state) => state.historyPanelOpen);
  const toggleHistoryPanel = useAuraStore((state) => state.toggleHistoryPanel);
  const settings = useAuraStore((state) => state.settings);

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeIndicator = ACTIVITY_INDICATORS[currentState] || ACTIVITY_INDICATORS.IDLE;
  const isMicActive = currentState === 'LISTENING';

  return (
    <header className="absolute top-6 left-6 md:top-8 md:left-8 z-20 pointer-events-auto flex items-center gap-3 text-slate-400/80 font-telemetry select-none">
      {/* Primary Logo & System Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#080b18]/60 backdrop-blur-md border border-slate-800/80 shadow-lg">
        {/* State-driven subtle activity pulse */}
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${activeIndicator.colorClass} ${
              settings.reducedMotion ? 'opacity-40' : activeIndicator.pingSpeedClass
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${activeIndicator.colorClass}`}
            style={{ boxShadow: activeIndicator.shadowStyle }}
          />
        </span>

        <span className="text-amber-400/90 font-semibold tracking-[0.2em] text-xs">AURA</span>
        <span className="text-slate-600">//</span>
        <span className="text-slate-300 text-[10px] tracking-wider">SYS.ONLINE</span>
      </div>

      {/* Expanded System & Telemetry Metrics (Controlled by hudTelemetry setting) */}
      {settings.hudTelemetry && (
        <div className="hidden md:flex items-center gap-3 text-slate-500 border-l border-slate-800/80 pl-3 text-[10px] tracking-wider">
          <span>FPS: <strong className="text-slate-300 font-normal">{telemetry.fps}</strong></span>
          <span>RES: <strong className="text-slate-400 font-normal">{viewport.width}x{viewport.height}</strong></span>
          <span>CORE: <strong className="text-emerald-400/90 font-normal">ONLINE</strong></span>
          <span>WEBGL: <strong className="text-emerald-400/90 font-normal">ONLINE</strong></span>
          <span>
            MIC:{' '}
            <strong className={isMicActive ? 'text-cyan-400 font-semibold' : 'text-slate-400 font-normal'}>
              {isMicActive ? 'ON' : 'OFF'}
            </strong>
          </span>
          <span>UP: <strong className="text-slate-400 font-normal">{formatUptime(seconds)}</strong></span>
        </div>
      )}

      {/* History Panel Trigger Button (Controlled by commandHistory setting) */}
      {settings.commandHistory && (
        <button
          id="aura-history-toggle-btn"
          onClick={toggleHistoryPanel}
          aria-label="Open command history"
          aria-expanded={historyPanelOpen}
          title="Open command history"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-md border transition-all duration-200 cursor-pointer ${
            historyPanelOpen
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(229,169,60,0.3)]'
              : 'bg-[#080b18]/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span className="text-[10px] tracking-widest hidden sm:inline">HISTORY</span>
          {history.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-mono flex items-center justify-center border border-amber-500/30">
              {history.length}
            </span>
          )}
        </button>
      )}
    </header>
  );
};
