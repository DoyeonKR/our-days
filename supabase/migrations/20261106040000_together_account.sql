-- 함께 · 계정 리뷰 (2026-11-05) — 연결 해제 · 초대코드 · 한 계정 한 공간 · 계정 삭제.
-- schema.sql 끝에 이 파일이 그대로 붙어 있다(신규 bootstrap = 운영 migration — togetheraccount.test 가 잠근다).
-- 여러 번 돌려도 같다(create or replace · if not exists · drop … if exists 뒤 create). 행을 지우는 건 사용자가
-- '내 기록도 지우고 나가기'를 골랐을 때의 leave_couple 뿐이다.
begin;

-- ── 1) 닫힌 공간 ─────────────────────────────────────────────────────────────
-- 연결 해제가 멤버 행만 지워서, 초대코드가 그대로 살아 있었다 — 다음에 그 코드로 들어온 사람이
-- 나간 사람의 일기 · 사진 · 로그를 전부 봤다. 아무도 안 남은 공간은 닫고(closed_at) join_couple 이 거절한다.
alter table public.couples add column if not exists closed_at timestamptz;

-- 지금 멤버가 아닌 사람이 남긴 기록이 있는가 — 새 코드를 발급할 때 확인을 받는 기준.
create or replace function private.couple_has_departed_content(p_couple uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with m as (select user_id from public.couple_members where couple_id = p_couple)
  select exists (select 1 from public.deco_entries t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.couple_photos t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.couple_logs t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.pokes t where t.couple_id = p_couple and t.from_user not in (select user_id from m))
      or exists (select 1 from public.qa_answers t where t.couple_id = p_couple and t.user_id not in (select user_id from m))
      or exists (select 1 from public.mood_checkins t where t.couple_id = p_couple and t.user_id not in (select user_id from m))
      or exists (select 1 from public.couple_events t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.couple_bucket t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.entry_comments t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.log_comments t where t.couple_id = p_couple and t.created_by not in (select user_id from m))
      or exists (select 1 from public.photo_comments t where t.couple_id = p_couple and t.created_by not in (select user_id from m));
$$;
revoke all on function private.couple_has_departed_content(uuid) from public, anon, authenticated;

-- 멤버가 빠지면(새 RPC · 옛 앱의 직접 delete · 계정 삭제 모두) 코드를 바로 막고, 아무도 안 남으면 공간을 닫는다.
-- 옛 앱은 couple_members 를 직접 지우므로 트리거로 걸어야 옛 앱도 고쳐진다. 멤버가 아니라 couples 를 고치므로 definer.
create or replace function private.on_member_left()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.couples c
     set invite_expires_at = case when c.invite_expires_at is null or c.invite_expires_at > now() then now() else c.invite_expires_at end,
         closed_at = case
           when c.closed_at is null and not exists (select 1 from public.couple_members m where m.couple_id = c.id) then now()
           else c.closed_at end
   where c.id = old.couple_id;
  return null;
end;
$$;
revoke all on function private.on_member_left() from public, anon, authenticated;
drop trigger if exists couple_members_after_delete on public.couple_members;
create trigger couple_members_after_delete after delete on public.couple_members
  for each row execute function private.on_member_left();

-- 이 migration 전에 해제된 공간도 한 번 정리한다: 아무도 없으면 닫고, 떠난 사람의 기록이 남은 공간은 코드만 막는다
-- (남은 사람은 확인 뒤 새로 발급할 수 있다). 다시 돌릴 때 그 뒤에 발급한 코드를 또 막지 않게 closed_at 칸의 주석을 표식으로 쓴다.
do $$
begin
  if coalesce(col_description('public.couples'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.couples'::regclass and attname = 'closed_at')), '') <> 'together-2026-11-05' then
    update public.couples c
       set closed_at = coalesce(c.closed_at, now()),
           invite_expires_at = least(coalesce(c.invite_expires_at, now()), now())
     where not exists (select 1 from public.couple_members m where m.couple_id = c.id);
    update public.couples c
       set invite_expires_at = now()
     where (c.invite_expires_at is null or c.invite_expires_at > now())
       and exists (select 1 from public.couple_members m where m.couple_id = c.id)
       and private.couple_has_departed_content(c.id);
    comment on column public.couples.closed_at is 'together-2026-11-05';
  end if;
end $$;

-- ── 2) 초대코드 맞히기 막기 ─────────────────────────────────────────────────────
-- 시도 횟수 제한이 없었고 '없음 · 만료 · 정원 초과'가 서로 다른 문구라 어떤 코드가 살아 있는지 알려 줬다.
-- 사용자마다 1시간에 실패 10번. 노출 스키마 밖(private)이고 RLS 를 켜고 아무 권한도 주지 않는다.
create table if not exists private.invite_attempts (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts     integer not null default 0
);
alter table private.invite_attempts enable row level security;
revoke all on table private.invite_attempts from public, anon, authenticated;

-- ── 3) 한 계정 = 한 공간 ───────────────────────────────────────────────────────
-- user_id 에 unique 가 없어 동시에 만들기 · 합류를 누르면 두 공간에 들어갈 수 있었다.
-- 이미 겹친 계정이 있으면 migration 전체를 실패시키지 않고 알리기만 한다(사람이 정리한 뒤 다시 돌리면 걸린다).
do $$
begin
  if to_regclass('public.couple_members_one_per_user') is null then
    if exists (select 1 from public.couple_members group by user_id having count(*) > 1) then
      raise notice 'couple_members_one_per_user: 두 공간에 든 계정이 있어 unique 를 건너뜀';
    else
      create unique index couple_members_one_per_user on public.couple_members (user_id);
    end if;
  end if;
end $$;

-- ── 4) 만들기 · 합류 ───────────────────────────────────────────────────────────
-- 사용자마다 advisory lock 으로 줄 세운다 — 검사(이미 공간이 있나)와 insert 사이에 다른 요청이 끼지 못하게.
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
  perform pg_advisory_xact_lock(hashtextextended('ourdays:membership:' || v_uid::text, 0));
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception '이미 커플에 연결돼 있어요. 새로 만들려면 먼저 연결을 해제해 주세요.' using errcode = 'P0001';
  end if;

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
revoke execute on function public.create_couple(text, date) from public, anon;
grant execute on function public.create_couple(text, date) to authenticated;

