import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fetchRoadNetwork } from './overpass.ts';
import { buildGraph, findNearestNode } from './graphBuilder.ts';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

// ── Graph ─────────────────────────────────────────────────────────────────────

app.get('/graph', async (c) => {
  const { minLat, minLng, maxLat, maxLng } = c.req.query();
  if (!minLat || !minLng || !maxLat || !maxLng)
    return c.json({ error: 'Missing bbox parameters: minLat, minLng, maxLat, maxLng' }, 400);

  const coords = [minLat, minLng, maxLat, maxLng].map(Number);
  if (coords.some(isNaN))
    return c.json({ error: 'Invalid bbox coordinates' }, 400);

  try {
    const osmData = await fetchRoadNetwork(...(coords as [number, number, number, number]));
    const graph = buildGraph(osmData);
    return c.json({
      nodes: graph.nodes,
      adjacency: graph.adjacency,
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
    });
  } catch (err: any) {
    const isRateLimit =
      err?.status === 429 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('rate limit'));
    return c.json({ error: err.message ?? 'Failed to fetch road network' }, isRateLimit ? 429 : 502);
  }
});

app.get('/graph/nearest', async (c) => {
  const { lat, lng, minLat, minLng, maxLat, maxLng } = c.req.query();
  if (!lat || !lng || !minLat || !minLng || !maxLat || !maxLng)
    return c.json({ error: 'Missing parameters' }, 400);

  try {
    const osmData = await fetchRoadNetwork(
      Number(minLat), Number(minLng), Number(maxLat), Number(maxLng)
    );
    const graph = buildGraph(osmData);
    const nearestId = findNearestNode(graph, Number(lat), Number(lng));
    if (!nearestId) return c.json({ error: 'No nodes found in the area' }, 404);
    return c.json({ nodeId: nearestId, node: graph.nodes[nearestId] });
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to find nearest node' }, 502);
  }
});

// ── Geocoding ─────────────────────────────────────────────────────────────────

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const UA = 'Traverse/1.0 (educational pathfinding visualizer; contact: open-source)';

app.get('/geocode/search', async (c) => {
  const { q, limit = '5' } = c.req.query();
  if (!q || q.trim().length < 2)
    return c.json({ error: 'Query must be at least 2 characters' }, 400);

  const params = new URLSearchParams({
    q: q.trim(),
    format: 'json',
    limit: String(Math.min(parseInt(limit, 10) || 8, 10)),
    addressdetails: '1',
    namedetails: '1',
  });

  try {
    const res = await fetch(`${NOMINATIM}/search?${params}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return c.json({ error: 'Geocoding service unavailable' }, 503);
    const data: any[] = await res.json();
    return c.json(data.map((item) => ({
      id: item.place_id,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
      boundingBox: item.boundingbox?.map(parseFloat),
      address: item.address,
    })));
  } catch (err: any) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Geocoding request timed out' }, 504);
    return c.json({ error: 'Geocoding service unavailable' }, 503);
  }
});

app.get('/geocode/reverse', async (c) => {
  const { lat, lng } = c.req.query();
  if (!lat || !lng) return c.json({ error: 'Missing lat/lng parameters' }, 400);

  const params = new URLSearchParams({
    lat, lon: lng, format: 'json', addressdetails: '1',
  });

  try {
    const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return c.json({ displayName: `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` });
    }
    const item: any = await res.json();
    if (!item || item.error) {
      return c.json({ displayName: `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` });
    }
    return c.json({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.address,
    });
  } catch {
    return c.json({ displayName: `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` });
  }
});

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
