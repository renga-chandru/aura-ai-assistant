import React from 'react';
import { Nebula } from './Nebula';
import { StarField } from './StarField';

interface SpaceEnvironmentProps {
  pointerRef: React.MutableRefObject<[number, number]>;
}

/**
 * Deep Space Environment Component
 * Combines cosmic void background (#02040A), procedural multi-layer star field, and subtle outer nebula.
 * Keeps center coordinates [0, 0, 0] open and unobstructed for future AURA core.
 */
export const SpaceEnvironment: React.FC<SpaceEnvironmentProps> = ({ pointerRef }) => {
  return (
    <>
      {/* Declarative background color attachment for cosmic void #02040A */}
      <color attach="background" args={['#02040A']} />

      {/* Outer Atmospheric Nebula Layer */}
      <Nebula pointerRef={pointerRef} />

      {/* Multi-depth Procedural GPU Star Field */}
      <StarField pointerRef={pointerRef} />

      {/* Ambient warm space light foundation */}
      <ambientLight color="#E5A93C" intensity={0.12} />

      {/* Subtle directional deep space navy fill light */}
      <directionalLight position={[10, 20, 15]} color="#0A0B16" intensity={0.25} />
    </>
  );
};
