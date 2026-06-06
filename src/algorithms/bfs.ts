import { RoadGraph, PathResult, VisualizationStep } from '../types';

// BFS treats all edges equally (unweighted) — explores in rings from start
export function runBFS(
  graph: RoadGraph,
  startId: string,
  endId: string
): PathResult {
  const t0 = performance.now();
  const steps: VisualizationStep[] = [];

  const visited = new Set<string>();
  const prev: Record<string, string | null> = {};
  const queue: string[] = [startId];

  for (const id of Object.keys(graph.nodes)) {
    prev[id] = null;
  }

  visited.add(startId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const exploreEdges: Array<{ from: string; to: string }> = [];
    for (const neighbor of graph.adjacency[currentId] ?? []) {
      exploreEdges.push({ from: currentId, to: neighbor.to });
    }
    steps.push({ type: 'explore', nodeId: currentId, edges: exploreEdges, queueSize: queue.length });

    if (currentId === endId) break;

    for (const { to } of graph.adjacency[currentId] ?? []) {
      if (!visited.has(to)) {
        visited.add(to);
        prev[to] = currentId;
        queue.push(to);
        steps.push({ type: 'visit', nodeId: to, edges: [{ from: currentId, to }], queueSize: queue.length });
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

  // BFS path distance = sum of actual edge weights along BFS path
  let totalDistance = 0;
  for (let i = 0; i < validPath.length - 1; i++) {
    const fromId = validPath[i];
    const toId = validPath[i + 1];
    const edge = (graph.adjacency[fromId] ?? []).find((e) => e.to === toId);
    if (edge) totalDistance += edge.distance;
  }

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
