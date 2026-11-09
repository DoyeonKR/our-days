-- 서버 지키기(2026-11-09 서버 리뷰 "Fix all") — README §10.21.
-- 멱등(create or replace · drop … if exists 뒤 add) · 한 트랜잭션 · 이 파일은 행을 지우지도 바꾸지도 않는다.
-- 새 CHECK 는 전부 NOT VALID — 이미 있는 행은 검사하지 않는다(그 행을 다음에 고칠 때부터 검사한다).
-- 함수는 각자의 가장 최근 정의에서 필요한 줄만 바꿨다(서명 · 권한 그대로 — 옛 앱 번들도 그대로 부른다).
-- 롤백(SQL 편집기)은 README §10.21 '롤백'.
begin;

-- ── 1) 모험 저장 — 합친 결과도 300KB 까지 ───────────────────────────────────────────────
-- 20261107050000_adventure_guard 의 정의에서 바뀐 것: 합치기(state || p_state)는 보낸 칸만 크기를 봐서,
-- 매번 새 최상위 칸을 300KB 씩 보내면 한 사람의 저장이 끝없이 커졌다. 합친 결과의 크기를 보고 넘으면 PT422.
create or replace function public.adventure_save(p_state jsonb, p_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v integer;
  v_old jsonb;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 300000 then
    raise exception 'bad state' using errcode = 'PT422';
  end if;
  if coalesce(p_version, 0) = 0 then
    insert into public.adventure_saves (user_id, state, version)
    values (v_uid, p_state, 1)
    on conflict (user_id) do nothing
    returning version into v;
  else
    select s.state into v_old from public.adventure_saves s
      where s.user_id = v_uid and s.version = p_version
      for update;
    if found and octet_length((coalesce(v_old, '{}'::jsonb) || p_state)::text) > 300000 then
      raise exception 'bad state' using errcode = 'PT422';
    end if;
    update public.adventure_saves
      set state = adventure_saves.state || p_state, version = version + 1, updated_at = now()
      where user_id = v_uid and version = p_version
      returning version into v;
  end if;
  if v is null then
    raise exception 'stale' using errcode = 'PT409';
  end if;
  return v;
end;
$$;
revoke all on function public.adventure_save(jsonb, integer) from public, anon;
grant execute on function public.adventure_save(jsonb, integer) to authenticated;

-- ── 2) 미디어 경로는 그 행의 커플 폴더 아래만 ─────────────────────────────────────────────
-- 경로 칸은 앱이 보내는 글자라, 상대의 파일 경로(또는 남의 커플 폴더)를 내 행에 적을 수 있었다.
-- 계정 삭제(manage-account) · 영상 정리(expire_log_videos)는 서비스 롤로 그 경로를 지우므로 남의 파일이 지워질 수 있었다.
-- 앱이 만드는 경로는 늘 '<커플 id>/…' 다(lib/couple.ts). 배열 칸은 원소마다 본다(빈 원소 · null 은 통과 — 지울 것이 없다).
create or replace function public.media_paths_in_couple(p_paths text[], p_couple uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(u.p is null or u.p = '' or starts_with(u.p, p_couple::text || '/')), true)
  from unnest(p_paths) as u(p);
$$;
revoke all on function public.media_paths_in_couple(text[], uuid) from public, anon;
grant execute on function public.media_paths_in_couple(text[], uuid) to authenticated, service_role;

alter table public.couple_photos drop constraint if exists couple_photos_path_in_couple;
alter table public.couple_photos add constraint couple_photos_path_in_couple
  check (starts_with(storage_path, couple_id::text || '/')
         and (thumb_path is null or starts_with(thumb_path, couple_id::text || '/'))) not valid;
alter table public.couple_logs drop constraint if exists couple_logs_path_in_couple;
alter table public.couple_logs add constraint couple_logs_path_in_couple
  check ((video_path is null or starts_with(video_path, couple_id::text || '/'))
         and (poster_path is null or starts_with(poster_path, couple_id::text || '/'))) not valid;
alter table public.deco_entries drop constraint if exists deco_entries_path_in_couple;
alter table public.deco_entries add constraint deco_entries_path_in_couple
  check (public.media_paths_in_couple(photo_paths, couple_id)
         and public.media_paths_in_couple(thumb_paths, couple_id)) not valid;

