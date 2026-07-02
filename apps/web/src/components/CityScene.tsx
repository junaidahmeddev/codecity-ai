import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { CityLayout } from '@codecity/shared-types';
import { CityRenderer } from './CityRenderer.js';
import { PostProcessing } from './PostProcessing.js';

interface CitySceneProps {
  layout: CityLayout;
}

export function CityScene({ layout }: CitySceneProps) {
  const [bloomIntensity, setBloomIntensity] = useState(1.6);
  const [isFlyMode, setIsFlyMode] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'auto' }}>
      {/* ── Fly-Mode Controls HUD ─────────────────────────── */}
      <div 
        style={{
          position: 'absolute',
          top: '60px',
          right: '20px',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid #39FF14',
          padding: '10px',
          fontFamily: '"JetBrains Mono", monospace',
          color: '#39FF14',
          fontSize: '12px',
          borderRadius: '4px',
          boxShadow: '0 0 10px rgba(57, 255, 20, 0.2)',
        }}
      >
        <button
          onClick={() => setIsFlyMode(!isFlyMode)}
          style={{
            background: isFlyMode ? '#39FF14' : 'transparent',
            color: isFlyMode ? '#000' : '#39FF14',
            border: '1px solid #39FF14',
            padding: '5px 10px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 'bold',
            borderRadius: '2px',
          }}
        >
          {isFlyMode ? 'FREE FLY: ON' : 'FREE FLY: OFF'}
        </button>
        <div style={{ marginTop: '8px', color: '#1A5C25' }}>
          {isFlyMode 
            ? 'Use Mouse + Damped controls to fly' 
            : 'Left-Click + Drag to rotate · Right-Click to pan'
          }
        </div>
      </div>

      {/* ── 3D WebGL Canvas ──────────────────────────────── */}
      <Canvas
        camera={{ position: [100, 80, 150], fov: 60 }}
        gl={{ antialias: true }}
      >
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
          setBloomIntensity={setBloomIntensity} 
        />

        {/* ── Matrix Grid Ground Plane ────────────────────── */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial 
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
        <PostProcessing bloomIntensity={bloomIntensity} />
      </Canvas>
    </div>
  );
}
