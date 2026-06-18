import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleLines, handleStream, handleHistory } from './server/state-api.mjs';

// Dev server uses the SAME data-seam handlers as the standalone sidecar (server.mjs),
// so behavior is identical in dev and in the shipped app.
function grandmaState() {
  return {
    name: 'grandma-state',
    configureServer(server) {
      server.middlewares.use('/api/lines', handleLines);
      server.middlewares.use('/api/history', handleHistory);
      server.middlewares.use('/api/stream', handleStream);
    },
  };
}

export default defineConfig({
  plugins: [react(), grandmaState()],
  server: { port: 5599, open: false },
});