-- 계정 삭제용 — 받은 경로 중 그 사용자가 올린 파일(storage 의 owner_id · 옛 칸 owner)만 돌려준다. 서비스 롤만.
-- manage-account 가 행에서 모은 경로를 이걸로 거른 뒤에만 지운다(못 부르면 지우지 않고 media-gc 에 맡긴다).
create or replace function public.account_owned_media(p_user uuid, p_paths text[])
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user is null then
    return;
  end if;
  return query
    select o.name from storage.objects o
    where o.bucket_id = 'couple-photos'
      and o.name = any(coalesce(p_paths, array[]::text[]))
      and (o.owner_id = p_user::text or o.owner = p_user);
end;
$$;
revoke all on function public.account_owned_media(uuid, text[]) from public, anon, authenticated;
grant execute on function public.account_owned_media(uuid, text[]) to service_role;

-- ── 3) 90일 영상 정리 — 지울 경로는 그 로그의 커플 폴더 아래 · 로그 작성자가 올린 파일만 ──────────────
-- 20261106010000_log_review 의 정의 그대로(서명 · 서비스롤 전용 · 30일 바닥 · 회당 500 상한 · skip locked · keep 건너뛰기).
-- 바뀐 것: 행은 똑같이 비우되, 돌려주는 경로는 위 조건을 지날 때만. 못 지나면 경로 대신 null 한 줄(편 수는 그대로 센다 —
-- daily-reminders 는 null 경로를 건너뛴다). 남은 파일은 아무 행도 안 가리키면 media-gc 가 수거한다.
create or replace function public.expire_log_videos(p_keep_days int, p_limit int)
returns table (log_id uuid, path text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
  v_any boolean;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  -- 0·7 같은 값을 실수로 넘겨도 최근 영상이 날아가지 않게 바닥을 둔다.
  if p_keep_days is null or p_keep_days < 30 then
    raise exception 'keep days must be at least 30' using errcode = '22023';
  end if;
  for r in
    with picked as (
      select l.id, l.video_path, l.poster_path, l.couple_id, l.created_by
      from public.couple_logs l
      where l.video_path is not null
        and not l.keep
        and l.log_date < (now() at time zone 'Asia/Seoul')::date - p_keep_days
      order by l.log_date, l.id
      limit least(greatest(coalesce(p_limit, 0), 0), 500)
      for update of l skip locked
    )
    update public.couple_logs l
    set video_path = null, poster_path = null, video_expired_at = now()
    from picked
    where l.id = picked.id
    returning l.id as expired_id, picked.video_path as expired_path, picked.poster_path as expired_poster,
              picked.couple_id as expired_couple, picked.created_by as expired_by
  loop
    v_any := false;
    if r.expired_path is not null and starts_with(r.expired_path, r.expired_couple::text || '/')
       and exists (select 1 from storage.objects o
                   where o.bucket_id = 'couple-photos' and o.name = r.expired_path
                     and (o.owner_id = r.expired_by::text or o.owner = r.expired_by)) then
      log_id := r.expired_id;
      path := r.expired_path;
      v_any := true;
      return next;
    end if;
    if r.expired_poster is not null and starts_with(r.expired_poster, r.expired_couple::text || '/')
       and exists (select 1 from storage.objects o
                   where o.bucket_id = 'couple-photos' and o.name = r.expired_poster
                     and (o.owner_id = r.expired_by::text or o.owner = r.expired_by)) then
      log_id := r.expired_id;
      path := r.expired_poster;
      v_any := true;
      return next;
    end if;
    if not v_any then
      log_id := r.expired_id;
      path := null;
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.expire_log_videos(int, int) from public, anon, authenticated;
grant execute on function public.expire_log_videos(int, int) to service_role;

-- ── 4) 대전 입력 기록 크기 상한 ──────────────────────────────────────────────────────────
-- 정상 기록은 많아야 9000칸 · 약 15만 바이트다(엔진의 LOG_MAX · 칸마다 숫자 넷). 함수가 거른 뒤에도 표에 상한을 둔다.
alter table public.adventure_matches drop constraint if exists adventure_matches_log_size;
alter table public.adventure_matches add constraint adventure_matches_log_size
  check (log is null or octet_length(log::text) <= 200000) not valid;

