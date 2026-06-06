import { RoadGraph, LatLng } from '../types';

export function findNearestNode(graph: RoadGraph, point: LatLng): string | null {
  let nearest: string | null = null;
  let minDist = Infinity;

  for (const [id, node] of Object.entries(graph.nodes)) {
    const dlat = node.lat - point.lat;
    const dlng = node.lng - point.lng;
    const d = dlat * dlat + dlng * dlng; // squared Euclidean (fast enough for nearest-node)
    if (d < minDist) {
      minDist = d;
      nearest = id;
    }
  }

  return nearest;
}

export function getBoundingBox(
  p1: LatLng,
  p2: LatLng,
): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const latSpan = Math.abs(p1.lat - p2.lat);
  const lngSpan = Math.abs(p1.lng - p2.lng);
  // At least 0.02° (~2 km) per side; also 30% of the direct span so detours/bridges never fall outside
  const padding = Math.max(0.02, Math.max(latSpan, lngSpan) * 0.3);
  return {
    minLat: Math.min(p1.lat, p2.lat) - padding,
    minLng: Math.min(p1.lng, p2.lng) - padding,
    maxLat: Math.max(p1.lat, p2.lat) + padding,
    maxLng: Math.max(p1.lng, p2.lng) + padding,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(meters: number, speedKmh = 50): string {
  const hours = meters / 1000 / speedKmh;
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
