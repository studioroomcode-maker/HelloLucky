// Local check of supabase/*.sql access rules on PGlite (in-memory Postgres) with minimal Supabase mocks.
// usage: npm i --no-save @electric-sql/pglite@0.3.14 && node scripts/check_supabase_security.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const repo = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const db = new PGlite();
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
// Fresh accounts (made today) for the report_find abuse check.
const [D, E, F] = ['d', 'e', 'f'].map((x) => `00000000-0000-4000-8000-00000000000${x}`);

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users (id uuid primary key, created_at timestamptz default now() - interval '10 days');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid,
  created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create schema net; create table net.calls (body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$ insert into net.calls values (body); select 1::bigint $$;
create schema cron; create table cron.job (jobid bigint, jobname text);
create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(a bigint) returns boolean language sql as $$ select true $$;
insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');
insert into auth.users values ('${D}', now()), ('${E}', now()), ('${F}', now());
`);
const strip = (f) => readFileSync(`${repo}/supabase/${f}`, 'utf8').replace(/^create extension.*$/gm, '');
for (const f of ['schema.sql', 'clover_photos.sql', 'lucky_letters.sql']) await db.exec(strip(f));
await db.exec(`grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated;`);
// The live-DB delta must apply cleanly on top too.
await db.exec(readFileSync(`${repo}/supabase/migrations/20261031_security_hardening.sql`, 'utf8'));

async function as(user, sql, params) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}
const fails = async (p) => assert.ok(await p.then(() => false, () => true), 'expected an error');

// 1. Reported (hidden) pins leave other people's map; the owner still sees them.
const pin = (await as(A, `insert into shared_finds (latitude, longitude, found_at, has_photo) values (37.5, 127, now(), true) returning id`))[0].id;
assert.equal((await as(B, `select id from shared_finds`)).length, 1);
await db.query(`update shared_finds set hidden = true where id = $1`, [pin]);
assert.equal((await as(B, `select id from shared_finds`)).length, 0);
assert.equal((await as(null, `select id from shared_finds`)).length, 0);
assert.equal((await as(A, `select id from shared_finds`)).length, 1);

// 2. Storage: own folder only, 40 uploads a day.
await fails(as(A, `insert into storage.objects (bucket_id, name) values ('clovers', '${B}/x.jpg')`));
for (let i = 0; i < 40; i++) await as(A, `insert into storage.objects (bucket_id, name) values ('clovers', '${A}/${i}.jpg')`);
await fails(as(A, `insert into storage.objects (bucket_id, name) values ('clovers', '${A}/40.jpg')`));
await as(B, `insert into storage.objects (bucket_id, name) values ('clovers', '${B}/0.jpg')`);
await db.exec(`update storage.objects set created_at = now() - interval '2 days' where name like '${A}/%'`);
await as(A, `insert into storage.objects (bucket_id, name) values ('clovers', '${A}/41.jpg')`);

// 3. Letters: no direct reads; the mailbox hides sender/recipient ids; city text is cleaned.
await as(B, `select check_mailbox('ko', 'Asia/Seoul')`);
await db.exec(`delete from lucky_letters where from_app`); // B free for A's letter
const photoA = `${A}/11111111-1111-4111-8111-111111111111.jpg`;
const letter = (await as(A, `select send_lucky_letter(1::smallint, 1::smallint, 'call me 010 1234', 37.51, 127.01, null, 5::smallint, $1) id`, [photoA]))[0].id;
const row = (await db.query(`select recipient, origin, route, photo from lucky_letters where id = $1`, [letter])).rows[0];
assert.equal(row.recipient, B);
assert.equal(row.origin, null);
assert.equal(row.route[0].c, undefined);
assert.equal((await as(A, `select * from lucky_letters`)).length, 0);
await db.exec(`update lucky_letters set deliver_at = now() - interval '1 minute'`);
await db.exec(`select deliver_due()`);
assert.equal((await as(B, `select * from lucky_letters`)).length, 0);
const mail = await as(B, `select * from check_mailbox('ko', 'Asia/Seoul') where id = $1`, [letter]);
assert.equal(mail.length, 1);
assert.equal(mail[0].sender, null);
assert.equal(mail[0].recipient, null);
assert.equal(mail[0].message_key, 1);
assert.equal(mail[0].photo, photoA);

// 4. A relay keeps its parent's clover, whatever photo it names.
await as(C, `select check_mailbox('en', 'UTC')`);
await db.exec(`delete from lucky_letters where from_app`); // C free for the relay
const relay = (await as(B, `select send_lucky_letter(1::smallint, 1::smallint, '서울특별시 강서구', 37.5, 127, $1, 7::smallint, $2) id`,
  [letter, `${B}/22222222-2222-4222-8222-222222222222.jpg`]))[0].id;
const r = (await db.query(`select photo, origin, route from lucky_letters where id = $1`, [relay])).rows[0];
assert.equal(r.photo, photoA);
assert.equal(r.origin, '서울특별시 강서구');
assert.equal(r.route.at(-1).c, '서울특별시 강서구');

// 5. Thank-you city goes through the same filter.
await as(B, `select thank_letter($1, 2::smallint, 'insta.com/me')`, [letter]);
assert.equal((await db.query(`select thanks_city from lucky_letters where id = $1`, [letter])).rows[0].thanks_city, null);

// 6. report_find: three fresh accounts can't hide a pin; three older ones can.
const pin2 = (await as(A, `insert into shared_finds (latitude, longitude, found_at) values (37.6, 127, now()) returning id`))[0].id;
for (const u of [D, E, F]) await as(u, `select report_find($1)`, [pin2]);
assert.equal((await as(B, `select id from shared_finds where id = $1`, [pin2])).length, 1);
await as(B, `select report_find($1)`, [pin2]);
await as(C, `select report_find($1)`, [pin2]);
assert.equal((await as(B, `select id from shared_finds where id = $1`, [pin2])).length, 1);
await db.query(`insert into auth.users (id) values ('00000000-0000-4000-8000-000000000010')`);
await as('00000000-0000-4000-8000-000000000010', `select report_find($1)`, [pin2]);
assert.equal((await as(B, `select id from shared_finds where id = $1`, [pin2])).length, 0);

// 7. report_letter: recipient only; blocks the sender for the reporter, takes the clover off the whole chain.
await fails(as(C, `select report_letter($1)`, [letter]));
await fails(as(null, `select report_letter($1)`, [letter]));
await as(B, `select report_letter($1)`, [letter]);
assert.equal((await db.query(`select count(*)::int n from letter_reports where letter = $1`, [letter])).rows[0].n, 1);
assert.deepEqual((await db.query(`select blocker, blocked from letter_blocks`)).rows, [{ blocker: B, blocked: A }]);
assert.equal((await db.query(`select count(*)::int n from lucky_letters where photo = $1`, [photoA])).rows[0].n, 0);
assert.equal((await as(B, `select * from my_letters() where letter = $1`, [letter])).length, 0);
assert.equal((await as(B, `select * from letter_blocks`)).length, 0);
assert.equal((await as(B, `select * from letter_reports`)).length, 0);
// Everyone free again: A's next letter skips B (blocked) and goes to C; with C busy it waits, and B won't adopt it.
await db.exec(`delete from lucky_letters where from_app; update lucky_letters set delivered_at = now() - interval '2 days'`);
const toC = (await as(A, `select send_lucky_letter(2::smallint, 1::smallint, null) id`))[0].id;
assert.equal((await db.query(`select recipient from lucky_letters where id = $1`, [toC])).rows[0].recipient, C);
const waiting = (await as(A, `select send_lucky_letter(3::smallint, 1::smallint, null) id`))[0].id;
assert.equal((await db.query(`select recipient from lucky_letters where id = $1`, [waiting])).rows[0].recipient, null);
await as(B, `select check_mailbox('ko', 'Asia/Seoul')`);
assert.equal((await db.query(`select recipient from lucky_letters where id = $1`, [waiting])).rows[0].recipient, null);

// 8. Place names in every script survive; links / numbers / handles don't.
const names = { 'Seoul Gangseo-gu': true, 'São Paulo': true, 'กรุงเทพมหานคร': true, 'हिन्दी नगर': true, '東京都': true,
  "St. John's": true, 'www.x.com': false, 'call 010': false, 'me@x': false, 'http://x': false }; // non-ASCII digits: checked on the live ICU locale instead (PGlite is C)
for (const [s, keep] of Object.entries(names))
  assert.equal((await db.query(`select place_name($1) p`, [s])).rows[0].p !== null, keep, s);

console.log('all security checks passed');
