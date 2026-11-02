import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The agent runs in Azure Foundry, behind /agent/ask on the engine's Container
// App. In dev, /agent is proxied there so the browser never deals with CORS.
// Point AGENT_WEBHOOK at http://localhost:8787/agent/ask to run against a local
// engine instead.
const AGENT_WEBHOOK =
  process.env.AGENT_WEBHOOK ??
  'https://diabite-engine.greenglacier-ab5551c6.swedencentral.azurecontainerapps.io/agent/ask'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/agent': { target: new URL(AGENT_WEBHOOK).origin, changeOrigin: true, rewrite: () => new URL(AGENT_WEBHOOK).pathname },
      '/meal': { target: new URL(AGENT_WEBHOOK).origin, changeOrigin: true },
      // Not proxied: in development the app talks to the deployed engine, and "Delete my account" must not delete a real
      // account from a laptop. Unanswered, Vite returned index.html with 200 and the app reported the deletion done.
      '/account': {
        target: new URL(AGENT_WEBHOOK).origin,
        bypass: (_req, res) => { res!.statusCode = 501; res!.setHeader('content-type', 'application/json'); res!.end(JSON.stringify({ error: 'not_in_development' })); return false },
      },
    },
  },
})
