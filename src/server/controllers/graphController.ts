import { Request, Response, NextFunction } from 'express';
import { fetchRoadNetwork } from '../services/overpassService';
import { buildGraph, findNearestNode } from '../services/graphBuilder';

export async function getGraph(req: Request, res: Response, next: NextFunction) {
  try {
    const { minLat, minLng, maxLat, maxLng } = req.query;

    if (!minLat || !minLng || !maxLat || !maxLng) {
      res.status(400).json({ error: 'Missing bbox parameters: minLat, minLng, maxLat, maxLng' });
      return;
    }

    const min_lat = parseFloat(minLat as string);
    const min_lng = parseFloat(minLng as string);
    const max_lat = parseFloat(maxLat as string);
    const max_lng = parseFloat(maxLng as string);

    if ([min_lat, min_lng, max_lat, max_lng].some(isNaN)) {
      res.status(400).json({ error: 'Invalid bbox coordinates' });
      return;
    }

    const osmData = await fetchRoadNetwork(min_lat, min_lng, max_lat, max_lng);
    const graph = buildGraph(osmData);

    res.json({
      nodes: graph.nodes,
      adjacency: graph.adjacency,
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
    });
  } catch (err: any) {
    // Surface rate-limit errors as 429 so the frontend can show the right message
    if (
      err?.response?.status === 429 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('rate limit'))
    ) {
      const e: any = new Error(
        'The OpenStreetMap road-network API is temporarily rate-limited. ' +
        'Please wait 10–15 seconds and try again.'
      );
      e.statusCode = 429;
      return next(e);
    }
    next(err);
  }
}

export async function getNearestNode(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng, minLat, minLng, maxLat, maxLng } = req.query;

    if (!lat || !lng || !minLat || !minLng || !maxLat || !maxLng) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    const point_lat = parseFloat(lat as string);
    const point_lng = parseFloat(lng as string);
    const min_lat = parseFloat(minLat as string);
    const min_lng = parseFloat(minLng as string);
    const max_lat = parseFloat(maxLat as string);
    const max_lng = parseFloat(maxLng as string);

    const osmData = await fetchRoadNetwork(min_lat, min_lng, max_lat, max_lng);
    const graph = buildGraph(osmData);
    const nearestId = findNearestNode(graph, point_lat, point_lng);

    if (!nearestId) {
      res.status(404).json({ error: 'No nodes found in the area' });
      return;
    }

    res.json({ nodeId: nearestId, node: graph.nodes[nearestId] });
  } catch (err) {
    next(err);
  }
}
