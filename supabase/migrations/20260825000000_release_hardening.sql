-- Existing-project, data-preserving hardening migration.
-- Safe to run more than once; never drops application tables or user rows.
begin;

-- Partner join/leave must reach both clients without a polling-only blind spot.
do $$
begin
  alter publication supabase_realtime add table public.couple_members;
exception
  when duplicate_object then null;
end
$$;

-- Former members must not keep updating rows that belonged to an old couple.
drop policy if exists mood_update on public.mood_checkins;
create policy mood_update on public.mood_checkins
  for update
  using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists chat_reads_update on public.chat_reads;
create policy chat_reads_update on public.chat_reads
  for update
  using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- A private diary's photo must stay private at the Storage policy boundary too.
create or replace function public.deco_photo_blocked(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deco_entries d
    where d.visibility = 'private'
      and d.created_by <> auth.uid()
      and d.photo_paths @> array[p_name]
  );
$$;

create index if not exists deco_entries_private_photos_idx
  on public.deco_entries using gin (photo_paths)
  where visibility = 'private';

drop policy if exists couple_photos_obj_all on storage.objects;
create policy couple_photos_obj_all on storage.objects
  for all
  using (
    bucket_id = 'couple-photos'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and not public.deco_photo_blocked(name)
  )
  with check (
    bucket_id = 'couple-photos'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and not public.deco_photo_blocked(name)
  );

-- The ranking UI is retired; retain rows/RPC writes but remove broad profile reads.
drop policy if exists ranks_select on public.game_ranks;

-- Home clothesline selection. Re-declare all allowed columns because column grants replace.
alter table public.couples add column if not exists cover_path text;
alter table public.couples add column if not exists hung_paths text[];
revoke update on public.couples from anon, authenticated;
grant update (start_date, cover_path, hung_paths) on public.couples to authenticated;

commit;
