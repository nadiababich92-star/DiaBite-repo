-- Accounts: a profile and a diary per signed-in person.
--
-- Additive and safe to apply twice. Row-level security is on from the first line,
-- and the policies are written before any code reads these tables. `anon` has no
-- access to either table: only a signed-in person, and only to their own rows.
-- Deleting the auth user deletes every row here (on delete cascade); that is how
-- "delete my account" works.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The Profile object the app already validates (src/lib/storage.ts, sanitizeProfile).
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 20000),
  consent_at timestamptz,
  consent_version text check (consent_version is null or char_length(consent_version) <= 40),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One profile per signed-in person: diagnosis, medicine classes, kidney status, allergens, targets inputs. Own rows only; deleted with the auth user.';

create table if not exists public.diary_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The client's own id, so importing the same entry twice leaves one row.
  id text not null check (char_length(id) between 1 and 64),
  day date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id text not null check (char_length(food_id) between 1 and 80),
  grams numeric not null check (grams > 0 and grams <= 5000),
  -- The engine's numbers at the time of logging, so history does not change when a food record does.
  snapshot jsonb check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 4000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table public.diary_entries is 'The food diary of one person. Own rows only; deleted with the auth user.';

create index if not exists diary_entries_user_day_idx on public.diary_entries (user_id, day desc);

-- A signed-in person can still be a source of abuse; a diary has no business holding more than this.
create or replace function public.limit_diary_rows() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.diary_entries where user_id = new.user_id) >= 20000 then
    raise exception 'diary is full' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists diary_entries_limit on public.diary_entries;
create trigger diary_entries_limit before insert on public.diary_entries
  for each row execute function public.limit_diary_rows();

alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;

-- Supabase grants every privilege on a new public table to anon and authenticated; narrow it.
revoke all on public.profiles from anon, authenticated;
revoke all on public.diary_entries from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.diary_entries to authenticated;

-- (select auth.uid()) is evaluated once per statement rather than once per row.
drop policy if exists "Own profile: select" on public.profiles;
drop policy if exists "Own profile: insert" on public.profiles;
drop policy if exists "Own profile: update" on public.profiles;
drop policy if exists "Own profile: delete" on public.profiles;
create policy "Own profile: select" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own profile: delete" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Own diary: select" on public.diary_entries;
drop policy if exists "Own diary: insert" on public.diary_entries;
drop policy if exists "Own diary: update" on public.diary_entries;
drop policy if exists "Own diary: delete" on public.diary_entries;
create policy "Own diary: select" on public.diary_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own diary: insert" on public.diary_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own diary: update" on public.diary_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own diary: delete" on public.diary_entries for delete to authenticated using ((select auth.uid()) = user_id);

-- Feedback may now say who sent it, so the owner can answer. Still insert-only for the public,
-- and a person can only put their own id there.
alter table public.feedback add column if not exists user_id uuid references auth.users (id) on delete set null;
drop policy if exists "Public can submit feedback" on public.feedback;
create policy "Public can submit feedback" on public.feedback for insert to anon, authenticated
  with check (
    rating between 1 and 5
    and char_length(btrim(feedback)) between 1 and 1000
    and (user_id is null or user_id = (select auth.uid()))
  );
