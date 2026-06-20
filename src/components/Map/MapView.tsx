import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { reverseGeocode } from '../../services/api';
import { SpeedMultiplier, VisualizationStep, AlgorithmId } from '../../types';
import { ALGORITHMS, COMPARE_COLORS } from '../../lib/algorithmMeta';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DARK_TILE  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const LIGHT_TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATTR = '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const BASE_SPS = 500;


function stepsPerSec(speed: SpeedMultiplier): number {
  if (speed === 'instant') return Infinity;
  return BASE_SPS * (speed as number);
}

function pinIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:28px;height:28px;cursor:move;"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

type EdgePair = { from: string; to: string };

type LegendItem = { color: string; lineWidth: number; alpha: number; label: string };

function drawLegend(ctx: CanvasRenderingContext2D, W: number, H: number, items: LegendItem[]) {
  if (!items.length) return;
  const LINE_W = 18, ROW_H = 18, PAD_X = 10, PAD_Y = 7, TEXT_GAP = 6;
  const legendW = 148;
  const legendH = items.length * ROW_H + PAD_Y * 2;
  const x = 10, y = H - legendH - 58;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(10,10,10,0.72)';
  ctx.beginPath();
  if ((ctx as any).roundRect) {
    (ctx as any).roundRect(x, y, legendW, legendH, 5);
  } else {
    ctx.rect(x, y, legendW, legendH);
  }
  ctx.fill();

  for (let i = 0; i < items.length; i++) {
    const { color, lineWidth, alpha, label } = items[i];
    const rowY = y + PAD_Y + i * ROW_H + ROW_H / 2;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + PAD_X, rowY);
    ctx.lineTo(x + PAD_X + LINE_W, rowY);
    ctx.stroke();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter,-apple-system,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + PAD_X + LINE_W + TEXT_GAP, rowY);
  }
  ctx.restore();
}

