import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The agent lives in n8n Cloud. In dev, /agent is proxied there so the browser
// never deals with CORS. The workflow is published, so the production URL is
// the default; the test URL (/webhook-test/diabite) answers once per "Execute workflow".
const AGENT_WEBHOOK = process.env.AGENT_WEBHOOK ?? 'https://n-babich.app.n8n.cloud/webhook/diabite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/agent': { target: new URL(AGENT_WEBHOOK).origin, changeOrigin: true, rewrite: () => new URL(AGENT_WEBHOOK).pathname },
    },
  },
})
