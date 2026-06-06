// ── Map & Graph ──────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
}

export interface AdjacencyEntry {
  to: string;
  distance: number;
  wayName?: string;
}

export interface RoadGraph {
  nodes: Record<string, GraphNode>;
  adjacency: Record<string, AdjacencyEntry[]>;
  nodeCount: number;
  edgeCount: number;
}

// ── Algorithm ────────────────────────────────────────────────────────────────

export type AlgorithmId = 'dijkstra' | 'astar' | 'bfs' | 'greedy' | 'bidijkstra' | 'biastar';

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  shortName?: string;
  description: string;
  timeComplexity: string;
  spaceComplexity: string;
  guaranteesShortest: boolean;
  supportsWeights: boolean;
  heuristic?: string;
  bestUseCase?: string;
  limitation?: string;
  color: string;
  visualizationHint?: string;
  pseudocode: string[];
  highlightLine: (stepType: StepType, direction?: 'forward' | 'backward') => number[];
}

// ── Visualization ─────────────────────────────────────────────────────────────

export type StepType = 'explore' | 'visit' | 'path';

export interface VisualizationStep {
  type: StepType;
  nodeId: string;
  edges: Array<{ from: string; to: string }>;
  direction?: 'forward' | 'backward';
  queueSize?: number;
}

export interface PathResult {
  path: string[];
  totalDistance: number;
  nodesExplored: number;
  executionTimeMs: number;
  steps: VisualizationStep[];
}

// ── Waypoints ─────────────────────────────────────────────────────────────────

export interface Waypoint {
  point: LatLng;
  name: string;
}

// ── Playback ──────────────────────────────────────────────────────────────────

export type PlaybackState = 'idle' | 'running' | 'paused' | 'done';

export type SpeedMultiplier = 0.25 | 0.5 | 1 | 2 | 4 | 'instant';

// ── UI State ──────────────────────────────────────────────────────────────────

export interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface SearchResult {
  id: number;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  importance: number;
  boundingBox?: number[];
  address?: NominatimAddress;
}

export type Theme = 'light' | 'dark';

export type PanelTab = 'route' | 'algorithm' | 'education';

export type PickMode = 'start' | 'end' | string | null;

// ── Compare Mode ─────────────────────────────────────────────────────────────

export interface CompareResult {
  algorithm: AlgorithmId;
  nodesExplored: number;
  executionTimeMs: number;
  pathLength: number;
  pathNodes: number;
  steps: VisualizationStep[];
  path: string[];
}