-- ── 5) 섬 저장 크기 상한 ─────────────────────────────────────────────────────────────────
-- 20260927000000_island_stale_no_retry 의 정의(권한은 20260929000000_rls_setbased_and_grants)에서 바뀐 것:
-- 받은 상태가 객체가 아니거나 1,000,000 바이트를 넘으면 PT422. 실제 섬 상태(수조 · 낚시 포함)는 목록마다 상한이 있어
-- 이보다 훨씬 작다 — 정상 저장은 걸리지 않는다. 충돌은 그대로 PT409.
create or replace function public.island_action(p_expected_version int, p_state jsonb)
returns public.couple_island language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.couple_island;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 1000000 then
    raise exception 'bad state' using errcode = 'PT422';
  end if;
  select couple_id into v_couple from public.couple_members where user_id = v_uid limit 1;
  if v_couple is null then raise exception '커플이 없습니다.'; end if;
  select * into v_row from public.couple_island where couple_id = v_couple for update;
  if v_row.couple_id is null then raise exception 'no island'; end if;
  if v_row.version <> p_expected_version then raise exception 'stale' using errcode = 'PT409'; end if;
  update public.couple_island
    set state = p_state, version = version + 1, updated_by = v_uid, updated_at = now()
    where couple_id = v_couple
    returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.island_action(integer, jsonb) from public, anon;
grant execute on function public.island_action(integer, jsonb) to authenticated;

