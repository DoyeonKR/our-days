-- 타임캡슐 편지 (2026-11-13) — README §10.26
--
-- 한 사람이 편지(글 2000자 이하 · 사진 한 장은 선택)를 쓰고 여는 날(내일 ~ 10년 뒤, KST 날짜)을 고른다.
-- 여는 날 전엔 받는 사람이 봉인된 카드(보낸 사람 · 여는 날)만 본다 — 본문 · 사진 경로는 **서버가** 막는다:
--   · 표 SELECT 정책: 내 커플이고 (내가 쓴 편지이거나 여는 날이 지났을 때)만 행이 보인다. 봉인 카드는 본문 없는
--     security definer RPC(time_capsule_cards)로만 나온다.
--   · 사진은 따로 둔 비공개 버킷 capsule-photos 의 '{커플}/{쓴 사람}/…' 에 올린다. 읽기는 쓴 사람 폴더이거나
--     열린 편지의 경로일 때만(private.my_open_capsule_photos). couple-photos 와 섞지 않아 media-gc 가 모르는 파일을
--     고아로 보고 지우는 일이 없다(그 함수는 couple-photos 만 훑는다 — 함수 재배포 없이 안전하다).
--   · 봉인은 시각(open_on 과 KST 오늘)으로만 정한다 — 크론이 늦어도 일찍 열리지 않고, 늦게 열리지도 않는다.
-- 여는 날이 오면 크론(매시 1분, SQL 한 줄 — 비밀 없음)이 opened_at 을 찍고 activity_events 에 'capsule_open' 한 줄을 넣는다
-- (활동함 🔔). 앱이 목록을 읽을 때도 같은 함수를 내 커플에 한해 부른다(open_due_time_capsules). opened_at 이 비었을 때만이라 몇 번 돌아도 한 줄.
-- 활동 줄에는 본문을 싣지 않는다(summary null) — activity_events 는 커플 둘 다 · 실시간으로 본다.
-- 계정 삭제: purge_account_data 가 쓴 편지를 지운다(20260924000000 판 본문 그대로 + 한 줄). created_by 는 auth.users 삭제에도 따라 지워진다.
-- 멱등 · 한 트랜잭션 · 이 파일은 행을 지우지 않는다. 롤백은 README §10.26.
begin;

-- ── 1) 표 ─────────────────────────────────────────────────────────────────────
create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  open_on date not null,
  body text not null,
  photo_path text,
  reply_to uuid references public.time_capsules(id) on delete set null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_capsules_body_len check (char_length(body) <= 2000 and btrim(body) <> ''),
  -- 사진은 그 커플 · 쓴 사람 폴더 아래만 — 남의 파일 경로를 적어 상대 화면에 걸 수 없게
  constraint time_capsules_photo_path check (
    photo_path is null
    or (starts_with(photo_path, couple_id::text || '/' || created_by::text || '/')
        and char_length(photo_path) <= 300
        and position('..' in photo_path) = 0)
  )
);
create index if not exists time_capsules_couple_open_idx on public.time_capsules (couple_id, open_on);
create index if not exists time_capsules_created_by_idx on public.time_capsules (created_by);
create index if not exists time_capsules_reply_to_idx on public.time_capsules (reply_to);
create index if not exists time_capsules_due_idx on public.time_capsules (open_on) where opened_at is null;

-- 고칠 수 있는 칸은 셋뿐(여는 날 · 본문 · 사진). opened_at · 쓴 사람 · 커플은 앱이 못 바꾼다.
alter table public.time_capsules enable row level security;
revoke all on public.time_capsules from anon;
revoke insert, update, delete on public.time_capsules from authenticated;
grant select, delete on public.time_capsules to authenticated;
grant insert (id, couple_id, created_by, open_on, body, photo_path, reply_to) on public.time_capsules to authenticated;
grant update (open_on, body, photo_path) on public.time_capsules to authenticated;

