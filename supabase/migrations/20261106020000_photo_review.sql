-- 사진첩 리뷰 (2026-11-06) — 찍은 날 · 휴지통 · 중복 · 캡션/댓글/하트 · 빨랫줄 원자 토글 · 월간 집계 · 용량
--
-- 왜:
--   · 추억과 '그날' 묶음이 올린 시각(created_at)을 봤다 — 옛 여행 사진을 한꺼번에 올리면 '작년 오늘'이 올린 날에 몰렸다.
--     찍은 시각(taken_at, EXIF)을 따로 두고, 정렬 · 집계는 shot_at = coalesce(taken_at, created_at) 로 본다.
--   · 누구든 사진을 바로 지웠고 파일도 그 자리에서 사라졌다(되돌릴 수 없었다). deleted_at 으로 30일 휴지통을 둔다.
--     파일은 media-gc 가 30일이 지난 뒤에만 고아로 본다(함수 쪽 참조 조회도 함께 고쳤다).
--   · 빨랫줄 걸기는 화면이 계산한 배열을 통째로 덮어써서 두 사람이 동시에 누르면 한쪽 선택이 사라졌다 → 행 잠금 RPC.
--   · 월간 리캡이 네 표를 통째로(행 상한 1000에서 잘린 채) 받아 화면에서 셌다 → 달 하나를 서버에서 센다.
-- 규칙: 모든 정책은 to authenticated · couple_id in (select private.my_couple_ids()) · (select auth.uid()) (README §5 RLS 규약).
--   couples 의 컬럼 단위 grant 는 건드리지 않는다 — 빨랫줄 RPC 는 security definer 라 grant 와 무관하다.
--   storage.objects 정책도 건드리지 않는다.
-- 이 파일은 전부 멱등이고 지우는 것이 없다(add column if not exists · create or replace · drop … if exists 뒤 create).
-- 옛 앱은 새 칸을 모른 채 그대로 넣고 읽는다(전부 nullable · 기본값). 옛 앱의 목록엔 휴지통 사진이 보인다(README 메모).
-- schema.sql 끝에 이 파일이 그대로 붙어 있다(신규 bootstrap = 운영 — photoreview.test).
begin;
set local lock_timeout = '10s';

-- ── 1) couple_photos 새 칸 ─────────────────────────────────────────────────────
alter table public.couple_photos add column if not exists taken_at timestamptz;
alter table public.couple_photos add column if not exists deleted_at timestamptz;
alter table public.couple_photos add column if not exists deleted_by uuid;
alter table public.couple_photos add column if not exists caption text;
alter table public.couple_photos add column if not exists sha256 text;
-- 정렬 · 묶음 · 추억이 모두 같은 시각을 보게 한 칸으로 만든다(PostgREST 는 식으로 정렬할 수 없다).
alter table public.couple_photos add column if not exists shot_at timestamptz
  generated always as (coalesce(taken_at, created_at)) stored;

alter table public.couple_photos drop constraint if exists couple_photos_caption_len;
alter table public.couple_photos add constraint couple_photos_caption_len
  check (caption is null or char_length(caption) <= 200);
alter table public.couple_photos drop constraint if exists couple_photos_sha256_hex;
alter table public.couple_photos add constraint couple_photos_sha256_hex
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

-- 같은 사진 두 번 막기: 휴지통에 들어간 것은 빼고 센다(지운 뒤 다시 올릴 수 있어야 한다). 기존 행은 null 이라 걸리지 않는다.
create unique index if not exists couple_photos_sha_live_uidx
  on public.couple_photos (couple_id, sha256) where sha256 is not null and deleted_at is null;
-- 사진첩 키셋 페이지(찍은 시각 내림차순)와 휴지통 목록
create index if not exists couple_photos_album_idx
  on public.couple_photos (couple_id, shot_at desc, id desc) where deleted_at is null;
create index if not exists couple_photos_trash_idx
  on public.couple_photos (couple_id, deleted_at desc) where deleted_at is not null;

