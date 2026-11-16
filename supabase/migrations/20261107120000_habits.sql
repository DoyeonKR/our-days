-- 같이 하는 습관(2026-11-13, README §10.27) — 커플이 같이 만드는 습관과 사람마다 하루 한 번의 체크.
--   couple_habits  : 습관(이름 20자 · 아이콘 키 · 매일 또는 주 N회 · 둘 다 / 한 명만). 커플 공유 — 버킷과 같은 규칙(둘 다 고치고 지운다).
--   habit_checkins : 한 사람 · 한 습관 · 하루(KST) 한 줄 — 기본키 (habit_id, user_id, day). 되돌리기는 줄을 지우지 않고 done=false 로
--                    같은 줄을 고친다(실시간 UPDATE 는 couple_id 필터로 상대에게 바로 가고, 재시도가 같은 열쇠에 upsert 라 멱등이다).
-- 서버가 지키는 것: 이름 · 목표 · 방식 CHECK, 커플당 습관 30개(PT422), 체크는 내 줄 · 내 커플 · 그 습관의 커플만,
--   날짜는 KST 오늘과 어제만(오프라인 재시도가 자정을 넘겨도 들어가게 — 그보다 지난 날 · 미래는 거절, 42501).
-- 섬 하트(+5 · 커플 하루 20)는 앱이 섬 상태(최상위 habitPay 링)에 쓴다 — DB 는 관여하지 않는다.
-- 계정 삭제(purge_account_data)는 체크를 지우고 습관은 남은 멤버에게 넘긴다(버킷과 같다). 본문의 나머지는
-- 20260924000000_drop_old_game_tables 의 것과 한 글자도 다르지 않다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 한 번 더 실행해도 안전). 이 파일은 기존 행을 지우지도 바꾸지도 않는다.
begin;

-- ── 1) 표 ────────────────────────────────────────────────────────────────────
create table if not exists public.couple_habits (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  name         text not null,
  icon         text not null default 'sprout',
  target_kind  text not null default 'daily',
  target_count smallint not null default 1,
  mode         text not null default 'both',
  created_by   uuid not null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint couple_habits_name_len check (char_length(btrim(name)) between 1 and 20 and name = btrim(name)),
  constraint couple_habits_icon_key check (icon ~ '^[a-z]{1,16}$'),
  constraint couple_habits_target check (
    (target_kind = 'daily' and target_count = 1) or (target_kind = 'weekly' and target_count between 1 and 6)
  ),
  constraint couple_habits_mode check (mode in ('both', 'either'))
);
create index if not exists couple_habits_couple_idx on public.couple_habits (couple_id, created_at);
alter table public.couple_habits enable row level security;

create table if not exists public.habit_checkins (
  habit_id   uuid not null references public.couple_habits(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day        date not null,
  done       boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (habit_id, user_id, day)
);
create index if not exists habit_checkins_couple_day_idx on public.habit_checkins (couple_id, day);
create index if not exists habit_checkins_user_idx on public.habit_checkins (user_id);
alter table public.habit_checkins enable row level security;

-- ── 2) 정책 — 집합 조회 · to authenticated(README §5 'RLS 규약') ────────────────
drop policy if exists habits_select on public.couple_habits;
drop policy if exists habits_insert on public.couple_habits;
drop policy if exists habits_update on public.couple_habits;
drop policy if exists habits_delete on public.couple_habits;
create policy habits_select on public.couple_habits for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy habits_insert on public.couple_habits for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy habits_update on public.couple_habits for update to authenticated
  using (couple_id in (select private.my_couple_ids()))
  with check (couple_id in (select private.my_couple_ids()));
create policy habits_delete on public.couple_habits for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));

