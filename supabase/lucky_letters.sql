-- Hello Luck: random "lucky letters" to strangers. Only curated content travels:
-- a message key, a card design, a city name and a city-level point (0.1° ≈ 11 km). No free text, no photos.
-- Letters can be thanked with a sticker and relayed onward; a relay chain remembers the cities it passed.
-- Delivery waits for a cozy moment in the recipient's time zone (15:00–15:40 or 18:00–19:00).
-- Apply after schema.sql (scripts/setup_supabase.py applies every supabase/*.sql in order). Idempotent.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

-- Everyone who opened the app recently; push_token is null until notifications are allowed.
create table if not exists public.luck_members (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  push_token text check (char_length(push_token) <= 200),
  lang text not null default 'en' check (char_length(lang) <= 10),
  last_seen timestamptz not null default now()
);
alter table public.luck_members add column if not exists tz text check (char_length(tz) <= 64);
alter table public.luck_members enable row level security;
drop policy if exists "own member row" on public.luck_members;
create policy "own member row" on public.luck_members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.lucky_letters (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users (id) on delete cascade,
  message_key smallint not null,
  card_key smallint not null,
  origin text check (char_length(origin) <= 60),
  recipient uuid references auth.users (id) on delete set null,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
-- Cards: 0–7 everyday designs, 8–9 special-day designs (src/ui/LuckCard.tsx).
alter table public.lucky_letters drop constraint if exists lucky_letters_card_key_check;
alter table public.lucky_letters add constraint lucky_letters_card_key_check check (card_key between 0 and 9);
-- Keys: 0–49 fortune lines, 1000 + 10 × category + n cheers (src/letters.ts).
alter table public.lucky_letters drop constraint if exists lucky_letters_message_key_check;
alter table public.lucky_letters add constraint lucky_letters_message_key_check
  check (message_key between 0 and 49 or message_key between 1000 and 1099);
alter table public.lucky_letters
  add column if not exists chain uuid,                       -- first letter of the relay chain
  add column if not exists hops smallint not null default 0,  -- 0 = original, n = relayed n times
  add column if not exists route jsonb not null default '[]', -- [{c: city, la: lat, lo: lng, n: sender name id}] oldest first
  add column if not exists deliver_at timestamptz,
  add column if not exists homecoming boolean not null default false,
  add column if not exists relayed_at timestamptz,
  add column if not exists thanks_key smallint check (thanks_key between 0 and 5),
  add column if not exists thanks_city text check (char_length(thanks_city) <= 60),
  add column if not exists thanked_at timestamptz,
  -- The sender's clover close-up in the public clovers bucket (<user>/<uuid>.jpg); relays carry it on.
  add column if not exists photo text check (photo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  add column if not exists thanks_seen_at timestamptz;
update public.lucky_letters set chain = id where chain is null;
create index if not exists lucky_letters_pending on public.lucky_letters (created_at) where recipient is null;
create index if not exists lucky_letters_recipient on public.lucky_letters (recipient, delivered_at);
create index if not exists lucky_letters_sender on public.lucky_letters (sender, created_at);
create index if not exists lucky_letters_due on public.lucky_letters (deliver_at) where delivered_at is null and recipient is not null;
create index if not exists lucky_letters_chain on public.lucky_letters (chain);
alter table public.lucky_letters enable row level security;
drop policy if exists "see own letters" on public.lucky_letters;
-- Recipients see a letter only once it has arrived.
create policy "see own letters" on public.lucky_letters for select to authenticated
  using (sender = auth.uid() or (recipient = auth.uid() and delivered_at is not null));
-- No insert/update policies: letters move only through the functions below.

create or replace function public.push(p_token text, p_title text, p_body text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('to', p_token, 'sound', 'default', 'channelId', 'luck',
                               'title', p_title, 'body', p_body, 'data', p_data)
  );
end $$;

create or replace function public.notify_letter(p_letter uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select lm.push_token, lm.lang, l.homecoming, l.hops into m
    from lucky_letters l join luck_members lm on lm.user_id = l.recipient where l.id = p_letter;
  if m.homecoming then
    perform push(m.push_token,
      case when m.lang = 'ko' then '🎉 내가 보낸 행운이 돌아왔어요!' else '🎉 Your luck came back to you!' end,
      case when m.lang = 'ko' then m.hops || '명을 거쳐 다시 나에게 왔어요' else 'It traveled through ' || m.hops || ' people and found its way home' end,
      jsonb_build_object('letter', p_letter));
  else
    perform push(m.push_token,
      case when m.lang = 'ko' then '🍀 우연히 행운이 도착했어요!' else '🍀 Some luck just found you!' end,
      case when m.lang = 'ko' then '누군가 보낸 응원을 열어보세요' else 'Open the luck a stranger sent you' end,
      jsonb_build_object('letter', p_letter));
  end if;
end $$;

-- Next cozy moment in a time zone: 15:00–15:40 or 18:00–19:00 local; soon if we're inside one.
create or replace function public.cozy_time(p_tz text) returns timestamptz
language plpgsql volatile set search_path = public as $$
declare
  zone text := coalesce((select name from pg_timezone_names where name = p_tz), 'UTC');
  local_now timestamp := now() at time zone zone;
  today date := local_now::date;
  t timestamp;
begin
  if local_now::time between '15:00' and '15:35' or local_now::time between '18:00' and '18:55' then
    t := local_now + make_interval(mins => 1 + floor(random() * 5)::int);
  elsif local_now::time < '15:00' then
    t := today + time '15:00' + make_interval(mins => floor(random() * 40)::int);
  elsif local_now::time < '18:00' then
    t := today + time '18:00' + make_interval(mins => floor(random() * 60)::int);
  else
    t := today + 1 + time '15:00' + make_interval(mins => floor(random() * 40)::int);
  end if;
  return t at time zone zone;
end $$;

-- Busy = got a letter in the last day, or has one on its way.
create or replace function public.is_free(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from lucky_letters l where l.recipient = p_user
                       and (l.delivered_at is null or l.delivered_at > now() - interval '1 day'))
$$;

-- A random recent member (not the sender) who is free.
create or replace function public.pick_recipient(p_exclude uuid) returns uuid
language sql security definer set search_path = public as $$
  select lm.user_id from luck_members lm
   where lm.user_id <> p_exclude and lm.last_seen > now() - interval '30 days' and is_free(lm.user_id)
   order by random() limit 1
$$;

-- Chance that a relay goes home to the chain's starter: 15% at 4 hops, ×0.8 per extra hop, halved per earlier homecoming.
create or replace function public.homecoming_chance(p_hops int, p_homes int) returns double precision
language sql immutable as $$
  select case when p_hops < 4 then 0 else 0.15 * power(0.8, p_hops - 4) * power(0.5, p_homes) end
$$;

drop function if exists public.send_lucky_letter(smallint, smallint, text);
-- p_nick: the sender's name id (src/nicknames.ts, 0–2499); old apps leave it out.
drop function if exists public.send_lucky_letter(smallint, smallint, text, double precision, double precision, uuid);
-- p_photo: my clover close-up already uploaded to clovers/<me>/…; a relay keeps its parent's.
drop function if exists public.send_lucky_letter(smallint, smallint, text, double precision, double precision, uuid, smallint);
create or replace function public.send_lucky_letter(p_message smallint, p_card smallint, p_origin text,
  p_lat double precision default null, p_lng double precision default null, p_parent uuid default null,
  p_nick smallint default null, p_photo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  parent lucky_letters;
  letter uuid := gen_random_uuid();
  hop jsonb := jsonb_strip_nulls(jsonb_build_object('c', left(p_origin, 60),
    'la', round(p_lat::numeric, 1), 'lo', round(p_lng::numeric, 1),
    'n', case when p_nick between 0 and 2499 then p_nick end));
  v_chain uuid; v_hops smallint := 0; v_route jsonb; v_message smallint := p_message; v_card smallint := p_card;
  root uuid; target uuid; home boolean := false; tz text;
  v_photo text := case when p_photo like auth.uid()::text || '/%' then p_photo end;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from lucky_letters where sender = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limit';
  end if;
  if p_parent is null then
    v_chain := letter;
    v_route := jsonb_build_array(hop);
  else
    -- Relay: the same card travels on, adding this city to its route.
    select * into parent from lucky_letters where id = p_parent and recipient = me and delivered_at is not null for update;
    if parent.id is null then raise exception 'not_your_letter'; end if;
    if parent.relayed_at is not null then raise exception 'already_relayed'; end if;
    update lucky_letters set relayed_at = now() where id = parent.id;
    v_chain := parent.chain; v_hops := parent.hops + 1; v_message := parent.message_key; v_card := parent.card_key;
    v_route := parent.route || hop;
    v_photo := coalesce(v_photo, parent.photo);
    if jsonb_array_length(v_route) > 30 then v_route := v_route - 1; end if;
  end if;
  -- After 4+ hops a chain sometimes finds its way home to whoever started it (rarer the further it goes).
  select sender into root from lucky_letters where id = v_chain;
  if root <> me and random() < homecoming_chance(v_hops, (select count(*)::int from lucky_letters where chain = v_chain and homecoming))
     and is_free(root)
     and exists (select 1 from luck_members where user_id = root and last_seen > now() - interval '30 days') then
    target := root; home := true;
  else
    target := pick_recipient(me);
  end if;
  select lm.tz into tz from luck_members lm where lm.user_id = target;
  insert into lucky_letters (id, sender, message_key, card_key, origin, recipient, deliver_at, chain, hops, route, homecoming, photo)
  values (letter, me, v_message, v_card, left(p_origin, 60), target,
          case when target is null then null else cozy_time(tz) end, v_chain, v_hops, v_route, home, v_photo);
  return letter;
end $$;

-- Every 5 minutes: hand over letters whose cozy moment has come.
create or replace function public.deliver_due() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in update lucky_letters set delivered_at = now()
            where delivered_at is null and recipient is not null and deliver_at <= now() returning id loop
    perform notify_letter(r.id);
  end loop;
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'deliver-lucky-letters';
select cron.schedule('deliver-lucky-letters', '*/5 * * * *', 'select public.deliver_due()');

-- Called on app open: refresh presence, adopt one waiting letter if free, return arrived unopened mail.
drop function if exists public.check_mailbox(text);
create or replace function public.check_mailbox(p_lang text, p_tz text default null) returns setof public.lucky_letters
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); waiting uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  insert into luck_members (user_id, lang, tz, last_seen) values (me, left(p_lang, 10), left(p_tz, 64), now())
  on conflict (user_id) do update set lang = excluded.lang, tz = coalesce(excluded.tz, luck_members.tz), last_seen = now();
  if is_free(me) then
    select id into waiting from lucky_letters
     where recipient is null and sender <> me order by created_at limit 1 for update skip locked;
    if waiting is not null then
      update lucky_letters set recipient = me, delivered_at = now(), deliver_at = now() where id = waiting;
    end if;
  end if;
  return query select * from lucky_letters
    where recipient = me and delivered_at is not null and opened_at is null order by delivered_at;
