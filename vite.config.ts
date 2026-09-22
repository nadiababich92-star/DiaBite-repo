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
    },
  },
})