-- 실패(없음 · 만료 · 정원 · 닫힘)는 한 문구로. 실패를 예외로 내면 시도 기록까지 되돌려지므로
-- 정상 반환 + HTTP 400(response.status)으로 오류 모양의 JSON 을 돌려준다 — 옛 앱의 supabase-js 도 error.message 로 읽는다.
-- 반환형이 couples → json 으로 바뀌어 drop 뒤 다시 만든다(성공 모양은 그대로 couples 한 행).
drop function if exists public.join_couple(text, text);
create function public.join_couple(p_code text, p_nickname text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_row  public.couples;
  v_try  private.invite_attempts;
  v_count int;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ourdays:membership:' || v_uid::text, 0));

  select * into v_try from private.invite_attempts where user_id = v_uid;
  if v_try.user_id is not null and v_try.window_start > now() - interval '1 hour' and v_try.attempts >= 10 then
    raise exception '초대코드를 너무 여러 번 틀렸어요. 1시간 뒤에 다시 시도해 주세요.' using errcode = 'PT429';
  end if;

  -- 이미 이 코드의 멤버면 그대로(다른 기기 · 다시 누름). 다른 공간 멤버면 코드와 상관없이 거절 — 코드 존재를 알려 주지 않는다.
  select c.* into v_row
  from public.couples c
  join public.couple_members m on m.couple_id = c.id and m.user_id = v_uid
  where c.invite_code = v_code;
  if v_row.id is not null then
    return row_to_json(v_row);
  end if;
  if exists (select 1 from public.couple_members where user_id = v_uid) then
    raise exception '이미 다른 커플에 연결돼 있어요. 먼저 연결을 해제해 주세요.' using errcode = 'P0001';
  end if;

  if length(v_code) between 4 and 6 then
    select * into v_row from public.couples where invite_code = v_code for update;
    if v_row.id is not null
       and v_row.closed_at is null
       and (v_row.invite_expires_at is null or v_row.invite_expires_at > now()) then
      select count(*) into v_count from public.couple_members where couple_id = v_row.id;
      if v_count < 2 then
        insert into public.couple_members (couple_id, user_id, nickname)
        values (v_row.id, v_uid, nullif(trim(p_nickname), ''));
        return row_to_json(v_row);
      end if;
    end if;
  end if;

  insert into private.invite_attempts as a (user_id, window_start, attempts)
  values (v_uid, now(), 1)
  on conflict (user_id) do update
    set attempts = case when a.window_start > now() - interval '1 hour' then a.attempts + 1 else 1 end,
        window_start = case when a.window_start > now() - interval '1 hour' then a.window_start else now() end;
  perform set_config('response.status', '400', true);
  return json_build_object(
    'code', 'PT400',
    'message', '초대코드를 찾을 수 없거나 만료됐어요. 상대에게 새 코드를 받아 주세요.',
    'details', null,
    'hint', 'invite_invalid');
end;
$$;
revoke execute on function public.join_couple(text, text) from public, anon;
grant execute on function public.join_couple(text, text) to authenticated;

-- ── 5) 새 코드 발급 — 떠난 사람의 기록이 남아 있으면 확인을 받는다 ───────────────────
-- 옛 앱은 p_couple 하나만 보낸다 → 기본값 false 로 같은 함수에 닿는다(겹치는 오버로드를 남기지 않으려고 옛 것을 지운다).
drop function if exists public.rotate_invite_code(uuid);
create or replace function public.rotate_invite_code(p_couple uuid, p_confirm boolean default false)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row public.couples;
begin
  if auth.uid() is null
     or not exists (select 1 from public.couple_members where couple_id = p_couple and user_id = auth.uid()) then
    raise exception '권한이 없어요.' using errcode = '42501';
  end if;
  if not coalesce(p_confirm, false) and private.couple_has_departed_content(p_couple) then
    raise exception '이전 상대가 남긴 기록이 새로 들어오는 사람에게 보여요. 확인한 뒤 다시 발급해 주세요.'
      using errcode = 'PT412', hint = 'departed_content';
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
      invite_expires_at = now() + interval '7 days',
      closed_at = null
  where id = p_couple
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.rotate_invite_code(uuid, boolean) from public, anon;
grant execute on function public.rotate_invite_code(uuid, boolean) to authenticated;

