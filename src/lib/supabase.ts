import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 *
 * Only the publishable key belongs here — it is visible to anyone who opens the
 * app, and everything it may do is decided by row-level security (for this
 * project: insert into public.feedback, and read or write the signed-in
 * person's own profile and diary, nothing else). A service-role
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
        // A signed-in person keeps their session across visits. The link in the email is
        // handled in the implicit flow on purpose: the person may ask for it on a laptop
        // and tap it on a phone, which a PKCE link (bound to the browser that asked) refuses.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      })
    : null

export const supabaseConfigured = supabase !== null