-- ── 6) 낚시 순위 — 닉네임 · 물고기 이름 정리 · 아는 계열만 크기 순위에 ─────────────────────────────
-- 닉네임 · 이름은 앱이 보내는 글자 그대로라 주소 · 보이지 않는 글자가 남의 순위 화면에 그대로 떴다.
-- 규칙은 합치기 순위의 merge_clean_nick 과 같다(공백 접기 · 제어/보이지 않는 글자 · 주소면 null). 길이만 칸마다 다르다.
create schema if not exists private;
create or replace function private.clean_board_text(p_text text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.merge_clean_nick(p_text) is null then null
    else left(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')), greatest(coalesce(p_max, 0), 1))
  end;
$$;
revoke all on function private.clean_board_text(text, integer) from public, anon, authenticated;

-- 크기 순위에 드는 계열 — src/lib/aquarium.ts 의 FAMILIES 키와 같은 목록(serverguard.test 가 견준다).
-- 앱에 계열을 더하면 이 목록도 새 migration 으로 더한다(안 더하면 그 계열은 점수만 받고 크기 순위엔 안 든다).
create or replace function private.fish_family_ok(p_family text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_family = any (array[
    'guppy', 'pale_chub', 'chinese_minnow', 'crucian', 'tetra', 'smelt', 'sweetfish', 'goldfish', 'bullhead', 'betta',
    'mackerel', 'rockfish_bollak', 'catfish', 'flounder', 'common_carp', 'rockfish', 'masu_salmon', 'angel', 'black_seabream', 'sailfin_sandfish',
    'starfish', 'clown', 'sea_bream', 'snakehead', 'mandarin_fish', 'jellyfish', 'perch_kkeokji', 'sea_bass', 'hairtail', 'salmon',
    'cutlassfish_pollock', 'squid', 'discus', 'nurse_shark', 'leopard_shark', 'koi', 'croaker', 'eel', 'yellowtail', 'barred_knifejaw',
    'ray', 'octopus', 'gulper_eel', 'striped_jack', 'lenok', 'puffer', 'arowana', 'blue_shark', 'bluefin', 'anglerfish',
    'sea_turtle', 'oarfish', 'hammerhead', 'whale_shark', 'great_white', 'manta', 'coelacanth', 'megamouth', 'giant_squid', 'rising',
    'astral', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

-- 20261105000000_fish_catch_rate_lock 의 정의에서 바뀐 것: 닉네임 · 이름 정리, 모르는 계열은 계열 · 크기 없이 넣는다
-- (잡은 것 · 점수는 그대로 — 옛 앱이 점수를 잃지 않게 거절하지 않는다). 점수 공식 · 잠금 · 상한 · 서명 · 권한은 그대로.
create or replace function public.submit_fish_catch(
  p_nickname text, p_name text, p_grade integer, p_stage integer,
  p_quality double precision, p_perfect boolean, p_stored boolean, p_junk boolean,
  p_family text default null, p_cm double precision default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_nick   text := coalesce(private.clean_board_text(p_nickname, 20), '이름 없음');
  v_name   text := coalesce(private.clean_board_text(p_name, 30), '');
  v_family text := case when private.fish_family_ok(btrim(p_family)) then btrim(p_family) else null end;
  v_grade  integer := least(greatest(coalesce(p_grade, 0), 0), 7);
  v_stage  integer := least(greatest(coalesce(p_stage, 0), 0), 2);
  v_q      double precision := least(greatest(coalesce(p_quality, 0), 0), 1);
  v_cm     real;
  v_pts    integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  v_cm := case when coalesce(p_junk, false) or v_family is null or p_cm is null or p_cm <= 0 then null else least(p_cm, 2000) end;
  perform pg_advisory_xact_lock(hashtextextended('fish_catch:' || v_uid::text, 0));
  if exists (select 1 from public.fish_catches c where c.user_id = v_uid and c.created_at > now() - interval '2 seconds') then
    return 0;
  end if;
  if (select count(*) from public.fish_catches c where c.user_id = v_uid
      and c.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 300 then
    return 0;
  end if;
  if coalesce(p_junk, false) then
    v_pts := 2;
  else
    v_pts := floor(10 * power(1.8::double precision, v_grade)
      * (case v_stage when 2 then 2 when 1 then 1.3 else 1 end)
      * (1 + 0.5 * v_q)
      * (case when coalesce(p_perfect, false) then 1.1 else 1 end)
      * (case when coalesce(p_stored, false) then 1.25 else 1 end) + 0.5)::integer;
  end if;
  insert into public.fish_catches (user_id, nickname, name, grade, stage, junk, stored, points, family, cm)
  values (v_uid, v_nick, v_name, v_grade, v_stage, coalesce(p_junk, false), coalesce(p_stored, false), v_pts,
          case when v_cm is null then null else v_family end, v_cm);
  return v_pts;
end;
$$;
revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) to authenticated;

-- 20261107000000_fish_size_board_all 의 정의에서 바뀐 것: 아는 계열만 · 이미 저장된 옛 행의 닉네임 · 이름도 내보낼 때 정리한다.
create or replace function public.fish_size_board_all()
returns table (family text, rank integer, name text, cm real, catch_name text, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (c.family, c.user_id) c.family, c.user_id, c.cm, c.name as catch_name, c.id
    from public.fish_catches c
    where c.family is not null and c.cm is not null and private.fish_family_ok(c.family)
    order by c.family, c.user_id, c.cm desc, c.id asc
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c order by c.user_id, c.id desc
  ), ranked as (
    select b.family, (row_number() over (partition by b.family order by b.cm desc, b.id asc))::integer as rank,
           coalesce(private.clean_board_text(n.nickname, 20), '이름 없음') as name, b.cm,
           coalesce(private.clean_board_text(b.catch_name, 30), '') as catch_name, b.user_id = auth.uid() as is_me
    from best b join nick n on n.user_id = b.user_id
  )
  select r.family, r.rank, r.name, r.cm, r.catch_name, r.is_me
  from ranked r where r.rank <= 20 or r.is_me order by r.family, r.rank;
$$;
revoke all on function public.fish_size_board_all() from public, anon;
grant execute on function public.fish_size_board_all() to authenticated;

-- ── 7) 진단 로그 — 한 사람이 1시간에 300줄까지 ─────────────────────────────────────────────
-- debug_logs 는 로그인한 사람이 자기 행을 마음대로 넣을 수 있어 표를 끝없이 키울 수 있었다(30일 정리 전까지).
-- 넘으면 PT429. 앱의 logDebug 는 insert 결과를 보지 않는다(오류를 삼킨다). 서비스 롤 · 로그인 없는 요청은 세지 않는다.
create or replace function private.debug_logs_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  n integer;
begin
  if v_uid is null or coalesce((select auth.role())::text, '') = 'service_role' then
    return new;
  end if;
  select count(*) into n from (
    select 1 from public.debug_logs d
    where d.user_id = new.user_id and d.created_at > now() - interval '1 hour'
    limit 300
  ) x;
  if n >= 300 then
    raise exception 'too many debug logs' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
revoke all on function private.debug_logs_rate() from public, anon, authenticated;
drop trigger if exists debug_logs_rate on public.debug_logs;
create trigger debug_logs_rate before insert on public.debug_logs
  for each row execute function private.debug_logs_rate();

notify pgrst, 'reload schema';
commit;
