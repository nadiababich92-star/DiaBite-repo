import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 *
 * Only the publishable key belongs here — it is visible to anyone who opens the
 * app, and everything it may do is decided by row-level security (for this
 * project: insert one row into public.feedback, nothing else). A service-role
 * key must never reach the frontend; Vite inlines every VITE_* value into the
 * bundle it ships.
 *
 * Both values are optional at build time: without them the app runs normally
 * and only the feedback form reports that it is not configured.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        // No login anywhere in the app, so there is no session to persist.
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export const supabaseConfigured = supabase !== null