end $$;

create or replace function public.open_letter(p_letter uuid) returns void
language sql security definer set search_path = public as $$
  update lucky_letters set opened_at = now()
   where id = p_letter and recipient = auth.uid() and delivered_at is not null and opened_at is null
$$;

-- A sticker back to whoever sent it (once per letter).
create or replace function public.thank_letter(p_letter uuid, p_sticker smallint, p_city text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  update lucky_letters set thanks_key = p_sticker, thanks_city = left(p_city, 60), thanked_at = now()
   where id = p_letter and recipient = auth.uid() and delivered_at is not null and thanked_at is null
   returning sender into s;
  if s.sender is null then return; end if;
  perform push(lm.push_token,
    case when lm.lang = 'ko' then '💚 누군가 당신의 행운에 고마워해요' else '💚 Someone is grateful for your luck' end,
    case when lm.lang = 'ko' then '앱에서 고마움 스티커를 확인해 보세요' else 'Open the app to see their thank-you' end,
    jsonb_build_object('thanks', p_letter))
  from luck_members lm where lm.user_id = s.sender;
end $$;

-- Thank-yous for my letters not shown yet; marks them seen.
create or replace function public.my_thanks() returns table (letter uuid, message_key smallint, card_key smallint,
  thanks_key smallint, thanks_city text)
language sql security definer set search_path = public as $$
  with seen as (
    update lucky_letters l set thanks_seen_at = now()
     where l.sender = auth.uid() and l.thanked_at is not null and l.thanks_seen_at is null
     returning l.id, l.message_key, l.card_key, l.thanks_key, l.thanks_city)
  select * from seen
$$;

create or replace function public.set_push_token(p_token text, p_lang text) returns void
language sql security definer set search_path = public as $$
  insert into luck_members (user_id, push_token, lang, last_seen) values (auth.uid(), p_token, left(p_lang, 10), now())
  on conflict (user_id) do update set push_token = excluded.push_token, lang = excluded.lang, last_seen = now()
$$;

-- Letters that reached me, newest first (the keepsake box).
drop function if exists public.my_letters();
create or replace function public.my_letters() returns table (letter uuid, message_key smallint, card_key smallint,
  origin text, hops smallint, route jsonb, homecoming boolean, delivered_at timestamptz, relayed boolean, thanked boolean, photo text)
language sql stable security definer set search_path = public as $$
  select id, message_key, card_key, origin, hops, route, homecoming, delivered_at, relayed_at is not null, thanked_at is not null, photo
    from lucky_letters where recipient = auth.uid() and delivered_at is not null
   order by delivered_at desc limit 200
$$;

-- Every chain I sent or relayed into: how far it has gone (only city-level points, never who).
create or replace function public.my_journeys() returns table (chain uuid, message_key smallint, card_key smallint,
  hops smallint, route jsonb, came_home boolean, started_by_me boolean, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  with mine as (select distinct l.chain from lucky_letters l where l.sender = auth.uid())
  select distinct on (l.chain) l.chain, l.message_key, l.card_key, l.hops, l.route,
         exists (select 1 from lucky_letters h where h.chain = l.chain and h.homecoming and h.recipient = auth.uid()),
         (select r.sender = auth.uid() from lucky_letters r where r.id = l.chain),
         l.created_at
    from lucky_letters l join mine using (chain)
   order by l.chain, l.hops desc, l.created_at desc
$$;

-- How many people my luck has reached: every delivery in my chains from my first letter in each onward.
create or replace function public.my_echo() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from lucky_letters l
    join (select chain, min(created_at) as since from lucky_letters where sender = auth.uid() group by chain) m
      on l.chain = m.chain and l.created_at >= m.since
   where l.delivered_at is not null and l.recipient is distinct from auth.uid()
$$;

-- Letters sent anywhere in the last 24 hours: a number only, for "luck in the world today".
create or replace function public.luck_today() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from lucky_letters where created_at > now() - interval '1 day'
$$;

revoke execute on function public.notify_letter(uuid), public.pick_recipient(uuid), public.push(text, text, text, jsonb),
  public.deliver_due(), public.is_free(uuid), public.cozy_time(text) from public, anon, authenticated;
grant execute on function public.send_lucky_letter(smallint, smallint, text, double precision, double precision, uuid, smallint, text),
  public.check_mailbox(text, text), public.open_letter(uuid), public.thank_letter(uuid, smallint, text),
  public.my_thanks(), public.my_letters(), public.my_journeys(), public.my_echo(), public.luck_today(), public.set_push_token(text, text) to authenticated;
