-- Account trust, richer plans, expiring invitations, LDR profile and activity inbox.
-- Data preserving and re-runnable. Existing application rows are never dropped.
begin;

-- --------------------------------------------------------------------------
-- Invite lifecycle and long-distance profile
-- --------------------------------------------------------------------------
alter table public.couples
  add column if not exists invite_expires_at timestamptz;
alter table public.couples
  alter column invite_expires_at set default (now() + interval '7 days');
update public.couples
set invite_expires_at = now() + interval '30 days'
where invite_expires_at is null;

alter table public.couple_members
  add column if not exists timezone text not null default 'Asia/Seoul';
alter table public.couple_members
  add column if not exists city_key text not null default 'seoul';
alter table public.couple_members
  add column if not exists updated_at timestamptz not null default now();

alter table public.couple_members drop constraint if exists members_timezone_len;
alter table public.couple_members add constraint members_timezone_len
  check (char_length(timezone) between 3 and 64) not valid;
alter table public.couple_members drop constraint if exists members_city_key_len;
alter table public.couple_members add constraint members_city_key_len
  check (city_key ~ '^[a-z0-9_-]{2,40}$') not valid;

drop policy if exists members_update on public.couple_members;
create policy members_update on public.couple_members
  for update
  using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

revoke update on public.couple_members from anon, authenticated;
grant update (nickname, timezone, city_key) on public.couple_members to authenticated;

create or replace function public.touch_member_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists couple_members_touch_updated_at on public.couple_members;
create trigger couple_members_touch_updated_at
  before update on public.couple_members
  for each row execute function public.touch_member_updated_at();

-- Join now rejects expired links while retaining idempotent access for an existing member.
create or replace function public.join_couple(p_code text, p_nickname text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.couples;
  v_count int;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if length(trim(p_code)) not between 4 and 6 then
    raise exception '초대코드를 찾을 수 없어요.' using errcode = 'P0002';
  end if;

  select * into v_row from public.couples
  where invite_code = upper(trim(p_code))
  for update;
  if v_row.id is null then
    raise exception '초대코드를 찾을 수 없어요.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.couple_members
    where couple_id = v_row.id and user_id = v_uid
  ) then
    return v_row;
  end if;
  if v_row.invite_expires_at is not null and v_row.invite_expires_at <= now() then
    raise exception '초대 링크가 만료됐어요. 상대에게 새 초대를 요청해 주세요.' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.couple_members where couple_id = v_row.id;
  if v_count >= 2 then
    raise exception '이미 두 명이 연결된 커플이에요.' using errcode = 'P0001';
  end if;
  insert into public.couple_members (couple_id, user_id, nickname)
  values (v_row.id, v_uid, nullif(trim(p_nickname), ''));
  return v_row;
end;
$$;
grant execute on function public.join_couple(text, text) to authenticated, anon;

