import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Strip /api prefix — Express routes are registered without it
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/';
  app(req as any, res as any);
}
