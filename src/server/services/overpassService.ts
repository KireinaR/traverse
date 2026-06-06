import axios, { AxiosError } from 'axios';

// Mirrors ordered by reliability; tried in sequence on any server-side error
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

export interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OsmData {
  nodes: OsmNode[];
  ways: OsmWay[];
}

// ── In-memory cache ───────────────────────────────────────────────────────────
interface CacheEntry { data: OsmData; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(minLat: number, minLng: number, maxLat: number, maxLng: number) {
  return [minLat, minLng, maxLat, maxLng].map((v) => v.toFixed(4)).join(',');
}

// ─────────────────────────────────────────────────────────────────────────────

const HIGHWAY_FILTER =
  'motorway|trunk|primary|secondary|tertiary|unclassified|residential|' +
  'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street|road';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Status codes that mean "this mirror is busy/blocked — try the next one"
const RETRYABLE = new Set([403, 429, 502, 503, 504]);

async function fetchFromMirror(url: string, query: string): Promise<any> {
  const res = await axios.post(url, `data=${encodeURIComponent(query)}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Traverse/1.0 (educational pathfinding visualizer)',
    },
    timeout: 50000,
  });
  return res.data;
}

export async function fetchRoadNetwork(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number
): Promise<OsmData> {
  // Cache hit
  const key = cacheKey(minLat, minLng, maxLat, maxLng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[overpass] cache hit ${key}`);
    return cached.data;
  }

  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:45];(way["highway"~"^(${HIGHWAY_FILTER})$"](${bbox}););(._;>;);out body;`;

  let lastStatus = 0;
  let lastMessage = 'All Overpass mirrors failed';

  for (const url of OVERPASS_MIRRORS) {
    try {
      console.log(`[overpass] → ${url}`);
      const data = await fetchFromMirror(url, query);
      const parsed = parseOsmData(data);
      cache.set(key, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
      console.log(`[overpass] ✓ ${parsed.nodes.length} nodes, ${parsed.ways.length} ways`);
      return parsed;
    } catch (err) {
      const axErr = err as AxiosError;
      const status = axErr.response?.status ?? 0;
      lastStatus = status;
      if (RETRYABLE.has(status)) {
        console.warn(`[overpass] ${url} → HTTP ${status}, trying next mirror…`);
        lastMessage =
          status === 403
            ? 'Overpass API blocked this request (HTTP 403). Trying alternate mirrors…'
            : 'Overpass API is temporarily busy. Trying alternate mirrors…';
        await sleep(600);
        continue;
      }
      // Non-retryable error (network timeout, bad query, etc.)
      const msg = axErr.code === 'ECONNABORTED'
        ? 'Road network request timed out. The selected area may be too large — try choosing points closer together.'
        : (axErr.message ?? 'Unknown error fetching road network');
      console.error(`[overpass] fatal error from ${url}: ${msg}`);
      throw new Error(msg);
    }
  }

  throw new Error(
    `${lastMessage} (last HTTP status: ${lastStatus || 'N/A'}). ` +
    'Please wait a few seconds and try again, or choose a smaller area.'
  );
}

function parseOsmData(data: any): OsmData {
  const nodes: OsmNode[] = [];
  const ways: OsmWay[] = [];
  for (const el of data.elements ?? []) {
    if (el.type === 'node') nodes.push({ id: el.id, lat: el.lat, lon: el.lon, tags: el.tags });
    else if (el.type === 'way') ways.push({ id: el.id, nodes: el.nodes, tags: el.tags });
  }
  return { nodes, ways };
}
