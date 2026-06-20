import { AlgorithmMeta, AlgorithmId, StepType } from '../types';

export const ALGORITHMS: Record<AlgorithmId, AlgorithmMeta> = {
  dijkstra: {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    description:
      "Explores all paths from the source, always expanding the closest unvisited node first. Guaranteed to find the shortest path in graphs with non-negative edge weights.",
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
    supportsWeights: true,
    color: '#EAB308',
    visualizationHint: 'Radial expansion — always takes the globally closest unvisited node first',
    pseudocode: [
      'dist[s] ← 0,  dist[all] ← ∞',
      'push (0, s) into min-heap',
      'while heap is not empty:',
      '  u ← pop node with min dist',
      '  if u = goal: done',
      '  for each neighbour v of u:',
      '    nd ← dist[u] + w(u,v)',
      '    if nd < dist[v]:',
      '      dist[v] ← nd;  prev[v] ← u',
      '      push (nd, v) into heap',
      'reconstruct path via prev[]',
    ],
    highlightLine: (type: StepType) => {
      if (type === 'explore') return [3];
      if (type === 'visit')   return [5, 6, 7, 8, 9];
      if (type === 'path')    return [10];
      return [];
    },
  },

  astar: {
    id: 'astar',
    name: 'A* Search',
    description:
      'Extends Dijkstra with a heuristic function that estimates the remaining distance to the goal. Focuses exploration toward the destination, reducing the number of nodes examined.',
    timeComplexity: 'O(E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
    supportsWeights: true,
    heuristic: 'Haversine straight-line distance to goal (admissible — never overestimates)',
    color: '#3B82F6',
    visualizationHint: 'Cone angles toward goal — heuristic focus cuts explored area vs Dijkstra',
    pseudocode: [
      'g[s] ← 0;  f[s] ← h(s, goal)',
      'push (f[s], s) into open set',
      'while open set is not empty:',
      '  u ← pop node with min f-score',
      '  if u = goal: done',
      '  for each neighbour v of u:',
      '    tg ← g[u] + w(u,v)',
      '    if tg < g[v]:',
      '      g[v]←tg;  f[v]←tg+h(v,goal)',
      '      prev[v]←u;  push (f[v], v)',
      'reconstruct path via prev[]',
    ],
    highlightLine: (type: StepType) => {
      if (type === 'explore') return [3];
      if (type === 'visit')   return [5, 6, 7, 8, 9];
      if (type === 'path')    return [10];
      return [];
    },
  },

  bfs: {
    id: 'bfs',
    name: 'Breadth-First Search',
    description:
      'Explores all neighbors level-by-level, guaranteeing the fewest number of hops in unweighted graphs. On weighted road networks it does not minimize distance.',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: false,
    supportsWeights: false,
    bestUseCase: 'Unweighted graphs, social networks, maze solving',
    limitation: 'Does not account for edge weights — path may not be shortest by distance',
    color: '#A855F7',
    visualizationHint: 'Equal-hop rings expand outward — each layer is one road segment further from start',
    pseudocode: [
      'enqueue s;  visited ← {s}',
      'while queue is not empty:',
      '  u ← dequeue()',
      '  if u = goal: done',
      '  for each neighbour v of u:',
      '    if v not in visited:',
      '      visited ← visited ∪ {v}',
      '      prev[v] ← u;  enqueue(v)',
      'reconstruct path via prev[]',
    ],
    highlightLine: (type: StepType) => {
      if (type === 'explore') return [2];
      if (type === 'visit')   return [4, 5, 6, 7];
      if (type === 'path')    return [8];
      return [];
    },
  },

  greedy: {
    id: 'greedy',
    name: 'Greedy Best-First',
    shortName: 'Greedy',
    description:
      'Selects the next node purely by straight-line distance to the goal, ignoring accumulated cost. Very fast but not guaranteed to find the shortest path.',
    timeComplexity: 'O(E log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: false,
    supportsWeights: false,
    heuristic: 'Haversine straight-line distance to goal (ignores actual edge weights)',
    limitation: 'Ignores accumulated cost — can return longer paths than optimal',
    color: '#F97316',
    visualizationHint: 'Beelines toward goal by straight-line distance — fast but may take a longer actual route',
    pseudocode: [
      'push (h(s, goal), s) into heap',
      'while heap is not empty:',
      '  u ← pop node with min h',
      '  if u = goal: done',
      '  for each unvisited v in adj(u):',
      '    prev[v] ← u',
      '    push (h(v, goal), v)',
      'reconstruct path via prev[]',
    ],
    highlightLine: (type: StepType) => {
      if (type === 'explore') return [2];
      if (type === 'visit')   return [4, 5, 6];
      if (type === 'path')    return [7];
      return [];
    },
  },

  bidijkstra: {
    id: 'bidijkstra',
    name: 'Bidirectional Dijkstra',
    shortName: 'Bi-Dijkstra',
    description:
      'Runs two simultaneous Dijkstra searches from start and end, meeting in the middle. Explores roughly half the nodes of standard Dijkstra.',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
    supportsWeights: true,
    bestUseCase: 'Long-distance routes where both endpoints are known up front',
    color: '#22D3EE',
    visualizationHint: 'Two frontiers grow from each end — they meet in the middle, halving search space',
    pseudocode: [
      'distF[s]←0;  distB[t]←0;  μ←∞',
      'pushF(0,s);  pushB(0,t)',
      'while queues and μ > minF+minB:',
      '  u ← popF  (forward step)',
      '  relax forward edges of u',
      '  if u settled backward: μ ← min',
      '  u ← popB  (backward step)',
      '  relax backward edges of u',
      '  if u settled forward: μ ← min',
      'reconstruct path via meeting node',
    ],
    highlightLine: (type: StepType, dir?: 'forward' | 'backward') => {
      if (type === 'explore') return dir === 'backward' ? [6] : [3];
      if (type === 'visit')   return dir === 'backward' ? [7, 8] : [4, 5];
      if (type === 'path')    return [9];
      return [];
    },
  },

  biastar: {
    id: 'biastar',
    name: 'Bidirectional A*',
    shortName: 'Bi-A*',
    description:
      'Two simultaneous A* searches from start and goal, guided by heuristics in both directions. Combines heuristic efficiency with bidirectional speed.',
    timeComplexity: 'O(E)',
    spaceComplexity: 'O(V)',
    guaranteesShortest: true,
    supportsWeights: true,
    heuristic: 'Haversine from each frontier to its opposite endpoint',
    color: '#A78BFA',
    visualizationHint: 'Two heuristic cones converging — forward frontier aims at B, backward at A',
    pseudocode: [
      'gF[s]←0;  gB[t]←0;  μ←∞',
      'pushF(h(s,t),s);  pushB(h(t,s),t)',
      'while queues and μ unsatisfied:',
      '  u ← popF  (forward step)',
      '  expand u with h(v, goal)',
      '  u ← popB  (backward step)',
      '  expand u with h(v, start)',
      '  if frontiers share settled node: break',
      'reconstruct path via meeting node',
    ],
    highlightLine: (type: StepType, dir?: 'forward' | 'backward') => {
      if (type === 'explore') return dir === 'backward' ? [5] : [3];
      if (type === 'visit')   return dir === 'backward' ? [6] : [4];
      if (type === 'path')    return [8];
      return [];
    },
  },
};

export const ALGORITHM_LIST = Object.values(ALGORITHMS);

// Color palette for compare mode — order matches allAlgos in TopBar: dijkstra, astar, bidijkstra, biastar, greedy, bfs
// Position-based, not algorithm-based: results are sorted before display so index 0 is always "best".
export const COMPARE_COLORS = [
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#F97316', // orange
  '#22c55e', // green
] as const;
