import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { getGraph, getNearestNode } from './server/controllers/graphController';
import { searchLocation, reverseGeocode } from './server/controllers/geocodingController';
import { errorHandler } from './server/middleware/errorHandler';

// Returns a configured Express app mounted at /api by the caller (Vite dev or start.ts).
export function createApp() {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      message: { error: 'Too many requests, please try again in a minute.' },
    })
  );

  const graphRouter = Router();
  graphRouter.get('/', getGraph);
  graphRouter.get('/nearest', getNearestNode);
  app.use('/graph', graphRouter);

  const geocodingRouter = Router();
  geocodingRouter.get('/search', searchLocation);
  geocodingRouter.get('/reverse', reverseGeocode);
  app.use('/geocode', geocodingRouter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(errorHandler);

  return app;
}
