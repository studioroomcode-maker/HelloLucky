-- Hello Luck shared map: the spot (pin) of AI-confirmed finds; clover close-ups are in clover_photos.sql. No user text.
-- Apply once to a fresh Supabase project (scripts/setup_supabase.py does it).

create table if not exists public.shared_finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Reverse-geocoded by the OS (e.g. "Seoul Gangseo-gu"), never typed by the user.
  place text check (char_length(place) <= 120),
  found_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists shared_finds_geo on public.shared_finds (latitude, longitude);
create index if not exists shared_finds_user on public.shared_finds (user_id, created_at);

alter table public.shared_finds enable row level security;
-- Read policy ("read unhidden"): clover_photos.sql, which adds the hidden column it needs.
drop policy if exists "insert own" on public.shared_finds;
create policy "insert own" on public.shared_finds for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "delete own" on public.shared_finds;
create policy "delete own" on public.shared_finds for delete to authenticated using (user_id = auth.uid());
-- No update policy: a share is immutable; unshare = delete.

-- Abuse guard: at most 30 pins per account per day.
create or replace function public.limit_shares() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from shared_finds where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limit';
  end if;
  return new;
end $$;
drop trigger if exists shared_finds_limit on public.shared_finds;
create trigger shared_finds_limit before insert on public.shared_finds for each row execute function public.limit_shares();
