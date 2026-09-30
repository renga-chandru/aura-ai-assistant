import React, { useEffect, useRef } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { UIScaleOption } from '@/types';
import { Settings, X, Eye, Volume2, Layout, Sparkles } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const settings = useAuraStore((state) => state.settings);
  const updateSettings = useAuraStore((state) => state.updateSettings);
  const settingsPanelOpen = useAuraStore((state) => state.settingsPanelOpen);
  const setSettingsPanelOpen = useAuraStore((state) => state.setSettingsPanelOpen);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management & Escape key handling
  useEffect(() => {
    if (settingsPanelOpen) {
      closeButtonRef.current?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsPanelOpen) {
        setSettingsPanelOpen(false);
        // Return focus to trigger button
        const triggerBtn = document.getElementById('aura-settings-toggle-btn');
        triggerBtn?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsPanelOpen, setSettingsPanelOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsPanelOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        const triggerBtn = document.getElementById('aura-settings-toggle-btn');
        if (triggerBtn && triggerBtn.contains(e.target as Node)) return;
        setSettingsPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsPanelOpen, setSettingsPanelOpen]);

  if (!settingsPanelOpen) return null;

  const handleClose = () => {
    setSettingsPanelOpen(false);
    const triggerBtn = document.getElementById('aura-settings-toggle-btn');
    triggerBtn?.focus();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="AURA Settings Configuration"
      className="absolute top-16 right-6 md:top-20 md:right-8 z-40 w-[90vw] sm:w-[380px] max-h-[75vh] rounded-2xl bg-[#050711]/90 backdrop-blur-xl border border-slate-800/90 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#080b18]/60">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-400" />
          <span className="font-telemetry text-xs font-semibold tracking-widest text-slate-200 uppercase">
            AURA SETTINGS
          </span>
        </div>

        <button
          ref={closeButtonRef}
          onClick={handleClose}
          aria-label="Close AURA settings"
          className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Sections Body */}
      <div className="p-4 overflow-y-auto space-y-5 text-xs font-sans text-slate-300 scrollbar-thin scrollbar-thumb-slate-800">
        
        {/* VISUAL SECTION */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-telemetry tracking-widest text-amber-400/90 uppercase border-b border-slate-800/50 pb-1">
            <Eye className="w-3.5 h-3.5" />
            <span>VISUAL CONFIGURATION</span>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-slate-200">Reduced Motion</div>
              <div className="text-[11px] text-slate-500">Minimize orbital speed &amp; particle drift</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reducedMotion}
              aria-label="Toggle Reduced Motion"
              onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                settings.reducedMotion ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-100 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.reducedMotion ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Bloom Effect Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-slate-200">Cinematic Bloom</div>
              <div className="text-[11px] text-slate-500">Post-processing luminous glow pass</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.bloomEnabled}
              aria-label="Toggle Cinematic Bloom"
              onClick={() => updateSettings({ bloomEnabled: !settings.bloomEnabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                settings.bloomEnabled ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-100 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.bloomEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* UI Scale Segmented Control */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-slate-200">UI Scale</div>
              <div className="text-[11px] text-slate-500">Interface overlay element sizing</div>
            </div>
            <div className="flex items-center gap-1 bg-[#080b18] p-1 rounded-lg border border-slate-800">
              {([0.9, 1.0, 1.1] as UIScaleOption[]).map((scale) => {
                const label = scale === 0.9 ? '90%' : scale === 1.0 ? '100%' : '110%';
                const isActive = settings.uiScale === scale;
                return (
                  <button
                    key={scale}
                    onClick={() => updateSettings({ uiScale: scale })}
                    aria-label={`Set UI Scale to ${label}`}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-black font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* AUDIO SECTION */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-telemetry tracking-widest text-amber-400/90 uppercase border-b border-slate-800/50 pb-1">
            <Volume2 className="w-3.5 h-3.5" />
            <span>AUDIO REACTION</span>
          </div>

          {/* Audio Reactivity Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-slate-200">Audio Reactivity</div>
              <div className="text-[11px] text-slate-500">Modulate core &amp; particles from voice spectrum</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.audioReactive}
              aria-label="Toggle Audio Reactivity"
              onClick={() => updateSettings({ audioReactive: !settings.audioReactive })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                settings.audioReactive ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-100 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.audioReactive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* INTERFACE SECTION */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-telemetry tracking-widest text-amber-400/90 uppercase border-b border-slate-800/50 pb-1">
            <Layout className="w-3.5 h-3.5" />
            <span>INTERFACE OVERLAYS</span>
          </div>

          {/* HUD Telemetry Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-slate-200">HUD Telemetry</div>
              <div className="text-[11px] text-slate-500">Display detailed runtime metrics in HUD</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.hudTelemetry}
              aria-label="Toggle HUD Telemetry"
              onClick={() => updateSettings({ hudTelemetry: !settings.hudTelemetry })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                settings.hudTelemetry ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-100 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.hudTelemetry ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Command History Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-slate-200">Command History</div>
              <div className="text-[11px] text-slate-500">Record submitted commands &amp; history button</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.commandHistory}
              aria-label="Toggle Command History"
              onClick={() => {
                const nextVal = !settings.commandHistory;
                updateSettings({ commandHistory: nextVal });
                if (!nextVal) {
                  useAuraStore.getState().setHistoryPanelOpen(false);
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 ${
                settings.commandHistory ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-100 shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.commandHistory ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

      </div>

      {/* Footer Bar */}
      <div className="px-4 py-2 bg-[#03040a]/80 border-t border-slate-800/60 text-[10px] font-telemetry text-slate-500 text-center flex items-center justify-between">
        <span className="flex items-center gap-1 text-slate-400">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>AURA CONFIG</span>
        </span>
        <span className="font-mono">ESC TO CLOSE</span>
      </div>
    </div>
  );
};
