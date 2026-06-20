import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { AlgorithmId, LatLng, PathResult, VisualizationStep } from '../../types';
import { ALGORITHM_LIST } from '../../lib/algorithmMeta';
import LocationBar from './LocationBar';
import { fetchGraph } from '../../services/api';
import { findNearestNode } from '../../lib/graphUtils';
import { runDijkstra }               from '../../algorithms/dijkstra';
import { runAstar }                  from '../../algorithms/astar';
import { runBFS }                    from '../../algorithms/bfs';
import { runGreedy }                 from '../../algorithms/greedy';
import { runBidirectionalDijkstra }  from '../../algorithms/bidijkstra';
import { runBidirectionalAstar }     from '../../algorithms/biastar';
import { CompareResult } from '../../types';

function multiPointBBox(points: LatLng[]) {
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  const padding = Math.max(0.02, Math.max(latSpan, lngSpan) * 0.3);
  return {
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
    minLng: Math.min(...lngs) - padding,
    maxLng: Math.max(...lngs) + padding,
  };
}

function getAlgoRunner(id: AlgorithmId) {
  switch (id) {
    case 'astar':      return runAstar;
    case 'bfs':        return runBFS;
    case 'greedy':     return runGreedy;
    case 'bidijkstra': return runBidirectionalDijkstra;
    case 'biastar':    return runBidirectionalAstar;
    default:           return runDijkstra;
  }
}

