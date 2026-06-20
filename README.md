# TRAVERSE

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)

**Traverse** is an interactive real-world pathfinding visualizer. Pick any two points on a live OpenStreetMap, choose an algorithm, and watch it explore the actual road network in real time.

![Explored using A* search algorithm and viewed the shortest route.](asset/ss1.png)

---

## Features

- **6 algorithms** — Dijkstra, A\*, BFS, Greedy Best-First, Bidirectional Dijkstra, Bidirectional A\*
- **Compare mode** — run all six algorithms side-by-side with live stats
- **Real road data** — fetched from OpenStreetMap via the Overpass API
- **Geocoding** — search for any location by name (Nominatim)
- **Auto-locate** — centers the map on your city on load (see [Privacy Policy](./PRIVACY.md))
- **Playback controls** — play, pause, stop, reset, and 6 speed levels (including instant)
- **Light / dark mode**
- **Drag-and-drop** A/B pins directly on the map

---

## Quick start

### Prerequisites

- Node.js 20+
- npm 9+

### Install

```bash
npm install
```

### Environment variables

The frontend talks to a Cloudflare Worker API (see [Architecture](#architecture)), not a local backend. Copy the example file and fill in your worker's URL and API key:

```bash
cp .env.example .env
```

```
VITE_API_BASE=https://your-worker.workers.dev
VITE_API_KEY=your-worker-api-key
```

To stand up your own worker, see [`worker/README`](#worker-cloudflare-api) below.

### Run (development)

```bash
npm run dev
```

Open **http://localhost:5173**

### Production build

```bash
npm run build   # type-check + Vite bundle → dist/
```

Deploy the `dist/` output to any static host (the project is configured for Vercel via `vercel.json`).

---

## Usage

1. **Search** or click the map to set a start point (A).
2. **Search** or click again to set an end point (B).
3. **Choose an algorithm** from the dropdown.
4. Click **Visualize** — Traverse fetches the road network and starts the animation.
5. Use **Pause / Resume / Stop / Reset** and the speed controls to explore at your own pace.
6. Switch to **Compare mode** to run all six algorithms simultaneously and compare node counts, path lengths, and execution times.

---

## Algorithms

| Algorithm | Shortest path | Uses weights | Heuristic |
|---|---|---|---|
| Dijkstra | ✓ | ✓ | — |
| A\* | ✓ | ✓ | Haversine to goal |
| BFS | ✗ (fewest hops) | ✗ | — |
| Greedy Best-First | ✗ | ✗ | Haversine to goal |
| Bidirectional Dijkstra | ✓ | ✓ | — |
| Bidirectional A\* | ✓ | ✓ | Haversine (both ends) |

---

## Architecture

```
traverse/
├── src/
│   ├── algorithms/          # All 6 algorithm implementations (client-side)
│   ├── components/
│   │   ├── Map/MapView.tsx  # Leaflet map + canvas visualization engine
│   │   └── UI/              # TopBar, Sidebar, InfoPanel, controls
│   ├── context/
│   │   └── AppContext.tsx   # Global state (useReducer)
│   ├── lib/
│   │   ├── algorithmMeta.ts # Metadata, descriptions, pseudocode for all algos
│   │   └── graphUtils.ts    # Bounding box, nearest-node, haversine
│   ├── services/api.ts      # Calls the Cloudflare Worker API
│   └── types/index.ts       # Shared TypeScript types
├── worker/                  # Cloudflare Worker API (Hono) — see below
└── package.json
```

### How it works

1. **Map click / search** — sets A and B markers on the Leaflet map.
2. **Visualize** — frontend requests the road graph for the bounding box from the Cloudflare Worker API.
3. **Worker** — queries the [Overpass API](https://overpass-api.de/) for OSM road ways, builds a weighted adjacency graph (edge weights = haversine distance in metres).
4. **Algorithm** — runs synchronously on the client, producing a `VisualizationStep[]` array.
5. **Animation** — a `requestAnimationFrame` loop steps through frames at the chosen speed, drawing coloured polylines on a `<canvas>` overlay above the Leaflet map.

### Worker (Cloudflare API)

The backend is a [Hono](https://hono.dev/) app running on Cloudflare Workers (`worker/`), exposing:

| Route | Purpose |
|---|---|
| `GET /graph` | Builds and returns the road graph for a bounding box |
| `GET /graph/nearest` | Finds the nearest graph node to a coordinate |
| `GET /geocode/search` | Proxies Nominatim place search |
| `GET /geocode/reverse` | Proxies Nominatim reverse geocoding |
| `GET /health` | Health check |

Every request must include an `X-API-Key` header matching the worker's `API_KEY` secret, or it's rejected with `401`.

To run/deploy your own:

```bash
cd worker
npm install
npm run dev      # local dev via Wrangler
npx wrangler secret put API_KEY   # set your API key (prompted)
npm run deploy   # deploy to Cloudflare
```

> Note: the API key is exposed in the frontend's compiled JS bundle (Vite env vars are inlined at build time), so it only deters casual abuse of the worker URL — it is not a substitute for proper auth on sensitive endpoints.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Map | Leaflet.js, OpenStreetMap / CARTO tiles |
| Canvas | HTML5 Canvas (direct 2D drawing, no library) |
| API | Cloudflare Workers, Hono |
| Road data | Overpass API (OpenStreetMap) |
| Geocoding | Nominatim (OpenStreetMap) |
| State | React `useReducer` |
| Styling | Pure CSS custom properties (no framework) |

---

## Privacy

Traverse asks for your location on load only to center the map on your city — nothing is stored or sent anywhere. See [PRIVACY.md](./PRIVACY.md) for the full policy.

---

## License

[MIT](./LICENSE) © Ujaan Mukherjee