-- ── 2) 정책 — 봉인은 여기서 ───────────────────────────────────────────────────────
-- 여는 날(open_on)의 KST 0시부터 열린다. 그 전엔 쓴 사람만 행(본문 · 사진 경로)을 읽는다.
-- 여는 날 범위(내일 ~ 10년 뒤)는 트리거가 아니라 with check 에 둔다 — 크론 · 계정 삭제(서비스 롤)는 정책을 안 타서 막히지 않는다.
drop policy if exists time_capsules_select on public.time_capsules;
create policy time_capsules_select on public.time_capsules for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (created_by = (select auth.uid())
              or open_on <= (select (now() at time zone 'Asia/Seoul')::date)));

drop policy if exists time_capsules_insert on public.time_capsules;
create policy time_capsules_insert on public.time_capsules for insert to authenticated
  with check (couple_id in (select private.my_couple_ids())
              and created_by = (select auth.uid())
              and opened_at is null
              and open_on > (select (now() at time zone 'Asia/Seoul')::date)
              and open_on <= (select ((now() at time zone 'Asia/Seoul')::date + interval '10 years')::date));

-- 고치기 · 지우기는 쓴 사람이 여는 날 전에만
drop policy if exists time_capsules_update on public.time_capsules;
create policy time_capsules_update on public.time_capsules for update to authenticated
  using (couple_id in (select private.my_couple_ids())
         and created_by = (select auth.uid())
         and open_on > (select (now() at time zone 'Asia/Seoul')::date))
  with check (couple_id in (select private.my_couple_ids())
              and created_by = (select auth.uid())
              and open_on > (select (now() at time zone 'Asia/Seoul')::date)
              and open_on <= (select ((now() at time zone 'Asia/Seoul')::date + interval '10 years')::date));

drop policy if exists time_capsules_delete on public.time_capsules;
create policy time_capsules_delete on public.time_capsules for delete to authenticated
  using (couple_id in (select private.my_couple_ids())
         and created_by = (select auth.uid())
         and open_on > (select (now() at time zone 'Asia/Seoul')::date));

-- 내용(본문 · 사진 · 여는 날)이 바뀔 때만 updated_at — 크론이 opened_at 을 찍을 땐 그대로
create or replace function private.touch_time_capsule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.body, new.open_on, new.photo_path) is distinct from (old.body, old.open_on, old.photo_path) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.touch_time_capsule() from public, anon, authenticated;
drop trigger if exists time_capsules_touch on public.time_capsules;
create trigger time_capsules_touch before update on public.time_capsules
  for each row execute function private.touch_time_capsule();

