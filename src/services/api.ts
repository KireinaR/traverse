import { RoadGraph, SearchResult } from '../types';

const BASE = 'https://traverse-api.mris.workers.dev';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = body.error || `HTTP ${res.status}`;
    if (res.status === 429) {
      throw new Error(
        'The OpenStreetMap road-network API is temporarily rate-limited. ' +
        'Please wait 10–15 seconds and try again.'
      );
    }
    throw new Error(message);
  }
  return res.json();
}

// ── Request deduplication for graph fetches ──────────────────────────────────��
// If two Visualize clicks happen for the same bbox before the first resolves,
// they share a single in-flight promise rather than making two Overpass calls.
const inFlight = new Map<string, Promise<RoadGraph>>();

export async function fetchGraph(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number
): Promise<RoadGraph> {
  const key = [minLat, minLng, maxLat, maxLng].map((v) => v.toFixed(5)).join(',');
  const existing = inFlight.get(key);
  if (existing) return existing;

  const url = `${BASE}/graph?minLat=${minLat}&minLng=${minLng}&maxLat=${maxLat}&maxLng=${maxLng}`;
  const promise = fetchJSON<RoadGraph>(url).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export async function searchLocations(query: string): Promise<SearchResult[]> {
  const url = `${BASE}/geocode/search?q=${encodeURIComponent(query)}&limit=5`;
  return fetchJSON<SearchResult[]>(url);
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ displayName: string }> {
  const url = `${BASE}/geocode/reverse?lat=${lat}&lng=${lng}`;
  return fetchJSON<{ displayName: string }>(url);
}
