-- Public feedback from the DiaBite app. No login, so rows carry no user id.
-- Applied to the Supabase project "DiaBite-feedback" (ref qennxqfbvgqyodjmkguo).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  feedback text not null check (char_length(btrim(feedback)) between 1 and 1000),
  name text check (name is null or char_length(name) <= 100),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  created_at timestamptz not null default now()
);

comment on table public.feedback is 'Anonymous product feedback from the DiaBite app. Insert-only for the public role; reading requires a privileged key.';

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Anyone using the app may leave feedback, and nothing else. There is no
-- select/update/delete policy, so anon and authenticated cannot read back or
-- change what was submitted — only the service role (server side) can.
drop policy if exists "Public can submit feedback" on public.feedback;
create policy "Public can submit feedback"
  on public.feedback
  for insert
  to anon, authenticated
  with check (
    rating between 1 and 5
    and char_length(btrim(feedback)) between 1 and 1000
  );
