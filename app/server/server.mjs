// Standalone sidecar server for the shipped app: serves the built frontend (dist/) plus
// the live data API (/api/stream, /api/lines) on one port. Tauri spawns this and points its
// windows at it — so the app runs with no Vite / no `npm run dev`. Same handlers as dev.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleLines, handleStream, handleHistory } from './state-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.GRANDMA_PORT) || 5600;
// dist/ location: env override (Tauri passes the bundled resource path) or ../dist next to server/.
const DIST = process.env.GRANDMA_DIST || path.resolve(__dirname, '..', 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.map': 'application/json',
};

function serveStatic(req, res) {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  let file = path.join(DIST, rel);
  // SPA fallback: anything that isn't a real asset file → index.html (hash routing)
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(DIST, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer((req, res) => {
  const url = (req.url || '').split('?')[0];
  if (url === '/api/lines') return handleLines(req, res);
  if (url === '/api/history') return handleHistory(req, res);
  if (url === '/api/stream') return handleStream(req, res);
  return serveStatic(req, res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`grandma sidecar on http://127.0.0.1:${PORT} (dist: ${DIST})`);
});
