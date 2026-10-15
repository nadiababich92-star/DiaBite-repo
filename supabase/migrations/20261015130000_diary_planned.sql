-- A meal can be planned for a day instead of eaten. A planned meal lives in the diary and counts nowhere (not in the
-- day's budget, not in the in-range days) until the person marks it eaten, which sets this back to false.
-- Existing rows become false, that is eaten, which is what they all are.
-- Safe to apply twice. Row-level security is on rows, not columns, so the proof in docs/security/security-plan.md still
-- holds; no policy changes. No check on `day`: a diary imported from an older device holds legitimate rows older than the
-- 14-day limit the app applies to new ones.
alter table public.diary_entries
  add column if not exists planned boolean not null default false;

comment on column public.diary_entries.planned is 'True for a meal planned for the day and not yet eaten; it counts nowhere until it is marked eaten.';
