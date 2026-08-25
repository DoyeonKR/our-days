-- 3차 전체 리뷰(2026-08-26) 확정분의 DB 반영. 전부 멱등·데이터 보존형(drop table/truncate 없음).
-- schema.sql 끝에 이 파일이 그대로 포함된다(신규 bootstrap = 운영 migration 동일 보장,
-- product-schema-sync.test 와 같은 방식의 review-round3-sync 테스트가 잠근다).

-- ── 1) 비밀일기 사진 가드: private 스키마(비노출) + deco- 경로 한정 ─────────────
-- 20260825000000_release_hardening 이 이 함수를 public 에 만들었는데, public 함수는
-- /rest/v1/rpc 로 노출되어 '이 파일이 상대의 비밀일기에 있나'를 묻는 오라클이 됐다.
-- 또 photo_paths 는 클라 입력이라 임의 경로(앨범 사진 등)를 넣어 상대의 공유 파일
-- 접근까지 차단할 수 있었다 → 가드를 일기 업로드 경로(*/deco-*)로 한정한다.
create schema if not exists private;
grant usage on schema private to authenticated, anon;
create or replace function private.deco_photo_blocked(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_name like '%/deco-%'
    and exists (
      select 1 from public.deco_entries d
      where d.visibility = 'private'
        and d.created_by <> auth.uid()
        and d.photo_paths @> array[p_name]
    );
$$;
grant execute on function private.deco_photo_blocked(text) to authenticated, anon;
create index if not exists deco_entries_private_photos_idx
  on public.deco_entries using gin (photo_paths) where visibility = 'private';
drop policy if exists couple_photos_obj_all on storage.objects;
create policy couple_photos_obj_all on storage.objects for all
  using (bucket_id = 'couple-photos'
         and public.is_couple_member(((storage.foldername(name))[1])::uuid)
         and not private.deco_photo_blocked(name))
  with check (bucket_id = 'couple-photos'
              and public.is_couple_member(((storage.foldername(name))[1])::uuid)
              and not private.deco_photo_blocked(name));
drop function if exists public.deco_photo_blocked(text);

-- ── 2) couples 를 realtime 발행에 등록 ─────────────────────────────────────────
-- subscribeCouple(대표사진·빨랫줄·시작일 실시간 공유)이 의존하는데 어디에도 등록이
-- 없어 실DB 에서도 빠져 있었다(resync 때만 우연히 따라잡던 것).
do $$ begin
  alter publication supabase_realtime add table public.couples;
exception when duplicate_object then null; end $$;

-- ── 3) game_ranks: 내 행만 select ──────────────────────────────────────────────
-- 전체 공개 select 는 제거된 상태(순위판 폐지). 계정 내보내기가 내 기록을 읽을 수 있게
-- 본인 행 한정으로만 되살린다.
drop policy if exists ranks_select_own on public.game_ranks;
create policy ranks_select_own on public.game_ranks for select using (user_id = auth.uid());

-- ── 4) qa_answers: update 정책 ─────────────────────────────────────────────────
-- 클라이언트는 upsert(수정 포함)를 쓰는데 update 정책이 없어 갱신 경로가 항상 거부됐다.
drop policy if exists qa_update on public.qa_answers;
create policy qa_update on public.qa_answers for update
  using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ── 5) couple_events: created_by 불변 ──────────────────────────────────────────
-- events_update 가 멤버면 어떤 컬럼이든 허용해 작성자 스푸핑이 가능했다.
-- 정책은 OLD 를 못 보므로 트리거로 잠근다.
create or replace function public.forbid_created_by_change()
returns trigger language plpgsql as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception '작성자는 바꿀 수 없어요.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists events_created_by_immutable on public.couple_events;
create trigger events_created_by_immutable
  before update on public.couple_events
  for each row execute function public.forbid_created_by_change();

-- ── 6) 한 계정은 한 커플만: join/create 가드 ───────────────────────────────────
-- 가드가 없어 반쪽 연동 화면 등에서 '커플 만들기'를 누르면 두 번째 멤버십이 실제로
-- 생겼고, limit 1 조회들이 커플을 임의로 골랐다.
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
  -- 이미 다른 커플에 속해 있으면 합류 불가(멱등 재합류는 위에서 이미 통과)
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception '이미 다른 커플에 연결돼 있어요. 먼저 연결을 해제해 주세요.' using errcode = 'P0001';
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

create or replace function public.create_couple(p_nickname text, p_start date)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_row   public.couples;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception '이미 커플에 연결돼 있어요. 새로 만들려면 먼저 연결을 해제해 주세요.' using errcode = 'P0001';
  end if;

  -- 6자리 대문자/숫자 초대코드 (헷갈리는 0/O/1/I 제외), 유니크 보장
  loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                               (floor(random()*32)+1)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.couples where invite_code = v_code);
  end loop;

  insert into public.couples (invite_code, start_date, created_by)
  values (v_code, p_start, v_uid)
  returning * into v_row;

  insert into public.couple_members (couple_id, user_id, nickname)
  values (v_row.id, v_uid, nullif(trim(p_nickname), ''));

  return v_row;
end;
$$;
grant execute on function public.create_couple(text, date) to authenticated, anon;

-- ── 7) 활동 귀속 교정: update 의 actor 는 행 작성자가 아니라 수정한 사람 ─────────
-- created_by 를 먼저 보면 상대가 고친 일정이 '내 활동'으로 기록됐다. RLS 경유 DML 은
-- auth.uid() 가 곧 행위자다(service role 경유만 null → 기존 fallback 유지).
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
    auth.uid(),
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

-- ── 8) 계정 삭제가 letters(편지)를 정리하도록 ──────────────────────────────────
-- 편지 UI 는 내려갔지만 테이블·실데이터는 보존 중인데, purge 가 이 테이블만 빠뜨려
-- 삭제한 계정의 편지(자유 입력 본문)를 상대가 계속 읽을 수 있었다.
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
  delete from public.letters where from_user = p_user; -- 편지 본문도 개인 데이터다 [2026-08-26]

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
  delete from public.reminder_log where user_id = p_user;

  return jsonb_build_object(
    'deleted_couples', v_deleted_couples,
    'left_shared_couples', v_left_couples
  );
end;
$$;
revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;

-- ── 9) 기념일 푸시 발송 dedup ──────────────────────────────────────────────────
-- 크론이 하루 2회(00:00 · 10:00 UTC) 돌아도 같은 리마인더를 같은 사람에게 두 번
-- 안 보내기 위한 장부. 시간대 조용시간과 단일 크론이 겹치면(유럽 등) 기념일 푸시를
-- 영영 못 받던 것을 2회 시도 + 이 dedup 으로 푼다. 서비스롤 전용.
create table if not exists public.reminder_log (
  user_id uuid not null,
  sent_on date not null,
  r_key   text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, sent_on, r_key)
);
alter table public.reminder_log enable row level security;
revoke all on table public.reminder_log from anon, authenticated;
