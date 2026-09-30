import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const nebulaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragmentShader = `
  uniform float uTime;
  uniform vec3 uColorNavy;
  uniform vec3 uColorIndigo;
  uniform vec3 uColorTeal;
  varying vec2 vUv;

  // Simple 2D noise helper function
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    
    // Distance from center (0.0 at center, 0.5+ at edges)
    float dist = length(uv - vec2(0.5));
    
    // Explicit center mask: Keep center r < 0.25 very dark, fade nebula into outer region
    float centerMask = smoothstep(0.15, 0.65, dist);

    // Fluid procedural cloud noise
    vec2 q = vec2(0.0);
    q.x = fbm(uv * 2.5 + uTime * 0.02);
    q.y = fbm(uv * 2.5 + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(uv * 2.5 + 1.0 * q + vec2(1.7, 9.2) + 0.015 * uTime);
    r.y = fbm(uv * 2.5 + 1.0 * q + vec2(8.3, 2.8) + 0.012 * uTime);

    float f = fbm(uv * 2.5 + r);

    // Color gradient composition
    vec3 color = mix(uColorNavy, uColorIndigo, clamp(f * f * 2.0, 0.0, 1.0));
    color = mix(color, uColorTeal, clamp(length(q), 0.0, 1.0) * 0.35);

    // Final alpha: Very soft and restrained (max opacity ~0.22 in outer edges, 0 in center)
    float alpha = clamp(f * f * f * 2.5, 0.0, 1.0) * centerMask * 0.22;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface NebulaProps {
  pointerRef: React.MutableRefObject<[number, number]>;
}

/**
 * Restrained Procedural Nebula Component
 * Displays dark navy/indigo atmospheric cloud clouds toward outer background regions.
 * Features an explicit center mask to keep the central space clear for future AURA core.
 */
export const Nebula: React.FC<NebulaProps> = ({ pointerRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorNavy: { value: new THREE.Color('#060919') },
      uColorIndigo: { value: new THREE.Color('#0a0b1e') },
      uColorTeal: { value: new THREE.Color('#051824') },
    }),
    []
  );

  // 60 FPS Render Loop for slow atmospheric fluid drift and subtle mouse parallax
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
    }

    if (meshRef.current) {
      const [px, py] = pointerRef.current;
      meshRef.current.rotation.z = THREE.MathUtils.lerp(
        meshRef.current.rotation.z,
        px * 0.01,
        0.02
      );
      meshRef.current.position.x = THREE.MathUtils.lerp(
        meshRef.current.position.x,
        px * 5,
        0.02
      );
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        py * 3,
        0.02
      );
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -350]}>
      <planeGeometry args={[1200, 900]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};
