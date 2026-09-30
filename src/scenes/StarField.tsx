import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pseudoRandom } from '@/utils';

interface StarFieldProps {
  pointerRef: React.MutableRefObject<[number, number]>;
}

/**
 * Procedural GPU Star Field Component (Refined)
 * Renders multi-depth stars with soft circular textures (no square points),
 * subtle opacity, and clear center exclusion zone so central AURA remains the hero.
 */
export const StarField: React.FC<StarFieldProps> = ({ pointerRef }) => {
  const farStarsGroupRef = useRef<THREE.Group>(null);
  const nearStarsGroupRef = useRef<THREE.Group>(null);
  const nearMaterialRef = useRef<THREE.PointsMaterial>(null);

  // Circular sprite texture to eliminate square point artifacts
  const circleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Generate Distant Star Field Geometry (1,000 micro-stars)
  const farStarData = useMemo(() => {
    const count = 1000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const baseColor = new THREE.Color('#94a3b8');
    const amberColor = new THREE.Color('#e5a93c');

    for (let i = 0; i < count; i++) {
      const r1 = pseudoRandom(i * 3 + 1);
      const r2 = pseudoRandom(i * 3 + 2);
      const r3 = pseudoRandom(i * 3 + 3);

      let x = (r1 - 0.5) * 600;
      let y = (r2 - 0.5) * 450;
      let z = -150 - r3 * 450;

      const distFromCenter = Math.sqrt(x * x + y * y);
      if (distFromCenter < 3.5) {
        x += x >= 0 ? 4 : -4;
        y += y >= 0 ? 4 : -4;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const isAmber = r1 < 0.08;
      const col = isAmber ? amberColor : baseColor;
      const dimFactor = 0.25 + r2 * 0.35;

      colors[i * 3] = col.r * dimFactor;
      colors[i * 3 + 1] = col.g * dimFactor;
      colors[i * 3 + 2] = col.b * dimFactor;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  // Generate Foreground / Midground Star Field Geometry (500 subtle stars)
  const nearStarData = useMemo(() => {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const whiteColor = new THREE.Color('#f8fafc');
    const blueColor = new THREE.Color('#38bdf8');
    const amberColor = new THREE.Color('#fbbf24');

    for (let i = 0; i < count; i++) {
      const r1 = pseudoRandom(i * 4 + 100);
      const r2 = pseudoRandom(i * 4 + 101);
      const r3 = pseudoRandom(i * 4 + 102);
      const r4 = pseudoRandom(i * 4 + 103);

      let x = (r1 - 0.5) * 350;
      let y = (r2 - 0.5) * 250;
      let z = -40 - r3 * 200;

      const distFromCenter = Math.sqrt(x * x + y * y);
      if (distFromCenter < 4.0) {
        const angle = r4 * Math.PI * 2;
        const radius = 4.5 + r1 * 8;
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const col = r4 < 0.80 ? whiteColor : r4 < 0.92 ? blueColor : amberColor;
      const dimFactor = 0.35 + r2 * 0.45;

      colors[i * 3] = col.r * dimFactor;
      colors[i * 3 + 1] = col.g * dimFactor;
      colors[i * 3 + 2] = col.b * dimFactor;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const [px, py] = pointerRef.current;

    if (farStarsGroupRef.current) {
      farStarsGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        farStarsGroupRef.current.rotation.y,
        px * 0.012,
        0.04
      );
      farStarsGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        farStarsGroupRef.current.rotation.x,
        -py * 0.012,
        0.04
      );
    }

    if (nearStarsGroupRef.current) {
      nearStarsGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        nearStarsGroupRef.current.rotation.y,
        px * 0.03,
        0.05
      );
      nearStarsGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        nearStarsGroupRef.current.rotation.x,
        -py * 0.03,
        0.05
      );
    }

    if (nearMaterialRef.current) {
      nearMaterialRef.current.opacity = 0.45 + Math.sin(time * 1.2) * 0.08;
    }
  });

  return (
    <>
      {/* Distant Micro-Star Field */}
      <group ref={farStarsGroupRef}>
        <points geometry={farStarData}>
          <pointsMaterial
            map={circleTexture}
            size={1.1}
            sizeAttenuation={true}
            vertexColors={true}
            transparent={true}
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>

      {/* Foreground/Midground Dynamic Star Field */}
      <group ref={nearStarsGroupRef}>
        <points geometry={nearStarData}>
          <pointsMaterial
            ref={nearMaterialRef}
            map={circleTexture}
            size={1.4}
            sizeAttenuation={true}
            vertexColors={true}
            transparent={true}
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      </group>
    </>
  );
};

