import { AuraSettings, DEFAULT_AURA_SETTINGS } from '@/types';

/**
 * Utility functions for AURA GLSL math, color manipulation, state formatting, and storage.
 */

/**
 * Clamp a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation between a and b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Deterministic pseudo-random number generator returning [0..1).
 * Pure function suitable for React useMemo hooks.
 */
export function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Formats uptime seconds into HH:MM:SS format.
 */
export function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Converts a hex color string to normalized RGB array [0..1].
 */
export function hexToNormalizedRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return [r, g, b];
}

const SETTINGS_STORAGE_KEY = 'aura_settings_v1';

/**
 * Safely loads AURA settings from localStorage with fallback defaults and system reduced-motion detection.
 */
export function loadStoredSettings(): AuraSettings {
  const defaults = { ...DEFAULT_AURA_SETTINGS };
  if (typeof window === 'undefined') return defaults;

  // Check system prefers-reduced-motion media query
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    defaults.reducedMotion = true;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}

/**
 * Safely saves AURA settings to localStorage.
 */
export function saveStoredSettings(settings: AuraSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota or access errors
  }
}
