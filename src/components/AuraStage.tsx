import React from 'react';
import { useAuraStore } from '@/state/useAuraStore';
import { SceneCanvas } from '@/scenes/SceneCanvas';
import { CornerBrackets } from './CornerBrackets';
import { TopTelemetryBar } from './TopTelemetryBar';
import { HistoryPanel } from './HistoryPanel';
import { SettingsPanel } from './SettingsPanel';
import { StateIndicator } from './StateIndicator';
import { FloatingResponseArea } from './FloatingResponseArea';
import { CommandBar } from './CommandBar';

/**
 * AURA Full-Screen Stage Layout Component (Phase 14 Enhanced)
 * Enforces visual hierarchy:
 * BACKGROUND -> ATMOSPHERE -> CENTRAL AURA CORE (3D Viewport) -> MINIMAL HUD -> USER INPUT
 * Applies UI scale preferences to HUD elements without scaling 3D WebGL scene canvas.
 */
export const AuraStage: React.FC = () => {
  const uiScale = useAuraStore((state) => state.settings.uiScale);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#02040A] text-slate-100 flex flex-col select-none">
      {/* Visual Corner Frame Brackets */}
      <CornerBrackets />

      {/* Production R3F WebGL Canvas Layer (Center Unobstructed for Core) */}
      <SceneCanvas />

      {/* Scaled HUD Overlay Container */}
      <div
        className="absolute inset-0 pointer-events-none z-10 w-full h-full"
        style={{
          transform: `scale(${uiScale})`,
          transformOrigin: 'center center',
          transition: 'transform 200ms ease-out',
        }}
      >
        {/* Top Left System Telemetry Bar */}
        <TopTelemetryBar />

        {/* Floating Command History Overlay Panel */}
        <HistoryPanel />

        {/* Floating Settings Configuration Overlay Panel */}
        <SettingsPanel />

        {/* Top Right State Indicator & Switcher */}
        <StateIndicator />

        {/* Floating Conversational Response Area */}
        <FloatingResponseArea />

        {/* Bottom Centered Command Bar */}
        <CommandBar />
      </div>
    </div>
  );
};
