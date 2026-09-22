/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Agent webhook URL. Unset in dev: Vite proxies /agent to n8n. */
  readonly VITE_AGENT_URL?: string
}
