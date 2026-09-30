import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';

interface AuraRaysProps {
  pointerRef?: React.MutableRefObject<[number, number]>;
}

/**
 * Piercing Radiant Light Beams Component (Stitch ANIMATION_9 Direct Port)
 * Renders 38 piercing radiant light beams shooting from core into the volume,
 * matching exact Stitch line positions, white-gold to warm amber colors, and shimmer animation tick.
 */
export const AuraRays: React.FC<AuraRaysProps> = () => {
  const rayLinesRef = useRef<THREE.LineSegments>(null);
  const rayMatRef = useRef<THREE.LineBasicMaterial>(null);

  const lerpRef = useRef({
    radiusScale: 1.0,
    plasmaExcitation: 0.1,
  });

  const rayGeometry = useMemo(() => {
    const SPHERE_BASE_RADIUS = 11.2;
    const RAY_COUNT = 38;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAY_COUNT * 6);
    const colors = new Float32Array(RAY_COUNT * 6);

    for (let s = 0; s < RAY_COUNT; s++) {
      const s6 = s * 6;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      ).normalize();

      const innerL = 1.0 + Math.random() * 0.5;
      const outerL = SPHERE_BASE_RADIUS * (0.88 + Math.random() * 0.45);

      positions[s6]     = dir.x * innerL;
      positions[s6 + 1] = dir.y * innerL;
      positions[s6 + 2] = dir.z * innerL;

      positions[s6 + 3] = dir.x * outerL;
      positions[s6 + 4] = dir.y * outerL;
      positions[s6 + 5] = dir.z * outerL;

      // Center white-gold (#FFF7C2)
      colors[s6]     = 1.0;
      colors[s6 + 1] = 0.97;
      colors[s6 + 2] = 0.76;

      // Outer warm amber fade (#FF7A00)
      colors[s6 + 3] = 1.0;
      colors[s6 + 4] = 0.48;
      colors[s6 + 5] = 0.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return geo;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const currentState = useAuraStore.getState().currentState;
    const settings = useAuraStore.getState().settings;
    const rawAudio = audioEngine.update();

    const audio = settings.audioReactive
      ? rawAudio
      : { uAudioAmp: 0, uBass: 0, uMid: 0, uHigh: 0, speechEnergy: 0, isMicrophoneActive: false, permissionState: rawAudio.permissionState };

    const voiceAmp = audio.uAudioAmp + audio.speechEnergy * 0.5;

    let targetRadiusScale = 1.0;
    let speedMult = 1.0;
    let plasmaExcitation = 0.1;

    if (currentState === 'LISTENING') {
      const speechInfluence = voiceAmp * 0.32;
      targetRadiusScale = 0.74 - speechInfluence * 0.18;
      speedMult = 1.45 + speechInfluence * 0.8;
      plasmaExcitation = 0.55 + speechInfluence * 0.5;
    } else if (currentState === 'SPEAKING') {
      const auraInfluence = voiceAmp * 0.36;
      targetRadiusScale = 1.15 + Math.sin(time * 4.2) * 0.06 + auraInfluence * 0.14;
      speedMult = 1.35 + auraInfluence * 0.7;
      plasmaExcitation = 0.85 + auraInfluence * 0.6;
    } else if (currentState === 'THINKING') {
      targetRadiusScale = 0.88 + Math.sin(time * 4.0) * 0.05;
      speedMult = 2.2;
      plasmaExcitation = 0.7;
    } else if (currentState === 'EXECUTING') {
      targetRadiusScale = 1.08;
      speedMult = 2.0;
      plasmaExcitation = 0.8;
    } else {
      targetRadiusScale = 1.0 + Math.sin(time * 1.5) * 0.025;
      speedMult = 0.75;
      plasmaExcitation = 0.1;
    }

    lerpRef.current.radiusScale = THREE.MathUtils.lerp(lerpRef.current.radiusScale, targetRadiusScale, 0.08);
    lerpRef.current.plasmaExcitation = THREE.MathUtils.lerp(lerpRef.current.plasmaExcitation, plasmaExcitation, 0.08);

    const currentRadiusScale = lerpRef.current.radiusScale;
    const currentExcitation = lerpRef.current.plasmaExcitation;

    // Piercing rays shimmer and scale matching Stitch animation tick
    if (rayLinesRef.current) {
      rayLinesRef.current.rotation.y += 0.0014 * speedMult;
      rayLinesRef.current.scale.set(currentRadiusScale, currentRadiusScale, currentRadiusScale);
    }
    if (rayMatRef.current) {
      rayMatRef.current.opacity = 0.58 + Math.sin(time * 4.0) * 0.16 + (currentExcitation * 0.25);
    }
  });

  return (
    <lineSegments ref={rayLinesRef} geometry={rayGeometry}>
      <lineBasicMaterial
        ref={rayMatRef}
        vertexColors={true}
        transparent={true}
        opacity={0.72}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
};
