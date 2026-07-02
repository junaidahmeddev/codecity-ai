import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useStore((state) => state.layout);
  const setCameraTarget = useStore((state) => state.setCameraTarget);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounds of the city coordinates to normalize scaling
    const buildings = layout.buildings;
    if (buildings.length === 0) return;

    const xs = buildings.map((b) => b.position.x);
    const zs = buildings.map((b) => b.position.z);
    const minX = Math.min(...xs) - 20;
    const maxX = Math.max(...xs) + 20;
    const minZ = Math.min(...zs) - 20;
    const maxZ = Math.max(...zs) + 20;

    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── 1. Draw Districts Boundaries ───────────────────────
    ctx.strokeStyle = '#1A5C25';
    ctx.lineWidth = 1;
    for (const distPath in layout.districts) {
      const bounds = layout.districts[distPath]!.bounds;
      const x = ((bounds.minX - minX) / rangeX) * canvas.width;
      const z = ((bounds.minZ - minZ) / rangeZ) * canvas.height;
      const w = ((bounds.maxX - bounds.minX) / rangeX) * canvas.width;
      const h = ((bounds.maxZ - bounds.minZ) / rangeZ) * canvas.height;

      ctx.strokeRect(x, z, w, h);
    }

    // ── 2. Draw Building Dots ──────────────────────────────
    for (const b of buildings) {
      const x = ((b.position.x - minX) / rangeX) * canvas.width;
      const z = ((b.position.z - minZ) / rangeZ) * canvas.height;

      ctx.fillStyle = b.glowTier === 'peak' ? '#A8FF7A' : '#39FF14';
      ctx.fillRect(x - 1, z - 1, 2, 2);
    }
  }, [layout]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickZ = e.clientY - rect.top;

    // Convert back from canvas coordinates to 3D world space
    const buildings = layout.buildings;
    if (buildings.length === 0) return;

    const xs = buildings.map((b) => b.position.x);
    const zs = buildings.map((b) => b.position.z);
    const minX = Math.min(...xs) - 20;
    const maxX = Math.max(...xs) + 20;
    const minZ = Math.min(...zs) - 20;
    const maxZ = Math.max(...zs) + 20;

    const targetX = minX + (clickX / canvas.width) * (maxX - minX);
    const targetZ = minZ + (clickZ / canvas.height) * (maxZ - minZ);

    setCameraTarget([targetX, 0, targetZ], [targetX + 60, 50, targetZ + 60]);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '50px',
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid var(--border)',
        padding: '10px',
        fontFamily: 'var(--font-mono)',
        boxShadow: 'var(--glow-sm)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontSize: '9px', color: 'var(--signal-dim)', marginBottom: '6px', alignSelf: 'flex-start', letterSpacing: '0.1em' }}>
        SYS::METROPOLIS_MINIMAP
      </div>
      <canvas
        ref={canvasRef}
        width={150}
        height={150}
        onClick={handleMinimapClick}
        style={{
          border: '1px solid #1A5C25',
          background: '#000',
          cursor: 'crosshair',
        }}
      />
      <div style={{ fontSize: '8px', color: '#1A5C25', marginTop: '6px' }}>
        CLICK TO JUMP PORT
      </div>
    </div>
  );
}
