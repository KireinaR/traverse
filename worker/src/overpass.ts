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

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const HIGHWAY_FILTER =
  'motorway|trunk|primary|secondary|tertiary|unclassified|residential|' +
  'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|living_street|road';

const RETRYABLE = new Set([403, 429, 502, 503, 504]);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchFromMirror(url: string, query: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Traverse/1.0 (educational pathfinding visualizer)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
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

export async function fetchRoadNetwork(
  minLat: number, minLng: number, maxLat: number, maxLng: number
): Promise<OsmData> {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:45];(way["highway"~"^(${HIGHWAY_FILTER})$"](${bbox}););(._;>;);out body;`;

  let lastStatus = 0;
  let lastMessage = 'All Overpass mirrors failed';

  for (const url of OVERPASS_MIRRORS) {
    try {
      const data = await fetchFromMirror(url, query);
      return parseOsmData(data);
    } catch (err: any) {
      const status = err.status ?? 0;
      lastStatus = status;
      if (RETRYABLE.has(status)) {
        lastMessage = status === 403
          ? 'Overpass API blocked this request. Trying alternate mirrors…'
          : 'Overpass API is temporarily busy. Trying alternate mirrors…';
        await sleep(600);
        continue;
      }
      throw new Error(err.message ?? 'Unknown error fetching road network');
    }
  }

  throw new Error(
    `${lastMessage} (last HTTP status: ${lastStatus || 'N/A'}). ` +
    'Please wait a few seconds and try again, or choose a smaller area.'
  );
}
