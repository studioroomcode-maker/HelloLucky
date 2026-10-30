-- Lucky Map clover close-ups (app 1.0.1+): one small square JPEG per pin, cut around the AI box on the device.
-- Public bucket, path <user_id>/<pin id>.jpg; the original photo never leaves the device.
-- Reports: report_find() hides a pin and its photo from everyone but its owner after 3 distinct reporters (Apple 1.2).

alter table public.shared_finds add column if not exists has_photo boolean not null default false;
alter table public.shared_finds add column if not exists hidden boolean not null default false;
-- A reported pin leaves everyone else's map, so its photo URL (<user_id>/<id>.jpg) can no longer be looked up.
drop policy if exists "read all" on public.shared_finds;
drop policy if exists "read unhidden" on public.shared_finds;
create policy "read unhidden" on public.shared_finds for select using (not hidden or user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clovers', 'clovers', true, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Each install writes, lists and deletes only its own folder; anyone reads through the public URL.
-- Abuse guard: 40 uploads a day per install (30 pins + 6 letters fit), so one account can't fill the storage quota.
drop policy if exists "clovers insert own" on storage.objects;
create policy "clovers insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'clovers' and (storage.foldername(name))[1] = auth.uid()::text
    and (select count(*) from storage.objects o where o.bucket_id = 'clovers'
           and o.name like auth.uid()::text || '/%' and o.created_at > now() - interval '1 day') < 40);
drop policy if exists "clovers select own" on storage.objects;
create policy "clovers select own" on storage.objects for select to authenticated
  using (bucket_id = 'clovers' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "clovers delete own" on storage.objects;
create policy "clovers delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'clovers' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.find_reports (
  find_id uuid not null references public.shared_finds (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (find_id, reporter)
);
alter table public.find_reports enable row level security; -- no policies: written only by report_find()

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
revoke all on function public.report_find(uuid) from public, anon;
grant execute on function public.report_find(uuid) to authenticated;