-- ── 2) 휴지통 · 되살리기 · 캡션 ────────────────────────────────────────────────
-- update 정책을 열면 storage_path 까지 고칠 수 있게 되므로, 바꿀 수 있는 칸만 RPC 로 연다.
create or replace function public.photo_trash(p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.couple_photos%rowtype;
  v_paths text[];
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  update public.couple_photos p
     set deleted_at = now(), deleted_by = v_uid
   where p.id = p_photo and p.deleted_at is null
     and p.couple_id in (select private.my_couple_ids())
  returning * into v_row;
  if not found then
    raise exception '사진을 찾지 못했어요.' using errcode = 'PT404';
  end if;
  -- 휴지통 사진이 대표 · 빨랫줄 자리를 계속 차지하지 않게 같은 트랜잭션에서 뺀다.
  v_paths := array_remove(array[v_row.storage_path, v_row.thumb_path], null);
  update public.couples c
     set cover_path = case when c.cover_path = any(v_paths) then null else c.cover_path end,
         hung_paths = nullif(array(
           select x from unnest(coalesce(c.hung_paths, array[]::text[])) with ordinality u(x, i)
           where not (x = any(v_paths)) order by i), array[]::text[])
   where c.id = v_row.couple_id
     and (c.cover_path = any(v_paths) or coalesce(c.hung_paths, array[]::text[]) && v_paths);
  return jsonb_build_object('id', v_row.id, 'deleted_at', v_row.deleted_at);
end;
$$;

create or replace function public.photo_restore(p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  begin
    update public.couple_photos p
       set deleted_at = null, deleted_by = null
     where p.id = p_photo and p.deleted_at is not null
       and p.deleted_at > now() - interval '30 days'
       and p.couple_id in (select private.my_couple_ids())
    returning p.id into v_id;
  exception when unique_violation then
    raise exception '같은 사진이 이미 사진첩에 있어요.' using errcode = 'PT409';
  end;
  if v_id is null then
    raise exception '되살릴 사진을 찾지 못했어요(30일이 지나면 정리돼요).' using errcode = 'PT404';
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.photo_set_caption(p_photo uuid, p_caption text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if v_caption is not null and char_length(v_caption) > 200 then
    raise exception '캡션은 200자까지 쓸 수 있어요.' using errcode = 'PT400';
  end if;
  update public.couple_photos p set caption = v_caption
   where p.id = p_photo and p.deleted_at is null
     and p.couple_id in (select private.my_couple_ids())
  returning p.id into v_id;
  if v_id is null then
    raise exception '사진을 찾지 못했어요.' using errcode = 'PT404';
  end if;
  return v_caption;
end;
$$;

-- ── 3) 빨랫줄 원자 토글 · 되돌리기 ─────────────────────────────────────────────
-- 행을 잠그고 그 순간의 배열에 넣고 뺀다 — 두 사람이 동시에 눌러도 서로의 선택을 덮지 않는다.
-- 가득 차면 가장 먼저 걸린 것이 내려가고(FIFO 유지), 무엇이 내려갔는지 돌려줘 화면이 알리고 되돌리게 한다.
create or replace function public.couple_hung_toggle(p_couple uuid, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur text[];
  v_next text[];
  v_evicted text;
  v_added boolean;
begin
  if p_couple is null or p_couple not in (select private.my_couple_ids()) then
    raise exception '권한이 없어요.' using errcode = 'PT403';
  end if;
  select coalesce(c.hung_paths, array[]::text[]) into v_cur from public.couples c where c.id = p_couple for update;
  if p_path = any(v_cur) then
    v_next := array_remove(v_cur, p_path);
    v_added := false;
  else
    if not exists (select 1 from public.couple_photos p
                   where p.couple_id = p_couple and p.storage_path = p_path and p.deleted_at is null) then
      raise exception '사진을 찾지 못했어요.' using errcode = 'PT404';
    end if;
    v_next := v_cur || p_path;
    v_added := true;
    if cardinality(v_next) > 4 then
      v_evicted := v_next[1];
      v_next := v_next[cardinality(v_next) - 3 : cardinality(v_next)];
    end if;
  end if;
  update public.couples c set hung_paths = nullif(v_next, array[]::text[]) where c.id = p_couple;
  return jsonb_build_object('paths', to_jsonb(v_next), 'added', v_added, 'evicted', v_evicted);
end;
$$;

-- 되돌리기 — 지금 배열이 내가 본 그대로일 때만 바꾼다(그 사이 상대가 바꿨으면 덮지 않고 지금 값을 돌려준다).
create or replace function public.couple_hung_swap(p_couple uuid, p_expect text[], p_next text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cur text[];
  v_next text[];
begin
  if p_couple is null or p_couple not in (select private.my_couple_ids()) then
    raise exception '권한이 없어요.' using errcode = 'PT403';
  end if;
  select coalesce(c.hung_paths, array[]::text[]) into v_cur from public.couples c where c.id = p_couple for update;
  if v_cur is distinct from coalesce(p_expect, array[]::text[]) then
    return jsonb_build_object('ok', false, 'paths', to_jsonb(v_cur));
  end if;
  -- 지금 살아 있는 이 커플의 사진만, 순서 그대로, 4장까지
  v_next := array(
    select x from unnest(coalesce(p_next, array[]::text[])) with ordinality u(x, i)
    where exists (select 1 from public.couple_photos p
                  where p.couple_id = p_couple and p.storage_path = x and p.deleted_at is null)
    order by i limit 4);
  update public.couples c set hung_paths = nullif(v_next, array[]::text[]) where c.id = p_couple;
  return jsonb_build_object('ok', true, 'paths', to_jsonb(v_next));
end;
$$;

-- ── 4) 월간 리캡 집계(한 달) ───────────────────────────────────────────────────
-- security invoker — 부른 사람의 RLS 그대로 센다(상대 비밀일기 · 아직 못 보는 상대 답은 화면과 똑같이 빠진다).
-- 날짜는 KST. 사진은 찍은 시각, 휴지통은 뺀다.
create or replace function public.memory_month_stats(p_couple uuid, p_month text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select d0, (d0 + interval '1 month')::date as d1,
           (d0::timestamp at time zone 'Asia/Seoul') as t0,
           ((d0 + interval '1 month')::timestamp at time zone 'Asia/Seoul') as t1
    from (select to_date(p_month || '-01', 'YYYY-MM-DD') as d0) b
  ),
  diaries as (
    select e.entry_date as d, e.mood_emoji from public.deco_entries e, r
    where e.couple_id = p_couple and e.entry_date >= r.d0 and e.entry_date < r.d1
  ),
  photos as (
    select (p.shot_at at time zone 'Asia/Seoul')::date as d from public.couple_photos p, r
    where p.couple_id = p_couple and p.deleted_at is null and p.shot_at >= r.t0 and p.shot_at < r.t1
  ),
  logs as (
    select l.log_date as d from public.couple_logs l, r
    where l.couple_id = p_couple and l.log_date >= r.d0 and l.log_date < r.d1
  ),
  answers as (
    select (a.created_at at time zone 'Asia/Seoul')::date as d from public.qa_answers a, r
    where a.couple_id = p_couple and a.created_at >= r.t0 and a.created_at < r.t1
  ),
  moods as (
    select mood_emoji as emoji, count(*)::int as n from diaries
    where mood_emoji is not null and mood_emoji <> '' group by mood_emoji
  )
  select jsonb_build_object(
    'diaries', (select count(*) from diaries),
    'photos', (select count(*) from photos),
    'logs', (select count(*) from logs),
    'answers', (select count(*) from answers),
    'active_days', (select count(*) from (select d from diaries union select d from photos
                                          union select d from logs union select d from answers) u),
    'moods', coalesce((select jsonb_agg(jsonb_build_object('emoji', emoji, 'count', n) order by n desc, emoji) from moods),
                      '[]'::jsonb)
  );
$$;

-- ── 5) 저장 공간(이 커플 폴더 · 버킷 전체) ─────────────────────────────────────
-- storage.objects 는 앱에서 직접 못 읽는다 → definer 로 크기 합만 돌려준다(파일 이름 · 다른 커플의 행은 내보내지 않는다).
-- 버킷 전체 합 두 숫자는 무료 1GB 가 프로젝트 단위라 '남은 기간'을 셈하려면 필요하다.
create or replace function public.couple_storage_usage(p_couple uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mine jsonb;
  v_all jsonb;
  v_prefix text;
begin
  if p_couple is null or p_couple not in (select private.my_couple_ids()) then
    raise exception '권한이 없어요.' using errcode = 'PT403';
  end if;
  v_prefix := p_couple::text || '/';
  select jsonb_build_object(
           'photos', coalesce(sum(s.sz) filter (where s.kind = 'photo'), 0),
           'diary', coalesce(sum(s.sz) filter (where s.kind = 'diary'), 0),
           'logs', coalesce(sum(s.sz) filter (where s.kind = 'log'), 0),
           'recent30', coalesce(sum(s.sz) filter (where s.created_at > now() - interval '30 days'), 0))
    into v_mine
    from (select coalesce(nullif(o.metadata ->> 'size', '')::bigint, 0) as sz, o.created_at,
                 case when left(o.name, char_length(v_prefix) + 4) = v_prefix || 'log-' then 'log'
                      when left(o.name, char_length(v_prefix) + 5) = v_prefix || 'deco-' then 'diary'
                      else 'photo' end as kind
            from storage.objects o
           where o.bucket_id = 'couple-photos' and left(o.name, char_length(v_prefix)) = v_prefix) s;
  select jsonb_build_object(
           'bucket_total', coalesce(sum(coalesce(nullif(o.metadata ->> 'size', '')::bigint, 0)), 0),
           'bucket_recent30', coalesce(sum(coalesce(nullif(o.metadata ->> 'size', '')::bigint, 0))
                                       filter (where o.created_at > now() - interval '30 days'), 0))
    into v_all
    from storage.objects o where o.bucket_id = 'couple-photos';
  return v_mine || v_all;
end;
$$;

-- ── 6) 사진 댓글 · 하트(일기 반응/댓글과 같은 규칙) ────────────────────────────
-- created_by 는 auth.users 에 묶어 계정이 지워지면 그 사람의 댓글 · 하트도 함께 지워진다(삭제 함수를 따로 고치지 않아도).
create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.couple_photos(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  body text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.photo_comments drop constraint if exists photo_comment_body_len;
alter table public.photo_comments add constraint photo_comment_body_len
  check (char_length(btrim(body)) between 1 and 500);
create index if not exists photo_comments_photo_idx on public.photo_comments (photo_id, created_at);
create index if not exists photo_comments_couple_idx on public.photo_comments (couple_id, created_at);
alter table public.photo_comments enable row level security;

create table if not exists public.photo_reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.couple_photos(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  emoji text not null default '❤️',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, created_by, emoji)
);
alter table public.photo_reactions drop constraint if exists photo_reaction_emoji_len;
alter table public.photo_reactions add constraint photo_reaction_emoji_len
  check (char_length(emoji) between 1 and 16);
create index if not exists photo_reactions_couple_idx on public.photo_reactions (couple_id);
alter table public.photo_reactions enable row level security;

drop policy if exists pc_delete on public.photo_comments;
drop policy if exists pc_insert on public.photo_comments;
drop policy if exists pc_select on public.photo_comments;
create policy pc_delete on public.photo_comments for delete to authenticated
  using (created_by = (select auth.uid()));
create policy pc_insert on public.photo_comments for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and couple_id = (select p.couple_id from public.couple_photos p where p.id = photo_comments.photo_id and p.deleted_at is null)
);
create policy pc_select on public.photo_comments for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

drop policy if exists phr_delete on public.photo_reactions;
drop policy if exists phr_insert on public.photo_reactions;
drop policy if exists phr_select on public.photo_reactions;
create policy phr_delete on public.photo_reactions for delete to authenticated
  using (created_by = (select auth.uid()));
create policy phr_insert on public.photo_reactions for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and couple_id = (select p.couple_id from public.couple_photos p where p.id = photo_reactions.photo_id and p.deleted_at is null)
);
create policy phr_select on public.photo_reactions for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- ── 7) 사진 활동은 10분에 한 줄 ────────────────────────────────────────────────
-- 열 장을 올리면 상대 활동함에 열 줄이 쌓였다. 같은 사람의 10분 안 사진은 첫 줄의 개수만 올린다
-- (첫 줄의 entity_id = 첫 사진이라 알림을 누르면 그 사진으로 간다).
create or replace function public.capture_photo_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if current_setting('ourdays.suppress_activity', true) = 'on' then
    return new;
  end if;
  if new.couple_id is null or new.created_by is null then
    return new;
  end if;
  select a.id into v_id from public.activity_events a
   where a.couple_id = new.couple_id and a.actor_user = new.created_by and a.kind = 'photo'
     and a.created_at > now() - interval '10 minutes'
   order by a.created_at desc limit 1
   for update;
  if v_id is null then
    insert into public.activity_events (couple_id, actor_user, kind, entity_id, summary, metadata)
    values (new.couple_id, new.created_by, 'photo', new.id::text, null,
            jsonb_build_object('operation', 'insert', 'count', 1));
  else
    update public.activity_events a
       set metadata = a.metadata || jsonb_build_object('count', coalesce((a.metadata ->> 'count')::int, 1) + 1)
     where a.id = v_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.capture_photo_activity() from public, anon, authenticated;
