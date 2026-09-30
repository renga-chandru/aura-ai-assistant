import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';

const atmosVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosFragmentShader = `
  uniform float uPulse;
  varying vec3 vNormal;
  void main() {
    float viewDot = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float rim = pow(viewDot, 4.0);
    vec3 glowCol = vec3(1.0, 0.65, 0.15); // Pure warm gold atmosphere
    gl_FragColor = vec4(glowCol, rim * 0.18 * uPulse);
  }
`;

/**
 * Outer Warm Golden Atmosphere Component (Stitch ANIMATION_9 Direct Port)
 * Renders a large back-side atmosphere sphere surrounding the 3D core volume with warm golden rim glow.
 */
export const AuraAtmosphere: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const lerpRef = useRef({ pulse: 1.0 });

  const uniforms = useMemo(
    () => ({
      uPulse: { value: 1.0 },
    }),
    []
  );

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const settings = useAuraStore.getState().settings;
    const rawAudio = audioEngine.update();

    const audio = settings.audioReactive
      ? rawAudio
      : { uAudioAmp: 0, isMicrophoneActive: false, permissionState: rawAudio.permissionState };

    const targetPulse = 1.0 + Math.sin(time * 1.8) * 0.1 + (audio.uAudioAmp * 0.2);
    lerpRef.current.pulse = THREE.MathUtils.lerp(lerpRef.current.pulse, targetPulse, 0.08);

    if (materialRef.current) {
      materialRef.current.uniforms.uPulse.value = lerpRef.current.pulse;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[11.2 * 1.38, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={atmosVertexShader}
        fragmentShader={atmosFragmentShader}
        uniforms={uniforms}
        transparent={true}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
};