drop policy if exists hc_select on public.habit_checkins;
drop policy if exists hc_insert on public.habit_checkins;
drop policy if exists hc_update on public.habit_checkins;
create policy hc_select on public.habit_checkins for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy hc_insert on public.habit_checkins for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid())
  and couple_id = (select h.couple_id from public.couple_habits h where h.id = habit_checkins.habit_id)
  and day between (select (now() at time zone 'Asia/Seoul')::date - 1) and (select (now() at time zone 'Asia/Seoul')::date)
);
create policy hc_update on public.habit_checkins for update to authenticated using (
  user_id = (select auth.uid())
  and day between (select (now() at time zone 'Asia/Seoul')::date - 1) and (select (now() at time zone 'Asia/Seoul')::date)
) with check (
  couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid())
  and couple_id = (select h.couple_id from public.couple_habits h where h.id = habit_checkins.habit_id)
  and day between (select (now() at time zone 'Asia/Seoul')::date - 1) and (select (now() at time zone 'Asia/Seoul')::date)
);
-- 체크 줄을 지우는 정책은 없다 — 되돌리기는 done=false. 습관을 지우면 연쇄로 사라지고, 계정 삭제는 서비스 롤 함수가 지운다.

-- ── 3) 트리거 — 갱신 시각 · 작성자 고정 · 커플당 30개 ─────────────────────────────
create or replace function private.habits_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.habits_touch() from public, anon, authenticated;
drop trigger if exists couple_habits_touch on public.couple_habits;
create trigger couple_habits_touch before update on public.couple_habits
  for each row execute function private.habits_touch();
drop trigger if exists habit_checkins_touch on public.habit_checkins;
create trigger habit_checkins_touch before update on public.habit_checkins
  for each row execute function private.habits_touch();

-- 작성자 스푸핑 막기 — 일정과 같은 함수(서비스 롤 = 계정 삭제만 넘긴다)
drop trigger if exists habits_created_by_immutable on public.couple_habits;
create trigger habits_created_by_immutable before update on public.couple_habits
  for each row execute function public.forbid_created_by_change();

-- 커플당 30개(앱의 HABIT_MAX 와 같은 값). 같은 커플의 동시 추가는 커플 단위 잠금으로 줄을 세운다.
create or replace function private.habits_cap()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('ourdays:habits:' || new.couple_id::text));
  if (select count(*) from public.couple_habits h where h.couple_id = new.couple_id) >= 30 then
    raise exception 'too many habits' using errcode = 'PT422';
  end if;
  return new;
end;
$$;
revoke all on function private.habits_cap() from public, anon, authenticated;
drop trigger if exists couple_habits_cap on public.couple_habits;
create trigger couple_habits_cap before insert on public.couple_habits
  for each row execute function private.habits_cap();

-- ── 4) 실시간 ─────────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.couple_habits;
exception when duplicate_object then null; when undefined_object then null; end $$; -- 재실행 멱등
do $$ begin
  alter publication supabase_realtime add table public.habit_checkins;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ── 5) 계정 삭제 — 체크는 지우고 습관은 남은 멤버에게(버킷과 같다) ─────────────────
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
    update public.couple_habits set created_by = v_partner
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
  delete from public.habit_checkins where user_id = p_user; -- 같이 하는 습관 체크(개인 기록) [2026-11-13]
  delete from public.time_capsules where created_by = p_user; -- 타임캡슐 편지(쓴 것) [2026-11-13] — 20261107110000 의 purge 에 있던 줄. 이 정의가 마지막이라 옮긴다
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
  -- 같이 하는 습관(공유 계획) — 버킷과 같다: 남은 멤버가 있으면 넘기고, 없으면 지운다(체크는 습관과 함께 연쇄 삭제) [2026-11-13]
  update public.couple_habits h
  set created_by = (
    select m.user_id from public.couple_members m
    where m.couple_id = h.couple_id and m.user_id <> p_user limit 1
  )
  where h.created_by = p_user
    and exists (
      select 1 from public.couple_members m
      where m.couple_id = h.couple_id and m.user_id <> p_user
    );
  delete from public.couple_habits where created_by = p_user;

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

notify pgrst, 'reload schema';
commit;
