-- 3초 로그 리뷰 [2026-11-06] — 첫 장면 그림 · 평생 보관 · 빠른 반응
-- [사용자: 3초 로그 전수 리뷰 → "다 고쳐" + 기능(한 달 필름 · 만료 안내 · 나란히 · 반응 · 미션 · 연속 기록 · 평생 보관)]
--
-- 이 파일은 표도 행도 지우지 않는다: 열 둘(선택 · 기본값) · 표 하나 · 트리거 둘 · 함수 둘(하나는 다시 정의).
-- main 에 push 하는 순간 운영에 실행되므로(README §7) 몇 번을 돌려도 같은 결과로 쓴다(if not exists · create or replace ·
-- drop … if exists 뒤 create). 옛 앱은 새 열을 모른 채 그대로 돈다(upsert 에 없는 열은 그대로 남는다).
-- schema.sql 끝에 이 파일이 그대로 붙는다(신규 bootstrap = 운영 — logreview.test).
begin;

-- ── 1) 첫 장면 그림 · 평생 보관 ──────────────────────────────────────────────
-- poster_path: 찍을 때 만든 첫 장면(WebP/JPEG). 목록 타일이 영상보다 먼저 그린다 — iOS 저전력 · 느린 망에서
--   preload=metadata 영상이 첫 장면을 안 그려 검은 칸으로 남았다.
-- keep: 평생 보관(한 사람 한 달 한 편). 90일 정리(expire_log_videos)에서 빠진다.
alter table public.couple_logs add column if not exists poster_path text;
alter table public.couple_logs add column if not exists keep boolean not null default false;

-- ── 2) 영상이 바뀌면 그림도 따라 비운다 ──────────────────────────────────────
-- 옛 앱은 다시 찍어도 poster_path 를 모른다 — 그대로 두면 새 영상 칸에 옛 영상의 첫 장면이 뜬다.
-- 영상이 바뀌었는데 그림을 같이 안 보냈으면 비운다(남는 옛 그림 파일은 고아 — media-gc 가 수거).
create or replace function public.couple_logs_poster_follow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.video_path is distinct from old.video_path and new.poster_path is not distinct from old.poster_path then
    new.poster_path := null;
  end if;
  return new;
end;
$$;
drop trigger if exists couple_logs_poster_follow on public.couple_logs;
create trigger couple_logs_poster_follow before update on public.couple_logs
  for each row execute function public.couple_logs_poster_follow();
revoke execute on function public.couple_logs_poster_follow() from public, anon, authenticated;

-- ── 3) 평생 보관은 한 사람 한 달 한 편 ───────────────────────────────────────
-- 화면(logreview.canKeepMore)도 같은 규칙을 보지만 두 기기 · 옛 화면이 있으니 서버가 강제한다.
-- 같은 사람이 동시에 두 편을 켜는 경합은 (사람, 달) 잠금으로 줄 세운다. 넘치면 PT409(HTTP 409, 재시도 없음 — README §11).
-- 영상이 없는 로그(정리됨 · 글 로그)는 보관할 영상이 없다.
create or replace function public.couple_logs_keep_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.keep and (tg_op = 'INSERT' or not coalesce(old.keep, false)) then
    if new.video_path is null then
      raise exception 'keep needs a video' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('log_keep:' || new.created_by::text || ':' || to_char(new.log_date, 'YYYY-MM'), 0));
    if exists (
      select 1 from public.couple_logs l
      where l.created_by = new.created_by
        and l.keep
        and l.id <> new.id
        and date_trunc('month', l.log_date) = date_trunc('month', new.log_date)
    ) then
      raise exception 'keep-cap' using errcode = 'PT409';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists couple_logs_keep_cap on public.couple_logs;
create trigger couple_logs_keep_cap before insert or update of keep on public.couple_logs
  for each row execute function public.couple_logs_keep_cap();
revoke execute on function public.couple_logs_keep_cap() from public, anon, authenticated;

