import React from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

interface CinematicBloomProps {
  threshold?: number;
  intensity?: number;
  radius?: number;
}

/**
 * Controlled Cinematic Bloom Post-Processing Component (Refined)
 * Restrained EffectComposer bloom pipeline that enhances bright kernel energy hotspots
 * while preserving distinct particle visibility and deep-space black contrast without overexposure.
 */
export const CinematicBloom: React.FC<CinematicBloomProps> = ({
  threshold = 0.82,
  intensity = 0.4,
  radius = 0.35,
}) => {
  return (
    <EffectComposer multisampling={2}>
      <Bloom
        luminanceThreshold={threshold}
        luminanceSmoothing={0.25}
        intensity={intensity}
        mipmapBlur={true}
        radius={radius}
      />
    </EffectComposer>
  );
};
