import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchGraph } from '../../services/api';
import { findNearestNode, getBoundingBox } from '../../lib/graphUtils';
import { runDijkstra } from '../../algorithms/dijkstra';
import { runAstar } from '../../algorithms/astar';
import { runBFS } from '../../algorithms/bfs';
import { CompareResult } from '../../types';
import SearchBox from './SearchBox';
import AlgorithmSelector from './AlgorithmSelector';
import SpeedControl from './SpeedControl';
import PlaybackControls from './PlaybackControls';
import ThemeToggle from './ThemeToggle';
import { SearchResult } from '../../types';

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const {
    startPoint, endPoint, startName, endName,
    selectedAlgorithm, panelOpen,
  } = state;

  const handleSelectStart = useCallback((r: SearchResult) => {
    dispatch({ type: 'SET_START', point: { lat: r.lat, lng: r.lng }, name: r.displayName.split(',')[0] });
    dispatch({ type: 'ADD_HISTORY', name: r.displayName.split(',')[0], point: { lat: r.lat, lng: r.lng } });
  }, [dispatch]);

  const handleSelectEnd = useCallback((r: SearchResult) => {
    dispatch({ type: 'SET_END', point: { lat: r.lat, lng: r.lng }, name: r.displayName.split(',')[0] });
    dispatch({ type: 'ADD_HISTORY', name: r.displayName.split(',')[0], point: { lat: r.lat, lng: r.lng } });
  }, [dispatch]);

  const loadGraphAndRun = useCallback(async (compareMode = false) => {
    if (!startPoint || !endPoint) return;
    dispatch({ type: 'SET_GRAPH_LOADING' });
    try {
      const bbox = getBoundingBox(startPoint, endPoint);
      const graph = await fetchGraph(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng);
      dispatch({ type: 'SET_GRAPH', graph });

      const startId = findNearestNode(graph, startPoint);
      const endId = findNearestNode(graph, endPoint);

      if (!startId || !endId) {
        dispatch({ type: 'SET_GRAPH_ERROR', error: 'Could not find road nodes near your selected points.' });
        return;
      }

      if (compareMode) {
        const dijkResult = runDijkstra(graph, startId, endId);
        const astarResult = runAstar(graph, startId, endId);
        const compareResults: CompareResult[] = [
          {
            algorithm: 'dijkstra',
            nodesExplored: dijkResult.nodesExplored,
            executionTimeMs: dijkResult.executionTimeMs,
            pathLength: dijkResult.totalDistance,
            pathNodes: dijkResult.path.length,
            steps: dijkResult.steps,
            path: dijkResult.path,
          },
          {
            algorithm: 'astar',
            nodesExplored: astarResult.nodesExplored,
            executionTimeMs: astarResult.executionTimeMs,
            pathLength: astarResult.totalDistance,
            pathNodes: astarResult.path.length,
            steps: astarResult.steps,
            path: astarResult.path,
          },
        ];
        dispatch({ type: 'SET_COMPARE_MODE', enabled: true });
        dispatch({ type: 'SET_COMPARE', results: compareResults });
        dispatch({ type: 'SET_PANEL_TAB', tab: 'route' });
        return;
      }

      const run =
        selectedAlgorithm === 'dijkstra' ? runDijkstra :
        selectedAlgorithm === 'astar' ? runAstar : runBFS;

      const result = run(graph, startId, endId);
      dispatch({ type: 'SET_COMPARE_MODE', enabled: false });
      dispatch({ type: 'SET_RESULT', result });
      dispatch({ type: 'SET_PANEL_TAB', tab: 'route' });

      if (!panelOpen) dispatch({ type: 'TOGGLE_PANEL' });
    } catch (err: any) {
      dispatch({ type: 'SET_GRAPH_ERROR', error: err.message ?? 'Failed to load road network' });
    }
  }, [startPoint, endPoint, selectedAlgorithm, dispatch, panelOpen]);

  const handleVisualize = () => loadGraphAndRun(false);
  const handleCompare = () => loadGraphAndRun(true);

  const swapPoints = () => {
    if (!startPoint || !endPoint) return;
    dispatch({ type: 'SET_START', point: endPoint, name: endName });
    dispatch({ type: 'SET_END', point: startPoint, name: startName });
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-text">TRAVERSE</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Search */}
      <div className="sidebar-section">
        <div className="search-group">
          <SearchBox
            placeholder="Search start location…"
            value={startName}
            onSelect={handleSelectStart}
            color="#22C55E"
          />
          <button className="swap-btn" onClick={swapPoints} title="Swap start and end" disabled={!startPoint || !endPoint}>
            <SwapIcon />
          </button>
          <SearchBox
            placeholder="Search destination…"
            value={endName}
            onSelect={handleSelectEnd}
            color="#EF4444"
          />
        </div>
        {(!startPoint || !endPoint) && (
          <p className="hint">
            {!startPoint ? 'Search or click map to set start' : 'Search or click map to set destination'}
          </p>
        )}
      </div>

      {/* Algorithm */}
      <div className="sidebar-section">
        <AlgorithmSelector />
      </div>

      {/* Speed */}
      <div className="sidebar-section">
        <SpeedControl />
      </div>

      {/* Playback */}
      <div className="sidebar-section">
        <PlaybackControls onVisualize={handleVisualize} onCompare={handleCompare} />
      </div>

      {/* Legend */}
      <div className="sidebar-section">
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const { state } = useApp();
  const { selectedAlgorithm } = state;

  const colors: Record<string, { explore: string; label: string }> = {
    dijkstra:   { explore: '#EAB308', label: 'Yellow' },
    astar:      { explore: '#3B82F6', label: 'Blue'   },
    bfs:        { explore: '#A855F7', label: 'Purple' },
    greedy:     { explore: '#F97316', label: 'Orange' },
    bidijkstra: { explore: '#22D3EE', label: 'Cyan'   },
    biastar:    { explore: '#A78BFA', label: 'Violet' },
  };
  const c = colors[selectedAlgorithm] ?? colors['dijkstra'];

  return (
    <div className="legend">
      <div className="label-sm">Legend</div>
      <div className="legend-items">
        <LegendItem color={c.explore} label="Exploring" />
        <LegendItem color="#F97316" label="Visited" />
        <LegendItem color="#22C55E" label="Shortest path" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="legend-item">
      <div style={{ width: 24, height: 4, borderRadius: 2, background: color }} />
      <span>{label}</span>
    </div>
  );
}

const PathIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" />
    <path d="M5 7c0 6 14 4 14 12" />
  </svg>
);

const SwapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7 16V4m0 0L3 8m4-4l4 4" /><path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);