// Pure replay function: rebuild visualization state up to a given step index
function computeVizState(steps: VisualizationStep[], upToStep: number) {
  const visited: EdgePair[] = [];
  const visitedBack: EdgePair[] = [];
  let active: EdgePair[] = [];
  let activeBack: EdgePair[] = [];
  const path: EdgePair[] = [];

  for (let i = 0; i <= upToStep && i < steps.length; i++) {
    const step = steps[i];
    const isBwd = step.direction === 'backward';
    if (step.type === 'explore') {
      if (isBwd) { for (const e of step.edges) visitedBack.push(e); activeBack = step.edges.slice(); }
      else       { for (const e of step.edges) visited.push(e);     active    = step.edges.slice(); }
    } else if (step.type === 'visit') {
      if (isBwd) { for (const e of step.edges) visitedBack.push(e); }
      else       { for (const e of step.edges) visited.push(e); }
    } else if (step.type === 'path') {
      for (const e of step.edges) path.push(e);
      active = []; activeBack = [];
    }
  }

  return { visited, visitedBack, active, activeBack, path };
}

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const mapRef           = useRef<L.Map | null>(null);
  const tileRef          = useRef<L.TileLayer | null>(null);
  const startMarkerRef   = useRef<L.Marker | null>(null);
  const endMarkerRef     = useRef<L.Marker | null>(null);

  // Visualization state — mutated directly
  const vizRef = useRef({
    visited:      [] as EdgePair[],
    active:       [] as EdgePair[],
    path:         [] as EdgePair[],
    visitedBack:  [] as EdgePair[],
    activeBack:   [] as EdgePair[],
  });

  const animRef = useRef({ rafId: 0, stepIndex: 0, lastTs: 0, running: false });

  const compareVizRef  = useRef<Array<{ visited: EdgePair[]; active: EdgePair[]; path: EdgePair[]; done: boolean }>>([]);
  const compareAnimRef = useRef({ rafId: 0, stepIndices: [] as number[], lastTs: 0, running: false });

  const { state, dispatch } = useApp();
  const { theme } = useTheme();
  const { startPoint, endPoint, viaPoints, graph, result, playback, speed, pickMode, compareResults, panelOpen, selectedAlgorithm, compareMode } = state;

  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const playbackRef = useRef(playback);
  useEffect(() => { playbackRef.current = playback; }, [playback]);

  const selectedAlgorithmRef = useRef<AlgorithmId>(selectedAlgorithm);
  useEffect(() => { selectedAlgorithmRef.current = selectedAlgorithm; }, [selectedAlgorithm]);

  const compareResultsRef = useRef(compareResults);
  useEffect(() => { compareResultsRef.current = compareResults; }, [compareResults]);

  const drawRef = useRef<() => void>(() => {});

  // ── A/B/via pin overlay ──────────────────────────────────────────────────────
  const drawMarkersToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const map    = mapRef.current;
    if (!canvas || !map) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx  = canvas.getContext('2d')!;

    const drawPin = (point: typeof startPoint, label: string, r = 13) => {
      if (!point) return;
      const p = map.latLngToContainerPoint([point.lat, point.lng]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle   = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.fillStyle    = '#000000';
      ctx.font         = `bold ${r > 10 ? 10 : 8}px Inter,-apple-system,sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, p.x, p.y);
    };

    ctx.save();
    ctx.scale(dpr, dpr);

    // Via point markers (drawn below A/B so they don't cover them)
    viaPoints.forEach((via, idx) => {
      if (via.point.lat !== 0 || via.point.lng !== 0) {
        drawPin(via.point, `${idx + 1}`, 10);
      }
    });

    drawPin(startPoint, 'A');
    drawPin(endPoint,   'B');
    ctx.restore();
  }, [startPoint, endPoint, viaPoints]);

  // ── Canvas draw (single algorithm) ──────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const map    = mapRef.current;
    if (!canvas || !map || !graph) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width  / dpr;
    const H = canvas.height / dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const proj = (id: string) => {
      const n = graph.nodes[id];
      if (!n) return null;
      return map.latLngToContainerPoint([n.lat, n.lng]);
    };

    const BATCH = 8000;
    const drawEdges = (edges: EdgePair[], color: string, lineWidth: number, alpha: number) => {
      if (!edges.length) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidth;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      for (let start = 0; start < edges.length; start += BATCH) {
        ctx.beginPath();
        for (let i = start; i < Math.min(start + BATCH, edges.length); i++) {
          const { from, to } = edges[i];
          const a = proj(from);
          const b = proj(to);
          if (!a || !b) continue;
          if (a.x < -20 && b.x < -20) continue;
          if (a.y < -20 && b.y < -20) continue;
          if (a.x > W + 20 && b.x > W + 20) continue;
          if (a.y > H + 20 && b.y > H + 20) continue;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    };

    const v = vizRef.current;
    const algoColor  = ALGORITHMS[selectedAlgorithmRef.current].color;
    const backColor  = '#f59e0b'; // amber — contrasts with any algo color for backward frontier

    drawEdges(v.visited,     algoColor, 1.5, 0.40);
    drawEdges(v.active,      algoColor, 2.5, 1.0);
    drawEdges(v.visitedBack, backColor, 1.5, 0.40);
    drawEdges(v.activeBack,  backColor, 2.5, 1.0);

    if (v.path.length > 0) {
      const pts: Array<{ x: number; y: number }> = [];
      const first = proj(v.path[0].from);
      if (first) {
        pts.push(first);
        for (const { to } of v.path) {
          const p = proj(to);
          if (p) pts.push(p);
        }
      }
      if (pts.length >= 2) {
        // Shadow pass for contrast against explored cloud
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth   = 8.0;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        // Main path
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 5.0;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
    }

    if (playbackRef.current !== 'idle') {
      const isBidirectional = selectedAlgorithmRef.current === 'bidijkstra' || selectedAlgorithmRef.current === 'biastar';
      const hasPath = v.path.length > 0;
      const legendItems: LegendItem[] = [
        { color: algoColor, lineWidth: 1.5, alpha: 0.50, label: 'Explored' },
        { color: algoColor, lineWidth: 2.5, alpha: 1.0,  label: 'Frontier' },
      ];
      if (isBidirectional) {
        legendItems.push({ color: backColor, lineWidth: 1.5, alpha: 0.50, label: 'Back explored' });
        legendItems.push({ color: backColor, lineWidth: 2.5, alpha: 1.0,  label: 'Back frontier' });
      }
      if (hasPath) {
        legendItems.push({ color: '#ffffff', lineWidth: 4.5, alpha: 1.0, label: 'Shortest path' });
      }
      drawLegend(ctx, W, H, legendItems);
    }

    ctx.restore();
    drawMarkersToCanvas();
  }, [graph, drawMarkersToCanvas]);

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const runFrame = useCallback((ts: number) => {
    const anim = animRef.current;
    if (!anim.running || !result) return;

    const sps     = stepsPerSec(speedRef.current);
    const elapsed = anim.lastTs > 0 ? ts - anim.lastTs : 16;
    anim.lastTs   = ts;

    const toAdvance = sps === Infinity
      ? result.steps.length
      : Math.max(1, Math.round(elapsed * sps / 1000));

    const end = Math.min(anim.stepIndex + toAdvance, result.steps.length);

    for (let i = anim.stepIndex; i < end; i++) {
      const step = result.steps[i];
      const isBwd = step.direction === 'backward';
      if (step.type === 'explore') {
        if (isBwd) { vizRef.current.activeBack = step.edges; for (const e of step.edges) vizRef.current.visitedBack.push(e); }
        else       { vizRef.current.active     = step.edges; for (const e of step.edges) vizRef.current.visited.push(e); }
      } else if (step.type === 'visit') {
        if (isBwd) { for (const e of step.edges) vizRef.current.visitedBack.push(e); }
        else       { for (const e of step.edges) vizRef.current.visited.push(e); }
      } else if (step.type === 'path') {
        vizRef.current.active      = [];
        vizRef.current.activeBack  = [];
        for (const e of step.edges) vizRef.current.path.push(e); // append for multi-segment
      }
    }

    anim.stepIndex = end;
    drawCanvas();

    if (end >= result.steps.length) {
      anim.running = false;
      dispatch({ type: 'SET_PLAYBACK', state: 'done' });
      dispatch({ type: 'SET_STEP', step: end });
      return;
    }

    if (end % 80 === 0) dispatch({ type: 'SET_STEP', step: end });
    anim.rafId = requestAnimationFrame(runFrame);
  }, [result, drawCanvas, dispatch]);

  // ── Compare live visualization ───────────────────────────────────────────────
  const drawCompareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const map    = mapRef.current;
    if (!canvas || !map || !graph) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx  = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vizStates = compareVizRef.current;
    if (vizStates.length > 0) {
      ctx.save();
      ctx.scale(dpr, dpr);

      for (let ci = 0; ci < vizStates.length; ci++) {
        const viz   = vizStates[ci];
        const color = COMPARE_COLORS[ci] ?? '#ffffff';

        const CMP_BATCH = 8000;
        const drawEdgeBatch = (edges: EdgePair[], lineWidth: number, alpha: number) => {
          if (!edges.length) return;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth   = lineWidth;
          ctx.lineCap     = 'round';
          ctx.lineJoin    = 'round';
          for (let start = 0; start < edges.length; start += CMP_BATCH) {
            ctx.beginPath();
            for (let i = start; i < Math.min(start + CMP_BATCH, edges.length); i++) {
              const { from, to } = edges[i];
              const a = graph.nodes[from];
              const b = graph.nodes[to];
              if (!a || !b) continue;
              const pa = map.latLngToContainerPoint([a.lat, a.lng]);
              const pb = map.latLngToContainerPoint([b.lat, b.lng]);
              ctx.moveTo(pa.x, pa.y);
              ctx.lineTo(pb.x, pb.y);
            }
            ctx.stroke();
          }
        };

        drawEdgeBatch(viz.visited, 1.2, 0.14);
        drawEdgeBatch(viz.active,  2.0, 0.60);

        if (viz.path.length > 0) {
          const pts: Array<{ x: number; y: number }> = [];
          const first = graph.nodes[viz.path[0].from];
          if (first) {
            pts.push(map.latLngToContainerPoint([first.lat, first.lng]));
            for (const { to } of viz.path) {
              const n = graph.nodes[to];
              if (n) pts.push(map.latLngToContainerPoint([n.lat, n.lng]));
            }
          }
          const pathWidths = [10, 8, 6.5, 5, 3.5, 2];
          if (pts.length >= 2) {
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = color;
            ctx.lineWidth   = pathWidths[ci] ?? 4.5;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
              const mx = (pts[i].x + pts[i + 1].x) / 2;
              const my = (pts[i].y + pts[i + 1].y) / 2;
              ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.stroke();
          }
        }
      }

      const cmpRes = compareResultsRef.current;
      if (cmpRes) {
        const W = canvas.width / dpr;
        const H = canvas.height / dpr;
        const legendItems: LegendItem[] = cmpRes.map((r, i) => ({
          color: COMPARE_COLORS[i] ?? '#ffffff',
          lineWidth: 2.5,
          alpha: 1.0,
          label: ALGORITHMS[r.algorithm].shortName ?? ALGORITHMS[r.algorithm].name.split(' ')[0],
        }));
        drawLegend(ctx, W, H, legendItems);
      }

      ctx.restore();
    }

    drawMarkersToCanvas();
  }, [graph, drawMarkersToCanvas]);

  // ── Compare RAF loop ─────────────────────────────────────────────────────────
  const runCompareFrame = useCallback((ts: number) => {
    const anim = compareAnimRef.current;
    if (!anim.running || !compareResults) return;

    const elapsed   = anim.lastTs > 0 ? ts - anim.lastTs : 16;
    anim.lastTs     = ts;
    const sps       = stepsPerSec(speedRef.current);
    const toAdvance = sps === Infinity
      ? Number.MAX_SAFE_INTEGER
      : Math.max(1, Math.round(elapsed * sps / 1000));

    for (let ai = 0; ai < compareResults.length; ai++) {
      const steps = compareResults[ai].steps;
      const viz   = compareVizRef.current[ai];
      if (!viz || viz.done) continue;

      const from = anim.stepIndices[ai];
      const to   = Math.min(from + toAdvance, steps.length);

      for (let i = from; i < to; i++) {
        const step = steps[i];
        if (step.type === 'explore') { viz.active = step.edges; for (const e of step.edges) viz.visited.push(e); }
        else if (step.type === 'visit')  { for (const e of step.edges) viz.visited.push(e); }
        else if (step.type === 'path')   { viz.active = []; viz.path = step.edges; }
      }
      anim.stepIndices[ai] = to;
      if (to >= steps.length) viz.done = true;
    }

    drawCompareCanvas();

    if (compareVizRef.current.every((v) => v.done)) {
      anim.running = false;
      dispatch({ type: 'SET_PLAYBACK', state: 'done' });
      return;
    }

    anim.rafId = requestAnimationFrame(runCompareFrame);
  }, [compareResults, drawCompareCanvas, dispatch]);

  // Start single-algorithm animation
  useEffect(() => {
    if (playback !== 'running' || !result) return;
    if (animRef.current.running) return;
    vizRef.current = { visited: [], active: [], path: [], visitedBack: [], activeBack: [] };
    animRef.current.stepIndex = 0;
    animRef.current.lastTs    = 0;
    animRef.current.running   = true;
    animRef.current.rafId     = requestAnimationFrame(runFrame);
  }, [playback, result, runFrame]);

  // Start compare animation
  useEffect(() => {
    if (playback !== 'running' || !compareResults || !compareResults.length) return;
    if (compareAnimRef.current.running) return;
    compareVizRef.current      = compareResults.map(() => ({ visited: [], active: [], path: [], done: false }));
    compareAnimRef.current     = { rafId: 0, stepIndices: compareResults.map(() => 0), lastTs: 0, running: true };
    compareAnimRef.current.rafId = requestAnimationFrame(runCompareFrame);
  }, [playback, compareResults, runCompareFrame]);

  // Expose controls to BottomBar
  useEffect(() => {
    const inCompare = () => compareVizRef.current.length > 0;

    const pause = () => {
      animRef.current.running        = false;
      compareAnimRef.current.running = false;
      cancelAnimationFrame(animRef.current.rafId);
      cancelAnimationFrame(compareAnimRef.current.rafId);
      dispatch({ type: 'SET_PLAYBACK', state: 'paused' });
    };
    const resume = () => {
      if (animRef.current.running || compareAnimRef.current.running) return;
      dispatch({ type: 'SET_PLAYBACK', state: 'running' });
      if (inCompare()) {
        compareAnimRef.current.running = true;
        compareAnimRef.current.lastTs  = 0;
        compareAnimRef.current.rafId   = requestAnimationFrame(runCompareFrame);
      } else {
        animRef.current.running = true;
        animRef.current.lastTs  = 0;
        animRef.current.rafId   = requestAnimationFrame(runFrame);
      }
    };
    const stop = () => {
      animRef.current.running        = false;
      compareAnimRef.current.running = false;
      cancelAnimationFrame(animRef.current.rafId);
      cancelAnimationFrame(compareAnimRef.current.rafId);
      animRef.current.stepIndex = 0;
      compareVizRef.current     = [];
      vizRef.current            = { visited: [], active: [], path: [], visitedBack: [], activeBack: [] };
      const c = canvasRef.current;
      if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
      drawMarkersToCanvas();
      dispatch({ type: 'SET_PLAYBACK', state: 'idle' });
      dispatch({ type: 'SET_STEP', step: 0 });
    };
    const reset = () => { stop(); dispatch({ type: 'RESET' }); };

    const scrubStep = (n: number) => {
      if (!result) return;
      const s = computeVizState(result.steps, n - 1);
      vizRef.current = { visited: s.visited, active: s.active, path: s.path, visitedBack: s.visitedBack, activeBack: s.activeBack };
      animRef.current.stepIndex = n;
      drawCanvas();
      dispatch({ type: 'SET_STEP', step: n });
    };

    (window as any).__vizControls = { pause, resume, stop, reset, scrubStep };
  }, [result, runFrame, runCompareFrame, drawCanvas, drawMarkersToCanvas, dispatch]);

  // Clear canvas on reset
  useEffect(() => {
    if (!result && playback === 'idle') {
      vizRef.current = { visited: [], active: [], path: [], visitedBack: [], activeBack: [] };
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
      drawMarkersToCanvas();
    }
  }, [result, playback, drawMarkersToCanvas]);

  // Auto-open info panel when route finishes
  useEffect(() => {
    if (playback !== 'done') return;
    dispatch({ type: 'SET_PANEL_TAB', tab: 'route' });
    if (!panelOpen) dispatch({ type: 'TOGGLE_PANEL' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback]);

  // Keep drawRef current after every render
  useEffect(() => {
    if (compareResults) {
      drawRef.current = drawCompareCanvas;
    } else if (graph) {
      drawRef.current = drawCanvas;
    } else {
      drawRef.current = () => {
        const c = canvasRef.current;
        if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
        drawMarkersToCanvas();
      };
    }
  });

  // ── Map init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, { center: [40.7128, -74.006], zoom: 13, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const tile = L.tileLayer(DARK_TILE, { attribution: ATTR, maxZoom: 19 }).addTo(map);
    tileRef.current = tile;
    mapRef.current  = map;

    const resizeCanvas = () => {
      const c = canvasRef.current;
      const container = mapContainerRef.current;
      if (!c || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = container;
      c.width  = w * dpr; c.height = h * dpr;
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      drawRef.current();
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(mapContainerRef.current);

    map.on('move zoom moveend zoomend', () => drawRef.current());

    (window as any).__mapPanTo = (lat: number, lng: number, zoom?: number) => {
      map.setView([lat, lng], zoom ?? map.getZoom(), { animate: false });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => map.setView([coords.latitude, coords.longitude], 13, { animate: false }),
        () => {},
        { timeout: 6000 },
      );
    }
  }, []); // eslint-disable-line

  useEffect(() => { tileRef.current?.setUrl(theme === 'dark' ? DARK_TILE : LIGHT_TILE); }, [theme]);

  // ── Map clicks (pick mode) ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (!pickMode) return;
      const geo = await reverseGeocode(lat, lng).catch(() => ({ displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
      const name = geo.displayName.split(',')[0];
      if (pickMode === 'start') {
        dispatch({ type: 'SET_START', point: { lat, lng }, name });
      } else if (pickMode === 'end') {
        dispatch({ type: 'SET_END', point: { lat, lng }, name });
      } else if (typeof pickMode === 'string' && pickMode.startsWith('via:')) {
        const idx = parseInt(pickMode.slice(4));
        dispatch({ type: 'SET_VIA_POINT', index: idx, point: { lat, lng }, name });
      }
    };
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [pickMode, dispatch]);

  useEffect(() => {
    if (mapContainerRef.current)
      mapContainerRef.current.style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode]);

  // ── Start marker ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    startMarkerRef.current?.remove();
    if (!startPoint) { startMarkerRef.current = null; return; }
    const m = L.marker([startPoint.lat, startPoint.lng], { icon: pinIcon(), draggable: true }).addTo(map);
    m.on('dragend', async () => {
      const p = m.getLatLng();
      const geo = await reverseGeocode(p.lat, p.lng).catch(() => ({ displayName: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` }));
      dispatch({ type: 'SET_START', point: { lat: p.lat, lng: p.lng }, name: geo.displayName.split(',')[0] });
    });
    startMarkerRef.current = m;
  }, [startPoint, dispatch]);

  // ── End marker ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    endMarkerRef.current?.remove();
    if (!endPoint) { endMarkerRef.current = null; return; }
    const m = L.marker([endPoint.lat, endPoint.lng], { icon: pinIcon(), draggable: true }).addTo(map);
    m.on('dragend', async () => {
      const p = m.getLatLng();
      const geo = await reverseGeocode(p.lat, p.lng).catch(() => ({ displayName: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` }));
      dispatch({ type: 'SET_END', point: { lat: p.lat, lng: p.lng }, name: geo.displayName.split(',')[0] });
    });
    endMarkerRef.current = m;
  }, [endPoint, dispatch]);

  // ── Auto-fit ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !startPoint || !endPoint) return;
    mapRef.current.fitBounds(
      [[startPoint.lat, startPoint.lng], [endPoint.lat, endPoint.lng]],
      { padding: [80, 80] },
    );
  }, [startPoint, endPoint]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
      />
      {pickMode && (
        <div className="pick-hint">
          Click on the map to set your{' '}
          {pickMode === 'start' ? 'start point' : pickMode === 'end' ? 'destination' : 'waypoint'}
          <button
            className="pick-hint-cancel"
            onClick={() => dispatch({ type: 'SET_PICK_MODE', mode: null })}
          >
            Cancel
          </button>
        </div>
      )}
      {(playback === 'running' || playback === 'paused') && !compareMode && (() => {
        const algo = ALGORITHMS[selectedAlgorithm];
        return algo.visualizationHint ? (
          <div className="viz-hint">
            <span className="viz-hint-chip" style={{ color: algo.color }}>{algo.shortName ?? algo.name.split(' ')[0]}</span>
            {algo.visualizationHint}
          </div>
        ) : null;
      })()}
    </div>
  );
}
