/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Agent webhook URL. Unset in dev: Vite proxies /agent to n8n. */
  readonly VITE_AGENT_URL?: string
  /** Supabase project URL, e.g. https://<ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Publishable key (sb_publishable_…) — never the service-role key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
