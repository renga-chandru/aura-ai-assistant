import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuraStore } from '@/state/useAuraStore';
import { audioEngine } from '@/audio';

// Inner core atmospheric fresnel halo GLSL Shader (Stitch ANIMATION_9 Direct Match)
const innerHaloVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const innerHaloFragmentShader = `
  uniform float uTime;
  uniform float uPulse;
  uniform float uCoreLuminance;
  uniform vec3 uColorCyan;
  uniform vec3 uColorViolet;
  uniform vec3 uColorCrimson;
  uniform float uInteraction;
  uniform float uThinkProgress;
  uniform float uExecutionProgress;

  varying vec3 vNormal;
  void main() {
    float viewDot = clamp(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float rim = pow(1.0 - viewDot, 2.0);
    float centerGlow = pow(viewDot, 1.5);
    vec3 innerCol = vec3(1.0, 0.97, 0.76); // #FFF7C2 White-Hot
    vec3 outerCol = vec3(1.0, 0.69, 0.0);  // #FFB000 Bright Gold
    vec3 col = mix(innerCol, outerCol, rim);

    // State accents on rim
    col = mix(col, uColorCyan, clamp(uInteraction * rim * 0.5, 0.0, 1.0));
    col = mix(col, uColorViolet, clamp(uThinkProgress * rim * 0.6, 0.0, 1.0));
    col = mix(col, uColorCrimson, clamp(uExecutionProgress * rim * 0.5, 0.0, 1.0));

    float alpha = clamp((centerGlow * 0.95 + rim * 0.85) * uPulse * uCoreLuminance, 0.0, 0.98);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Turbulent golden plasma corona GLSL Shader (Stitch ANIMATION_9 Direct Match)
const plasmaVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float uTime;
  uniform float uActivity;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 p = position;
    float displacement = sin(p.x * 2.5 + uTime * 2.8) * cos(p.y * 2.5 + uTime * 2.4) * sin(p.z * 2.5 + uTime * 2.6) * (0.4 + uActivity * 0.5);
    p += normal * displacement;
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const plasmaFragmentShader = `
  uniform float uTime;
  uniform float uActivity;
  uniform float uPulse;
  uniform vec3 uColorCyan;
  uniform vec3 uColorViolet;
  uniform vec3 uColorCrimson;
  uniform float uInteraction;
  uniform float uThinkProgress;
  uniform float uExecutionProgress;

  varying vec3 vNormal;
  varying vec3 vPos;

  void main() {
    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    float noise = sin(vPos.x * 3.2 + uTime * 2.8) * cos(vPos.y * 3.2 + uTime * 2.4) * 0.25;
    vec3 colGold = vec3(1.0, 0.75, 0.2);   // #FFB000
    vec3 colAmber = vec3(1.0, 0.48, 0.0);  // #FF7A00
    vec3 col = mix(colGold, colAmber, clamp(intensity + noise, 0.0, 1.0));

    col = mix(col, uColorCyan, clamp(uInteraction * 0.4, 0.0, 1.0));
    col = mix(col, uColorViolet, clamp(uThinkProgress * 0.5, 0.0, 1.0));
    col = mix(col, uColorCrimson, clamp(uExecutionProgress * 0.4, 0.0, 1.0));

    float alpha = clamp((1.0 - intensity * 1.05) * (0.5 + uActivity * 0.45) * uPulse, 0.0, 0.88);
    gl_FragColor = vec4(col, alpha);
  }