create or replace function public.rotate_invite_code(p_couple uuid)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row public.couples;
begin
  if auth.uid() is null or not public.is_couple_member(p_couple) then
    raise exception '권한이 없어요.' using errcode = '42501';
  end if;
  loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                               (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;
  update public.couples
  set invite_code = v_code,
      invite_expires_at = now() + interval '7 days'
  where id = p_couple
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.rotate_invite_code(uuid) from public;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Rich event editing and reminder choices
-- --------------------------------------------------------------------------
alter table public.couple_events
  add column if not exists recurrence text not null default 'none';
alter table public.couple_events
  add column if not exists note text;
alter table public.couple_events
  add column if not exists reminder_offsets int[] not null default array[0, 1, 3, 7];
alter table public.couple_events
  add column if not exists updated_at timestamptz not null default now();

update public.couple_events
set recurrence = case when repeat_yearly then 'yearly' else 'none' end
where recurrence = 'none' and repeat_yearly;

alter table public.couple_events drop constraint if exists events_recurrence_valid;
alter table public.couple_events add constraint events_recurrence_valid
  check (recurrence in ('none', 'monthly', 'yearly')) not valid;
alter table public.couple_events drop constraint if exists events_note_len;
alter table public.couple_events add constraint events_note_len
  check (note is null or char_length(note) <= 2000) not valid;
alter table public.couple_events drop constraint if exists events_reminders_valid;
alter table public.couple_events add constraint events_reminders_valid
  check (reminder_offsets <@ array[0, 1, 3, 7, 14, 30]) not valid;

create or replace function public.sync_event_recurrence()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.repeat_yearly and new.recurrence = 'none' then new.recurrence := 'yearly'; end if;
  elsif new.recurrence is not distinct from old.recurrence
        and new.repeat_yearly is distinct from old.repeat_yearly then
    new.recurrence := case when new.repeat_yearly then 'yearly' else 'none' end;
  end if;
  new.repeat_yearly := new.recurrence = 'yearly';
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists couple_events_sync_recurrence on public.couple_events;
create trigger couple_events_sync_recurrence
  before insert or update on public.couple_events
  for each row execute function public.sync_event_recurrence();

drop policy if exists events_update on public.couple_events;
create policy events_update on public.couple_events
  for update
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- --------------------------------------------------------------------------
-- Durable activity inbox. Inserts are database triggers, not best-effort UI calls.
-- --------------------------------------------------------------------------
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  actor_user uuid not null,
  kind text not null,
  entity_id text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_couple_created_idx
  on public.activity_events(couple_id, created_at desc);
alter table public.activity_events enable row level security;
drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events
  for select using (public.is_couple_member(couple_id));

create table if not exists public.activity_reads (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  last_read_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
alter table public.activity_reads enable row level security;
drop policy if exists activity_reads_select on public.activity_reads;
drop policy if exists activity_reads_insert on public.activity_reads;
drop policy if exists activity_reads_update on public.activity_reads;
create policy activity_reads_select on public.activity_reads
  for select using (public.is_couple_member(couple_id));
create policy activity_reads_insert on public.activity_reads
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy activity_reads_update on public.activity_reads
  for update
  using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

create or replace function public.capture_couple_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_couple uuid;
  v_actor uuid;
  v_entity text;
  v_summary text;
begin
  if current_setting('ourdays.suppress_activity', true) = 'on' then
    return new;
  end if;
  v_couple := (v_row ->> 'couple_id')::uuid;
  -- Private diary activity must remain private just like the diary row and its Storage objects.
  if tg_table_name = 'deco_entries' and v_row ->> 'visibility' = 'private' then
    return new;
  end if;
  v_actor := coalesce(
    nullif(v_row ->> 'created_by', '')::uuid,
    nullif(v_row ->> 'user_id', '')::uuid,
    nullif(v_row ->> 'from_user', '')::uuid
  );
  v_entity := coalesce(v_row ->> 'id', v_row ->> 'user_id');
  if tg_nargs > 1 and tg_argv[1] <> '' then
    v_summary := left(coalesce(v_row ->> tg_argv[1], ''), 160);
  end if;
  if v_couple is not null and v_actor is not null then
    insert into public.activity_events (
      couple_id, actor_user, kind, entity_id, summary, metadata
    ) values (
      v_couple, v_actor, tg_argv[0], v_entity, nullif(v_summary, ''),
      jsonb_build_object('operation', lower(tg_op))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists activity_on_poke on public.pokes;
create trigger activity_on_poke after insert on public.pokes
  for each row execute function public.capture_couple_activity('poke', 'message');
drop trigger if exists activity_on_event on public.couple_events;
create trigger activity_on_event after insert or update on public.couple_events
  for each row execute function public.capture_couple_activity('event', 'title');
drop trigger if exists activity_on_photo on public.couple_photos;
create trigger activity_on_photo after insert on public.couple_photos
  for each row execute function public.capture_couple_activity('photo', '');
drop trigger if exists activity_on_diary on public.deco_entries;
create trigger activity_on_diary after insert on public.deco_entries
  for each row execute function public.capture_couple_activity('diary', 'title');
drop trigger if exists activity_on_log on public.couple_logs;
create trigger activity_on_log after insert on public.couple_logs
  for each row execute function public.capture_couple_activity('log', 'body');
drop trigger if exists activity_on_mood on public.mood_checkins;
create trigger activity_on_mood after insert or update on public.mood_checkins
  for each row execute function public.capture_couple_activity('mood', 'note');
drop trigger if exists activity_on_answer on public.qa_answers;
create trigger activity_on_answer after insert on public.qa_answers
  for each row execute function public.capture_couple_activity('answer', '');
drop trigger if exists activity_on_bucket on public.couple_bucket;
create trigger activity_on_bucket after insert or update on public.couple_bucket
  for each row execute function public.capture_couple_activity('bucket', 'title');

do $$ begin
  alter publication supabase_realtime add table public.activity_events;
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- Account deletion transaction. Only the Edge Function service role may call.
-- Storage is removed by the function before this database phase.
-- --------------------------------------------------------------------------
create or replace function public.purge_account_data(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_membership record;
  v_partner uuid;
  v_paths text[] := array[]::text[];
  v_count int := 0;
  v_deleted_couples int := 0;
  v_left_couples int := 0;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user is null then
    raise exception 'user id required' using errcode = '22004';
  end if;

  -- 삭제 과정의 소유권 이전이 상대에게 새 활동으로 기록되지 않도록 같은 트랜잭션에서만 억제한다.
  perform set_config('ourdays.suppress_activity', 'on', true);

  -- 현재 멤버십을 이미 해제한 계정의 과거 작성 미디어도 포함한다.
  select coalesce(array_agg(path), array[]::text[]) into v_paths
  from (
    select storage_path as path from public.couple_photos where created_by = p_user
    union
    select thumb_path as path from public.couple_photos
      where created_by = p_user and thumb_path is not null
    union
    select unnest(coalesce(photo_paths, array[]::text[])) as path
      from public.deco_entries where created_by = p_user
    union
    select video_path as path from public.couple_logs
      where created_by = p_user and video_path is not null
  ) owned_paths
  where path is not null;

  update public.couples
  set cover_path = case when cover_path = any(v_paths) then null else cover_path end,
      hung_paths = array(
        select path from unnest(coalesce(hung_paths, array[]::text[])) path
        where not (path = any(v_paths))
      )
  where cover_path = any(v_paths)
     or coalesce(hung_paths, array[]::text[]) && v_paths;

  -- User-authored child rows can point at parent content retained for the partner.
  delete from public.entry_reactions where created_by = p_user;
  delete from public.entry_comments where created_by = p_user;
  delete from public.poke_reactions where created_by = p_user;
  delete from public.log_comments where created_by = p_user;

  for v_membership in
    select couple_id from public.couple_members where user_id = p_user for update
  loop
    select user_id into v_partner
    from public.couple_members
    where couple_id = v_membership.couple_id and user_id <> p_user
    limit 1;

    if v_partner is null then
      delete from public.couples where id = v_membership.couple_id;
      v_deleted_couples := v_deleted_couples + 1;
      continue;
    end if;

    update public.couples
    set created_by = case when created_by = p_user then v_partner else created_by end
    where id = v_membership.couple_id;

    -- Shared plans survive under the remaining member. Personal content is removed globally below.
    update public.couple_events set created_by = v_partner
      where couple_id = v_membership.couple_id and created_by = p_user;
    update public.couple_bucket set created_by = v_partner
      where couple_id = v_membership.couple_id and created_by = p_user;
    update public.couple_island set updated_by = v_partner
      where couple_id = v_membership.couple_id and updated_by = p_user;
    delete from public.couple_members where couple_id = v_membership.couple_id and user_id = p_user;
    v_left_couples := v_left_couples + 1;
  end loop;

  -- 연결 해제 후 계정 삭제하는 경우까지 포함해 작성자/사용자 식별 행을 전역 정리한다.
  delete from public.deco_entries where created_by = p_user;
  delete from public.couple_logs where created_by = p_user;
  delete from public.couple_photos where created_by = p_user;
  delete from public.qa_answers where user_id = p_user;
  delete from public.quiz_responses where user_id = p_user;
  delete from public.mood_checkins where user_id = p_user;
  delete from public.chat_reads where user_id = p_user;
  delete from public.pokes where from_user = p_user;

  -- 과거 커플의 공유 계획은 남은 멤버에게 이전하고, 남은 멤버가 없으면 제거한다.
  update public.couple_events e
  set created_by = (
    select m.user_id from public.couple_members m
    where m.couple_id = e.couple_id and m.user_id <> p_user limit 1
  )
  where e.created_by = p_user
    and exists (
      select 1 from public.couple_members m
      where m.couple_id = e.couple_id and m.user_id <> p_user
    );
  delete from public.couple_events where created_by = p_user;
  update public.couple_bucket b
  set created_by = (
    select m.user_id from public.couple_members m
    where m.couple_id = b.couple_id and m.user_id <> p_user limit 1
  )
  where b.created_by = p_user
    and exists (
      select 1 from public.couple_members m
      where m.couple_id = b.couple_id and m.user_id <> p_user
    );
  delete from public.couple_bucket where created_by = p_user;

  -- 사용자 ID가 결과에 직접 남는 게임 기록만 제거한다.
  delete from public.game_challenges c
  where c.challenger = p_user
     or c.winner = p_user
     or exists (
       select 1 from public.game_attempts a
       where a.challenge_id = c.id and a.user_id = p_user
     );
  delete from public.game_attempts where user_id = p_user;
  delete from public.board_games where p_user = any(players);
  delete from public.board_results where p_user = any(players);
  delete from public.tetris_results where winner_user = p_user or loser_user = p_user;

  update public.couple_island i
  set updated_by = (
    select m.user_id from public.couple_members m
    where m.couple_id = i.couple_id and m.user_id <> p_user limit 1
  )
  where i.updated_by = p_user;
  delete from public.activity_events where actor_user = p_user;
  delete from public.activity_reads where user_id = p_user;
  delete from public.couple_members where user_id = p_user;

  -- 생성자가 먼저 연결 해제한 과거 공간도 상대가 있으면 소유권을 넘기고, 빈 공간이면 제거한다.
  update public.couples c
  set created_by = (
    select m.user_id from public.couple_members m
    where m.couple_id = c.id and m.user_id <> p_user limit 1
  )
  where c.created_by = p_user
    and exists (
      select 1 from public.couple_members m
      where m.couple_id = c.id and m.user_id <> p_user
    );
  delete from public.couples c
  where c.created_by = p_user
    and not exists (select 1 from public.couple_members m where m.couple_id = c.id);
  get diagnostics v_count = row_count;
  v_deleted_couples := v_deleted_couples + v_count;

  delete from public.push_subscriptions where user_id = p_user;
  delete from public.notify_prefs where user_id = p_user;
  delete from public.debug_logs where user_id = p_user;
  delete from public.game_daily where user_id = p_user;
  delete from public.game_ranks where user_id = p_user;
  delete from public.game_profile where user_id = p_user;

  return jsonb_build_object(
    'deleted_couples', v_deleted_couples,
    'left_shared_couples', v_left_couples
  );
end;
$$;
revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;

-- Keep the strict couples column grant cumulative. Invite fields remain RPC-only.
revoke update on public.couples from anon, authenticated;
grant update (start_date, cover_path, hung_paths) on public.couples to authenticated;

commit;
