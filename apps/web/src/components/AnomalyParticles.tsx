import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/useStore.js';

export function AnomalyParticles() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const layout = useStore((state) => state.layout);
  const repository = useStore((state) => state.repository);

  // 1. Gather all anomalous buildings containing complexity violations (complexity > 1.0)
  const anomalies = useMemo(() => {
    if (!layout || !repository) return [];
    
    return layout.buildings.filter((b) => {
      const fileNode = repository.files[b.fileId];
      // Complexity threshold violation (e.g. complexity > 1.0)
      return fileNode && fileNode.complexity > 1.0;
    });
  }, [layout, repository]);

  // If no anomalies exist, don't spawn empty particle buffers
  const particleCountPerBuilding = 30;
  const totalParticles = anomalies.length * particleCountPerBuilding;

  const [positions, randoms] = useMemo(() => {
    const pos = new Float32Array(totalParticles * 3);
    const rand = new Float32Array(totalParticles * 3);

    let idx = 0;
    for (const b of anomalies) {
      const height = b.dimensions.height;
      for (let i = 0; i < particleCountPerBuilding; i++) {
        // Base position anchored at top center of building
        pos[idx * 3] = b.position.x;
        pos[idx * 3 + 1] = b.position.y + height / 2; // Roof height
        pos[idx * 3 + 2] = b.position.z;

        // Random offsets/velocities: X, Y (drift rate), Z
        rand[idx * 3] = (Math.random() - 0.5) * b.dimensions.width;
        rand[idx * 3 + 1] = 2.0 + Math.random() * 4.0; // Float speed
        rand[idx * 3 + 2] = (Math.random() - 0.5) * b.dimensions.depth;

        idx++;
      }
    }

    return [pos, rand];
  }, [anomalies, totalParticles]);

  useFrame((state) => {
    if (materialRef.current) {
      if (materialRef.current.uniforms?.uTime) {
        materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      }
    }
  });

  if (anomalies.length === 0) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-random"
          args={[randoms, 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={`
          uniform float uTime;
          attribute vec3 random;
          varying float vOpacity;

          void main() {
            // Compute animated position on GPU
            vec3 pos = position;
            
            // Particles drift upwards, resetting periodically
            float lifetime = 3.0;
            float timeOffset = random.y * 10.0;
            float progress = mod(uTime + timeOffset, lifetime) / lifetime;

            pos.x += random.x * progress;
            pos.y += random.y * progress * 10.0; // Drift upwards
            pos.z += random.z * progress;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Dynamic particle size based on camera distance
            gl_PointSize = (15.0 / -mvPosition.z) * (1.0 - progress);
            
            // Fade out particles near end of lifecycle
            vOpacity = sin(progress * 3.14159) * 0.8;
          }
        `}
        fragmentShader={`
          varying float vOpacity;

          void main() {
            // Soft circular spark point
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) discard;

            // Emissive red glow color (--signal-critical)
            vec3 color = vec3(1.0, 0.28, 0.28); 
            float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
            
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </points>
  );
}
