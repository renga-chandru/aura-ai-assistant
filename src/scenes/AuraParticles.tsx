import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';

interface AuraParticlesProps {
  pointerRef?: React.MutableRefObject<[number, number]>;
  pulsePositionsRef?: React.MutableRefObject<THREE.Vector3[]>;
}

/**
 * Dense Volumetric 3D Particle Sphere Component (Stitch ANIMATION_17 Direct Port)
 * Renders 20,000 GPU volume particles using uniform solid cube-root distribution,
 * CanvasTexture soft particle map, golden spectrum gradation, and interactive traveling light pulse excitement.
 */
export const AuraParticles: React.FC<AuraParticlesProps> = ({ pulsePositionsRef }) => {
  const particleSystemRef = useRef<THREE.Points>(null);
  const particleGeoRef = useRef<THREE.BufferGeometry>(null);

  const lerpRef = useRef({
    radiusScale: 1.0,
    voiceAmplitude: 0.0,
  });

  const { particleGeo, particleMap, basePositions, baseColors, baseSizes, particleMeta, PARTICLE_COUNT } = useMemo(() => {
    const SPHERE_BASE_RADIUS = 11.2;
    const PARTICLE_COUNT = 20000;

    // Soft Radial Glow Particle Texture generator (Golden luminous gradient)
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.18, 'rgba(255, 247, 194, 0.95)');
      grad.addColorStop(0.38, 'rgba(255, 185, 20, 0.85)');
      grad.addColorStop(0.65, 'rgba(255, 110, 0, 0.45)');
      grad.addColorStop(0.85, 'rgba(255, 70, 0, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const particleMap = new THREE.CanvasTexture(canvas);

    // Palette Constants matching ANIMATION_17
    const cWhiteHot   = new THREE.Color(0xFFF7C2);
    const cPaleGold   = new THREE.Color(0xF0BE55);
    const cBrightGold = new THREE.Color(0xFFB000);
    const cAmber      = new THREE.Color(0xFF7A00);
    const cDarkOrange = new THREE.Color(0xFF5500);

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const basePositions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const baseColors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const baseSizes = new Float32Array(PARTICLE_COUNT);
    const particleMeta = new Float32Array(PARTICLE_COUNT * 4); // phase, speed, radius, depthRatio

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const i4 = i * 4;

      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // Cube root distribution for uniform solid volume filling matching ANIMATION_17
      const rNorm = Math.cbrt(Math.random());
      const r = rNorm * SPHERE_BASE_RADIUS;
      const adjustedR = Math.max(1.3, r);

      const x = adjustedR * Math.sin(phi) * Math.cos(theta);
      const y = adjustedR * Math.sin(phi) * Math.sin(theta);
      const z = adjustedR * Math.cos(phi);

      positions[i3]     = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      basePositions[i3]     = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      particleMeta[i4]     = Math.random() * Math.PI * 2;
      particleMeta[i4 + 1] = 0.35 + Math.random() * 0.85;
      particleMeta[i4 + 2] = adjustedR;
      particleMeta[i4 + 3] = rNorm;

      const depthRatio = adjustedR / SPHERE_BASE_RADIUS;
      let pCol: THREE.Color;
      if (depthRatio < 0.25) {
        pCol = Math.random() < 0.65 ? cWhiteHot : cPaleGold;
      } else if (depthRatio < 0.55) {
        pCol = Math.random() < 0.6 ? cPaleGold : cBrightGold;
      } else if (depthRatio < 0.85) {
        pCol = Math.random() < 0.6 ? cBrightGold : cAmber;
      } else {
        pCol = Math.random() < 0.65 ? cAmber : cDarkOrange;
      }

      colors[i3]     = pCol.r;
      colors[i3 + 1] = pCol.g;
      colors[i3 + 2] = pCol.b;

      baseColors[i3]     = pCol.r;
      baseColors[i3 + 1] = pCol.g;
      baseColors[i3 + 2] = pCol.b;

      const sizeMult = depthRatio < 0.3 ? 1.5 : (Math.random() < 0.08 ? 1.7 : 0.85);
      const pSize = (Math.random() * 0.35 + 0.15) * sizeMult;
      sizes[i] = pSize;
      baseSizes[i] = pSize;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    return {
      particleGeo: geo,
      particleMap,
      basePositions,
      baseColors,
      baseSizes,
      particleMeta,
      PARTICLE_COUNT,
    };
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

    if (currentState === 'LISTENING') {
      const speechInfluence = voiceAmp * 0.34;
      targetRadiusScale = 0.72 - speechInfluence * 0.2;
      speedMult = 1.45 + speechInfluence * 0.8;
    } else if (currentState === 'SPEAKING') {
      const auraInfluence = voiceAmp * 0.38;
      targetRadiusScale = 1.18 + Math.sin(time * 4.2) * 0.07 + auraInfluence * 0.15;
      speedMult = 1.35 + auraInfluence * 0.7;
    } else if (currentState === 'THINKING') {
      targetRadiusScale = 0.85 + Math.sin(time * 4.0) * 0.05;
      speedMult = 2.4;
    } else if (currentState === 'EXECUTING') {
      targetRadiusScale = 1.05 + Math.sin(time * 5.0) * 0.08;
      speedMult = 2.8;
    } else {
      targetRadiusScale = 1.0 + Math.sin(time * 1.5) * 0.025;
      speedMult = 0.75;
    }

    lerpRef.current.radiusScale = THREE.MathUtils.lerp(lerpRef.current.radiusScale, targetRadiusScale, 0.08);
    lerpRef.current.voiceAmplitude = THREE.MathUtils.lerp(lerpRef.current.voiceAmplitude, voiceAmp, 0.12);

    const currentRadiusScale = lerpRef.current.radiusScale;
    const pulsePositions = pulsePositionsRef?.current || [];

    if (particleGeoRef.current) {
      const pArr = particleGeoRef.current.attributes.position.array as Float32Array;
      const cArr = particleGeoRef.current.attributes.color.array as Float32Array;
      const sArr = particleGeoRef.current.attributes.size.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        const bx = basePositions[i3];
        const by = basePositions[i3 + 1];
        const bz = basePositions[i3 + 2];

        const phase = particleMeta[i4];
        const speed = particleMeta[i4 + 1];
        const origRadius = particleMeta[i4 + 2];

        const angle = time * speed * 0.3 * speedMult + phase;
        const cosA = Math.cos(angle * 0.07);
        const sinA = Math.sin(angle * 0.07);

        let radialScale = currentRadiusScale;

        if (currentState === 'SPEAKING') {
          const waveFront = Math.sin((origRadius * 0.75) - (time * 5.2) + phase) * 0.09 * (voiceAmp + 0.3);
          radialScale += waveFront;
        } else if (currentState === 'LISTENING') {
          const pull = Math.sin(phase * 2.0 + time * 3.6) * 0.035 * (voiceAmp + 0.3);
          radialScale -= pull;
        } else if (currentState === 'EXECUTING') {
          const execWave = Math.sin(time * 6.0 + phase * 3.0) * 0.06;
          radialScale += execWave;
        }

        const rx = (bx * cosA - bz * sinA) * radialScale;
        const ry = (by + Math.cos(time * 1.5 + phase) * 0.16) * radialScale;
        const rz = (bx * sinA + bz * cosA) * radialScale;

        // Interactive light pulse illumination (Stitch ANIMATION_17 Direct Port)
        if (i % 6 === 0 && pulsePositions.length > 0) {
          const pulseTarget = pulsePositions[i % pulsePositions.length];
          const dx = rx - pulseTarget.x;
          const dy = ry - pulseTarget.y;
          const dz = rz - pulseTarget.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < 2.5) {
            const influence = (1.0 - distSq / 2.5) * 0.4;
            cArr[i3]     = Math.min(1.0, baseColors[i3] + influence * 0.5);
            cArr[i3 + 1] = Math.min(1.0, baseColors[i3 + 1] + influence * 0.5);
            cArr[i3 + 2] = Math.min(1.0, baseColors[i3 + 2] + influence * 0.6);
            sArr[i]      = baseSizes[i] * (1.0 + influence * 0.8);
          } else {
            cArr[i3]     = baseColors[i3];
            cArr[i3 + 1] = baseColors[i3 + 1];
            cArr[i3 + 2] = baseColors[i3 + 2];
            sArr[i]      = baseSizes[i];
          }
        }

        pArr[i3]     = rx;
        pArr[i3 + 1] = ry;
        pArr[i3 + 2] = rz;
      }

      particleGeoRef.current.attributes.position.needsUpdate = true;
      particleGeoRef.current.attributes.color.needsUpdate = true;
      particleGeoRef.current.attributes.size.needsUpdate = true;
    }
  });

  return (
    <points ref={particleSystemRef} geometry={particleGeo}>
      <bufferGeometry ref={particleGeoRef} {...particleGeo} />
      <pointsMaterial
        size={0.45}
        vertexColors={true}
        map={particleMap}
        transparent={true}
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};
