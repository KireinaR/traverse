import { RoadGraph, PathResult, VisualizationStep } from '../types';

function heuristic(graph: RoadGraph, nodeId: string, goalId: string): number {
  const a = graph.nodes[nodeId];
  const b = graph.nodes[goalId];
  if (!a || !b) return 0;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

class MinHeap {
  private heap: [number, string][] = [];
  push(p: number, id: string) { this.heap.push([p, id]); this.up(this.heap.length - 1); }
  pop(): [number, string] | null {
    if (!this.heap.length) return null;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length) { this.heap[0] = last; this.down(0); }
    return top;
  }
  get size() { return this.heap.length; }
  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p][0] <= this.heap[i][0]) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]]; i = p;
    }
  }
  private down(i: number) {
    const n = this.heap.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l][0] < this.heap[s][0]) s = l;
      if (r < n && this.heap[r][0] < this.heap[s][0]) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]]; i = s;
    }
  }
}

export function runGreedy(graph: RoadGraph, startId: string, endId: string): PathResult {
  const t0 = performance.now();
  const steps: VisualizationStep[] = [];

  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  const inQueue = new Set<string>();
  const pq = new MinHeap();

  pq.push(heuristic(graph, startId, endId), startId);
  inQueue.add(startId);
  prev[startId] = null;

  while (pq.size > 0) {
    const entry = pq.pop();
    if (!entry) break;
    const [, cur] = entry;
    if (visited.has(cur)) continue;
    visited.add(cur);

    const exploreEdges = (graph.adjacency[cur] ?? []).map(n => ({ from: cur, to: n.to }));
    steps.push({ type: 'explore', nodeId: cur, edges: exploreEdges, queueSize: pq.size });

    if (cur === endId) break;

    for (const { to } of graph.adjacency[cur] ?? []) {
      if (visited.has(to) || inQueue.has(to)) continue;
      inQueue.add(to);
      prev[to] = cur;
      pq.push(heuristic(graph, to, endId), to);
      steps.push({ type: 'visit', nodeId: to, edges: [{ from: cur, to }], queueSize: pq.size });
    }
  }

  const path: string[] = [];
  let cur: string | null = endId;
  while (cur !== null && cur in prev) { path.unshift(cur); cur = prev[cur] ?? null; }
  if (cur === null && path[0] !== startId) path.unshift(startId);
  const validPath = path[0] === startId && path[path.length - 1] === endId ? path : [];

  let totalDistance = 0;
  for (let i = 0; i < validPath.length - 1; i++) {
    const edge = (graph.adjacency[validPath[i]] ?? []).find(e => e.to === validPath[i + 1]);
    if (edge) totalDistance += edge.distance;
  }

  if (validPath.length > 0) {
    steps.push({
      type: 'path', nodeId: endId,
      edges: validPath.slice(0, -1).map((id, i) => ({ from: id, to: validPath[i + 1] })),
    });
  }

  return { path: validPath, totalDistance, nodesExplored: visited.size, executionTimeMs: performance.now() - t0, steps };
}
