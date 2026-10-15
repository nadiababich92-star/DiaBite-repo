-- Where a piece of feedback came from: the form in You, or a prompt after the third meal or on a later day.
-- Free text of up to 40 characters, because the app may learn new moments; the app writes `form`,
-- `after_3_meals` or `day_2`. Rows already in the table keep null.
-- Safe to apply twice. The insert-only policy and the table-level grant on `feedback` (see
-- 20261008120000_revoke_excess_anon_grants.sql) already cover a new column, so nothing else changes.
alter table public.feedback
  add column if not exists context text
  check (context is null or char_length(context) <= 40);

comment on column public.feedback.context is 'Which moment asked for this feedback: form, after_3_meals or day_2. Null on rows from before 15 October 2026.';
