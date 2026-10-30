-- 2026-10-31 security hardening for the live project (supabase/*.sql already hold the same; this is the delta).
-- Apply once: Supabase dashboard → SQL Editor → paste this whole file → Run (or psql -f). Safe to re-run.
begin;

-- A reported pin leaves everyone else's map, so its photo URL (<user_id>/<id>.jpg) can no longer be looked up.
drop policy if exists "read all" on public.shared_finds;
drop policy if exists "read unhidden" on public.shared_finds;
create policy "read unhidden" on public.shared_finds for select using (not hidden or user_id = (select auth.uid()));

-- Abuse guard: 40 uploads a day per install (30 pins + 6 letters fit), so one account can't fill the storage quota.
drop policy if exists "clovers insert own" on storage.objects;
create policy "clovers insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'clovers' and (storage.foldername(name))[1] = auth.uid()::text
    and (select count(*) from storage.objects o where o.bucket_id = 'clovers'
           and o.name like auth.uid()::text || '/%' and o.created_at > now() - interval '1 day') < 40);

create or replace function public.report_find(p_find uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  insert into find_reports (find_id, reporter) values (p_find, auth.uid()) on conflict do nothing;
  -- Only accounts at least 3 days old count, so three fresh anonymous installs can't hide someone's pin.
  if (select count(*) from find_reports r join auth.users u on u.id = r.reporter
       where r.find_id = p_find and u.created_at < now() - interval '3 days') >= 3 then
    update shared_finds set hidden = true where id = p_find;
  end if;
end $$;

-- No policies: letters are read and moved only through the functions below, so neither side ever sees the other's
-- user id (which would point to their exact pins on the public shared_finds map).
drop policy if exists "see own letters" on public.lucky_letters;

-- Report & block (Apple guideline 1.2), written only by report_letter(): reports stay for the operator to review
-- (Table Editor), blocks keep the reported sender's letters away from the reporter.
create table if not exists public.letter_reports (
  letter uuid not null references public.lucky_letters (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (letter, reporter)
);
alter table public.letter_reports enable row level security;
create table if not exists public.letter_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.letter_blocks enable row level security;

-- A city name from the OS geocoder, or null: the app has no free text, so drop anything shaped like a link,
-- handle, phone number or email (digits, @, /, :, "x.com") before it reaches a stranger or a push.
create or replace function public.place_name(p text) returns text
language sql immutable set search_path = public as $$
  select case when p !~ '[[:digit:]@/:]|\.[[:alpha:]]' then left(p, 60) end
$$;

-- A random recent member (not the sender, nor anyone who blocked the sender) who is free.
create or replace function public.pick_recipient(p_exclude uuid) returns uuid
language sql security definer set search_path = public as $$
  select lm.user_id from luck_members lm
   where lm.user_id <> p_exclude and lm.last_seen > now() - interval '30 days' and is_free(lm.user_id)
     and not exists (select 1 from letter_blocks b where b.blocker = lm.user_id and b.blocked = p_exclude)
   order by random() limit 1
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
  v_origin text := place_name(p_origin);
  hop jsonb := jsonb_strip_nulls(jsonb_build_object('c', v_origin,
    'la', round(p_lat::numeric, 1), 'lo', round(p_lng::numeric, 1),
    'n', case when p_nick between 0 and 2499 then p_nick end));
  v_chain uuid; v_hops smallint := 0; v_route jsonb; v_message smallint := p_message; v_card smallint := p_card;
  root uuid; target uuid; home boolean := false; tz text;
  v_photo text := case when p_photo like auth.uid()::text || '/%' then p_photo end;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  -- My own finds: the app sends each find once, so a find is never held back by a relay; 5 a day only stops abuse.
  -- Relays: one a day keeps each pass-on special. hops > 0 marks a relay.
  if (select count(*) from lucky_letters where sender = me and created_at > now() - interval '1 day'
        and (hops > 0) = (p_parent is not null)) >= (case when p_parent is null then 5 else 1 end) then
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
    v_photo := parent.photo;
    if jsonb_array_length(v_route) > 30 then v_route := v_route - 1; end if;
  end if;
  -- After 4+ hops a chain sometimes finds its way home to whoever started it (rarer the further it goes).
  select sender into root from lucky_letters where id = v_chain;
  if root <> me and random() < homecoming_chance(v_hops, (select count(*)::int from lucky_letters where chain = v_chain and homecoming))
     and is_free(root)
     and not exists (select 1 from letter_blocks b where b.blocker = root and b.blocked = me)
     and exists (select 1 from luck_members where user_id = root and last_seen > now() - interval '30 days') then
    target := root; home := true;
  else
    target := pick_recipient(me);
  end if;
  select lm.tz into tz from luck_members lm where lm.user_id = target;
  insert into lucky_letters (id, sender, message_key, card_key, origin, recipient, deliver_at, chain, hops, route, homecoming, photo)
  values (letter, me, v_message, v_card, v_origin, target,
          case when target is null then null else cozy_time(tz) end, v_chain, v_hops, v_route, home, v_photo);
  -- A relay tells whoever started the chain and whoever passed it to me that their luck moved on, so the loop is felt
  -- long before (or without) a homecoming. A starter it is heading home to gets the homecoming push instead.
  if p_parent is not null then
    perform push(lm.push_token,
      case when lm.lang = 'ko' then '✈️ 내 행운이 여행 중이에요' else '✈️ Your luck is traveling' end,
      case when lm.lang = 'ko' then coalesce(v_origin || '에서 ', '') || '다음 사람에게 떠났어요'
           when v_origin is null then 'It just moved on to the next person'
           else 'It just left ' || v_origin || ' for the next person' end,
      jsonb_build_object('journey', v_chain))
    from luck_members lm
    where lm.user_id in (root, parent.sender) and lm.user_id <> me and not (home and lm.user_id = root);
  end if;
  return letter;
end $$;

-- Called on app open: refresh presence, adopt one waiting letter if free, return arrived unopened mail.
drop function if exists public.check_mailbox(text);
create or replace function public.check_mailbox(p_lang text, p_tz text default null) returns setof public.lucky_letters
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); waiting uuid; own uuid := gen_random_uuid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  insert into luck_members (user_id, lang, tz, last_seen) values (me, left(p_lang, 10), left(p_tz, 64), now())
  on conflict (user_id) do update set lang = excluded.lang, tz = coalesce(excluded.tz, luck_members.tz), last_seen = now();
  if is_free(me) then
    select id into waiting from lucky_letters
     where recipient is null and sender <> me
       and not exists (select 1 from letter_blocks b where b.blocker = me and b.blocked = sender)
     order by created_at limit 1 for update skip locked;
    if waiting is not null then
      update lucky_letters set recipient = me, delivered_at = now(), deliver_at = now() where id = waiting;
    end if;
  end if;
  -- Nobody wrote for 15 days (or ever, for someone new): Hello Luck sends a general cheer (keys 1040–1049, topic 4)
  -- at the next cozy moment, so the mailbox never goes quiet while there are few senders. Marked from_app, not a stranger.
  if is_free(me) and not exists (select 1 from lucky_letters where recipient = me and delivered_at > now() - interval '15 days') then
    insert into lucky_letters (id, sender, from_app, message_key, card_key, recipient, deliver_at, chain)
    values (own, null, true, 1040 + floor(random() * 10)::int, floor(random() * 8)::int, me,
            cozy_time((select lm.tz from luck_members lm where lm.user_id = me)), own);
  end if;
  -- Without sender/recipient ids: a stranger stays a stranger.
  return query select r.* from lucky_letters l, jsonb_populate_record(l, '{"sender": null, "recipient": null}') r
    where l.recipient = me and l.delivered_at is not null and l.opened_at is null order by l.delivered_at;
end $$;

-- A sticker back to whoever sent it (once per letter).
create or replace function public.thank_letter(p_letter uuid, p_sticker smallint, p_city text default null) returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  update lucky_letters set thanks_key = p_sticker, thanks_city = place_name(p_city), thanked_at = now()
   where id = p_letter and recipient = auth.uid() and delivered_at is not null and thanked_at is null
   returning sender into s;
  if s.sender is null then return; end if;
  perform push(lm.push_token,
    case when lm.lang = 'ko' then '💚 누군가 당신의 행운에 고마워해요' else '💚 Someone is grateful for your luck' end,
    case when lm.lang = 'ko' then '앱에서 고마움 스티커를 확인해 보세요' else 'Open the app to see their thank-you' end,
    jsonb_build_object('thanks', p_letter))
  from luck_members lm where lm.user_id = s.sender;
end $$;

-- Report a letter that reached me: blocks its sender and the clover's owner for me (their letters, relays and
-- homecomings skip me from now on), takes that clover photo off every letter, and drops the letter from my box.
-- The photo file stays in storage for the operator to review and delete (dashboard → Storage → clovers).
create or replace function public.report_letter(p_letter uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l lucky_letters;
begin
  select * into l from lucky_letters where id = p_letter and recipient = me and delivered_at is not null;
  if l.id is null then raise exception 'not_your_letter'; end if;
  insert into letter_reports (letter, reporter) values (l.id, me) on conflict do nothing;
  insert into letter_blocks (blocker, blocked)
  select me, u.id from auth.users u where u.id in (l.sender, split_part(l.photo, '/', 1)::uuid) and u.id <> me
  on conflict do nothing;
  update lucky_letters set opened_at = coalesce(opened_at, now()) where id = l.id;
  if l.photo is not null then update lucky_letters set photo = null where photo = l.photo; end if;
end $$;

-- Letters that reached me, newest first (the keepsake box).
create or replace function public.my_letters() returns table (letter uuid, message_key smallint, card_key smallint,
  origin text, hops smallint, route jsonb, homecoming boolean, delivered_at timestamptz, relayed boolean, thanked boolean, photo text,
  from_app boolean)
language sql stable security definer set search_path = public as $$
  select id, message_key, card_key, origin, hops, route, homecoming, delivered_at, relayed_at is not null, thanked_at is not null, photo,
         from_app
    from lucky_letters l where recipient = auth.uid() and delivered_at is not null
     and not exists (select 1 from letter_reports r where r.letter = l.id and r.reporter = auth.uid())
   order by delivered_at desc limit 200
$$;

revoke all on function public.report_letter(uuid) from public, anon;
grant execute on function public.report_letter(uuid) to authenticated;

commit;