-- 보관 켜기/끄기 — 지난 날 영상이라 슬롯 시간 규칙(clogs_update 는 '지금 슬롯'만)에 걸린다. 본인 로그 · 내 커플만,
-- 바꾸는 칸은 keep 하나. updated_at 은 건드리지 않는다(별만 켜도 상대 화면에 NEW 가 뜨면 안 된다).
create or replace function public.set_log_keep(p_log uuid, p_keep boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  update public.couple_logs l
  set keep = coalesce(p_keep, false)
  where l.id = p_log
    and l.created_by = v_uid
    and l.couple_id in (select private.my_couple_ids());
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'log not found' using errcode = 'PT404';
  end if;
  return coalesce(p_keep, false);
end;
$$;
revoke all on function public.set_log_keep(uuid, boolean) from public, anon;
grant execute on function public.set_log_keep(uuid, boolean) to authenticated;

-- ── 4) 90일 정리는 보관한 영상을 건너뛴다 ────────────────────────────────────
-- 20260924010000_log_video_retention 의 함수를 그대로 다시 정의한다(서명 · 서비스롤 전용 · 30일 바닥 · 회당 500 상한 ·
-- skip locked 같음). 바뀐 것: not l.keep · 첫 장면 그림도 같이 떼어 내고 그 경로도 돌려준다(한 로그에 두 줄일 수 있다 —
-- 호출하는 daily-reminders 는 돌려받은 경로를 지우기만 하므로 옛 함수 코드로도 그대로 맞는다).
create or replace function public.expire_log_videos(p_keep_days int, p_limit int)
returns table (log_id uuid, path text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
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
      select l.id, l.video_path, l.poster_path
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
    returning l.id as expired_id, picked.video_path as expired_path, picked.poster_path as expired_poster
  loop
    log_id := r.expired_id;
    path := r.expired_path;
    return next;
    if r.expired_poster is not null then
      log_id := r.expired_id;
      path := r.expired_poster;
      return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.expire_log_videos(int, int) from public, anon, authenticated;
grant execute on function public.expire_log_videos(int, int) to service_role;

-- ── 5) 빠른 반응 ─────────────────────────────────────────────────────────────
-- couple_logs.emoji 는 행 주인만 고칠 수 있어(clogs_update) 상대가 반응을 못 남긴다 → 작은 표.
-- 한 사람이 클립마다 하나(기본키). 사용자 계정이 지워지면 같이 지워진다(auth.users 연쇄).
create table if not exists public.log_reactions (
  log_id     uuid not null references public.couple_logs(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (log_id, user_id)
);
create index if not exists log_reactions_couple_idx on public.log_reactions (couple_id);
alter table public.log_reactions enable row level security;
-- 정책은 집합 조회(README §5 'RLS 규약' — rls-perf-sync.test 가 잠근다). 쓰기는 내 행 · 내 커플 · 그 로그의 커플과 같을 때만.
drop policy if exists lr_select on public.log_reactions;
drop policy if exists lr_insert on public.log_reactions;
drop policy if exists lr_update on public.log_reactions;
drop policy if exists lr_delete on public.log_reactions;
create policy lr_select on public.log_reactions for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy lr_insert on public.log_reactions for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid())
  and couple_id = (select l.couple_id from public.couple_logs l where l.id = log_reactions.log_id)
);
create policy lr_update on public.log_reactions for update to authenticated using (user_id = (select auth.uid())) with check (
  couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid())
  and couple_id = (select l.couple_id from public.couple_logs l where l.id = log_reactions.log_id)
);
create policy lr_delete on public.log_reactions for delete to authenticated
  using (user_id = (select auth.uid()));
do $$ begin
  alter publication supabase_realtime add table public.log_reactions;
exception when duplicate_object then null; when undefined_object then null; end $$; -- 재실행 멱등

notify pgrst, 'reload schema';
commit;
