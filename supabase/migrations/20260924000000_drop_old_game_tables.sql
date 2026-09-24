-- 옛 게임(아케이드 5종 · 순위판 · 부루마블 · 테트리스) DB 정리 [2026-09-24]
-- [사용자: "너가 뺴야할 기능들 제안했던것도 다 뺄 수 있도록 진행해"]
--
-- 이 게임들의 화면·엔진·데이터 계층은 2026-08-06 에 지웠고, 테이블만 "되돌릴 수 없으니 따로 결정한다"며
-- 남겨 뒀다. 쓰는 화면이 없어 새 기록이 쌓일 길도 없다. 남겨 두면 계정 내보내기가
-- 쓰지도 않는 게임 표 8개를 계속 읽고, 계정 삭제 함수가 없는 게임을 위해 여덟 줄을 더 돌린다.
--
-- ⚠ 되돌릴 수 없다. 실행 전에 대시보드 Database → Backups(또는 pg_dump)로 백업을 먼저 받는다.
-- ⚠ 앱(프론트)이 이 표들을 내보내기 목록에서 뺀 버전으로 **먼저** 배포된 뒤에 실행한다 —
--   반대 순서면 옛 앱의 '내 데이터 내보내기'가 없는 표를 읽다 멈춘다.
-- 한 트랜잭션이라 중간에 실패하면 아무것도 안 지워진다. 다시 돌려도 안전하다(if exists).
-- schema.sql 끝에 이 파일이 그대로 포함된다(신규 bootstrap = 운영 migration 동일 보장 — drop-old-games-sync.test).
begin;

-- ── 1) 계정 삭제 함수에서 게임 표 줄을 뺀다 ────────────────────────────────────
-- 표보다 **먼저** 바꾼다. plpgsql 은 실행할 때 표 이름을 찾으므로, 표만 지우면 다음 계정 삭제가
-- 'relation does not exist' 로 통째로 실패한다(계정이 안 지워진다). 나머지 본문은
-- 20260826000000_review_round3 의 것과 한 글자도 다르지 않다.
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
  delete from public.reminder_log where user_id = p_user;

  return jsonb_build_object(
    'deleted_couples', v_deleted_couples,
    'left_shared_couples', v_left_couples
  );
end;
$$;
revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;

-- ── 2) 옛 게임 RPC ────────────────────────────────────────────────────────────
drop function if exists public.create_challenge(text, bigint, int);
drop function if exists public.resolve_challenge(uuid);
drop function if exists public.record_play(text, int);
drop function if exists public.bg_create(bigint, jsonb);
drop function if exists public.bg_action(uuid, int, jsonb);
drop function if exists public.bg_resign(uuid);

-- ── 3) 표 — 정책·인덱스·트리거·realtime 발행 등록은 표와 함께 사라진다 ─────────
-- game_attempts 가 game_challenges 를 참조하므로 먼저 지운다(cascade 없이 — 모르는 의존이 있으면 멈추게).
drop table if exists public.game_attempts;
drop table if exists public.game_challenges;
drop table if exists public.game_daily;
drop table if exists public.game_ranks;
drop table if exists public.game_profile;
drop table if exists public.board_results;
drop table if exists public.board_games;
drop table if exists public.tetris_results;

-- ── 4) 표가 쓰던 도우미 함수(트리거 함수·정책 함수라 표 다음에 지운다) ───────
drop function if exists public.game_attempt_check();
drop function if exists public.game_i_played(uuid);
drop function if exists public.game_score_plausible(text, int);

commit;