`;

interface AuraCoreProps {
  position?: [number, number, number];
}

/**
 * Sophisticated Central Intelligence Core Component (Stitch ANIMATION_9 Direct Port)
 * Features exact scale geometries:
 * 1. White-hot point center core (SphereGeometry 1.2)
 * 2. Molten pale-gold inner core glow (SphereGeometry 1.85)
 * 3. Inner core atmospheric fresnel halo (SphereGeometry 2.7)
 * 4. Turbulent golden plasma corona (SphereGeometry 3.8)
 */
export const AuraCore: React.FC<AuraCoreProps> = ({ position = [0, 0, 0] }) => {
  const masterGroupRef = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const moltenMeshRef = useRef<THREE.Mesh>(null);
  const innerHaloMeshRef = useRef<THREE.Mesh>(null);
  const plasmaMeshRef = useRef<THREE.Mesh>(null);

  const innerHaloMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const plasmaMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const lerpRef = useRef({
    interaction: 0,
    thinkProgress: 0,
    speechAmp: 0,
    executionProgress: 0,
    activity: 0,
    coreLuminance: 1.0,
    pulse: 1.0,
  });

  const innerHaloUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 1.0 },
      uCoreLuminance: { value: 1.0 },
      uColorCyan: { value: new THREE.Color('#3CE5D9') },
      uColorViolet: { value: new THREE.Color('#8B5CF6') },
      uColorCrimson: { value: new THREE.Color('#EF4444') },
      uInteraction: { value: 0 },
      uThinkProgress: { value: 0 },
      uExecutionProgress: { value: 0 },
    }),
    []
  );

  const plasmaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uActivity: { value: 0.0 },
      uPulse: { value: 1.0 },
      uColorCyan: { value: new THREE.Color('#3CE5D9') },
      uColorViolet: { value: new THREE.Color('#8B5CF6') },
      uColorCrimson: { value: new THREE.Color('#EF4444') },
      uInteraction: { value: 0 },
      uThinkProgress: { value: 0 },
      uExecutionProgress: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const currentState = useAuraStore.getState().currentState;
    const settings = useAuraStore.getState().settings;
    const rawAudio = audioEngine.update();

    const audio = settings.audioReactive
      ? rawAudio
      : { uAudioAmp: 0, uBass: 0, uMid: 0, uHigh: 0, speechEnergy: 0, activity: 0, isMicrophoneActive: false, permissionState: rawAudio.permissionState };

    const targetInteraction = currentState === 'LISTENING' ? 1.0 : 0.0;
    const targetThinkProgress = currentState === 'THINKING' ? 1.0 : 0.0;
    const targetSpeechAmp = currentState === 'SPEAKING' ? 1.0 : 0.0;
    const targetExecutionProgress = currentState === 'EXECUTING' ? 1.0 : 0.0;

    const targetActivity = Math.max(targetInteraction, targetThinkProgress, targetSpeechAmp, targetExecutionProgress, audio.activity);
    const targetLuminance = 1.0 + targetInteraction * (0.65 + audio.speechEnergy * 0.5) + targetSpeechAmp * (0.45 + audio.uAudioAmp * 0.45) + targetThinkProgress * 0.35;

    lerpRef.current.interaction = THREE.MathUtils.lerp(lerpRef.current.interaction, targetInteraction, 0.08);
    lerpRef.current.thinkProgress = THREE.MathUtils.lerp(lerpRef.current.thinkProgress, targetThinkProgress, 0.08);
    lerpRef.current.speechAmp = THREE.MathUtils.lerp(lerpRef.current.speechAmp, targetSpeechAmp, 0.08);
    lerpRef.current.executionProgress = THREE.MathUtils.lerp(lerpRef.current.executionProgress, targetExecutionProgress, 0.08);
    lerpRef.current.activity = THREE.MathUtils.lerp(lerpRef.current.activity, targetActivity, 0.08);
    lerpRef.current.coreLuminance = THREE.MathUtils.lerp(lerpRef.current.coreLuminance, targetLuminance, 0.08);

    const inter = lerpRef.current.interaction;
    const think = lerpRef.current.thinkProgress;
    const exec = lerpRef.current.executionProgress;

    // State pulse factor calculation matching Stitch animation loop
    let corePulseScale = 1.0;
    let speedMult = 1.0;
    let plasmaExcitation = 0.1;

    if (currentState === 'LISTENING') {
      const speechInfluence = audio.speechEnergy * 0.35;
      corePulseScale = 1.35 + speechInfluence * 0.55;
      speedMult = 1.45 + speechInfluence * 0.8;
      plasmaExcitation = 0.55 + speechInfluence * 0.5;
    } else if (currentState === 'SPEAKING') {
      corePulseScale = 1.28 + Math.sin(time * 7.5) * 0.25 * (audio.uAudioAmp + 0.3);
      speedMult = 1.35 + audio.uAudioAmp * 0.7;
      plasmaExcitation = 0.85 + audio.uAudioAmp * 0.6;
    } else if (currentState === 'THINKING') {
      corePulseScale = 1.15 + Math.sin(time * 8.0) * 0.15;
      speedMult = 2.2;
      plasmaExcitation = 0.7;
    } else if (currentState === 'EXECUTING') {
      corePulseScale = 1.25 + Math.sin(time * 6.0) * 0.2;
      speedMult = 2.0;
      plasmaExcitation = 0.8;
    } else {
      corePulseScale = 1.0 + Math.sin(time * 2.8) * 0.06;
      speedMult = 0.75;
      plasmaExcitation = 0.1;
    }

    lerpRef.current.pulse = THREE.MathUtils.lerp(lerpRef.current.pulse, corePulseScale, 0.08);

    if (innerHaloMaterialRef.current) {
      const u = innerHaloMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uPulse.value = lerpRef.current.pulse;
      u.uCoreLuminance.value = lerpRef.current.coreLuminance;
      u.uInteraction.value = inter;
      u.uThinkProgress.value = think;
      u.uExecutionProgress.value = exec;
    }

    if (plasmaMaterialRef.current) {
      const u = plasmaMaterialRef.current.uniforms;
      u.uTime.value = time;
      u.uActivity.value = plasmaExcitation + lerpRef.current.activity;
      u.uPulse.value = lerpRef.current.pulse;
      u.uInteraction.value = inter;
      u.uThinkProgress.value = think;
      u.uExecutionProgress.value = exec;
    }

    // Scale mesh objects matching Stitch animation tick
    if (coreMeshRef.current) {
      const s = lerpRef.current.pulse;
      coreMeshRef.current.scale.set(s, s, s);
    }
    if (moltenMeshRef.current) {
      const s = lerpRef.current.pulse * 1.12;
      moltenMeshRef.current.scale.set(s, s, s);
    }
    if (plasmaMeshRef.current) {
      plasmaMeshRef.current.rotation.y -= 0.004 * speedMult;
      plasmaMeshRef.current.rotation.x = Math.sin(time * 0.5) * 0.12;
    }
  });

  return (
    <group position={position} ref={masterGroupRef}>
      {/* Point Light source matching golden spectrum */}
      <pointLight color="#FFD700" intensity={0.5} distance={15.0} decay={2} />

      {/* 1. White-hot point center core (SphereGeometry 1.2) */}
      <mesh ref={coreMeshRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color={0xffffff} transparent={true} opacity={0.99} />
      </mesh>

      {/* 2. Molten pale-gold inner core glow (SphereGeometry 1.85) */}
      <mesh ref={moltenMeshRef}>
        <sphereGeometry args={[1.85, 32, 32]} />
        <meshBasicMaterial
          color={0xFFF7C2}
          transparent={true}
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Inner core atmospheric fresnel halo (SphereGeometry 2.7) */}
      <mesh ref={innerHaloMeshRef}>
        <sphereGeometry args={[2.7, 32, 32]} />
        <shaderMaterial
          ref={innerHaloMaterialRef}
          vertexShader={innerHaloVertexShader}
          fragmentShader={innerHaloFragmentShader}
          uniforms={innerHaloUniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Turbulent golden plasma corona (SphereGeometry 3.8) */}
      <mesh ref={plasmaMeshRef}>
        <sphereGeometry args={[3.8, 48, 48]} />
        <shaderMaterial
          ref={plasmaMaterialRef}
          vertexShader={plasmaVertexShader}
          fragmentShader={plasmaFragmentShader}
          uniforms={plasmaUniforms}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

