import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';
import { SpaceEnvironment } from './SpaceEnvironment';
import { AuraCore } from './AuraCore';
import { AuraParticles } from './AuraParticles';
import { AuraFilaments } from './AuraFilaments';
import { AuraAtmosphere } from './AuraAtmosphere';
import { CinematicBloom } from './CinematicBloom';

interface AuraSceneProps {
  pointerRef: React.MutableRefObject<[number, number]>;
}

/**
 * Master AURA WebGL 3D Spatial Intelligence Globe Scene (Stitch ANIMATION_17 Direct Port)
 * Assembles Space Environment, Central Intelligence Core, 20,000 Solid Volumetric Particles,
 * 5 Organic Energy Path Conduits with 10 Traveling Light Pulses, and Outer Golden Atmosphere.
 */
export const AuraScene: React.FC<AuraSceneProps> = ({ pointerRef }) => {
  const masterGroupRef = useRef<THREE.Group>(null);
  const pulsePositionsRef = useRef<THREE.Vector3[]>([]);
  const settings = useAuraStore((state) => state.settings);

  useFrame((state) => {
    if (!masterGroupRef.current) return;

    const time = state.clock.getElapsedTime();
    const currentState = useAuraStore.getState().currentState;
    const rawAudio = audioEngine.update();

    const audio = settings.audioReactive
      ? rawAudio
      : { uAudioAmp: 0, speechEnergy: 0, isMicrophoneActive: false, permissionState: rawAudio.permissionState };

    const voiceAmp = audio.uAudioAmp + audio.speechEnergy * 0.5;

    let speedMult = 1.0;
    if (currentState === 'LISTENING') {
      speedMult = 1.45 + voiceAmp * 0.8;
    } else if (currentState === 'SPEAKING') {
      speedMult = 1.35 + voiceAmp * 0.7;
    } else if (currentState === 'THINKING') {
      speedMult = 2.4;
    } else if (currentState === 'EXECUTING') {
      speedMult = 2.8;
    } else {
      speedMult = 0.75;
    }

    const [px, py] = pointerRef.current;
    const parallaxFactor = settings.reducedMotion ? 0.008 : 0.55;
    const targetRotY = px * parallaxFactor;
    const targetRotX = -py * (settings.reducedMotion ? 0.008 : 0.45);

    // Parallax tracking & continuous 3D rotation matching Stitch ANIMATION_17 tick
    masterGroupRef.current.rotation.y += THREE.MathUtils.lerp(0, targetRotY - masterGroupRef.current.rotation.y, 0.045) + (0.0018 * speedMult);
    masterGroupRef.current.rotation.x += THREE.MathUtils.lerp(0, targetRotX - masterGroupRef.current.rotation.x, 0.045);
    masterGroupRef.current.rotation.z = Math.sin(time * 0.3) * 0.04;
  });

  return (
    <>
      {/* Deep Space Background & Ambient Micro Grid */}
      <SpaceEnvironment pointerRef={pointerRef} />

      {/* Master Transformation Group (Stitch ANIMATION_17 Direct Port) */}
      <group ref={masterGroupRef}>
        {/* 1. Sophisticated Central Intelligence Core */}
        <AuraCore position={[0, 0, 0]} />

        {/* 2. Curved 3D Energy Pathways (5 Organic Conduits + 10 Traveling Light Pulses) */}
        <AuraFilaments pointerRef={pointerRef} pulsePositionsRef={pulsePositionsRef} />

        {/* 3. Dense Volumetric 3D Particle Sphere (20,000 Cube-Root Volume Particles) */}
        <AuraParticles pointerRef={pointerRef} pulsePositionsRef={pulsePositionsRef} />

        {/* 4. Outer Warm Golden Atmosphere */}
        <AuraAtmosphere />
      </group>

      {/* Controlled Cinematic Bloom Post-Processing Pass */}
      {settings.bloomEnabled && (
        <CinematicBloom threshold={0.82} intensity={0.4} radius={0.35} />
      )}
    </>
  );
};
