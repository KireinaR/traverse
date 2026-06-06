import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ALGORITHMS } from '../../lib/algorithmMeta';
import { formatDistance, formatDuration } from '../../lib/graphUtils';
import { PanelTab, CompareResult } from '../../types';

const EDUCATION_CONTENT = [
  { term: 'Graph', def: 'A structure of nodes (vertices) connected by edges. Road networks are graphs — intersections are nodes and roads are edges.' },
  { term: 'Edge Weight', def: 'A value assigned to an edge representing cost. In road networks this is distance in metres.' },
  { term: 'Priority Queue', def: 'A data structure that always dequeues the element with the lowest value first. Used in Dijkstra and A* for O((V+E) log V) performance.' },
  { term: 'Heuristic', def: "An estimated cost from a node to the goal. A* uses Haversine straight-line distance — admissible because it never overestimates." },
  { term: 'Visited Set', def: "Nodes fully processed. Once visited in Dijkstra or A*, the shortest path to that node is confirmed." },
  { term: 'Relaxation', def: "When a shorter path to a neighbour is found, its tentative distance is updated and it's re-added to the priority queue." },
];

export default function InfoPanel() {
  const { state, dispatch } = useApp();
  const {
    result, selectedAlgorithm, startName, endName,
    graphLoading, graphError, panelTab, panelOpen,
    graph, compareMode, compareResults, playback, currentStep,
  } = state;
  const algo = ALGORITHMS[selectedAlgorithm];

  // Queue size sparkline data
  const queueData = useMemo(() => {
    if (!result || result.steps.length < 2) return [];
    const stride = Math.max(1, Math.floor(result.steps.length / 50));
    return result.steps
      .filter((_, i) => i % stride === 0)
      .map(s => s.queueSize ?? 0);
  }, [result]);

  const maxQueue  = queueData.length ? Math.max(...queueData) : 1;
  const curStep   = result ? result.steps[Math.max(0, currentStep - 1)] : null;
  const curQueue  = curStep?.queueSize ?? 0;
  const pseudoHL  = algo.highlightLine(curStep?.type ?? 'explore', curStep?.direction);

  // Turn-by-turn street names
  const turnByTurn = useMemo(() => {
    if (!result || !graph || playback !== 'done') return [];
    const names: string[] = [];
    for (let i = 0; i < result.path.length - 1; i++) {
      const edge = (graph.adjacency[result.path[i]] ?? []).find(e => e.to === result.path[i + 1]);
      if (edge?.wayName) names.push(edge.wayName);
    }
    // Deduplicate consecutive identical names
    return names.filter((n, i) => n !== names[i - 1]);
  }, [result, graph, playback]);

  return (
    <aside className={`info-panel ${panelOpen ? 'open' : ''}`}>
      <div className="ip-header">
        <div className="ip-tabs">
          {(['route', 'algorithm', 'education'] as PanelTab[]).map((t) => (
            <button
              key={t}
              className={`ip-tab ${panelTab === t ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_PANEL_TAB', tab: t })}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className="ip-close" onClick={() => dispatch({ type: 'TOGGLE_PANEL' })} aria-label="Close panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="ip-body">
        {/* ── Route tab ─────────────────────────────────────────────────── */}
        {panelTab === 'route' && (
          <div className="ip-section">
            <Row label="Start"       value={startName || '—'} dot="start" />
            <Row label="Destination" value={endName   || '—'} dot="end"   />

            {graphLoading && <Status type="loading">Fetching road network…</Status>}
            {graphError   && <Status type="error">{graphError}</Status>}

            {graph && !graphLoading && (
              <>
                <Divider title="Graph" />
                <Stat label="Nodes" value={graph.nodeCount.toLocaleString()} />
                <Stat label="Edges" value={graph.edgeCount.toLocaleString()} />
              </>
            )}

            {result && (
              <>
                <Divider title="Result" />
                <Stat label="Distance"       value={formatDistance(result.totalDistance)} accent />
                <Stat label="Est. travel"    value={formatDuration(result.totalDistance)} />
                <Stat label="Nodes explored" value={result.nodesExplored.toLocaleString()} />
                <Stat label="Execution"      value={`${result.executionTimeMs.toFixed(2)} ms`} />
                <Stat label="Path nodes"     value={result.path.length.toString()} />
              </>
            )}

            {/* Turn-by-turn directions */}
            {turnByTurn.length > 0 && (
              <>
                <Divider title="Streets" />
                <ul className="ip-directions">
                  {turnByTurn.map((name, i) => (
                    <li key={i} className="ip-dir-item">
                      <span className="ip-dir-dot" />
                      {name}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {result && playback === 'done' && result.path.length > 1 && (
              <>
                <Divider title="Details" />
                <Stat label="Path segments" value={(result.path.length - 1).toString()} />
                <Stat label="Avg segment"   value={formatDistance(result.totalDistance / (result.path.length - 1))} />
                {graph && <Stat label="Total edges" value={graph.edgeCount.toLocaleString()} />}
              </>
            )}

            {compareMode && compareResults && <CompareSummary results={compareResults} />}
          </div>
        )}

        {/* ── Algorithm tab ──────────────────────────────────────────────── */}
        {panelTab === 'algorithm' && (
          <div className="ip-section">
            <div className="ip-algo-name" style={{ color: algo.color }}>{algo.name}</div>
            <p className="ip-algo-desc">{algo.description}</p>

            <Divider title="Complexity" />
            <Stat label="Time"  value={algo.timeComplexity}  mono />
            <Stat label="Space" value={algo.spaceComplexity} mono />

            <Divider title="Properties" />
            <Prop label="Guarantees shortest path" value={algo.guaranteesShortest} />
            <Prop label="Weighted graph support"   value={algo.supportsWeights} />
            {algo.heuristic    && <Note label="Heuristic">{algo.heuristic}</Note>}
            {algo.bestUseCase  && <Note label="Best for">{algo.bestUseCase}</Note>}
            {algo.limitation   && <Note label="Limitation" warn>{algo.limitation}</Note>}

            {/* Priority queue viewer (live during/after animation) */}
            {result && (playback === 'running' || playback === 'paused' || playback === 'done') && (
              <>
                <Divider title="Priority Queue" />
                <div className="ip-queue">
                  <span className="ip-stat-label">Size</span>
                  <div className="ip-queue-bar-outer">
                    <div
                      className="ip-queue-bar-inner"
                      style={{ width: `${maxQueue > 0 ? (curQueue / maxQueue) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="ip-queue-count">{curQueue.toLocaleString()}</span>
                </div>
                {queueData.length > 1 && (
                  <QueueSparkline data={queueData} progress={result ? currentStep / result.steps.length : 0} />
                )}
              </>
            )}

            {/* Pseudocode with step highlighting */}
            <Divider title="Pseudocode" />
            <div className="ip-pseudocode">
              {algo.pseudocode.map((line, i) => (
                <span
                  key={i}
                  className={`ip-pseudo-line${pseudoHL.includes(i) ? ' hl' : ''}`}
                >
                  {line || ' '}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Education tab ──────────────────────────────────────────────── */}
        {panelTab === 'education' && (
          <div className="ip-section">
            <Divider title="Graph Theory" />
            {EDUCATION_CONTENT.map((item) => (
              <div className="ip-edu" key={item.term}>
                <div className="ip-edu-term">{item.term}</div>
                <div className="ip-edu-def">{item.def}</div>
              </div>
            ))}
            <Divider title="Algorithm Comparison" />
            <div className="ip-compare-table">
              <div className="ip-cmp-row header">
                <span>Algorithm</span><span>Explores</span><span>Optimal?</span>
              </div>
              {[
                { name: 'Dijkstra',    style: 'All shortest',  optimal: true  },
                { name: 'A*',          style: 'Goal-biased',   optimal: true  },
                { name: 'Bi-Dijkstra', style: 'Both ends',     optimal: true  },
                { name: 'Bi-A*',       style: 'Both+heuristic',optimal: true  },
                { name: 'Greedy',      style: 'Heuristic only',optimal: false },
                { name: 'BFS',         style: 'Layer rings',   optimal: false },
              ].map((r) => (
                <div className="ip-cmp-row" key={r.name}>
                  <span>{r.name}</span><span>{r.style}</span>
                  <span style={{ color: r.optimal ? '#22C55E' : '#868e96' }}>
                    {r.optimal ? 'Yes' : 'No*'}
                  </span>
                </div>
              ))}
              <div className="ip-cmp-note">*Optimal only for unweighted graphs</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value, dot }: { label: string; value: string; dot: 'start' | 'end' }) {
  return (
    <div className="ip-row">
      <span className={`ip-dot ${dot}`} />
      <div>
        <div className="ip-row-label">{label}</div>
        <div className="ip-row-val">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="ip-stat">
      <span className="ip-stat-label">{label}</span>
      <span className={`ip-stat-val ${accent ? 'accent' : ''} ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function Prop({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="ip-stat">
      <span className="ip-stat-label">{label}</span>
      <span className={value ? 'badge-yes' : 'badge-no'}>{value ? 'Yes' : 'No'}</span>
    </div>
  );
}

function Note({ label, children, warn }: { label: string; children: string; warn?: boolean }) {
  return (
    <div className={`ip-note ${warn ? 'warn' : ''}`}>
      <div className="ip-note-label">{label}</div>
      <div className="ip-note-text">{children}</div>
    </div>
  );
}

function Divider({ title }: { title: string }) {
  return <div className="ip-divider"><span>{title}</span></div>;
}

function Status({ type, children }: { type: 'loading' | 'error'; children: React.ReactNode }) {
  return <div className={`ip-status ${type}`}>{children}</div>;
}

function QueueSparkline({ data, progress }: { data: number[]; progress: number }) {
  const W = 250, H = 36;
  const maxY = Math.max(...data, 1);
  const barW = W / data.length - 0.5;
  const markerX = progress * W;

  return (
    <div className="ip-chart" style={{ height: 36 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {data.map((v, i) => {
          const bh = Math.max(1, (v / maxY) * H);
          return (
            <rect
              key={i}
              x={i * (W / data.length)}
              y={H - bh}
              width={Math.max(1, barW)}
              height={bh}
              fill="var(--text-2)"
              opacity={0.5}
            />
          );
        })}
        <line x1={markerX} y1={0} x2={markerX} y2={H} stroke="var(--text)" strokeWidth="1" opacity="0.6" />
      </svg>
    </div>
  );
}

const COMPARE_META: Record<string, { label: string; color: string }> = {
  dijkstra:   { label: "Dijkstra's",  color: '#f59e0b' },
  astar:      { label: 'A* Search',   color: '#3b82f6' },
  bfs:        { label: 'BFS',         color: '#22c55e' },
  greedy:     { label: 'Greedy BFS',  color: '#F97316' },
  bidijkstra: { label: 'Bi-Dijkstra', color: '#22d3ee' },
  biastar:    { label: 'Bi-A*',       color: '#a78bfa' },
};

const RANK_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function CompareSummary({ results }: { results: CompareResult[] }) {
  return (
    <>
      <Divider title="Ranking" />
      {results.map((r, i) => {
        const meta = COMPARE_META[r.algorithm] ?? { label: r.algorithm, color: '#ffffff' };
        return (
          <div className="ip-compare-card" key={r.algorithm}>
            <div className="ip-compare-card-header">
              <span className={`ip-rank-badge ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                {RANK_LABELS[i] ?? `${i + 1}th`}
              </span>
              <div className="ip-compare-card-title" style={{ color: meta.color }}>{meta.label}</div>
            </div>
            <Stat label="Path length"    value={r.pathLength > 0 ? formatDistance(r.pathLength) : 'No route'} accent={i === 0} />
            <Stat label="Nodes explored" value={r.nodesExplored.toLocaleString()} />
            <Stat label="Execution"      value={`${r.executionTimeMs.toFixed(2)} ms`} />
          </div>
        );
      })}
    </>
  );
}
