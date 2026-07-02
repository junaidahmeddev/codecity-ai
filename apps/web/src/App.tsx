import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import './App.css';
import { trpc } from './utils/trpc.js';

const LazyCityScene = lazy(() =>
  import('./components/CityScene.js').then((module) => ({ default: module.CityScene }))
);
import { CommandPalette } from './components/CommandPalette.js';
import { Minimap } from './components/Minimap.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { useStore } from './store/useStore.js';

/**
 * Matrix Digital Rain — lightweight canvas-based falling code effect.
 * GPU-friendly: single canvas, no per-character DOM elements.
 */
function MatrixRain() {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF{}[]();:=>';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(0).map(() => Math.random() * -100);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = (drops[i] ?? 0) * fontSize;

        if (Math.random() > 0.98) {
          ctx.fillStyle = '#A8FF7A'; // --signal-peak
          ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
        } else {
          ctx.fillStyle = `rgba(57, 255, 20, ${0.3 + Math.random() * 0.4})`; // --signal-core
          ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
        }

        ctx.fillText(char ?? '', x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] = (drops[i] ?? 0) + 1;
      }

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        opacity: 0.4,
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Typing animation hook
 */
function useTypingEffect(text: string, speed: number = 50, delay: number = 0) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let index = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayText(text.slice(0, index + 1));
          index++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return { displayText, isComplete };
}

/**
 * Animated stat counter
 */
