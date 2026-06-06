import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel rewrites /api/:path* → /api and passes the captured segment as ?path=
  // Reconstruct the URL Express expects: /<path>?<remaining query params>
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('path') ?? '';
  url.searchParams.delete('path');
  req.url = `/${path}${url.search}`;
  app(req as any, res as any);
}
