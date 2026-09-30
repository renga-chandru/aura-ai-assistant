/**
 * Custom Shaders, Bloom & Post-processing Effects System Module
 * Module contracts and placeholders for future WebGL shader pipelines.
 */
export interface ShaderUniforms {
  uTime: { value: number };
  uResolution: { value: [number, number] };
  uAuraState: { value: number };
  uAudioFrequency: { value: number };
}
