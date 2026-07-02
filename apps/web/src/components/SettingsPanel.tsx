import { useStore } from '../store/useStore.js';

export function SettingsPanel() {
  const isFlyMode = useStore((state) => state.isFlyMode);
  const setFlyMode = useStore((state) => state.setFlyMode);

  const highContrastMode = useStore((state) => state.highContrastMode);
  const setHighContrastMode = useStore((state) => state.setHighContrastMode);

  const bloomOverride = useStore((state) => state.bloomOverride);
  const setBloomOverride = useStore((state) => state.setBloomOverride);

  const lodOverride = useStore((state) => state.lodOverride);
  const setLodOverride = useStore((state) => state.setLodOverride);

  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '50px',
        zIndex: 100,
        width: '260px',
        background: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid var(--border)',
        padding: '16px',
        fontFamily: 'var(--font-mono)',
        boxShadow: 'var(--glow-sm)',
        backdropFilter: 'blur(8px)',
        fontSize: '12px',
      }}
    >
      <div style={{ fontSize: '9px', color: 'var(--signal-dim)', marginBottom: '12px', letterSpacing: '0.1em' }}>
        SYS::RENDER_SETTINGS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Camera Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--signal-dim)' }}>Camera Controller:</span>
          <button
            onClick={() => setFlyMode(!isFlyMode)}
            style={{
              background: 'transparent',
              border: '1px solid var(--signal-core)',
              color: 'var(--signal-core)',
              padding: '3px 8px',
              fontFamily: 'inherit',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {isFlyMode ? 'FREE FLY' : 'ORBIT'}
          </button>
        </div>

        {/* Accessibility Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--signal-dim)' }}>Contrast Mode:</span>
          <button
            onClick={() => setHighContrastMode(!highContrastMode)}
            style={{
              background: 'transparent',
              border: '1px solid var(--signal-core)',
              color: 'var(--signal-core)',
              padding: '3px 8px',
              fontFamily: 'inherit',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {highContrastMode ? 'HIGH CONTRAST' : 'STANDARD'}
          </button>
        </div>

        {/* Bloom Override */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--signal-dim)' }}>Bloom Intensity:</span>
            <span style={{ color: 'var(--signal-core)' }}>{bloomOverride.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="4"
            step="0.1"
            value={bloomOverride}
            onChange={(e) => setBloomOverride(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: 'var(--signal-core)',
              background: 'var(--border)',
              height: '3px',
              outline: 'none',
            }}
          />
        </div>

        {/* LOD Distance Override */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--signal-dim)' }}>LOD Swap Threshold:</span>
            <span style={{ color: 'var(--signal-core)' }}>{lodOverride}m</span>
          </div>
          <input
            type="range"
            min="50"
            max="300"
            step="10"
            value={lodOverride}
            onChange={(e) => setLodOverride(parseInt(e.target.value))}
            style={{
              width: '100%',
              accentColor: 'var(--signal-core)',
              background: 'var(--border)',
              height: '3px',
              outline: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
