import { OsmData, OsmNode } from './overpassService';

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
}

export interface RoadGraph {
  nodes: Record<string, GraphNode>;
  adjacency: Record<string, Array<{ to: string; distance: number; wayName?: string }>>;
  nodeCount: number;
  edgeCount: number;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOneWay(tags?: Record<string, string>): boolean {
  if (!tags) return false;
  return (
    tags.oneway === 'yes' ||
    tags.oneway === '1' ||
    tags.junction === 'roundabout' ||
    tags.highway === 'motorway' ||
    tags.highway === 'motorway_link'
  );
}

export function buildGraph(osmData: OsmData): RoadGraph {
  const nodeMap: Record<number, OsmNode> = {};
  for (const node of osmData.nodes) {
    nodeMap[node.id] = node;
  }

  const nodes: Record<string, GraphNode> = {};
  const adjacency: Record<string, Array<{ to: string; distance: number; wayName?: string }>> = {};
  let edgeCount = 0;

  const addNode = (osmNode: OsmNode) => {
    const id = String(osmNode.id);
    if (!nodes[id]) {
      nodes[id] = { id, lat: osmNode.lat, lng: osmNode.lon };
      adjacency[id] = [];
    }
  };

  const addEdge = (fromId: string, toId: string, dist: number, wayName?: string) => {
    adjacency[fromId].push({ to: toId, distance: dist, wayName });
    edgeCount++;
  };

  for (const way of osmData.ways) {
    const oneWay  = isOneWay(way.tags);
    const wayName = way.tags?.name;

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromOsm = nodeMap[way.nodes[i]];
      const toOsm   = nodeMap[way.nodes[i + 1]];

      if (!fromOsm || !toOsm) continue;

      addNode(fromOsm);
      addNode(toOsm);

      const fromId = String(fromOsm.id);
      const toId   = String(toOsm.id);
      const dist   = haversine(fromOsm.lat, fromOsm.lon, toOsm.lat, toOsm.lon);

      addEdge(fromId, toId, dist, wayName);
      if (!oneWay) {
        addEdge(toId, fromId, dist, wayName);
      }
    }
  }

  return {
    nodes,
    adjacency,
    nodeCount: Object.keys(nodes).length,
    edgeCount,
  };
}

export function findNearestNode(
  graph: RoadGraph,
  lat: number,
  lng: number
): string | null {
  let nearest: string | null = null;
  let minDist = Infinity;

  for (const [id, node] of Object.entries(graph.nodes)) {
    const dist = haversine(lat, lng, node.lat, node.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = id;
    }
  }

  return nearest;
}