-- ── 3) 봉인 카드 — 본문 없이 ──────────────────────────────────────────────────────
-- 받는 사람은 표에서 봉인된 행을 못 읽으니 카드(누가 · 언제 열리나 · 사진이 있나)는 이 함수로만 받는다.
create or replace function public.time_capsule_cards(p_couple uuid)
returns table (id uuid, created_by uuid, open_on date, has_photo boolean, reply_to uuid, opened_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.created_by, t.open_on, t.photo_path is not null, t.reply_to, t.opened_at, t.created_at
    from public.time_capsules t
   where t.couple_id = p_couple
     and p_couple in (select private.my_couple_ids())
   order by t.open_on, t.created_at;
$$;
revoke all on function public.time_capsule_cards(uuid) from public, anon;
grant execute on function public.time_capsule_cards(uuid) to authenticated;

-- ── 4) 열기 — 크론 + 읽을 때 ──────────────────────────────────────────────────────
-- opened_at 이 빈 줄만 찍고 그 줄마다 활동 한 줄. 동시에 두 번 돌아도 update 가 줄을 잠가 뒤엣것은 0줄이다.
create or replace function private.open_due_capsules(p_couple uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  with opened as (
    update public.time_capsules t
       set opened_at = now()
     where t.opened_at is null
       and t.open_on <= (now() at time zone 'Asia/Seoul')::date
       and (p_couple is null or t.couple_id = p_couple)
    returning t.id, t.couple_id, t.created_by, t.open_on
  ), ins as (
    insert into public.activity_events (couple_id, actor_user, kind, entity_id, summary, metadata)
    select o.couple_id, o.created_by, 'capsule_open', o.id::text, null,
           jsonb_build_object('operation', 'open', 'open_on', o.open_on)
      from opened o
    returning 1
  )
  select count(*)::integer into v_n from ins;
  return v_n;
end;
$$;
revoke all on function private.open_due_capsules(uuid) from public, anon, authenticated;

create or replace function public.open_due_time_capsules(p_couple uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_couple is null or not (p_couple in (select private.my_couple_ids())) then
    return 0;
  end if;
  return private.open_due_capsules(p_couple);
end;
$$;
revoke all on function public.open_due_time_capsules(uuid) from public, anon;
grant execute on function public.open_due_time_capsules(uuid) to authenticated;

-- 묻을 때도 활동 한 줄(본문은 안 싣는다 — 둘째 인자가 빈 글자라 summary 는 null)
drop trigger if exists activity_on_capsule on public.time_capsules;
create trigger activity_on_capsule after insert on public.time_capsules
  for each row execute function public.capture_couple_activity('capsule', '');

do $$ begin
  alter publication supabase_realtime add table public.time_capsules;
exception when duplicate_object then null; end $$;

-- ── 5) 사진 — 따로 둔 비공개 버킷 ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('capsule-photos', 'capsule-photos', false)
on conflict (id) do nothing;
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/webp','image/jpeg','image/png','image/gif']
where id = 'capsule-photos';

-- 열린 편지의 사진 경로 — 저장소 읽기 정책이 질의한 사용자의 권한으로 부른다(authenticated 실행 필요)
create or replace function private.my_open_capsule_photos()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select t.photo_path
    from public.time_capsules t
   where t.photo_path is not null
     and t.couple_id in (select private.my_couple_ids())
     and t.open_on <= (now() at time zone 'Asia/Seoul')::date;
$$;
revoke all on function private.my_open_capsule_photos() from public, anon;
grant execute on function private.my_open_capsule_photos() to authenticated;

-- 경로 = '{커플}/{쓴 사람}/{파일}'. 올리기 · 지우기는 내 폴더에만, 읽기는 내 폴더 또는 열린 편지의 사진만.
drop policy if exists capsule_photos_obj_select on storage.objects;
create policy capsule_photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'capsule-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and ((storage.foldername(name))[2] = (select auth.uid())::text
              or name in (select private.my_open_capsule_photos())));

drop policy if exists capsule_photos_obj_insert on storage.objects;
create policy capsule_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'capsule-photos'
              and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and (owner_id = (select auth.uid())::text or owner = (select auth.uid())));

drop policy if exists capsule_photos_obj_delete on storage.objects;
create policy capsule_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'capsule-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and (storage.foldername(name))[2] = (select auth.uid())::text
         and (owner_id = (select auth.uid())::text or owner = (select auth.uid())));

-- ── 6) 크론 — 매시 1분, SQL 한 줄(비밀 없음) ──────────────────────────────────────
-- 이름으로 지우고 다시 건다(멱등). cron.job 에서는 jobid 만 읽는다.
do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'open-time-capsules-hourly' $q$;
  execute $q$ select cron.schedule('open-time-capsules-hourly', '1 * * * *', 'select private.open_due_capsules()') $q$;
end $$;

-- ── 7) 계정 삭제 — 쓴 편지도 지운다 ───────────────────────────────────────────────
-- 20260924000000_drop_old_game_tables 의 본문과 한 글자도 다르지 않고, letters 줄 뒤에 time_capsules 한 줄만 더했다
-- (timecapsule.test 가 견준다). 받은 편지는 상대의 기록이라 남는다 — 상대도 없으면 couples 삭제가 연쇄로 지운다.
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
  delete from public.time_capsules where created_by = p_user; -- 타임캡슐 편지(쓴 것) [2026-11-13]

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

notify pgrst, 'reload schema';

commit;