-- ── 6) 연결 해제 ───────────────────────────────────────────────────────────────
-- 내 멤버십을 지운다(코드 막기 · 공간 닫기는 위 트리거). p_wipe_mine 이면 이 공간에 내가 남긴 것도 지운다 —
-- 일기 · 사진 · 3초 로그 · 쿡 · 답 · 기분 · 댓글 · 반응 · 내가 만든 일정 · 버킷. 지운 파일 경로를 돌려준다.
-- ⚠ 파일(storage)은 멤버일 때만 지울 수 있어서 앱이 my_couple_media_paths 로 먼저 받아 지운 뒤 이걸 부른다.
create or replace function public.my_couple_media_paths(p_couple uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct x.path order by x.path), array[]::text[])
  from (
    select storage_path as path from public.couple_photos where couple_id = p_couple and created_by = auth.uid()
    union all select thumb_path from public.couple_photos where couple_id = p_couple and created_by = auth.uid()
    union all select unnest(coalesce(photo_paths, array[]::text[])) from public.deco_entries where couple_id = p_couple and created_by = auth.uid()
    union all select unnest(coalesce(thumb_paths, array[]::text[])) from public.deco_entries where couple_id = p_couple and created_by = auth.uid()
    union all select video_path from public.couple_logs where couple_id = p_couple and created_by = auth.uid()
    union all select poster_path from public.couple_logs where couple_id = p_couple and created_by = auth.uid()
  ) x
  where x.path is not null
    and exists (select 1 from public.couple_members m where m.couple_id = p_couple and m.user_id = auth.uid());
$$;
revoke execute on function public.my_couple_media_paths(uuid) from public, anon;
grant execute on function public.my_couple_media_paths(uuid) to authenticated;

