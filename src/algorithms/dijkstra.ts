import { RoadGraph, PathResult, VisualizationStep } from '../types';

// Min-heap priority queue for (distance, nodeId)
class MinHeap {
  private heap: [number, string][] = [];

  push(dist: number, id: string) {
    this.heap.push([dist, id]);
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

export function runDijkstra(
  graph: RoadGraph,
  startId: string,
  endId: string
): PathResult {
  const t0 = performance.now();
  const steps: VisualizationStep[] = [];

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const id of Object.keys(graph.nodes)) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  dist[startId] = 0;

  const pq = new MinHeap();
  pq.push(0, startId);

  while (pq.size > 0) {
    const entry = pq.pop();
    if (!entry) break;
    const [currentDist, currentId] = entry;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const exploreEdges: Array<{ from: string; to: string }> = [];
    for (const neighbor of graph.adjacency[currentId] ?? []) {
      exploreEdges.push({ from: currentId, to: neighbor.to });
    }
    steps.push({ type: 'explore', nodeId: currentId, edges: exploreEdges, queueSize: pq.size });

    if (currentId === endId) break;

    for (const { to, distance } of graph.adjacency[currentId] ?? []) {
      if (visited.has(to)) continue;
      const newDist = currentDist + distance;
      if (newDist < dist[to]) {
        dist[to] = newDist;
        prev[to] = currentId;
        pq.push(newDist, to);
        steps.push({ type: 'visit', nodeId: to, edges: [{ from: currentId, to }], queueSize: pq.size });
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let cur: string | null = endId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur] ?? null;
  }

  const validPath = path[0] === startId ? path : [];
  const totalDistance = dist[endId] === Infinity ? 0 : dist[endId];

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
