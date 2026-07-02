import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const layout = useStore((state) => state.layout);
  const setCameraTarget = useStore((state) => state.setCameraTarget);
  const setSelectedBuildingId = useStore((state) => state.setSelectedBuildingId);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter list matching layout buildings
  const filtered = search.trim() === ''
    ? []
    : (layout?.buildings || [])
        .filter((b) => b.fileId.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 8);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (fileId: string) => {
    const building = layout?.buildings.find((b) => b.fileId === fileId);
    if (building) {
      setSelectedBuildingId(fileId);
      // Offset camera coordinates for better look angle
      setCameraTarget(
        [building.position.x, building.position.y, building.position.z],
        [building.position.x + 30, building.position.y + 25, building.position.z + 30]
      );
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[activeIndex];
      if (selected) {
        handleSelect(selected.fileId);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: '550px',
          background: '#010401',
          border: '1.5px solid #39FF14',
          borderRadius: '2px',
          boxShadow: '0 0 20px rgba(57, 255, 20, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '14px' }}>
          <span style={{ color: '#39FF14', marginRight: '10px', fontSize: '16px', fontWeight: 'bold' }}>$ file_find -q</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type filepath query..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#39FF14',
              fontFamily: 'inherit',
              fontSize: '14px',
            }}
          />
        </div>

        {/* Results List */}
        <div ref={listRef} style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={item.fileId}
                  onClick={() => handleSelect(item.fileId)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: isActive ? '#1A5C25' : 'transparent',
                    color: isActive ? '#A8FF7A' : '#39FF14',
                    borderBottom: '1px dashed rgba(26, 92, 37, 0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: isActive ? 'bold' : 'normal' }}>
                    {isActive ? '> ' : '  '}
                    {item.fileId}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase' }}>
                    {item.geometryArchetype}
                  </span>
                </div>
              );
            })
          ) : (
            search.trim() !== '' && (
              <div style={{ padding: '16px', color: '#1A5C25', fontSize: '13px', textAlign: 'center' }}>
                No active records match query.
              </div>
            )
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '10px', color: '#1A5C25', display: 'flex', justifyContent: 'space-between' }}>
          <span>ARROW_KEYS to navigate · ENTER to select</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
