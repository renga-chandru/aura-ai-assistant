import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';

interface AuraFilamentsProps {
  pointerRef?: React.MutableRefObject<[number, number]>;
  pulsePositionsRef?: React.MutableRefObject<THREE.Vector3[]>;
}

/**
 * 5 Organic Curved 3D Energy Pathways & Traveling Light Pulses Component (Stitch ANIMATION_17 Direct Port)
 * Renders 5 asymmetric 3D CatmullRom tube conduits with 10 traveling light pulse nodes
 * that illuminate adjacent particles as they move through 3D space.
 */
export const AuraFilaments: React.FC<AuraFilamentsProps> = ({ pulsePositionsRef }) => {
  const filamentGroupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<THREE.Mesh[]>([]);
  const pulseMeshRefs = useRef<THREE.Mesh[]>([]);

  const lerpRef = useRef({
    filamentRadius: 1.0,
    coreBrightness: 1.0,
  });

  const { filamentsData, pulsesData } = useMemo(() => {
    const SPHERE_BASE_RADIUS = 11.2;
    const FILAMENT_COUNT = 5;
    const filamentsData = [];
    const pulsesData = [];

    for (let i = 0; i < FILAMENT_COUNT; i++) {
      const curvePoints = [];
      const segments = 120;
      const ringRadius = SPHERE_BASE_RADIUS * (0.55 + (i % 3) * 0.18);

      const tiltAxis = new THREE.Vector3(
        Math.sin(i * 1.4 + 0.6),
        Math.cos(i * 1.6 + 0.9),
        Math.sin(i * 0.9 + 1.2)
      ).normalize();

      const rotMatrix = new THREE.Matrix4().makeRotationAxis(tiltAxis, (i * Math.PI) / 2.5);

      for (let j = 0; j <= segments; j++) {
        const ang = (j / segments) * Math.PI * 2;
        const wobble = Math.sin(ang * 3.0 + i * 1.3) * 1.1 + Math.cos(ang * 5.0) * 0.4;
        const zOffset = Math.sin(ang * 2.0 + i) * 3.8 + Math.cos(ang * 3.0) * 1.2;
        const pt = new THREE.Vector3(
          (ringRadius + wobble) * Math.cos(ang),
          (ringRadius + wobble) * Math.sin(ang) * 0.92,
          zOffset
        );
        pt.applyMatrix4(rotMatrix);
        curvePoints.push(pt);
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 140, 0.052, 6, true);
      const colorHex = i % 2 === 0 ? 0xFFB000 : 0xF0BE55;

      filamentsData.push({
        curve,
        geometry: tubeGeo,
        colorHex,
        rotAxis: tiltAxis,
        rotSpeed: 0.0024 + (i % 3) * 0.0016,
        baseOpacity: 0.68 + (i % 2) * 0.12,
      });

      // 2 Traveling Light Pulses per filament matching ANIMATION_17
      for (let p = 0; p < 2; p++) {
        pulsesData.push({
          filamentIndex: i,
          t: p * 0.5 + Math.random() * 0.2,
          speed: 0.07 + (i % 2) * 0.03,
        });
      }
    }

    return { filamentsData, pulsesData, FILAMENT_COUNT };
  }, []);

  const pulseStateRef = useRef(
    pulsesData.map((p) => ({ t: p.t, speed: p.speed, filamentIndex: p.filamentIndex }))
  );

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const currentState = useAuraStore.getState().currentState;
    const settings = useAuraStore.getState().settings;
    const rawAudio = audioEngine.update();

    const audio = settings.audioReactive
      ? rawAudio
      : { uAudioAmp: 0, uBass: 0, uMid: 0, uHigh: 0, speechEnergy: 0, isMicrophoneActive: false, permissionState: rawAudio.permissionState };

    const voiceAmp = audio.uAudioAmp + audio.speechEnergy * 0.5;

    let targetFilamentRadius = 1.0;
    let targetCoreBrightness = 1.0;
    let speedMult = 1.0;
    let plasmaExcitation = 0.1;
    let pulseSpeedMult = 1.0;

    if (currentState === 'LISTENING') {
      const speechInfluence = voiceAmp * 0.34;
      targetFilamentRadius = 0.62 - speechInfluence * 0.22;
      targetCoreBrightness = 1.75 + speechInfluence * 0.65;
      speedMult = 1.45 + speechInfluence * 0.8;
      plasmaExcitation = 0.55 + speechInfluence * 0.5;
      pulseSpeedMult = 1.6 + speechInfluence * 0.8;
    } else if (currentState === 'SPEAKING') {
      const auraInfluence = voiceAmp * 0.38;
      targetFilamentRadius = 1.25 + Math.sin(time * 3.5) * 0.08 + auraInfluence * 0.18;
      targetCoreBrightness = 1.55 + voiceAmp * 0.45;
      speedMult = 1.35 + auraInfluence * 0.7;
      plasmaExcitation = 0.85 + auraInfluence * 0.6;
      pulseSpeedMult = 2.0 + auraInfluence * 1.2;
    } else if (currentState === 'THINKING') {
      targetFilamentRadius = 0.82;
      targetCoreBrightness = 1.45;
      speedMult = 2.4;
      plasmaExcitation = 0.72;
      pulseSpeedMult = 2.8;
    } else if (currentState === 'EXECUTING') {
      targetFilamentRadius = 1.08 + Math.cos(time * 4.5) * 0.1;
      targetCoreBrightness = 1.6;
      speedMult = 2.8;
      plasmaExcitation = 0.9;
      pulseSpeedMult = 3.2;
    } else {
      targetFilamentRadius = 1.0 + Math.sin(time * 1.2) * 0.02;
      targetCoreBrightness = 1.0;
      speedMult = 0.75;
      plasmaExcitation = 0.1;
      pulseSpeedMult = 1.0;
    }

    lerpRef.current.filamentRadius = THREE.MathUtils.lerp(lerpRef.current.filamentRadius, targetFilamentRadius, 0.08);
    lerpRef.current.coreBrightness = THREE.MathUtils.lerp(lerpRef.current.coreBrightness, targetCoreBrightness, 0.08);

    const currentFilamentRadius = lerpRef.current.filamentRadius;
    const coreBrightness = lerpRef.current.coreBrightness;

    // Rotate and scale energy conduits matching ANIMATION_17 tick
    meshRefs.current.forEach((mesh, f) => {
      if (!mesh) return;
      const data = filamentsData[f];
      mesh.rotateOnAxis(data.rotAxis, data.rotSpeed * speedMult);
      mesh.scale.set(currentFilamentRadius, currentFilamentRadius, currentFilamentRadius);

      const wave = Math.sin(time * 3.2 + f * 1.5) * 0.2;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = (data.baseOpacity + wave + (plasmaExcitation * 0.25)) * Math.min(coreBrightness, 1.35);
      }
    });

    // Update traveling light pulses along the curves & collect world positions matching ANIMATION_17
    const activePulsePositions: THREE.Vector3[] = [];
    pulseMeshRefs.current.forEach((pm, p) => {
      if (!pm) return;
      const pState = pulseStateRef.current[p];
      const data = filamentsData[pState.filamentIndex];
      const tubeMesh = meshRefs.current[pState.filamentIndex];

      pState.t = (pState.t + Math.min(delta, 0.1) * pState.speed * pulseSpeedMult) % 1.0;
      const pt = data.curve.getPointAt(pState.t);

      if (tubeMesh) {
        tubeMesh.updateMatrixWorld();
        pt.applyMatrix4(tubeMesh.matrixWorld);
      }

      pm.position.copy(pt);
      activePulsePositions.push(pt.clone());

      const pulseScale = 1.0 + Math.sin(time * 8.0 + p) * 0.25;
      pm.scale.set(pulseScale, pulseScale, pulseScale);
    });

    if (pulsePositionsRef) {
      pulsePositionsRef.current = activePulsePositions;
    }
  });

  return (
    <group ref={filamentGroupRef}>
      {/* 5 Organic Energy Conduit Tubes */}
      {filamentsData.map((data, idx) => (
        <mesh
          key={`tube-${idx}`}
          ref={(el) => {
            if (el) meshRefs.current[idx] = el;
          }}
          geometry={data.geometry}
        >
          <meshBasicMaterial
            color={data.colorHex}
            transparent={true}
            opacity={data.baseOpacity}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* 10 Traveling Light Pulses */}
      {pulsesData.map((_, pIdx) => (
        <mesh
          key={`pulse-${pIdx}`}
          ref={(el) => {
            if (el) pulseMeshRefs.current[pIdx] = el;
          }}
        >
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial
            color={0xFFF7C2}
            transparent={true}
            opacity={0.95}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};
