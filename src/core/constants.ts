import { AuraState, StateConfig, AuraThemeConfig } from '@/types';

/**
 * Fundamental Theme Tokens for AURA
 */
export const DEFAULT_AURA_THEME: AuraThemeConfig = {
  voidColor: '#02040A',
  spaceColor: '#080B18',
  amberColor: '#E5A93C',
  orangeColor: '#FF5500',
  hotspotColor: '#FFF7C2',
  listeningColor: '#3CE5D9',
  thinkingColor: '#8B5CF6',
  executingColor: '#EF4444',
};

/**
 * Parametric state configurations & visual tokens per AuraState.
 */
export const AURA_STATE_CONFIGS: Record<AuraState, StateConfig> = {
  IDLE: {
    name: 'IDLE',
    displayName: 'AURA // IDLE',
    description: 'Ambient cosmic breathing pulse, rhythmic orbital motion.',
    colorHex: '#E5A93C',
    glowClass: 'aura-glow-amber',
    core: {
      scaleMultiplier: 1.0,
      noiseFrequency: 0.5,
      noiseAmplitude: 0.1,
      glowIntensity: 1.0,
      colorHex: '#E5A93C',
    },
    rings: {
      rotationSpeed: 0.2,
      tiltAngle: 0.1,
      pulseFrequency: 0.5,
    },
    particles: {
      count: 1000,
      speedMultiplier: 0.5,
      direction: 'drift',
    },
    bloom: {
      intensity: 1.0,
      radius: 0.4,
    },
    motion: {
      amplitude: 0.2,
      frequency: 0.5,
    },
    hud: {
      telemetryText: 'SYSTEM STANDBY // AMBIENT OSCILLATION ACTIVE',
      accentColor: '#E5A93C',
    },
    audioReactivity: {
      enabled: true,
      sensitivity: 0.2,
      reactivityMode: 'ambient',
    },
  },
  LISTENING: {
    name: 'LISTENING',
    displayName: 'AURA // LISTENING',
    description: 'Core expands, audio-reactive waveform micro-oscillations, energetic particle draw-in.',
    colorHex: '#3CE5D9',
    glowClass: 'aura-glow-cyan',
    core: {
      scaleMultiplier: 1.25,
      noiseFrequency: 1.2,
      noiseAmplitude: 0.25,
      glowIntensity: 1.8,
      colorHex: '#3CE5D9',
    },
    rings: {
      rotationSpeed: 0.8,
      tiltAngle: 0.3,
      pulseFrequency: 1.5,
    },
    particles: {
      count: 2000,
      speedMultiplier: 1.5,
      direction: 'inward',
    },
    bloom: {
      intensity: 1.8,
      radius: 0.6,
    },
    motion: {
      amplitude: 0.6,
      frequency: 1.2,
    },
    hud: {
      telemetryText: 'AUDIO INPUT FOCUS // RECEIVING FREQUENCY STREAM',
      accentColor: '#3CE5D9',
    },
    audioReactivity: {
      enabled: true,
      sensitivity: 1.0,
      reactivityMode: 'stt',
    },
  },
  THINKING: {
    name: 'THINKING',
    displayName: 'AURA // THINKING',
    description: 'High-speed ring counter-rotation, harmonic chromatic shift, accelerated shader frequency.',
    colorHex: '#8B5CF6',
    glowClass: 'aura-glow-violet',
    core: {
      scaleMultiplier: 0.95,
      noiseFrequency: 3.5,
      noiseAmplitude: 0.4,
      glowIntensity: 2.2,
      colorHex: '#8B5CF6',
    },
    rings: {
      rotationSpeed: 2.5,
      tiltAngle: 0.6,
      pulseFrequency: 3.0,
    },
    particles: {
      count: 3000,
      speedMultiplier: 2.5,
      direction: 'spiral',
    },
    bloom: {
      intensity: 2.2,
      radius: 0.8,
    },
    motion: {
      amplitude: 1.2,
      frequency: 3.0,
    },
    hud: {
      telemetryText: 'COGNITIVE SYNTHESIS IN PROGRESS // HIGH FREQUENCY PULSE',
      accentColor: '#8B5CF6',
    },
    audioReactivity: {
      enabled: false,
      sensitivity: 0.0,
      reactivityMode: 'shader',
    },
  },
  SPEAKING: {
    name: 'SPEAKING',
    displayName: 'AURA // SPEAKING',
    description: 'Core dynamic modulation synchronized to audio amplitude/frequency, radiant light emission.',
    colorHex: '#FF9D00',
    glowClass: 'aura-glow-amber',
    core: {
      scaleMultiplier: 1.35,
      noiseFrequency: 2.0,
      noiseAmplitude: 0.35,
      glowIntensity: 2.5,
      colorHex: '#FF9D00',
    },
    rings: {
      rotationSpeed: 1.2,
      tiltAngle: 0.25,
      pulseFrequency: 2.0,
    },
    particles: {
      count: 2500,
      speedMultiplier: 1.8,
      direction: 'outward',
    },
    bloom: {
      intensity: 2.5,
      radius: 0.9,
    },
    motion: {
      amplitude: 1.0,
      frequency: 2.0,
    },
    hud: {
      telemetryText: 'AUDIO SYNTHESIS ACTIVE // STREAMING RESPONSE',
      accentColor: '#FF9D00',
    },
    audioReactivity: {
      enabled: true,
      sensitivity: 1.2,
      reactivityMode: 'tts',
    },
  },
  EXECUTING: {
    name: 'EXECUTING',
    displayName: 'AURA // EXECUTING',
    description: 'Focused core stabilization, intense directional pulse, action status telemetry output.',
    colorHex: '#EF4444',
    glowClass: 'aura-glow-crimson',
    core: {
      scaleMultiplier: 1.1,
      noiseFrequency: 0.8,
      noiseAmplitude: 0.15,
      glowIntensity: 3.0,
      colorHex: '#EF4444',
    },
    rings: {
      rotationSpeed: 0.4,
      tiltAngle: 0.0,
      pulseFrequency: 0.8,
    },
    particles: {
      count: 3500,
      speedMultiplier: 3.0,
      direction: 'shockwave',
    },
    bloom: {
      intensity: 3.0,
      radius: 1.0,
    },
    motion: {
      amplitude: 0.4,
      frequency: 0.8,
    },
    hud: {
      telemetryText: 'CONTROLLED ACTION PIPELINE // CRITICAL EXECUTION',
      accentColor: '#EF4444',
    },
    audioReactivity: {
      enabled: true,
      sensitivity: 0.5,
      reactivityMode: 'subbass',
    },
  },
};