create or replace function public.leave_couple(p_couple uuid, p_wipe_mine boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_paths text[] := array[]::text[];
  v_wiped int := 0;
  v_n int;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ourdays:membership:' || v_uid::text, 0));
  perform 1 from public.couples where id = p_couple for update;
  if not exists (select 1 from public.couple_members where couple_id = p_couple and user_id = v_uid) then
    return jsonb_build_object('left', false, 'wiped', 0, 'paths', '[]'::jsonb); -- 다른 기기에서 이미 나갔다
  end if;

  if coalesce(p_wipe_mine, false) then
    perform set_config('ourdays.suppress_activity', 'on', true);
    v_paths := public.my_couple_media_paths(p_couple);

    update public.couples
       set cover_path = case when cover_path = any(v_paths) then null else cover_path end,
           hung_paths = array(select p from unnest(coalesce(hung_paths, array[]::text[])) p where not (p = any(v_paths)))
     where id = p_couple
       and (cover_path = any(v_paths) or coalesce(hung_paths, array[]::text[]) && v_paths);

    delete from public.entry_reactions where couple_id = p_couple and created_by = v_uid;
    delete from public.entry_comments where couple_id = p_couple and created_by = v_uid;
    delete from public.poke_reactions where couple_id = p_couple and created_by = v_uid;
    delete from public.log_comments where couple_id = p_couple and created_by = v_uid;
    delete from public.log_reactions where couple_id = p_couple and user_id = v_uid;
    delete from public.photo_comments where couple_id = p_couple and created_by = v_uid;
    delete from public.photo_reactions where couple_id = p_couple and created_by = v_uid;
    delete from public.deco_entries where couple_id = p_couple and created_by = v_uid;
    get diagnostics v_n = row_count; v_wiped := v_wiped + v_n;
    delete from public.couple_photos where couple_id = p_couple and created_by = v_uid;
    get diagnostics v_n = row_count; v_wiped := v_wiped + v_n;
    delete from public.couple_logs where couple_id = p_couple and created_by = v_uid;
    get diagnostics v_n = row_count; v_wiped := v_wiped + v_n;
    delete from public.pokes where couple_id = p_couple and from_user = v_uid;
    get diagnostics v_n = row_count; v_wiped := v_wiped + v_n;
    delete from public.couple_events where couple_id = p_couple and created_by = v_uid;
    get diagnostics v_n = row_count; v_wiped := v_wiped + v_n;
    delete from public.couple_bucket where couple_id = p_couple and created_by = v_uid;
    get diagnostics v_n = row_count; v_wiped := v_wiped + v_n;
    delete from public.qa_answers where couple_id = p_couple and user_id = v_uid;
    delete from public.quiz_responses where couple_id = p_couple and user_id = v_uid;
    delete from public.mood_checkins where couple_id = p_couple and user_id = v_uid;
    delete from public.letters where couple_id = p_couple and from_user = v_uid;
    delete from public.chat_reads where couple_id = p_couple and user_id = v_uid;
    delete from public.activity_events where couple_id = p_couple and actor_user = v_uid;
    delete from public.activity_reads where couple_id = p_couple and user_id = v_uid;
  end if;

  delete from public.couple_members where couple_id = p_couple and user_id = v_uid;
  return jsonb_build_object('left', true, 'wiped', v_wiped, 'paths', to_jsonb(v_paths));
end;
$$;
revoke execute on function public.leave_couple(uuid, boolean) from public, anon;
grant execute on function public.leave_couple(uuid, boolean) to authenticated;

-- ── 7) 계정 삭제가 일정이 있는 커플 계정에서 멈추던 것 ──────────────────────────────
-- purge_account_data 는 남는 상대에게 일정의 작성자를 넘기는데(update couple_events set created_by = 상대),
-- events_created_by_immutable 트리거가 그 update 를 42501 로 막아 계정 삭제 전체가 되돌려졌다.
-- 작성자 스푸핑을 막는 트리거라 앱(authenticated)에는 그대로 두고, 서비스 롤(계정 삭제 함수)만 넘기게 한다.
create or replace function public.forbid_created_by_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.created_by is distinct from old.created_by
     and coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception '작성자는 바꿀 수 없어요.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.forbid_created_by_change() from public, anon, authenticated;

commit;