export default function TopBar() {
  const { state, dispatch } = useApp();
  const { theme, toggle } = useTheme();
  const { selectedAlgorithm, compareMode, startPoint, endPoint, viaPoints, graphLoading, playback, panelOpen } = state;

  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos]             = useState<{ x: number; y: number } | null>(null);
  const barRef  = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ox: number; oy: number; bx: number; by: number } | null>(null);

  const canRun = !!(startPoint && endPoint && !graphLoading && playback === 'idle');

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const onDragStart = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = barRef.current!.getBoundingClientRect();
    dragRef.current = { ox: e.clientX, oy: e.clientY, bx: r.left, by: r.top };
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { ox, oy, bx, by } = dragRef.current;
    let x = bx + (e.clientX - ox);
    let y = by + (e.clientY - oy);
    const bar = barRef.current;
    if (bar) {
      const { width, height } = bar.getBoundingClientRect();
      x = Math.max(8, Math.min(window.innerWidth  - width  - 8, x));
      y = Math.max(8, Math.min(window.innerHeight - height - 8, y));
    }
    setPos({ x, y });
  };

  const onDragEnd = () => { dragRef.current = null; };

  // ── Load & run ───────────────────────────────────────────────────────────────
  const loadAndRun = async (compare = false) => {
    if (!startPoint || !endPoint) return;
    dispatch({ type: 'SET_GRAPH_LOADING' });
    try {
      const allPoints = [startPoint, ...viaPoints.filter(v => v.point.lat !== 0 || v.point.lng !== 0).map(v => v.point), endPoint];
      const bbox  = multiPointBBox(allPoints);
      const graph = await fetchGraph(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng);
      dispatch({ type: 'SET_GRAPH', graph });

      const allIds = allPoints.map(p => findNearestNode(graph, p));
      if (allIds.some(id => !id)) {
        dispatch({ type: 'SET_GRAPH_ERROR', error: 'No road nodes found near one of your selected points. Try moving the markers closer to a road.' });
        return;
      }

      if (compare) {
        const from = allIds[0]!;
        const to   = allIds[allIds.length - 1]!;
        const allAlgos: AlgorithmId[] = ['dijkstra', 'astar', 'bidijkstra', 'biastar', 'greedy', 'bfs'];
        const raw = allAlgos.map(id => {
          const r = getAlgoRunner(id)(graph, from, to);
          return { algorithm: id, nodesExplored: r.nodesExplored, executionTimeMs: r.executionTimeMs, pathLength: r.totalDistance, pathNodes: r.path.length, steps: r.steps, path: r.path } as CompareResult;
        });
        raw.sort((a, b) => {
          if (a.pathLength === 0 && b.pathLength > 0) return 1;
          if (b.pathLength === 0 && a.pathLength > 0) return -1;
          if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
          return a.executionTimeMs - b.executionTimeMs;
        });
        dispatch({ type: 'SET_COMPARE_MODE', enabled: true });
        dispatch({ type: 'SET_COMPARE', results: raw });
        return;
      }

      const runner = getAlgoRunner(selectedAlgorithm);
      dispatch({ type: 'SET_COMPARE_MODE', enabled: false });

      let result: PathResult;
      if (allIds.length > 2) {
        const combinedSteps: VisualizationStep[] = [];
        const combinedPath: string[] = [];
        let totalDistance = 0, totalNodesExplored = 0;
        const t0 = performance.now();
        for (let i = 0; i < allIds.length - 1; i++) {
          const seg = runner(graph, allIds[i]!, allIds[i + 1]!);
          combinedSteps.push(...seg.steps);
          totalDistance      += seg.totalDistance;
          totalNodesExplored += seg.nodesExplored;
          combinedPath.length === 0 ? combinedPath.push(...seg.path) : combinedPath.push(...seg.path.slice(1));
        }
        result = { path: combinedPath, totalDistance, nodesExplored: totalNodesExplored, executionTimeMs: performance.now() - t0, steps: combinedSteps };
      } else {
        result = runner(graph, allIds[0]!, allIds[1]!);
      }

      dispatch({ type: 'SET_RESULT', result });
      if (result.path.length === 0) {
        dispatch({ type: 'SET_GRAPH_ERROR', error: 'No route found — the road network between these points appears disconnected. Try points on major roads.' });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_GRAPH_ERROR', error: err.message ?? 'Failed to load road network' });
    }
  };

  const barStyle: React.CSSProperties = pos ? { left: pos.x, top: pos.y, transform: 'none' } : {};

  return (
    <div
      ref={barRef}
      className={`top-panel${collapsed ? ' top-panel--collapsed' : ''}`}
      style={barStyle}
    >
      {/* Controls row */}
      <div className="top-bar">
        {/* Drag handle */}
        <div
          className="tb-drag-handle"
          title="Drag to move"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <GripIcon />
        </div>

        {/* Logo */}
        <div className="tb-logo">
          <span className="tb-logo-text">TRAVERSE</span>
        </div>

        {/* Collapse toggle */}
        <button
          className="tb-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
          aria-label={collapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>

        {/* Collapsible controls */}
        <div className="tb-controls">
          <div className="tb-divider" />

          <AlgoDropdown
            value={selectedAlgorithm}
            onChange={(id) => {
              dispatch({ type: 'SET_ALGORITHM', id });
            }}
            disabled={compareMode}
          />

          <div className="tb-divider" />

          <button
            className={`tb-compare ${compareMode ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_COMPARE_MODE', enabled: !compareMode })}
            title="Compare all algorithms side by side"
          >
            <CompareIcon />
            <span className="tb-label">Compare</span>
            <span className={`toggle-pill ${compareMode ? 'on' : ''}`} />
          </button>

          <div className="tb-spacer" />

          {state.graphError && (
            <div className="tb-error" title={state.graphError}>
              <WarnIcon />
              <span className="tb-error-text">{state.graphError}</span>
              <button onClick={() => dispatch({ type: 'SET_GRAPH_ERROR', error: '' })}>×</button>
            </div>
          )}

          <button
            className="tb-visualize"
            disabled={!canRun}
            onClick={() => loadAndRun(compareMode)}
            title={!startPoint || !endPoint ? 'Set start and destination first' : ''}
          >
            {graphLoading ? (
              <><span className="spinner-sm-dark" /><span className="tb-label">Loading…</span></>
            ) : (
              <><PlayIcon /><span>{compareMode ? 'Compare' : 'Explore'}</span></>
            )}
          </button>

          <button
            className={`tb-icon-btn ${state.panelOpen ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_PANEL' })}
            title="Algorithm info & stats"
          >
            <InfoIcon />
            <span className="tb-label">Info</span>
          </button>

          <button className="tb-icon-btn" onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* Search / waypoint section */}
      {!collapsed && <LocationBar />}
    </div>
  );
}

// ── Algorithm dropdown ────────────────────────────────────────────────────────
function AlgoDropdown({ value, onChange, disabled }: {
  value: AlgorithmId;
  onChange: (id: AlgorithmId) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = ALGORITHM_LIST.find((a) => a.id === value)!;

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 8, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="algo-dropdown">
      <button
        ref={triggerRef}
        className="algo-dropdown-trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title="Select pathfinding algorithm"
      >
        <span className="algo-dot" style={{ background: current.color }} />
        <span className="algo-trigger-name">{current.shortName ?? current.name}</span>
        <ChevronIcon />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="algo-dropdown-menu"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
        >
          {ALGORITHM_LIST.map((algo) => (
            <button
              key={algo.id}
              className={`algo-dropdown-item ${algo.id === value ? 'active' : ''}`}
              onClick={() => { onChange(algo.id as AlgorithmId); setOpen(false); }}
            >
              <span className="algo-dot" style={{ background: algo.color }} />
              <div>
                <div className="algo-item-name">{algo.name}</div>
                <div className="algo-item-sub">{algo.timeComplexity}</div>
              </div>
              {algo.id === value && <CheckIcon />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const GripIcon = () => (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
    <circle cx="2.5" cy="3"  r="1.5"/><circle cx="7.5" cy="3"  r="1.5"/>
    <circle cx="2.5" cy="8"  r="1.5"/><circle cx="7.5" cy="8"  r="1.5"/>
    <circle cx="2.5" cy="13" r="1.5"/><circle cx="7.5" cy="13" r="1.5"/>
  </svg>
);
const ChevronLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const PathScopeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5">
    <circle cx="5" cy="5" r="2.5" fill="#3B82F6" stroke="none"/>
    <circle cx="19" cy="19" r="2.5" fill="#22C55E" stroke="none"/>
    <path d="M5 7.5c0 5.5 14 3.5 14 11.5" strokeLinecap="round"/>
  </svg>
);
const PlayIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>;
const CompareIcon  = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const InfoIcon     = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const SunIcon      = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const MoonIcon     = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
  </svg>
);
const ChevronIcon  = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const CheckIcon    = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const WarnIcon     = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
