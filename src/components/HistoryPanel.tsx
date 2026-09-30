import React, { useEffect, useRef } from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { HistoryItem } from '@/types';
import { History, X, Trash2, ArrowUpRight, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const history = useAuraStore((state) => state.history);
  const clearHistory = useAuraStore((state) => state.clearHistory);
  const historyPanelOpen = useAuraStore((state) => state.historyPanelOpen);
  const setHistoryPanelOpen = useAuraStore((state) => state.setHistoryPanelOpen);
  const setSelectedCommandText = useAuraStore((state) => state.setSelectedCommandText);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && historyPanelOpen) {
        setHistoryPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyPanelOpen, setHistoryPanelOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        historyPanelOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        // Exclude the history toggle button from click-outside logic if needed
        const toggleBtn = document.getElementById('aura-history-toggle-btn');
        if (toggleBtn && toggleBtn.contains(e.target as Node)) return;
        setHistoryPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [historyPanelOpen, setHistoryPanelOpen]);

  if (!historyPanelOpen) return null;

  const handleSelectCommand = (item: HistoryItem) => {
    setSelectedCommandText(item.command);
    setHistoryPanelOpen(false);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Command history panel"
      className="absolute top-16 left-6 md:top-20 md:left-8 z-40 w-[90vw] sm:w-[360px] max-h-[60vh] rounded-2xl bg-[#050711]/90 backdrop-blur-xl border border-slate-800/90 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#080b18]/60">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <span className="font-telemetry text-xs font-semibold tracking-widest text-slate-200 uppercase">
            COMMAND HISTORY
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-400">
            {history.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              title="Clear all history"
              aria-label="Clear all command history"
              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setHistoryPanelOpen(false)}
            aria-label="Close command history"
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History Items Container */}
      <div className="p-3 overflow-y-auto space-y-2 max-h-[50vh] scrollbar-thin scrollbar-thumb-slate-800">
        {history.length === 0 ? (
          <div className="py-8 text-center text-xs font-telemetry text-slate-500 flex flex-col items-center gap-2">
            <Clock className="w-6 h-6 text-slate-700 stroke-1" />
            <span>NO RECENT COMMANDS RECORDED</span>
            <span className="text-[10px] text-slate-600">
              Submitted queries will appear here.
            </span>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelectCommand(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectCommand(item);
                }
              }}
              className="group p-3 rounded-xl bg-[#080b18]/60 border border-slate-800/60 hover:border-amber-500/40 hover:bg-[#0a0f24]/80 transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
            >
              {/* Top row: Timestamp + Status */}
              <div className="flex items-center justify-between text-[10px] font-telemetry text-slate-500">
                <span className="text-amber-400/90 font-mono tracking-wider">
                  {item.timestamp}
                </span>

                <div className="flex items-center gap-1.5">
                  {item.status === 'THINKING' && (
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>THINKING</span>
                    </span>
                  )}
                  {item.status === 'SUCCESS' && (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>READY</span>
                    </span>
                  )}
                  {item.status === 'ERROR' && (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>FAILED</span>
                    </span>
                  )}

                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100" />
                </div>
              </div>

              {/* Command Prompt */}
              <div className="text-xs font-sans font-medium text-slate-200 group-hover:text-amber-200 transition-colors line-clamp-2">
                &gt; {item.command}
              </div>

              {/* Response summary snippet if available */}
              {item.response && (
                <div className="text-[11px] font-sans text-slate-400/80 line-clamp-1 border-t border-slate-800/40 pt-1 mt-0.5">
                  {item.response}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Notice */}
      <div className="px-4 py-2 bg-[#03040a]/80 border-t border-slate-800/60 text-[10px] font-telemetry text-slate-500 text-center">
        Click entry to populate command bar
      </div>
    </div>
  );
};
