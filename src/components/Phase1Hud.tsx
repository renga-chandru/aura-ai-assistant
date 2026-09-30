import React from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { AuraState } from '@/types';
import { GlassPanel } from './GlassPanel';
import { ShieldCheck, Activity, Cpu, Layers, Terminal, CheckCircle2, Monitor } from 'lucide-react';

const STATES: AuraState[] = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'EXECUTING'];

export const Phase1Hud: React.FC = () => {
  const currentState = useAuraStore((state) => state.currentState);
  const stateConfig = useAuraStore((state) => state.stateConfig);
  const setAuraState = useAuraStore((state) => state.setAuraState);
  const viewport = useAuraStore((state) => state.viewport);
  const telemetry = useAuraStore((state) => state.telemetry);
  const diagnostics = useAuraStore((state) => state.diagnostics);
  const themeConfig = useAuraStore((state) => state.themeConfig);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10 text-slate-100 font-['Outfit',sans-serif]">
      <GlassPanel className="max-w-3xl w-full flex flex-col items-center text-center space-y-8 my-auto border-amber-500/30">
        
        {/* Header Branding */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-2">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Core Architecture Active
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white glow-amber-text">
            AURA Core Engine
          </h1>
          <p className="text-lg md:text-xl font-medium text-amber-400/90 tracking-wide">
            Phase 1 Initialized
          </p>
        </div>

        {/* State Display Card */}
        <div className="w-full bg-[#03040a]/90 rounded-lg p-5 border border-slate-800 flex flex-col items-center space-y-3">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Current System State
          </div>
          <div
            className="text-3xl font-black font-mono tracking-widest px-6 py-2 rounded border transition-all duration-300"
            style={{
              color: stateConfig.core.colorHex,
              borderColor: `${stateConfig.core.colorHex}40`,
              backgroundColor: `${stateConfig.core.colorHex}10`,
              boxShadow: `0 0 20px ${stateConfig.core.colorHex}20`,
            }}
          >
            {currentState}
          </div>
          <p className="text-xs text-slate-400 font-mono max-w-lg">
            {stateConfig.hud.telemetryText}
          </p>
        </div>

        {/* State Switcher Sanity Check Controls */}
        <div className="w-full space-y-3">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-widest text-left flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Verify State Machine Transitions
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STATES.map((state) => {
              const isActive = currentState === state;
              return (
                <button
                  key={state}
                  onClick={() => setAuraState(state)}
                  className={`px-3 py-2 rounded text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-black font-bold shadow-[0_0_15px_rgba(229,169,60,0.5)] scale-105'
                      : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  {state}
                </button>
              );
            })}
          </div>
        </div>

        {/* System Verification Metrics */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Tailwind CSS v4</div>
              <div className="text-[11px] font-mono text-emerald-400">Verified & Styling</div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Strict TypeScript</div>
              <div className="text-[11px] font-mono text-amber-400">ES2022 / Strict Types</div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
            <Terminal className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Path Aliases</div>
              <div className="text-[11px] font-mono text-cyan-400">@/* mapped to src/*</div>
            </div>
          </div>
        </div>

        {/* Diagnostics & Viewport Telemetry */}
        <div className="w-full pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-slate-500" />
            <span>Viewport: {viewport.width}x{viewport.height} @ {viewport.dpr}x DPR</span>
          </div>

          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-500" />
            <span>GPU Target: {telemetry.fps} FPS ({diagnostics.triangles.toLocaleString()} polys)</span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-400/80">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>Palette: {themeConfig.amberColor} / {themeConfig.listeningColor}</span>
          </div>
        </div>

      </GlassPanel>

      <footer className="mt-6 text-center text-xs font-mono text-slate-600">
        AURA (Advanced Universal Reactive Assistant) — Phase 1 Sanity Verification Screen
      </footer>
    </div>
  );
};
