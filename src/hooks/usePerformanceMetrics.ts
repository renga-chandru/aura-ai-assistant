import { useEffect, useRef } from 'react';
import { useAuraStore } from '@/state/useAuraStore';

/**
 * FPS & Performance Monitoring Hook
 * Uses requestAnimationFrame and a 1-second sliding window / exponential smoothing
 * to measure FPS accurately without causing per-frame React re-renders.
 */
export const usePerformanceMetrics = (): void => {
  const updateTelemetry = useAuraStore((state) => state.updateTelemetry);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const fpsRef = useRef(60);

  useEffect(() => {
    let animId: number;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      frameCountRef.current++;
      const lastTime = lastTimeRef.current ?? now;
      const elapsed = now - lastTime;

      if (elapsed >= 1000) {
        const rawFps = Math.round((frameCountRef.current * 1000) / elapsed);
        // Exponential moving average for stable readout
        fpsRef.current = Math.round(fpsRef.current * 0.75 + rawFps * 0.25);
        frameCountRef.current = 0;
        lastTimeRef.current = now;

        updateTelemetry({ fps: Math.min(fpsRef.current, 120) });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [updateTelemetry]);
};
