import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { AuraScene } from './AuraScene';

/**
 * Production WebGL Scene Canvas Component
 * Full-screen React Three Fiber viewport mounted behind the HUD layer.
 * Calibrated precisely to Stitch 16:9 desktop prototype parameters (FOV 45, Camera Z 21.0).
 */
export const SceneCanvas: React.FC = () => {
  // Normalized pointer coordinates [-1..1] stored in ref to bypass React re-renders
  const pointerRef = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerRef.current = [x, y];
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      id="aura-scene-container"
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#02040A]"
      aria-label="AURA WebGL 3D Spatial Canvas"
    >
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        camera={{
          position: [0, 0, 36.0],
          fov: 45,
          near: 0.1,
          far: 1000,
        }}
        aria-hidden="true"
      >
        <AuraScene pointerRef={pointerRef} />
      </Canvas>
    </div>
  );
};
