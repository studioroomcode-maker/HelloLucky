-- Lucky Map clover close-ups (app 1.0.1+): one small square JPEG per pin, cut around the AI box on the device.
-- Public bucket, path <user_id>/<pin id>.jpg; the original photo never leaves the device.
-- Reports: report_find() hides a pin's photo for everyone after 3 distinct reporters (Apple guideline 1.2).

alter table public.shared_finds add column if not exists has_photo boolean not null default false;
alter table public.shared_finds add column if not exists hidden boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clovers', 'clovers', true, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Each install writes, lists and deletes only its own folder; anyone reads through the public URL.
drop policy if exists "clovers insert own" on storage.objects;
create policy "clovers insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'clovers' and (storage.foldername(name))[1] = auth.uid()::text);
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
  if (select count(*) from find_reports where find_id = p_find) >= 3 then
    update shared_finds set hidden = true where id = p_find;
  end if;
end $$;
revoke all on function public.report_find(uuid) from public, anon;
grant execute on function public.report_find(uuid) to authenticated;
