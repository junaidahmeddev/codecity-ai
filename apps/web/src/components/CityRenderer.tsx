import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingLayout, CityLayout } from '@codecity/shared-types';
import {
  createTypeScriptGeometry,
  createPythonGeometry,
  createGoGeometry,
  createCppGeometry,
  createFallbackGeometry
} from './SkyscraperGeometries.js';

interface CityRendererProps {
  layout: CityLayout;
  setBloomIntensity: (intensity: number) => void;
}

const TIER_COLORS = {
  dim: '#1A5C25',
  core: '#39FF14',
  bright: '#7CFF4D',
  peak: '#A8FF7A',
};

export function CityRenderer({ layout, setBloomIntensity }: CityRendererProps) {
  const { camera } = useThree();

  // Create references for high-detail wireframe InstancedMeshes
  const detailMeshes = {
    typescript: useRef<THREE.InstancedMesh>(null),
    python: useRef<THREE.InstancedMesh>(null),
    go: useRef<THREE.InstancedMesh>(null),
    cpp: useRef<THREE.InstancedMesh>(null),
    fallback: useRef<THREE.InstancedMesh>(null),
  };

  // Create references for low-detail impostor InstancedMeshes (simple low-poly boxes)
  const impostorMeshes = {
    typescript: useRef<THREE.InstancedMesh>(null),
    python: useRef<THREE.InstancedMesh>(null),
    go: useRef<THREE.InstancedMesh>(null),
    cpp: useRef<THREE.InstancedMesh>(null),
    fallback: useRef<THREE.InstancedMesh>(null),
  };

  // 1. Procedural geometry initialization
  const geometries = useMemo(() => ({
    typescript: createTypeScriptGeometry(),
    python: createPythonGeometry(),
    go: createGoGeometry(),
    cpp: createCppGeometry(),
    fallback: createFallbackGeometry(),
  }), []);

  const impostorGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    return box;
  }, []);

  // Map each building to its geometry category
  const categorizedBuildings = useMemo(() => {
    const groups: Record<keyof typeof detailMeshes, BuildingLayout[]> = {
      typescript: [],
      python: [],
      go: [],
      cpp: [],
      fallback: [],
    };

    for (const b of layout.buildings) {
      const arch = (b.geometryArchetype || 'unknown').toLowerCase();
      if (arch.includes('typescript') || arch.includes('javascript')) {
        groups.typescript.push(b);
      } else if (arch.includes('python')) {
        groups.python.push(b);
      } else if (arch.includes('go')) {
        groups.go.push(b);
      } else if (arch.includes('c') || arch.includes('cpp')) {
        groups.cpp.push(b);
      } else {
        groups.fallback.push(b);
      }
    }

    return groups;
  }, [layout]);

  // Find the highest centrality building for the vertical beacon
  const peakBuilding = useMemo(() => {
    if (layout.buildings.length === 0) return null;
    // Find building in peak glow tier, or fallback to first building
    return layout.buildings.find(b => b.glowTier === 'peak') || layout.buildings[0];
  }, [layout]);

  // Assert correct instance counts at runtime (Contract 3)
  useEffect(() => {
    let totalInstances = 0;
    const categories = Object.keys(categorizedBuildings) as (keyof typeof detailMeshes)[];
    
    for (const cat of categories) {
      totalInstances += categorizedBuildings[cat].length;
    }

    console.log(`[WebGL Assert] Initializing scene: ${totalInstances} buildings parsed.`);
    if (totalInstances !== layout.buildings.length) {
      console.error(`[WebGL Error] Instance Count Mismatch: target ${layout.buildings.length}, allocated ${totalInstances}`);
    }
  }, [categorizedBuildings, layout]);

  // Populate InstancedMesh attributes (Positions, Scales, Colors)
  useEffect(() => {
    const categories = Object.keys(categorizedBuildings) as (keyof typeof detailMeshes)[];

    for (const cat of categories) {
      const buildingsList = categorizedBuildings[cat];
      const detailMesh = detailMeshes[cat].current;
      const impostorMesh = impostorMeshes[cat].current;

      if (!detailMesh || !impostorMesh) continue;

      const dummy = new THREE.Object3D();

      for (let i = 0; i < buildingsList.length; i++) {
        const b = buildingsList[i]!;

        // Base transform
        dummy.position.set(b.position.x, b.position.y, b.position.z);
        dummy.scale.set(b.dimensions.width, b.dimensions.height, b.dimensions.depth);
        dummy.updateMatrix();

        // Apply matrix to both high-detail and impostor initially
        detailMesh.setMatrixAt(i, dummy.matrix);
        impostorMesh.setMatrixAt(i, dummy.matrix);

        // Apply glow color based on centrality tier
        const hex = TIER_COLORS[b.glowTier] || TIER_COLORS.dim;
        const color = new THREE.Color(hex);
        detailMesh.setColorAt(i, color);
        impostorMesh.setColorAt(i, color);
      }

      detailMesh.instanceMatrix.needsUpdate = true;
      impostorMesh.instanceMatrix.needsUpdate = true;
      if (detailMesh.instanceColor) detailMesh.instanceColor.needsUpdate = true;
      if (impostorMesh.instanceColor) impostorMesh.instanceColor.needsUpdate = true;
    }
  }, [categorizedBuildings]);

  // Performance Guard & LOD Swapping variables
  const frameTimes = useRef<number[]>([]);
  const lodThreshold = 150; // Distance beyond which we swap to low-poly impostors

  useFrame((_, delta) => {
    // ── 1. Dynamic Performance Guard ──────────────────────
    const frameTime = delta * 1000;
    frameTimes.current.push(frameTime);
    if (frameTimes.current.length > 30) {
      frameTimes.current.shift();
    }

    const avgFrameTime = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
    
    // Adaptive Bloom scaling formula
    if (avgFrameTime > 16.6) {
      // Degrade quality if FPS drops below 60
      setBloomIntensity(0.6);
    } else {
      // High-performance standard bloom
      setBloomIntensity(1.6);
    }

    // ── 2. LOD Distance-based Swapping ────────────────────
    const categories = Object.keys(categorizedBuildings) as (keyof typeof detailMeshes)[];
    const cameraPos = camera.position;

    // We do LOD swapping on a district basis to maintain high performance
    const districtDistances: Record<string, number> = {};
    for (const distPath in layout.districts) {
      const bounds = layout.districts[distPath]!.bounds;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerZ = (bounds.minZ + bounds.maxZ) / 2;
      const dist = Math.sqrt(
        Math.pow(cameraPos.x - centerX, 2) + Math.pow(cameraPos.z - centerZ, 2)
      );
      districtDistances[distPath] = dist;
    }

    // Dynamically toggle matrices scale to 0/1 based on lod threshold
    for (const cat of categories) {
      const buildingsList = categorizedBuildings[cat];
      const detailMesh = detailMeshes[cat].current;
      const impostorMesh = impostorMeshes[cat].current;

      if (!detailMesh || !impostorMesh) continue;

      let detailNeedsUpdate = false;
      let impostorNeedsUpdate = false;

      const dummy = new THREE.Object3D();
      const mat = new THREE.Matrix4();

      for (let i = 0; i < buildingsList.length; i++) {
        const b = buildingsList[i]!;
        const dist = districtDistances[b.districtPath] ?? 0;
        const isNear = dist < lodThreshold;

        // Read active matrix
        detailMesh.getMatrixAt(i, mat);

        // Deconstruct matrix
        dummy.position.set(b.position.x, b.position.y, b.position.z);

        if (isNear) {
          // Show detail, hide impostor
          dummy.scale.set(b.dimensions.width, b.dimensions.height, b.dimensions.depth);
          dummy.updateMatrix();
          detailMesh.setMatrixAt(i, dummy.matrix);

          dummy.scale.set(0, 0, 0); // Hide
          dummy.updateMatrix();
          impostorMesh.setMatrixAt(i, dummy.matrix);
        } else {
          // Hide detail, show impostor
          dummy.scale.set(0, 0, 0); // Hide
          dummy.updateMatrix();
          detailMesh.setMatrixAt(i, dummy.matrix);

          dummy.scale.set(b.dimensions.width, b.dimensions.height, b.dimensions.depth);
          dummy.updateMatrix();
          impostorMesh.setMatrixAt(i, dummy.matrix);
        }

        detailNeedsUpdate = true;
        impostorNeedsUpdate = true;
      }

      if (detailNeedsUpdate) detailMesh.instanceMatrix.needsUpdate = true;
      if (impostorNeedsUpdate) impostorMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* ── High-Detail Wireframe Buildings ───────────────── */}
      {Object.keys(categorizedBuildings).map((cat) => {
        const key = cat as keyof typeof detailMeshes;
        return (
          <instancedMesh
            key={`detail-${key}`}
            ref={detailMeshes[key]}
            args={[geometries[key], null as any, categorizedBuildings[key].length]}
          >
            <meshBasicMaterial
              wireframe
              transparent
              opacity={0.7}
              toneMapped={false}
            />
          </instancedMesh>
        );
      })}

      {/* ── Low-Detail Impostor Buildings ────────────────── */}
      {Object.keys(categorizedBuildings).map((cat) => {
        const key = cat as keyof typeof impostorMeshes;
        return (
          <instancedMesh
            key={`impostor-${key}`}
            ref={impostorMeshes[key]}
            args={[impostorGeometry, null as any, categorizedBuildings[key].length]}
          >
            <meshBasicMaterial
              wireframe
              transparent
              opacity={0.3}
              toneMapped={false}
            />
          </instancedMesh>
        );
      })}

      {/* ── High Centrality Beacon Column ────────────────── */}
      {peakBuilding && (
        <mesh position={[peakBuilding.position.x, 150, peakBuilding.position.z]}>
          <cylinderGeometry args={[0.3, 0.3, 300, 4]} />
          <meshBasicMaterial
            color="#A8FF7A"
            transparent
            opacity={0.4}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
