export type UIScaleOption = 0.9 | 1.0 | 1.1;

export interface AuraSettings {
  reducedMotion: boolean;
  bloomEnabled: boolean;
  audioReactive: boolean;
  hudTelemetry: boolean;
  commandHistory: boolean;
  uiScale: UIScaleOption;
}

export const DEFAULT_AURA_SETTINGS: AuraSettings = {
  reducedMotion: false,
  bloomEnabled: true,
  audioReactive: true,
  hudTelemetry: true,
  commandHistory: true,
  uiScale: 1.0,
};
