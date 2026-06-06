import { RoadGraph, PathResult, VisualizationStep } from '../types';

// Haversine distance heuristic (straight-line distance in meters)
function heuristic(
  graph: RoadGraph,
  nodeId: string,
  goalId: string
): number {
  const a = graph.nodes[nodeId];
  const b = graph.nodes[goalId];
  if (!a || !b) return 0;

  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

class MinHeap {
  private heap: [number, string][] = [];

  push(f: number, id: string) {
    this.heap.push([f, id]);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): [number, string] | null {
    if (!this.heap.length) return null;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent][0] <= this.heap[i][0]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l][0] < this.heap[smallest][0]) smallest = l;
      if (r < n && this.heap[r][0] < this.heap[smallest][0]) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

export function runAstar(
  graph: RoadGraph,
  startId: string,
  endId: string
): PathResult {
  const t0 = performance.now();
  const steps: VisualizationStep[] = [];

  const gScore: Record<string, number> = {};
  const fScore: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const id of Object.keys(graph.nodes)) {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
    prev[id] = null;
  }
  gScore[startId] = 0;
  fScore[startId] = heuristic(graph, startId, endId);

  const openSet = new MinHeap();
  openSet.push(fScore[startId], startId);

  while (openSet.size > 0) {
    const entry = openSet.pop();
    if (!entry) break;
    const [, currentId] = entry;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const exploreEdges: Array<{ from: string; to: string }> = [];
    for (const neighbor of graph.adjacency[currentId] ?? []) {
      exploreEdges.push({ from: currentId, to: neighbor.to });
    }
    steps.push({ type: 'explore', nodeId: currentId, edges: exploreEdges, queueSize: openSet.size });

    if (currentId === endId) break;

    for (const { to, distance } of graph.adjacency[currentId] ?? []) {
      if (visited.has(to)) continue;
      const tentativeG = gScore[currentId] + distance;
      if (tentativeG < gScore[to]) {
        prev[to] = currentId;
        gScore[to] = tentativeG;
        fScore[to] = tentativeG + heuristic(graph, to, endId);
        openSet.push(fScore[to], to);
        steps.push({ type: 'visit', nodeId: to, edges: [{ from: currentId, to }], queueSize: openSet.size });
      }
    }
  }

  const path: string[] = [];
  let cur: string | null = endId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur] ?? null;
  }

  const validPath = path[0] === startId ? path : [];
  const totalDistance = gScore[endId] === Infinity ? 0 : gScore[endId];

  if (validPath.length > 0) {
    steps.push({
      type: 'path',
      nodeId: endId,
      edges: validPath.slice(0, -1).map((id, i) => ({ from: id, to: validPath[i + 1] })),
    });
  }

  return {
    path: validPath,
    totalDistance,
    nodesExplored: visited.size,
    executionTimeMs: performance.now() - t0,
    steps,
  };
}
