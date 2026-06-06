// Production entry point — run after `npm run build`.
// Serves the Vite-built frontend from dist/ and the API on /api.
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApp } from './server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const host = express();
host.use('/api', createApp());
host.use(express.static(join(__dirname, '../dist')));
host.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

host.listen(PORT, () => {
  console.log(`Traverse running on http://localhost:${PORT}`);
});