drop trigger if exists activity_on_photo on public.couple_photos;
create trigger activity_on_photo after insert on public.couple_photos
  for each row execute function public.capture_photo_activity();

-- ── 8) 함수 권한 · 실시간 ──────────────────────────────────────────────────────
revoke all on function public.photo_trash(uuid) from public, anon;
grant execute on function public.photo_trash(uuid) to authenticated;
revoke all on function public.photo_restore(uuid) from public, anon;
grant execute on function public.photo_restore(uuid) to authenticated;
revoke all on function public.photo_set_caption(uuid, text) from public, anon;
grant execute on function public.photo_set_caption(uuid, text) to authenticated;
revoke all on function public.couple_hung_toggle(uuid, text) from public, anon;
grant execute on function public.couple_hung_toggle(uuid, text) to authenticated;
revoke all on function public.couple_hung_swap(uuid, text[], text[]) from public, anon;
grant execute on function public.couple_hung_swap(uuid, text[], text[]) to authenticated;
revoke all on function public.memory_month_stats(uuid, text) from public, anon;
grant execute on function public.memory_month_stats(uuid, text) to authenticated;
revoke all on function public.couple_storage_usage(uuid) from public, anon;
grant execute on function public.couple_storage_usage(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.photo_comments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.photo_reactions;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
commit;
