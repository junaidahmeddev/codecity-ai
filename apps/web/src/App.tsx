import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { trpc } from './utils/trpc.js';

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
        // Stop refetching once status is complete or failed
        const state = query.state.data;
        if (state?.status === 'complete' || state?.status === 'failed') {
          return false;
        }
        return 1000; // Poll every 1s
      },
    }
  );

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    submitMutation.mutate({ repoUrl });
  };

  return (
    <div className="app scanlines">
      <MatrixRain />

      {/* ── HUD Top Bar ──────────────────────────────────── */}
      <header className="hud-top">
        <div className="hud-left">
          <span className="hud-indicator" />
          <span className="hud-text">
            {jobStatus ? `SYS::${jobStatus.status.toUpperCase()}` : 'SYS::ONLINE'}
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
              {jobStatus.status === 'complete' && jobStatus.result && (
                <>
                  <p className="log-line text-signal-bright">✅ [SUCCESS] AST normalizations completed! Metropolis is ready.</p>
                  <p className="log-line text-signal-peak">
                    📊 Stats: {jobStatus.result.repository.stats.totalFiles} Files parsed ·{' '}
                    {jobStatus.result.repository.stats.totalLoc.toLocaleString()} LOC mapped
                  </p>
                </>
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
          <StatCounter 
            label="LANGUAGES PARSED" 
            value={jobStatus?.result ? Object.values(jobStatus.result.repository.stats.languageBreakdown).filter(v => v > 0).length : 9} 
          />
          <StatCounter 
            label="TOTAL FILES MAPPED" 
            value={jobStatus?.result ? jobStatus.result.repository.stats.totalFiles : 10000} 
          />
          <StatCounter 
            label="TOTAL LOC ANALYZED" 
            value={jobStatus?.result ? jobStatus.result.repository.stats.totalLoc : 50000} 
          />
          <StatCounter 
            label="DISTRICTS PACKED" 
            value={jobStatus?.result ? jobStatus.result.repository.stats.totalDirectories : 12} 
          />
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

      {/* ── HUD Bottom Bar ───────────────────────────────── */}
      <footer className="hud-bottom">
        <span className="hud-text">PHASE::1_INGESTION_PIPELINE_COMPLETE</span>
        <span className="hud-text">ENGINE::R3F_v9</span>
        <span className="hud-text">PIPELINE::FASTIFY+tRPC</span>
      </footer>
    </div>
  );
}

export default App;
