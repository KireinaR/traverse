import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const UA = 'Traverse/1.0 (educational pathfinding visualizer; contact: open-source)';

function nominatimHeaders() {
  return { 'User-Agent': UA, 'Accept-Language': 'en' };
}

function handleNominatimError(err: unknown, res: Response, next: NextFunction) {
  const axErr = err as AxiosError;
  const status = axErr.response?.status;
  if (status === 403 || status === 429) {
    res.status(503).json({
      error: 'Geocoding service is temporarily unavailable. Please try again in a moment.',
    });
    return;
  }
  if (axErr.code === 'ECONNABORTED') {
    res.status(504).json({ error: 'Geocoding request timed out. Please try again.' });
    return;
  }
  next(err);
}

export async function searchLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, limit = '5' } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }

    const response = await axios.get(`${NOMINATIM_BASE}/search`, {
      params: {
        q: q.trim(),
        format: 'json',
        limit: Math.min(parseInt(limit as string, 10) || 8, 10),
        addressdetails: 1,
        namedetails: 1,
      },
      headers: nominatimHeaders(),
      timeout: 12000,
    });

    const results = response.data.map((item: any) => ({
      id: item.place_id,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
      boundingBox: item.boundingbox?.map(parseFloat),
      address: item.address,
    }));

    res.json(results);
  } catch (err) {
    handleNominatimError(err, res, next);
  }
}

export async function reverseGeocode(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      res.status(400).json({ error: 'Missing lat/lng parameters' });
      return;
    }

    const response = await axios.get(`${NOMINATIM_BASE}/reverse`, {
      params: {
        lat: parseFloat(lat as string),
        lon: parseFloat(lng as string),
        format: 'json',
        addressdetails: 1,
      },
      headers: nominatimHeaders(),
      timeout: 12000,
    });

    const item = response.data;
    if (!item || item.error) {
      // Graceful fallback — return coordinates as display name rather than 404
      res.json({ displayName: `${parseFloat(lat as string).toFixed(5)}, ${parseFloat(lng as string).toFixed(5)}` });
      return;
    }

    res.json({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.address,
    });
  } catch (err) {
    const axErr = err as AxiosError;
    // For reverse geocoding failures just return coordinates — don't break the UX
    if (axErr.response?.status === 403 || axErr.response?.status === 429 || axErr.code === 'ECONNABORTED') {
      const latVal = parseFloat(req.query.lat as string).toFixed(5);
      const lngVal = parseFloat(req.query.lng as string).toFixed(5);
      res.json({ displayName: `${latVal}, ${lngVal}` });
      return;
    }
    next(err);
  }
}
