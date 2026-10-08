-- Row-level security already decides which rows the public may touch. This
-- migration narrows the *kinds* of access as well, so a mistake in a policy is
-- not the only thing standing between the public key and a table.
--
-- Supabase grants every privilege on a new public table to anon and
-- authenticated by default, TRUNCATE and TRIGGER included. RLS does not govern
-- TRUNCATE, and PostgREST does not expose it, so nothing was exploitable; but
-- the day either of those facts changed, the table would have been open.
--
-- feedback is insert-only for the public. foods is read-only reference data.
-- The service role (the sync script, the owner) is unaffected.

revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to anon, authenticated;

revoke all on public.foods from anon, authenticated;
grant select on public.foods to anon, authenticated;
