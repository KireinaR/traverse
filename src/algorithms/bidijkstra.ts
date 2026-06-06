import { RoadGraph, PathResult, VisualizationStep } from '../types';

class MinHeap {
  private heap: [number, string][] = [];
  push(d: number, id: string) { this.heap.push([d, id]); this.up(this.heap.length - 1); }
  pop(): [number, string] | null {
    if (!this.heap.length) return null;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length) { this.heap[0] = last; this.down(0); }
    return top;
  }
  peek(): number { return this.heap.length ? this.heap[0][0] : Infinity; }
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

export function runBidirectionalDijkstra(graph: RoadGraph, startId: string, endId: string): PathResult {
  const t0 = performance.now();
  const steps: VisualizationStep[] = [];

  const distFwd: Record<string, number> = {};
  const distBwd: Record<string, number> = {};
  const prevFwd: Record<string, string | null> = {};
  const prevBwd: Record<string, string | null> = {};
  const settledFwd = new Set<string>();
  const settledBwd = new Set<string>();

  for (const id of Object.keys(graph.nodes)) {
    distFwd[id] = Infinity;
    distBwd[id] = Infinity;
    prevFwd[id] = null;
    prevBwd[id] = null;
  }
  distFwd[startId] = 0;
  distBwd[endId]   = 0;

  const pqFwd = new MinHeap();
  const pqBwd = new MinHeap();
  pqFwd.push(0, startId);
  pqBwd.push(0, endId);

  let mu       = Infinity;
  let meetNode = startId;

  const checkMeet = (id: string) => {
    const total = distFwd[id] + distBwd[id];
    if (total < mu) { mu = total; meetNode = id; }
  };

  while (pqFwd.size > 0 || pqBwd.size > 0) {
    if (pqFwd.peek() + pqBwd.peek() >= mu) break;

    if (pqFwd.size > 0 && (pqBwd.size === 0 || pqFwd.peek() <= pqBwd.peek())) {
      const entry = pqFwd.pop();
      if (!entry) continue;
      const [d, cur] = entry;
      if (settledFwd.has(cur)) continue;
      settledFwd.add(cur);
      if (settledBwd.has(cur)) checkMeet(cur);

      const exploreEdges = (graph.adjacency[cur] ?? []).map(n => ({ from: cur, to: n.to }));
      steps.push({ type: 'explore', nodeId: cur, edges: exploreEdges, direction: 'forward', queueSize: pqFwd.size });

      if (cur === endId) break;

      for (const { to, distance } of graph.adjacency[cur] ?? []) {
        if (settledFwd.has(to)) continue;
        const nd = d + distance;
        if (nd < distFwd[to]) {
          distFwd[to] = nd; prevFwd[to] = cur;
          pqFwd.push(nd, to);
          steps.push({ type: 'visit', nodeId: to, edges: [{ from: cur, to }], direction: 'forward', queueSize: pqFwd.size });
          if (settledBwd.has(to)) checkMeet(to);
        }
      }
    } else if (pqBwd.size > 0) {
      const entry = pqBwd.pop();
      if (!entry) continue;
      const [d, cur] = entry;
      if (settledBwd.has(cur)) continue;
      settledBwd.add(cur);
      if (settledFwd.has(cur)) checkMeet(cur);

      const exploreEdges = (graph.adjacency[cur] ?? []).map(n => ({ from: cur, to: n.to }));
      steps.push({ type: 'explore', nodeId: cur, edges: exploreEdges, direction: 'backward', queueSize: pqBwd.size });

      if (cur === startId) break;

      for (const { to, distance } of graph.adjacency[cur] ?? []) {
        if (settledBwd.has(to)) continue;
        const nd = d + distance;
        if (nd < distBwd[to]) {
          distBwd[to] = nd; prevBwd[to] = cur;
          pqBwd.push(nd, to);
          steps.push({ type: 'visit', nodeId: to, edges: [{ from: cur, to }], direction: 'backward', queueSize: pqBwd.size });
          if (settledFwd.has(to)) checkMeet(to);
        }
      }
    }
  }

  // Reconstruct: fwd path start→meetNode, bwd path meetNode→end
  const fwdPath: string[] = [];
  let cur: string | null = meetNode;
  while (cur !== null) { fwdPath.unshift(cur); cur = prevFwd[cur] ?? null; }

  const bwdPath: string[] = [];
  cur = prevBwd[meetNode];
  while (cur !== null) { bwdPath.push(cur); cur = prevBwd[cur] ?? null; }

  const validPath = fwdPath[0] === startId ? [...fwdPath, ...bwdPath] : [];

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

  return {
    path: validPath, totalDistance,
    nodesExplored: settledFwd.size + settledBwd.size,
    executionTimeMs: performance.now() - t0, steps,
  };
}