function StatCounter({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setCurrent(Math.min(Math.round(increment * step), value));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="stat-block">
      <div className="stat-value">
        {current.toLocaleString()}{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function App() {
  const { displayText: title, isComplete: titleDone } = useTypingEffect('CODECITY_AI', 80, 500);
  const { displayText: subtitle } = useTypingEffect(
    'Transform GitHub repositories into interactive 3D cyberpunk metropolises',
    30,
    1800
  );
  
  const [repoUrl, setRepoUrl] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  // ── tRPC Mutations & Queries ─────────────────────────────
  const submitMutation = trpc.submit.useMutation({
    onSuccess: (data) => {
      if (data.jobId) {
        setJobId(data.jobId);
      }
    },
  });

  const { data: jobStatus } = trpc.status.useQuery(
    { jobId: jobId || '' },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const state = query.state.data;
        if (state?.status === 'complete' || state?.status === 'failed') {
          return false;
        }
        return 1000;
      },
    }
  );

  // AI Insights Query
  const { data: insights } = trpc.insights.useQuery(
    {
      commitSha: jobStatus?.result?.repository.commitSha || '',
      fileIds: jobStatus?.result ? Object.keys(jobStatus.result.repository.files) : [],
    },
    { enabled: !!jobStatus?.result }
  );

  const setMetropolisData = useStore((state) => state.setMetropolisData);
  const setInsights = useStore((state) => state.setInsights);
  const resetStore = useStore((state) => state.reset);
  const currentBreadcrumb = useStore((state) => state.currentBreadcrumb);

  useEffect(() => {
    if (jobStatus?.status === 'complete' && jobStatus.result) {
      setMetropolisData(jobStatus.result.repository, jobStatus.result.layout);
    }
  }, [jobStatus, setMetropolisData]);

  useEffect(() => {
    if (insights) {
      setInsights(insights);
    }
  }, [insights, setInsights]);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    submitMutation.mutate({ repoUrl });
  };

  const handleReset = () => {
    setJobId(null);
    setRepoUrl('');
    resetStore();
  };

  const isComplete = jobStatus?.status === 'complete' && !!jobStatus.result;

  return (
    <div className="app scanlines">
      {!isComplete && <MatrixRain />}
      {isComplete && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000', color: '#39FF14', fontFamily: 'var(--font-mono)', fontSize: '14px', zIndex: 1 }}>
            SYS::LOADING_3D_METROPOLIS...
          </div>
        }>
          <LazyCityScene layout={jobStatus.result!.layout} />
        </Suspense>
      )}

      {/* ── HUD Top Bar ──────────────────────────────────── */}
      <header className="hud-top">
        <div className="hud-left" style={{ maxWidth: '70%', overflow: 'hidden' }}>
          <span className="hud-indicator" />
          <span className="hud-text" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {currentBreadcrumb.length > 0 
              ? currentBreadcrumb.join(' / ') 
              : (jobStatus ? `SYS::${jobStatus.status.toUpperCase()}` : 'SYS::ONLINE')
            }
          </span>
        </div>
        <div className="hud-center">
          <span className="hud-text">CODECITY AI v1.0.0</span>
        </div>
        <div className="hud-right">
          <span className="hud-text">{new Date().toISOString().split('T')[0]}</span>
          <span className="hud-indicator" />
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────── */}
      {!isComplete ? (
        <main className="main-content" style={{ opacity: showContent ? 1 : 0 }}>
          {/* Terminal Header */}
          <div className="terminal-header">
            <span className="prompt">{'>'}</span>
            <span className="terminal-path">~/codecity</span>
            <span className="prompt"> $</span>
            <span className="command"> initialize --mode=metropolis</span>
          </div>

          {/* Title */}
          <h1 className="title">
            {title}
            <span className="cursor-blink">{titleDone ? '█' : '▌'}</span>
          </h1>

          {/* Subtitle */}
          <p className="subtitle">{subtitle}</p>

          {/* Repo Input */}
          <form onSubmit={handleGenerate} className="input-section">
            <div className="input-wrapper">
              <span className="input-prefix">{'>'} git clone</span>
              <input
                type="text"
                className="repo-input"
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={submitMutation.isPending || (!!jobStatus && jobStatus.status !== 'complete' && jobStatus.status !== 'failed')}
                spellCheck={false}
              />
            </div>
            <button
              type="submit"
              className="generate-btn"
              disabled={!repoUrl.trim() || submitMutation.isPending || (!!jobStatus && jobStatus.status !== 'complete' && jobStatus.status !== 'failed')}
            >
              <span className="btn-text">
                {submitMutation.isPending ? 'CONNECTING...' : 'GENERATE CITY'}
              </span>
              <span className="btn-icon">→</span>
            </button>
          </form>

          {/* Ingestion Status Terminal Overlay */}
          {jobStatus && (
            <div className="terminal-console">
              <div className="console-header">
                <span className="console-title">INGESTION PIPELINE LOGS</span>
                <span className="console-progress">{jobStatus.progress}%</span>
              </div>
              <div className="console-body">
                <p className="log-line text-signal-dim">[pipeline] Target: {jobStatus.repoName}</p>
                <p className="log-line text-signal-dim">[pipeline] Job ID: {jobStatus.jobId}</p>

                {jobStatus.status === 'queued' && (
                  <p className="log-line text-signal-core anim-pulse">⏳ Queueing job in background pool...</p>
                )}
                {jobStatus.status === 'cloning' && (
                  <p className="log-line text-signal-core anim-pulse">📥 [CLONING] Securely cloning repo into cgroup container...</p>
                )}
                {jobStatus.status === 'parsing' && (
                  <p className="log-line text-signal-core">
                    ⚙️ [PARSING] Analyzing syntax with Web Tree-Sitter grammars ({jobStatus.progress}%)
                  </p>
                )}
                {jobStatus.status === 'layouting' && (
                  <p className="log-line text-signal-core anim-pulse">🧬 [LAYOUTING] Packing buildings into district structures...</p>
                )}
                {jobStatus.status === 'failed' && (
                  <p className="log-line text-signal-critical">
                    ❌ [ERROR] Ingestion crashed: {jobStatus.error || 'Unknown pipeline failure.'}
                  </p>
                )}
              </div>
              {/* Progress bar line */}
              <div className="console-bar-container">
                <div 
                  className={`console-bar ${jobStatus.status === 'failed' ? 'bg-signal-critical' : 'bg-signal-core'}`}
                  style={{ width: `${jobStatus.progress}%` }} 
                />
              </div>
            </div>
          )}

          {/* Dynamic Stats Grid (displays either default or completed parse results) */}
          <div className="stats-grid">
            <StatCounter label="LANGUAGES PARSED" value={9} />
            <StatCounter label="TOTAL FILES MAPPED" value={10000} />
            <StatCounter label="TOTAL LOC ANALYZED" value={50000} />
            <StatCounter label="DISTRICTS PACKED" value={12} />
          </div>

          {/* Feature Cards */}
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">◆</div>
              <h3>MULTI-LANGUAGE PARSING</h3>
              <p>Tree-sitter WASM grammars for TS, Python, Go, Rust, C/C++, Java, Ruby</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">◈</div>
              <h3>1 FILE = 1 BUILDING</h3>
              <p>Every source file becomes a unique skyscraper. No aggregation. No shortcuts.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">◇</div>
              <h3>REAL-TIME WebGL</h3>
              <p>React Three Fiber + instanced rendering. 60 FPS at 5,000+ buildings.</p>
            </div>
          </div>
        </main>
      ) : (
        /* Minimized Left HUD Panel during active WebGL session */
        <div 
          style={{
            position: 'fixed',
            left: '20px',
            top: '70px',
            zIndex: 100,
            width: '280px',
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid var(--border)',
            padding: '20px',
            fontFamily: 'var(--font-mono)',
            boxShadow: 'var(--glow-sm)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--signal-dim)', marginBottom: '4px' }}>METROPOLIS STATS</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--signal-bright)', marginBottom: '16px', wordBreak: 'break-all' }}>
            {jobStatus!.repoName}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--signal-dim)' }}>Files:</span>
              <span style={{ color: 'var(--signal-core)', fontWeight: 'bold' }}>{jobStatus!.result!.repository.stats.totalFiles}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--signal-dim)' }}>LOC:</span>
              <span style={{ color: 'var(--signal-core)', fontWeight: 'bold' }}>{jobStatus!.result!.repository.stats.totalLoc.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '4px' }}>
              <span style={{ color: 'var(--signal-dim)' }}>Districts:</span>
              <span style={{ color: 'var(--signal-core)', fontWeight: 'bold' }}>{jobStatus!.result!.repository.stats.totalDirectories}</span>
            </div>
          </div>

          <button
            onClick={handleReset}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid var(--signal-core)',
              color: 'var(--signal-core)',
              padding: '10px',
              fontFamily: 'inherit',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(57, 255, 20, 0.1)';
              e.currentTarget.style.boxShadow = 'var(--glow-sm)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            DISCONNECT CLIENT
          </button>
        </div>
      )}
      {isComplete && (
        <>
          <CommandPalette />
          <Minimap />
          <SettingsPanel />
        </>
      )}

      {/* ── HUD Bottom Bar ───────────────────────────────── */}
      <footer className="hud-bottom">
        <span className="hud-text">
          {isComplete ? `METROPOLIS::${jobStatus!.result!.repository.commitSha.slice(0, 7)}` : 'PHASE::1_INGESTION_PIPELINE_COMPLETE'}
        </span>
        <span className="hud-text">ENGINE::R3F_v9</span>
        <span className="hud-text">PIPELINE::FASTIFY+tRPC</span>
      </footer>
    </div>
  );
}

export default App;
