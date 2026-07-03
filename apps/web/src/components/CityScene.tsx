import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { CityLayout } from '@codecity/shared-types';
import { CityRenderer } from './CityRenderer.js';
import { PostProcessing } from './PostProcessing.js';
import { CameraRig } from './CameraRig.js';
import { useStore } from '../store/useStore.js';

interface CitySceneProps {
  layout: CityLayout;
}

export function CityScene({ layout }: CitySceneProps) {
  const [adaptiveBloom, setAdaptiveBloom] = useState(1.6);
  const isFlyMode = useStore((state) => state.isFlyMode);
  const bloomOverride = useStore((state) => state.bloomOverride);

  // Apply user setting bloom intensity if customized, otherwise fall back to adaptive loop
  const finalBloom = bloomOverride !== 1.6 ? bloomOverride : adaptiveBloom;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'auto' }}>
      {/* ── 3D WebGL Canvas ──────────────────────────────── */}
      <Canvas
        camera={{ position: [100, 80, 150], fov: 60 }}
        gl={{ antialias: true }}
      >
        {/* Mount smoothly interpolated CameraRig */}
        <CameraRig />

        {/* Zero ambient lighting as per Contract 3 - every surface lit by emissive glow */}
        <color attach="background" args={['#000000']} />
        
        {/* Green-tinted volumetric fog at far draw distance */}
        <fogExp2 attach="fog" args={['#010401', 0.003]} />

        {/* ── Interactive Navigation Rig ──────────────────── */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground level
          minDistance={10}
          maxDistance={500}
          autoRotate={!isFlyMode} // Cinematic orbit rotation
          autoRotateSpeed={0.3}
        />

        {/* Procedural Buildings Layer */}
        <CityRenderer 
          layout={layout} 
          setBloomIntensity={setAdaptiveBloom} 
        />

        {/* ── Matrix Grid Ground Plane ────────────────────── */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial 
            color="#000000" 
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>

        {/* Dashed light-strip avenues along layout grid axes */}
        <Grid
          renderOrder={-1}
          position={[0, 0, 0]}
          args={[1000, 1000]}
          cellSize={20}
          cellThickness={0.5}
          cellColor="#1A5C25"
          sectionSize={100}
          sectionThickness={1.2}
          sectionColor="#39FF14"
          fadeDistance={400}
          infiniteGrid
        />

        {/* Postprocessing effects pipeline */}
        <PostProcessing bloomIntensity={finalBloom} />
      </Canvas>
    </div>
  );
}
