import React from 'react';
import { useViewport, useKeyboardShortcuts, usePerformanceMetrics } from '@/hooks';
import { AuraStage } from '@/components/AuraStage';

/**
 * App Shell Layout Container (Phase 13 Enhanced)
 * Mounts viewport listener, keyboard shortcuts, performance metrics, and master AURA stage container.
 */
export const AppShell: React.FC = () => {
  useViewport();
  useKeyboardShortcuts();
  usePerformanceMetrics();

  return <AuraStage />;
};

