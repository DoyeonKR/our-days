-- ============================================================================
-- 우리의 하루 · 커플 연동 + 쿡찌르기 백엔드 스키마 (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- 신규/빈 프로젝트에서만 Supabase SQL Editor 로 이 파일 전체를 한 번 실행하세요.
-- 기존 프로젝트 업데이트는 supabase/migrations/*.sql 을 시간순으로 적용합니다.
-- 인증은 이메일/비밀번호 로그인을 씁니다.
-- 실시간(쿡찌르기 즉시 수신)은 pokes 테이블을 realtime publication 에 추가합니다.
-- ============================================================================

-- BOOTSTRAP ONLY: 핵심 테이블이 하나라도 있으면 어떤 DROP보다 먼저 중단한다.
-- 이 가드가 보이면 schema.sql을 수정/제거하지 말고 migrations를 적용할 것.
do $bootstrap_guard$
begin
  if to_regclass('public.couples') is not null
     or to_regclass('public.couple_members') is not null
     or to_regclass('public.pokes') is not null
     or to_regclass('public.couple_events') is not null
     or to_regclass('public.couple_photos') is not null
     or to_regclass('public.push_subscriptions') is not null then
    raise exception
      'BOOTSTRAP_ONLY: existing schema detected. Apply supabase/migrations/*.sql instead of schema.sql.';
  end if;
end
$bootstrap_guard$;

-- 빈 프로젝트에서 부분 생성 흔적만 정리한다. 위 핵심 테이블 가드를 통과한 경우에만 실행된다.
drop table if exists public.push_subscriptions cascade;
drop table if exists public.couple_photos cascade;
drop table if exists public.couple_events cascade;
drop table if exists public.pokes cascade;
drop table if exists public.couple_members cascade;
drop table if exists public.couples cascade;
drop function if exists public.is_couple_member(uuid) cascade;
drop function if exists public.create_couple(text, date) cascade;
drop function if exists public.join_couple(text, text) cascade;

-- ----------------------------------------------------------------------------
-- 테이블
-- ----------------------------------------------------------------------------

-- 커플 1쌍 = 1 row. invite_code 로 상대가 합류.
create table public.couples (
  id          uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  start_date  date,                        -- 공유되는 '사귄 날'
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

-- 커플 구성원 (최대 2명). user_id = 익명 auth 유저.
create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id   uuid not null default auth.uid(),
  nickname  text,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

-- 쿡찌르기 (알림). 상대가 insert 하면 realtime 으로 즉시 수신.
create table public.pokes (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  from_user  uuid not null default auth.uid(),
  kind       text not null default 'poke', -- poke | miss | meal | love | custom
  message    text,                          -- 표시 문구 (프리셋 또는 자유 메시지)
  created_at timestamptz not null default now()
);

create index pokes_couple_created_idx on public.pokes (couple_id, created_at desc);

-- 커플 공유 기념일 (둘 다 보임). 예전엔 localStorage 개인 저장이라 상대에게 안 보였음.
create table public.couple_events (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples(id) on delete cascade,
  title         text not null,
  event_date    date not null,
  repeat_yearly boolean not null default true,
  emoji         text,
  category      text not null default 'plan',  -- 'anniversary'(노란 기념일) | 'plan'(작성자색 일정)
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index couple_events_couple_idx on public.couple_events (couple_id);

-- 웹 푸시 구독 (기기별). 백그라운드 푸시 알림 전송에 사용.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subs_user_idx on public.push_subscriptions (user_id);

-- ----------------------------------------------------------------------------
-- 멤버십 판별 헬퍼 (SECURITY DEFINER 로 RLS 우회 → 정책 내 재귀 방지)
-- ----------------------------------------------------------------------------
create or replace function public.is_couple_member(p_couple uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.couple_members m
    where m.couple_id = p_couple and m.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS (Row Level Security)
-- ----------------------------------------------------------------------------
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.pokes          enable row level security;

-- couples: 내가 속한 커플만 조회/수정. 생성은 RPC 로만(직접 insert 금지).
create policy couples_select on public.couples
  for select using (public.is_couple_member(id));
create policy couples_update on public.couples
  for update using (public.is_couple_member(id)) with check (public.is_couple_member(id));
-- 대표사진·빨랫줄·시작일 실시간 공유(subscribeCouple)가 이 발행에 의존한다.
-- 2026-08-26 리뷰: 구독 코드는 있는데 발행 등록이 어디에도 없어 실DB 에서도 빠져 있었다
-- (resync 때만 우연히 따라잡던 것). 실DB 적용 완료.
do $$ begin
  alter publication supabase_realtime add table public.couples;
exception when duplicate_object then null; end $$;

-- couple_members: 같은 커플 구성원만 서로 조회. insert/delete 는 RPC/본인 한정.
create policy members_select on public.couple_members
  for select using (public.is_couple_member(couple_id));
create policy members_delete on public.couple_members
  for delete using (user_id = auth.uid());   -- 본인만 나갈 수 있음
-- 상대 합류를 realtime 으로 알기 위해 발행(2026-08-25) — 4초 폴링 대체. 조인/탈퇴만이라 WAL 비용 ~0.
do $$ begin
  alter publication supabase_realtime add table public.couple_members;
exception when duplicate_object then null; end $$;

-- pokes: 같은 커플만 조회, 보낼 땐 본인 명의로만.
create policy pokes_select on public.pokes
  for select using (public.is_couple_member(couple_id));
create policy pokes_insert on public.pokes
  for insert with check (public.is_couple_member(couple_id) and from_user = auth.uid());

-- couple_events: 같은 커플만 조회, 추가는 본인 명의, 삭제는 둘 중 누구나(공유 목록).
alter table public.couple_events enable row level security;
create policy events_select on public.couple_events
  for select using (public.is_couple_member(couple_id));
create policy events_insert on public.couple_events
  for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy events_delete on public.couple_events
  for delete using (public.is_couple_member(couple_id));

-- 커플 공유 사진 (메타는 여기, 실제 파일은 Storage 'couple-photos' 버킷).
create table public.couple_photos (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  storage_path text not null,           -- 원본(1600px WebP) — 대표/상세
  thumb_path   text,                    -- 썸네일(480px WebP) — 그리드용(없으면 원본 폴백)
  created_by   uuid not null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index couple_photos_couple_idx on public.couple_photos (couple_id, created_at desc);
alter table public.couple_photos enable row level security;
create policy photos_select on public.couple_photos
  for select using (public.is_couple_member(couple_id));
create policy photos_insert on public.couple_photos
  for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy photos_delete on public.couple_photos
  for delete using (public.is_couple_member(couple_id));

-- couples 는 start_date 컬럼만 수정 허용 (RLS 는 행 단위라 컬럼 제한은 grant 로).
-- → 멤버가 invite_code/created_by 를 바꿔 초대코드 무효화·소유자 스푸핑하는 것 차단.
revoke update on public.couples from anon, authenticated;
grant  update (start_date) on public.couples to authenticated;

-- push_subscriptions: 본인 기기 구독만 관리 (Edge Function 은 service_role 로 상대 것 읽음).
alter table public.push_subscriptions enable row level security;
create policy push_subs_own on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RPC: 커플 생성 (초대코드 발급 + 생성자 자동 합류)
-- ----------------------------------------------------------------------------
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

  -- 6자리 대문자/숫자 초대코드 (헷갈리는 0/O/1/I 제외), 유니크 보장
  loop
    -- 32자 알파벳(0/O/1/I 제외) → 인덱스 1..32 (random()*32 로 '9'까지 포함)
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

-- ----------------------------------------------------------------------------
-- RPC: 초대코드로 커플 합류 (최대 2명, 중복/포화 방어)
-- ----------------------------------------------------------------------------
create or replace function public.join_couple(p_code text, p_nickname text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_row   public.couples;
  v_count int;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  -- 초대코드 길이 검증(4~6) — 직접 API 로 이상 길이 호출 차단(클라 maxLength 서버 미러)
  if length(trim(p_code)) not between 4 and 6 then
    raise exception '초대코드를 찾을 수 없어요.' using errcode = 'P0002';
  end if;

  -- 커플 행을 잠가 동시 합류를 직렬화 (2인 초과 경쟁조건 방지: count→insert TOCTOU)
  select * into v_row from public.couples
  where invite_code = upper(trim(p_code))
  for update;
  if v_row.id is null then
    raise exception '초대코드를 찾을 수 없어요.' using errcode = 'P0002';
  end if;

  -- 이미 이 커플 구성원이면 그대로 반환 (재합류 idempotent)
  if exists (select 1 from public.couple_members
             where couple_id = v_row.id and user_id = v_uid) then
    return v_row;
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

-- 익명 유저(authenticated 롤)가 RPC 실행 가능하도록
grant execute on function public.create_couple(text, date) to authenticated, anon;
grant execute on function public.join_couple(text, text)   to authenticated, anon;

-- ----------------------------------------------------------------------------
-- 실시간: pokes 테이블 변경을 구독 가능하게 publication 에 추가
-- ----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.pokes;
exception when duplicate_object then null; end $$; -- 재실행 멱등
do $$ begin
  alter publication supabase_realtime add table public.couple_events;
exception when duplicate_object then null; end $$; -- 재실행 멱등
do $$ begin
  alter publication supabase_realtime add table public.couple_photos;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- ----------------------------------------------------------------------------
-- Storage: 커플 공유 사진 버킷 (비공개) + 커플 단위 접근 정책
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('couple-photos', 'couple-photos', false)
on conflict (id) do nothing;

-- 서버측 업로드 가드: 25MB 상한 + 이미지/영상 MIME 만(클라 가드는 API 직접 호출로 우회 가능).
-- iOS 카메라 앱 폴백은 video/quicktime 을 줄 수 있어 포함.
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['image/webp','image/jpeg','image/png','image/gif','video/mp4','video/webm','video/quicktime']
where id = 'couple-photos';

-- 경로 규칙 {couple_id}/파일명 → 폴더[1]=couple_id 의 멤버만 접근.
-- ⚠ 오브젝트 정책 본문은 deco_entries 섹션 뒤에 있다(비밀일기 사진 가드가 그 테이블을
-- 참조하므로, 신규 DB 재실행 순서를 지키려면 여기 둘 수 없다). "storage 정책" 검색.

-- ============================================================================
-- 추가 기능 (re-runnable 블록): 대표사진 공유 / 무드 / 오늘의 질문 / 데코북
-- ============================================================================

-- 대표사진 커플 공유 (couples.cover_path). start_date 와 함께 컬럼 update 만 허용.
alter table public.couples add column if not exists cover_path text;
revoke update on public.couples from anon, authenticated;
grant  update (start_date, cover_path) on public.couples to authenticated;

-- 무드 체크인 (본인 1개 upsert)
create table if not exists public.mood_checkins (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id   uuid not null default auth.uid(),
  emoji     text not null,
  note      text,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
alter table public.mood_checkins enable row level security;
drop policy if exists mood_select on public.mood_checkins;
drop policy if exists mood_insert on public.mood_checkins;
drop policy if exists mood_update on public.mood_checkins;
create policy mood_select on public.mood_checkins for select using (public.is_couple_member(couple_id));
create policy mood_insert on public.mood_checkins for insert with check (public.is_couple_member(couple_id) and user_id = auth.uid());
-- update 에도 멤버십(2026-08-25): 탈퇴한 전 멤버가 옛 커플의 자기 행을 계속 고치지 못하게.
create policy mood_update on public.mood_checkins for update using (user_id = auth.uid() and public.is_couple_member(couple_id)) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
-- '오늘 어땠어?'(오늘의 기분 한 줄 평)로 복귀(2026-07-27) → realtime 발행 복원.
-- 매일 바뀌는 프롬프트는 클라 결정적(src/lib/moodPrompt.ts) — 서버 상태 없음.
do $$ begin
  alter publication supabase_realtime add table public.mood_checkins;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 오늘의 질문 (상대 답은 내가 답해야 열림 — SECURITY DEFINER 로 재귀 방지)
create table if not exists public.qa_answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  question_id text not null,
  user_id uuid not null default auth.uid(),
  body text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, question_id, user_id)
);
create or replace function public.qa_i_answered(p_couple uuid, p_question text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.qa_answers a
    where a.couple_id = p_couple and a.question_id = p_question and a.user_id = auth.uid());
$$;
alter table public.qa_answers enable row level security;
drop policy if exists qa_select on public.qa_answers;
drop policy if exists qa_insert on public.qa_answers;
create policy qa_select on public.qa_answers for select using (
  public.is_couple_member(couple_id)
  and (user_id = auth.uid() or public.qa_i_answered(couple_id, question_id))
);
create policy qa_insert on public.qa_answers for insert with check (public.is_couple_member(couple_id) and user_id = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.qa_answers;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 서로 알기 퀴즈: 각자 '나는 A/B' + '상대는 A/B(예측)'. 상대 응답은 내가 답해야 열림(qa 패턴).
create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  question_id text not null,
  user_id uuid not null default auth.uid(),
  self_choice text not null check (self_choice in ('a','b')),
  guess_choice text not null check (guess_choice in ('a','b')),
  created_at timestamptz not null default now(),
  unique (couple_id, question_id, user_id)
);
create index if not exists quiz_responses_couple_idx on public.quiz_responses(couple_id);
create or replace function public.quiz_i_answered(p_couple uuid, p_question text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.quiz_responses r
    where r.couple_id = p_couple and r.question_id = p_question and r.user_id = auth.uid());
$$;
alter table public.quiz_responses enable row level security;
drop policy if exists quiz_select on public.quiz_responses;
drop policy if exists quiz_insert on public.quiz_responses;
create policy quiz_select on public.quiz_responses for select using (
  public.is_couple_member(couple_id)
  and (user_id = auth.uid() or public.quiz_i_answered(couple_id, question_id))
);
create policy quiz_insert on public.quiz_responses for insert with check (public.is_couple_member(couple_id) and user_id = auth.uid());
-- '서로 얼마나 알까' 퀴즈는 제거된 기능(2026-07-27, 미사용) → realtime 발행 제외(Disk IO 절감).
-- 테이블/데이터는 보존(복구 대비). 되살리려면 아래 add table 을 다시 실행.
do $$ begin
  alter publication supabase_realtime drop table public.quiz_responses;
exception when undefined_object then null; end $$; -- 재실행 멱등

-- 데코북 (꾸민 일기 페이지). 사진은 Storage 'couple-photos' 재사용.
create table if not exists public.deco_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  entry_date date not null,
  title text, body text, location text, mood_emoji text, bg text,
  hashtags text[] default '{}',
  stickers jsonb default '[]',
  photo_paths text[] default '{}',
  visibility text not null default 'shared',  -- 'shared' | 'private'(나만 보기)
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists deco_entries_couple_idx on public.deco_entries (couple_id, entry_date desc);
alter table public.deco_entries enable row level security;
drop policy if exists deco_select on public.deco_entries;
drop policy if exists deco_insert on public.deco_entries;
drop policy if exists deco_update on public.deco_entries;
drop policy if exists deco_delete on public.deco_entries;
create policy deco_select on public.deco_entries for select using (public.is_couple_member(couple_id) and (visibility = 'shared' or created_by = auth.uid()));
create policy deco_insert on public.deco_entries for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
-- 수정/삭제는 작성자 본인만(상대가 비밀일기 수정·visibility 뒤집기·삭제 차단).
create policy deco_update on public.deco_entries for update using (public.is_couple_member(couple_id) and created_by = auth.uid()) with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy deco_delete on public.deco_entries for delete using (public.is_couple_member(couple_id) and created_by = auth.uid());

-- storage 정책(2026-08-25 여기로 이동 + 비밀일기 사진 가드 추가): 상대의 private 일기
-- (photo_paths)가 참조하는 파일이면 차단. 행 수준(deco_select)은 이미 가리지만 storage 는
-- 폴더=couple 만 봐서 list+createSignedUrl 로 열람이 됐다. 오브젝트 이동 없이 정책만으로
-- 기존 사진까지 즉시 보호. SECURITY DEFINER 인 이유: 조회 주체의 RLS(deco_select)가
-- 상대의 private 행을 숨기면 정책 서브쿼리도 빈손이 되어 가드가 무력화된다.
-- ⚠ 함수는 **private 스키마**(PostgREST 비노출)에 둔다 — public 에 두면 /rest/v1/rpc 로
--   노출되어 '이 파일이 상대의 비밀일기에 있는가'를 묻는 오라클이 된다(상대는 공유 시절
--   경로를 알고 있어 삭제/비밀 전환을 구분할 수 있었다). [리뷰 2026-08-25]
create schema if not exists private;
grant usage on schema private to authenticated, anon;
create or replace function private.deco_photo_blocked(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deco_entries d
    where d.visibility = 'private'
      and d.created_by <> auth.uid()
      and d.photo_paths @> array[p_name]
  );
$$;
grant execute on function private.deco_photo_blocked(text) to authenticated, anon;
-- @> 는 GIN 을 탄다(= any() 는 못 탐). private 행만 담는 파셜 인덱스.
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
drop function if exists public.deco_photo_blocked(text); -- 옛 노출 버전 정리(재실행 멱등)

-- 반응/댓글 가시성 = 부모 일기 가시성(비밀일기는 작성자만). couple_id 신뢰 대신 entry 로 판정.
create or replace function public.can_view_entry(p_entry uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.deco_entries e
    where e.id = p_entry
      and public.is_couple_member(e.couple_id)
      and (e.visibility = 'shared' or e.created_by = auth.uid())
  );
$$;
do $$ begin
  alter publication supabase_realtime add table public.deco_entries;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 커플 버킷리스트 (함께 하고 싶은 일 목록 + 완료 체크).
create table if not exists public.couple_bucket (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  title      text not null,
  category   text not null default 'etc',
  done       boolean not null default false,
  done_at    timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists couple_bucket_couple_idx on public.couple_bucket (couple_id, created_at desc);
alter table public.couple_bucket enable row level security;
drop policy if exists bucket_select on public.couple_bucket;
drop policy if exists bucket_insert on public.couple_bucket;
drop policy if exists bucket_update on public.couple_bucket;
drop policy if exists bucket_delete on public.couple_bucket;
create policy bucket_select on public.couple_bucket for select using (public.is_couple_member(couple_id));
create policy bucket_insert on public.couple_bucket for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy bucket_update on public.couple_bucket for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy bucket_delete on public.couple_bucket for delete using (public.is_couple_member(couple_id));
do $$ begin
  alter publication supabase_realtime add table public.couple_bucket;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 진단 로그 (푸시/앱 디버깅). 본인 것만 read/insert (RLS 로 스코프) — getDebugLogs 는
-- user 필터 없이 select 하지만 RLS 가 auth.uid() 로 제한하므로 타인 로그 노출 없음.
create table if not exists public.debug_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid(),
  tag        text not null,
  detail     text,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists debug_logs_user_idx on public.debug_logs (user_id, created_at desc);
alter table public.debug_logs enable row level security;
drop policy if exists debug_own_insert on public.debug_logs;
drop policy if exists debug_own_select on public.debug_logs;
create policy debug_own_insert on public.debug_logs
  for insert with check (user_id = auth.uid());
create policy debug_own_select on public.debug_logs
  for select using (user_id = auth.uid());

-- 일기 반응(이모지) — couple_id 비정규화로 RLS 가 join 없이 is_couple_member 판정.
create table if not exists public.entry_reactions (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.deco_entries(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  emoji      text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (entry_id, created_by, emoji)
);
create index if not exists entry_reactions_entry_idx on public.entry_reactions(entry_id);
alter table public.entry_reactions enable row level security;
drop policy if exists er_select on public.entry_reactions;
drop policy if exists er_insert on public.entry_reactions;
drop policy if exists er_delete on public.entry_reactions;
create policy er_select on public.entry_reactions for select using (public.can_view_entry(entry_id));
create policy er_insert on public.entry_reactions for insert with check (public.can_view_entry(entry_id) and created_by = auth.uid() and couple_id = (select couple_id from public.deco_entries where id = entry_id));
create policy er_delete on public.entry_reactions for delete using (created_by = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.entry_reactions;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 일기 댓글(한 줄).
create table if not exists public.entry_comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.deco_entries(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  body       text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists entry_comments_entry_idx on public.entry_comments(entry_id, created_at);
alter table public.entry_comments enable row level security;
drop policy if exists ec_select on public.entry_comments;
drop policy if exists ec_insert on public.entry_comments;
drop policy if exists ec_delete on public.entry_comments;
create policy ec_select on public.entry_comments for select using (public.can_view_entry(entry_id));
create policy ec_insert on public.entry_comments for insert with check (public.can_view_entry(entry_id) and created_by = auth.uid() and couple_id = (select couple_id from public.deco_entries where id = entry_id));
create policy ec_delete on public.entry_comments for delete using (created_by = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.entry_comments;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 오늘의 로그 — 하루 2슬롯(오전 00시~/오후 12시~), 사람·슬롯당 1개(unique 로 서버 강제).
create table if not exists public.couple_logs (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  log_date   date not null,
  slot       text not null check (slot in ('am','pm')),
  body       text,                                  -- 캡션(선택)
  emoji      text,
  video_path text,                                  -- 3초 브이로그(Storage). 영상 또는 body 중 1개 필수
  constraint clogs_content_check check (video_path is not null or (body is not null and length(trim(body)) > 0)),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, created_by, log_date, slot)
);
create index if not exists couple_logs_couple_idx on public.couple_logs(couple_id, log_date desc);
alter table public.couple_logs enable row level security;
drop policy if exists clogs_select on public.couple_logs;
drop policy if exists clogs_insert on public.couple_logs;
drop policy if exists clogs_update on public.couple_logs;
drop policy if exists clogs_delete on public.couple_logs;
create policy clogs_select on public.couple_logs for select using (public.is_couple_member(couple_id));
-- 시간 규칙도 서버 강제(KST): '현재 슬롯'만 작성/수정 — 단 경계 5분 유예(11:59 촬영 → 12:01 게시 허용).
create policy clogs_insert on public.couple_logs for insert with check (
  public.is_couple_member(couple_id) and created_by = auth.uid()
  and (
    (log_date = (now() at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
    or
    (log_date = ((now() - interval '5 min') at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from (now() - interval '5 min') at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
  )
);
create policy clogs_update on public.couple_logs for update using (created_by = auth.uid()) with check (
  created_by = auth.uid() and public.is_couple_member(couple_id)  -- couple_id 변조로 타 커플 주입 차단
  and (
    (log_date = (now() at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
    or
    (log_date = ((now() - interval '5 min') at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from (now() - interval '5 min') at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
  )
);
create policy clogs_delete on public.couple_logs for delete using (created_by = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.couple_logs;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 채팅(쿡찌르기) 읽음 표시 — 사람별 '마지막으로 읽은 시각'. 상대 시각 ≥ 내 메시지 시각이면 '읽음'.
create table if not exists public.chat_reads (
  couple_id    uuid not null references public.couples(id) on delete cascade,
  user_id      uuid not null default auth.uid(),
  last_read_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
alter table public.chat_reads enable row level security;
drop policy if exists chat_reads_select on public.chat_reads;
drop policy if exists chat_reads_insert on public.chat_reads;
drop policy if exists chat_reads_update on public.chat_reads;
create policy chat_reads_select on public.chat_reads for select using (public.is_couple_member(couple_id));
create policy chat_reads_insert on public.chat_reads for insert with check (public.is_couple_member(couple_id) and user_id = auth.uid());
-- update 에도 멤버십(2026-08-25): mood_update 와 같은 이유.
create policy chat_reads_update on public.chat_reads for update using (user_id = auth.uid() and public.is_couple_member(couple_id)) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
do $$ begin
  alter publication supabase_realtime add table public.chat_reads;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 쿡찌르기 이모지 반응 — couple_id 비정규화로 RLS 가 join 없이 is_couple_member 판정.
create table if not exists public.poke_reactions (
  id         uuid primary key default gen_random_uuid(),
  poke_id    uuid not null references public.pokes(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  emoji      text not null check (length(emoji) <= 16),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (poke_id, created_by, emoji)
);
create index if not exists poke_reactions_couple_idx on public.poke_reactions(couple_id);
alter table public.poke_reactions enable row level security;
drop policy if exists pr_select on public.poke_reactions;
drop policy if exists pr_insert on public.poke_reactions;
drop policy if exists pr_delete on public.poke_reactions;
create policy pr_select on public.poke_reactions for select using (public.is_couple_member(couple_id));
create policy pr_insert on public.poke_reactions for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid() and couple_id = (select couple_id from public.pokes where id = poke_id));
create policy pr_delete on public.poke_reactions for delete using (created_by = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.poke_reactions;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 브이로그(오늘의 로그) 댓글.
create table if not exists public.log_comments (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.couple_logs(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  body       text not null check (length(body) <= 2000),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists log_comments_log_idx on public.log_comments(log_id, created_at);
alter table public.log_comments enable row level security;
drop policy if exists lc_select on public.log_comments;
drop policy if exists lc_insert on public.log_comments;
drop policy if exists lc_delete on public.log_comments;
create policy lc_select on public.log_comments for select using (public.is_couple_member(couple_id));
create policy lc_insert on public.log_comments for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid() and couple_id = (select couple_id from public.couple_logs where id = log_id));
create policy lc_delete on public.log_comments for delete using (created_by = auth.uid());
do $$ begin
  alter publication supabase_realtime add table public.log_comments;
exception when duplicate_object then null; end $$; -- 재실행 멱등

-- 알림 설정 — 이벤트 카테고리별 on/off(prefs jsonb, 끈 것만 false) + 조용시간(KST 시).
-- Edge(send-poke-push)가 service_role 로 '수신자' 행을 읽어 서버측에서 게이트.
create table if not exists public.notify_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  prefs       jsonb not null default '{}'::jsonb,
  quiet_start smallint,
  quiet_end   smallint,
  updated_at  timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists nprefs_own on public.notify_prefs;
create policy nprefs_own on public.notify_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 미래에 열어보는 편지 — open_at 이전엔 수신자에게 안 보임(작성자는 항상 보임).
create table if not exists public.letters (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  from_user  uuid not null default auth.uid(),
  title      text,
  body       text not null,
  open_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists letters_couple_idx on public.letters(couple_id, open_at desc);
alter table public.letters enable row level security;
drop policy if exists letters_select on public.letters;
drop policy if exists letters_insert on public.letters;
drop policy if exists letters_delete on public.letters;
-- 시간 게이트: 작성자는 항상, 수신자(같은 커플)는 open_at 지난 것만.
create policy letters_select on public.letters for select using (public.is_couple_member(couple_id) and (from_user = auth.uid() or open_at <= now()));
create policy letters_insert on public.letters for insert with check (public.is_couple_member(couple_id) and from_user = auth.uid());
create policy letters_delete on public.letters for delete using (from_user = auth.uid());

-- ⚠ 기념일 예약 푸시: Edge Function 'daily-reminders' + pg_cron('0 0 * * *') + pg_net 로
--   구성(코드/DB 밖). CRON_SECRET 헤더로 보호. 상세는 README/함수 소스 참고.

-- ============================================================================
-- 입력 크기 가드 (직접 API 남용 방어 — 클라 maxLength 와 짝, 서버측 강제). 재실행 가능.
--   · CHECK 에는 now() 등 non-immutable 함수 불가 → open_at 은 고정 상한으로.
--   · emoji 는 정규식 대신 길이 상한(ZWJ 시퀀스 포함 넉넉히).
-- ============================================================================
alter table public.pokes          drop constraint if exists pokes_message_len;
alter table public.pokes          add  constraint pokes_message_len check (message is null or length(message) <= 200);
alter table public.couple_bucket  drop constraint if exists bucket_title_len;
alter table public.couple_bucket  add  constraint bucket_title_len check (length(title) <= 500);
alter table public.entry_comments drop constraint if exists comment_body_len;
alter table public.entry_comments add  constraint comment_body_len check (length(body) <= 2000);
alter table public.deco_entries   drop constraint if exists deco_body_len;
alter table public.deco_entries   add  constraint deco_body_len check (body is null or length(body) <= 10000);
alter table public.couple_logs    drop constraint if exists log_emoji_len;
alter table public.couple_logs    add  constraint log_emoji_len check (emoji is null or length(emoji) <= 16);
-- 브이로그 캡션(body) 서버측 길이 캡 — 클라 60자, 직접 API 남용 방어 (2026-07-03)
alter table public.couple_logs    drop constraint if exists log_body_len;
alter table public.couple_logs    add  constraint log_body_len check (body is null or length(body) <= 200);
alter table public.letters        drop constraint if exists letter_body_len;
alter table public.letters        add  constraint letter_body_len check (length(body) <= 50000);
alter table public.letters        drop constraint if exists letter_open_at_sane;
alter table public.letters        add  constraint letter_open_at_sane check (open_at <= timestamptz '2100-01-01');

-- ============================================================================
-- 게임 아케이드 — 커플 1:1 비동기 미니게임(반응속도/기억력) + 포인트·전적
-- 점수는 전부 game_attempts 에 저장(reveal-gate 로 '내가 해야 상대 점수 열림').
-- 승패 판정·winner 확정은 resolve_challenge RPC(security definer)만. [2026-07-06]
-- ============================================================================
create table if not exists public.game_challenges (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  game text not null check (game in ('reaction','memory','tap','order','timing','tetris')),
  seed bigint not null,
  challenger uuid not null default auth.uid(),
  status text not null default 'open' check (status in ('open','resolved')),
  winner uuid,                                   -- RPC 만 기록
  result text check (result in ('a','b','draw')), -- 챌린저=a 기준
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists game_challenges_couple_idx on public.game_challenges(couple_id, created_at desc);

create table if not exists public.game_attempts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  challenge_id uuid not null references public.game_challenges(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  score int not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index if not exists game_attempts_challenge_idx on public.game_attempts(challenge_id);

-- reveal-gate: 내가 이 챌린지에 시도를 냈는지 (상대 점수는 내가 해야 열림)
create or replace function public.game_i_played(p_challenge uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.game_attempts a
    where a.challenge_id = p_challenge and a.user_id = auth.uid());
$$;

alter table public.game_challenges enable row level security;
drop policy if exists gc_select on public.game_challenges;
drop policy if exists gc_insert on public.game_challenges;
create policy gc_select on public.game_challenges for select using (public.is_couple_member(couple_id));
create policy gc_insert on public.game_challenges for insert with check (
  public.is_couple_member(couple_id) and challenger = auth.uid()
);
-- winner/result update 는 resolve_challenge RPC 만 (직접 update 정책 미부여)

alter table public.game_attempts enable row level security;
drop policy if exists ga_select on public.game_attempts;
drop policy if exists ga_insert on public.game_attempts;
create policy ga_select on public.game_attempts for select using (
  public.is_couple_member(couple_id)
  and (user_id = auth.uid() or public.game_i_played(challenge_id))
);
create policy ga_insert on public.game_attempts for insert with check (
  public.is_couple_member(couple_id) and user_id = auth.uid()
  and exists (select 1 from public.game_challenges c
    where c.id = challenge_id and c.couple_id = game_attempts.couple_id)
);

-- 점수 타당성(게임별 물리적 상한/하한) — 클라 계산 점수라 조작 가능 → 서버가 '불가능한 값'을 막는다.
-- (완전 방지는 불가하나 0ms/음수/INT_MAX 같은 '영원히 안 지는' 조작을 차단. reveal-gate/평균은 별개.)
-- ⚠ src/lib/game.ts 의 점수 함수 범위와 정합해야 한다(한쪽 바꾸면 재검토).
create or replace function public.game_score_plausible(p_game text, p_score int)
returns boolean language sql immutable as $$
  select case p_game
    when 'reaction' then p_score between 80 and 10000        -- ms, 하한=사람 반응 한계(9999 센티넬 포함)
    when 'memory'   then p_score between 0 and 1000          -- memoryScore 상한 1000
    when 'tap'      then p_score between 0 and 150           -- 5초간 탭(30/s 초과 불가)
    when 'order'    then p_score between 500 and 10000000    -- ms+오탭*2000, 16탭<500ms 불가
    when 'timing'   then p_score between 0 and 1000          -- 목표거리 0~1000
    when 'tetris'   then p_score between 0 and 400000        -- 2분 울트라 점수(프로 ~25만)
    else false
  end;
$$;

-- game_attempts.score 방어: (1) 넓은 범위 CHECK(음수/INT_MAX 차단), (2) 트리거로 게임별 정밀 검증.
alter table public.game_attempts drop constraint if exists game_attempts_score_sane;
alter table public.game_attempts add constraint game_attempts_score_sane
  check (score >= 0 and score <= 100000000) not valid;  -- not valid: 기존행 무검사, 신규만 강제
create or replace function public.game_attempt_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_game text;
begin
  select game into v_game from public.game_challenges where id = new.challenge_id;
  if v_game is null then raise exception 'challenge not found'; end if;
  if not public.game_score_plausible(v_game, new.score) then
    raise exception '비정상 점수' using errcode = 'P0001';  -- 게임별 물리 범위 밖
  end if;
  return new;
end;
$$;
drop trigger if exists game_attempts_validate on public.game_attempts;
create trigger game_attempts_validate before insert on public.game_attempts
  for each row execute function public.game_attempt_check();

-- 챌린지 생성 + 챌린저 본인 점수(attempt) 원자적 삽입
create or replace function public.create_challenge(p_game text, p_seed bigint, p_score int)
returns public.game_challenges
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.game_challenges;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode='28000'; end if;
  select couple_id into v_couple from public.couple_members where user_id = v_uid limit 1;
  if v_couple is null then raise exception '커플이 없습니다.'; end if;
  insert into public.game_challenges (couple_id, game, seed, challenger)
    values (v_couple, p_game, p_seed, v_uid)
    returning * into v_row;
  insert into public.game_attempts (couple_id, challenge_id, user_id, score)
    values (v_couple, v_row.id, v_uid, p_score);
  return v_row;
end;
$$;
grant execute on function public.create_challenge(text, bigint, int) to authenticated, anon;

-- 승패 판정: 양쪽 attempt 존재 시 서버에서 winner 확정(멱등, status='open' 조건부 update 직렬화)
create or replace function public.resolve_challenge(p_challenge uuid)
returns public.game_challenges
language plpgsql security definer set search_path = public as $$
declare
  v_c public.game_challenges;
  v_ch_score int; v_op uuid; v_op_score int; v_result text; v_winner uuid;
begin
  select * into v_c from public.game_challenges where id = p_challenge;
  if v_c.id is null then raise exception 'not found'; end if;
  if not public.is_couple_member(v_c.couple_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if v_c.status = 'resolved' then return v_c; end if;

  select score into v_ch_score from public.game_attempts
    where challenge_id = p_challenge and user_id = v_c.challenger;
  select user_id, score into v_op, v_op_score from public.game_attempts
    where challenge_id = p_challenge and user_id <> v_c.challenger limit 1;
  if v_ch_score is null or v_op is null then return v_c; end if; -- 아직 양쪽 미완

  -- 방향: memory/tap/tetris=높은 점수 승, 그 외(reaction/order/timing)=낮은 점수 승.
  -- ⚠ src/lib/game.ts GAME_DIR 와 동일해야 한다.
  if v_c.game = 'reaction' and abs(v_ch_score - v_op_score) <= 15 then
    v_result := 'draw';
  elsif v_ch_score = v_op_score then
    v_result := 'draw';
  elsif v_c.game in ('memory','tap','tetris') then
    v_result := case when v_ch_score > v_op_score then 'a' else 'b' end;
  else
    v_result := case when v_ch_score < v_op_score then 'a' else 'b' end;
  end if;
  v_winner := case v_result when 'a' then v_c.challenger when 'b' then v_op else null end;

  update public.game_challenges
    set status='resolved', winner=v_winner, result=v_result, resolved_at=now()
    where id = p_challenge and status='open'
    returning * into v_c;
  if v_c.id is null then select * into v_c from public.game_challenges where id = p_challenge; end if;
  return v_c;
end;
$$;
grant execute on function public.resolve_challenge(uuid) to authenticated, anon;

do $$ begin alter publication supabase_realtime add table public.game_challenges; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_attempts; exception when duplicate_object then null; end $$;

-- ============================================================================
-- 게임 글로벌 순위판 + 일일 1판 제한 [2026-07-06]
-- 한 판 = 3라운드(클라에서 평균 산출) → record_play 를 판당 1번 호출. 게임별 하루 1판
-- (KST) 제한이라 game_daily.plays 는 '판 수'를 센다(라운드 수 아님). 최고 기록(평균)이
-- 전체 사용자 공개 순위판에 오른다. best_score 는 record_play RPC 만(조작 방지),
-- 이름/한마디는 본인 행만(컬럼 권한). ⚠ 일일 캡은 src/lib/game.ts DAILY_MATCHES 와 동일.
-- ============================================================================

-- 일일 판 카운트 (본인만 조회, 갱신은 RPC) — plays = 오늘 친 판 수(라운드 아님)
create table if not exists public.game_daily (
  user_id uuid not null default auth.uid(),
  game text not null check (game in ('reaction','memory','tap','order','timing','tetris')),
  play_date date not null,
  plays int not null default 0,
  primary key (user_id, game, play_date)
);
alter table public.game_daily enable row level security;
drop policy if exists daily_select on public.game_daily;
create policy daily_select on public.game_daily for select using (user_id = auth.uid());
-- insert/update 는 record_play(security definer) 만

-- 순위판 (전체 로그인 사용자 공개 읽기)
create table if not exists public.game_ranks (
  user_id uuid not null default auth.uid(),
  game text not null check (game in ('reaction','memory','tap','order','timing','tetris')),
  best_score int not null,
  display_name text not null,
  message text,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_ranks enable row level security;
drop policy if exists ranks_select on public.game_ranks;
drop policy if exists ranks_update on public.game_ranks;
-- select 정책 없음(2026-08-25): 순위판 UI 가 내려가 읽는 코드가 0 인데 닉네임·한마디가
-- 전 계정 공개로 남아 있었다. 정책 미생성 = 전면 차단, 데이터·기록 RPC 는 보존.
-- 순위판을 되살리면 아래 한 줄을 복원할 것:
-- create policy ranks_select on public.game_ranks for select using (auth.role() = 'authenticated');
-- 본인 행만 이름/한마디 수정 (best_score 는 컬럼 권한으로 차단)
create policy ranks_update on public.game_ranks for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 컬럼 권한: 조작 방지 — best_score 는 클라가 못 바꾸고 이름/한마디만. RPC(owner) 는 무관.
revoke update on public.game_ranks from authenticated;
grant update (display_name, message) on public.game_ranks to authenticated;
-- 직접 insert 정책 없음(신규 진입은 record_play RPC 만)
create index if not exists game_ranks_board_idx on public.game_ranks(game, best_score);
-- 이름/한마디 길이 상한(서버 강제) — 컬럼 권한으로 직접 PATCH 가능하니 클라 slice(16/30)만으론 부족.
-- 전역 공개 보드라 초대형 문자열 저장→페이로드/레이아웃 붕괴 방지. [리뷰 2026-07-06]
alter table public.game_ranks drop constraint if exists game_ranks_name_len;
alter table public.game_ranks add constraint game_ranks_name_len
  check (char_length(display_name) <= 24) not valid;
alter table public.game_ranks drop constraint if exists game_ranks_msg_len;
alter table public.game_ranks add constraint game_ranks_msg_len
  check (message is null or char_length(message) <= 40) not valid;

-- 한 판 기록: 일일 1판 제한 + 최고 기록 갱신(방향 인지). remaining/isBest/rank 반환.
-- rank = 내 최고점의 전체 순위(1=최상위). 클라는 rank<=LEADERBOARD_TOP_N 일 때만 축하/등록.
create or replace function public.record_play(p_game text, p_score int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_date date := ((now() at time zone 'Asia/Seoul'))::date;  -- KST 오늘
  v_plays int;
  v_nick  text;
  v_disp  text;  -- 순위판 표시명 = 커플 닉네임(couple_members.nickname), 없으면 '익명'
  v_best  int;
  v_mybest int;
  v_rank int;
  v_higher boolean := p_game in ('memory','tap','tetris');  -- ⚠ src/lib/game.ts GAME_DIR 와 동일
  v_cap  int := 1;  -- 일일 캡(판 수). ⚠ src/lib/game.ts DAILY_MATCHES 와 동일해야 함(단일 소스화)
  v_is_best boolean := false;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  if p_game not in ('reaction','memory','tap','order','timing','tetris') then raise exception 'bad game'; end if;
  -- 전역 순위판 오염 차단(critical): 불가능한 점수는 거부. 클라 계산값이라 완전방지는 불가하나
  -- 0ms/음수/INT_MAX 같은 '영원히 1위' 조작을 막는다. [리뷰 2026-07-06]
  if not public.game_score_plausible(p_game, p_score) then
    raise exception '비정상 점수' using errcode = 'P0001';
  end if;

  insert into public.game_daily (user_id, game, play_date, plays)
    values (v_uid, p_game, v_date, 0)
    on conflict (user_id, game, play_date) do nothing;
  select plays into v_plays from public.game_daily
    where user_id = v_uid and game = p_game and play_date = v_date for update;
  if v_plays >= v_cap then
    raise exception '오늘 한 판 다 했어요. 자정(00시)에 초기화돼요.' using errcode = 'P0001';
  end if;
  update public.game_daily set plays = plays + 1
    where user_id = v_uid and game = p_game and play_date = v_date;

  -- 순위판 표시명은 커플 닉네임으로 고정(클라 임의 이름 금지). 최고기록 갱신마다 최신 닉네임으로 동기화.
  select nickname into v_nick from public.couple_members where user_id = v_uid limit 1;
  v_disp := coalesce(nullif(trim(v_nick), ''), '익명');
  select best_score into v_best from public.game_ranks where user_id = v_uid and game = p_game;
  if v_best is null then
    insert into public.game_ranks (user_id, game, best_score, display_name)
      values (v_uid, p_game, p_score, v_disp);
    v_is_best := true;
    v_mybest := p_score;
  elsif (v_higher and p_score > v_best) or (not v_higher and p_score < v_best) then
    update public.game_ranks set best_score = p_score, display_name = v_disp, updated_at = now()
      where user_id = v_uid and game = p_game;
    v_is_best := true;
    v_mybest := p_score;
  else
    v_mybest := v_best;
  end if;

  -- 내 최고점의 전체 순위(방향 인지): 나보다 '더 좋은' 사용자 수 + 1(동점은 같은 순위)
  if v_higher then
    select count(*) + 1 into v_rank from public.game_ranks
      where game = p_game and best_score > v_mybest;
  else
    select count(*) + 1 into v_rank from public.game_ranks
      where game = p_game and best_score < v_mybest;
  end if;

  return json_build_object('remaining', v_cap - (v_plays + 1), 'isBest', v_is_best, 'rank', v_rank, 'nick', v_disp);
end;
$$;
grant execute on function public.record_play(text, int) to authenticated, anon;

-- ============================================================================
-- 부루마블 실시간 보드게임 [2026-07-06] — 커플당 진행중 1판. 권위 상태=state jsonb,
-- 버전 낙관적 락으로 실시간 동기화. 룰 엔진은 클라(src/lib/boardgame.ts) — 커플 신뢰
-- 모델이라 상태 계산은 클라가 하고 서버는 '차례 소유 + 버전'만 강제(비-차례자 쓰기·유실 방지).
-- state.turn(0|1) ↔ players[] 인덱스 매핑. turn_user/winner_user 는 RPC 가 서버측 파생.
-- ============================================================================
create table if not exists public.board_games (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  players     uuid[] not null,                 -- [player0, player1] user_id (state.turn 과 매핑)
  state       jsonb not null,
  version     int not null default 1,
  turn_user   uuid not null,                   -- 현재 차례 사용자(액션 권한)
  status      text not null default 'playing' check (status in ('playing','over')),
  winner_user uuid,
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists board_games_couple_idx on public.board_games(couple_id, created_at desc);
alter table public.board_games enable row level security;
drop policy if exists bg_select on public.board_games;
drop policy if exists bg_delete on public.board_games;
create policy bg_select on public.board_games for select using (public.is_couple_member(couple_id));
create policy bg_delete on public.board_games for delete using (public.is_couple_member(couple_id));
-- insert/update 는 RPC(security definer) 만 — 상태 무결성(직접 정책 미부여)
do $$ begin alter publication supabase_realtime add table public.board_games; exception when duplicate_object then null; end $$;

-- 새 판 생성: 커플의 진행중 판을 정리하고 creator=player0(선공)으로 시작. 초기 state 는 클라가 구성.
create or replace function public.bg_create(p_seed bigint, p_state jsonb)
returns public.board_games language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_partner uuid;
  v_row public.board_games;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  select couple_id into v_couple from public.couple_members where user_id = v_uid limit 1;
  if v_couple is null then raise exception '커플이 없습니다.'; end if;
  select user_id into v_partner from public.couple_members
    where couple_id = v_couple and user_id <> v_uid limit 1;
  if v_partner is null then raise exception '상대가 아직 없어요.'; end if;
  delete from public.board_games where couple_id = v_couple and status = 'playing';
  insert into public.board_games (couple_id, players, state, version, turn_user, status, created_by)
    values (v_couple, array[v_uid, v_partner], p_state, 1, v_uid, 'playing', v_uid)
    returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.bg_create(bigint, jsonb) to authenticated, anon;

-- 액션 커밋: 차례자만, 버전 일치(낙관적 락)해야 통과. status/turn_user/winner_user 는 모두
-- 서버가 '제출된 state'에서 파생(클라의 임의 status/winner 파라미터를 신뢰하지 않음) → 무결성.
-- [리뷰 2026-07-06] 예전 5-인자(p_status/p_winner_idx) 버전은 제거.
drop function if exists public.bg_action(uuid, int, jsonb, text, int);
create or replace function public.bg_action(p_id uuid, p_expected_version int, p_state jsonb)
returns public.board_games language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.board_games;
  v_turn_idx int;
  v_next_turn uuid;
  v_phase text;
  v_status text;
  v_winner_idx int;
  v_winner uuid;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  select * into v_row from public.board_games where id = p_id for update;
  if v_row.id is null then raise exception 'not found'; end if;
  if not public.is_couple_member(v_row.couple_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.status = 'over' then raise exception '이미 끝난 판입니다.'; end if;
  if v_row.turn_user <> v_uid then raise exception '지금은 상대 차례예요.' using errcode = 'P0001'; end if;
  if v_row.version <> p_expected_version then raise exception 'stale' using errcode = 'PT409'; end if;

  v_turn_idx := (p_state->>'turn')::int;
  if v_turn_idx not in (0, 1) then raise exception 'bad turn'; end if;
  v_next_turn := v_row.players[v_turn_idx + 1];  -- SQL 배열 1-indexed

  -- status/winner 를 제출된 state 에서 파생(파라미터로 임의 지정 불가 → over/winner 위조 방지)
  v_phase := p_state->>'phase';
  v_status := case when v_phase = 'over' then 'over' else 'playing' end;
  if v_phase = 'over' and (p_state->>'winner') is not null then
    v_winner_idx := (p_state->>'winner')::int;
    if v_winner_idx in (0, 1) then v_winner := v_row.players[v_winner_idx + 1]; end if;
  end if;

  update public.board_games
    set state = p_state, version = version + 1, turn_user = v_next_turn,
        status = v_status, winner_user = v_winner, updated_at = now()
    where id = p_id
    returning * into v_row;
  -- 방금 over 로 전환됐으면 전적 기록(멱등 — 게임당 1행). 여기서 v_row.status 는 갱신 후 값.
  if v_status = 'over' then
    insert into public.board_results (game_id, couple_id, players, winner_user)
      values (v_row.id, v_row.couple_id, v_row.players, v_winner)
      on conflict (game_id) do nothing;
  end if;
  return v_row;
end;
$$;
grant execute on function public.bg_action(uuid, int, jsonb) to authenticated, anon;

-- 항복: 차례 무관하게(상대 차례에도) 누구나 포기 가능 → 상대 승리. state 도 서버가 패치.
create or replace function public.bg_resign(p_id uuid)
returns public.board_games language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.board_games;
  v_me int;   -- 1-based
  v_win int;  -- 1-based
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  select * into v_row from public.board_games where id = p_id for update;
  if v_row.id is null then raise exception 'not found'; end if;
  if not public.is_couple_member(v_row.couple_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.status = 'over' then return v_row; end if;
  v_me := array_position(v_row.players, v_uid);
  if v_me is null then raise exception 'not a player' using errcode = '42501'; end if;
  v_win := 3 - v_me;  -- 2명: 1↔2
  update public.board_games
    set status = 'over',
        winner_user = v_row.players[v_win],
        state = jsonb_set(jsonb_set(state, '{phase}', '"over"'::jsonb), '{winner}', to_jsonb(v_win - 1)),
        version = version + 1,
        updated_at = now()
    where id = p_id
    returning * into v_row;
  -- 항복도 전적에 기록(멱등)
  insert into public.board_results (game_id, couple_id, players, winner_user)
    values (v_row.id, v_row.couple_id, v_row.players, v_row.winner_user)
    on conflict (game_id) do nothing;
  return v_row;
end;
$$;
grant execute on function public.bg_resign(uuid) to authenticated, anon;

-- 부루마블 전적 로그 — 끝난 판마다 1행(game_id 멱등). board_games 원본이 삭제(닫기)돼도 전적은
-- 보존되도록 FK 없이 game_id 유니크. winner_user null = 무승부. insert 는 RPC(bg_action/bg_resign)만.
create table if not exists public.board_results (
  game_id     uuid primary key,                -- board_games.id (멱등 키, FK 없음)
  couple_id   uuid not null references public.couples(id) on delete cascade,
  players     uuid[] not null,                 -- [player0, player1]
  winner_user uuid,                            -- null = 무승부
  ended_at    timestamptz not null default now()
);
create index if not exists board_results_couple_idx on public.board_results(couple_id);
alter table public.board_results enable row level security;
drop policy if exists br_select on public.board_results;
create policy br_select on public.board_results for select using (public.is_couple_member(couple_id));
-- insert/update/delete 정책 미부여 — 기록은 RPC(security definer)만(전적 위조/삭제 방지)

-- 게임 프로필 — 보드게임 '말' 스킨(이모지). 포인트로 잠금 해제(커플 신뢰 모델이라 포인트
-- 계산·차감은 클라, 여기엔 선택 말·보유 목록·누적지출만 저장). 상대 말 표시 위해 커플간 조회 허용.
create table if not exists public.game_profile (
  user_id      uuid primary key default auth.uid(),
  token        text not null default '🚗' check (char_length(token) <= 8),
  owned        text[] not null default array['🚗','🐰'],
  points_spent int not null default 0 check (points_spent >= 0),
  updated_at   timestamptz not null default now()
);
alter table public.game_profile enable row level security;
drop policy if exists gp_select on public.game_profile;
drop policy if exists gp_insert on public.game_profile;
drop policy if exists gp_update on public.game_profile;
-- 본인 또는 같은 커플 상대의 프로필 조회(보드에 상대 말 표시 — 코스메틱, 비민감)
create policy gp_select on public.game_profile for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.couple_members a
    join public.couple_members b on a.couple_id = b.couple_id
    where a.user_id = auth.uid() and b.user_id = game_profile.user_id
  )
);
create policy gp_insert on public.game_profile for insert with check (user_id = auth.uid());
create policy gp_update on public.game_profile for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 테트리스 실시간 대결 전적 [2026-07-07]
-- 점수 대결(하루 1판)은 기존 game_challenges/game_ranks 인프라를 그대로 쓰고(게임 키
-- 'tetris' 추가), 이 테이블은 '실시간 공격전'(무제한, Realtime broadcast 채널) 전용.
-- 승패는 ephemeral 채널에서 확정되므로 서버 판정 RPC 가 없다 → 참가자가 기록하는
-- 커플 신뢰 모델(game_profile 상점과 같은 수준 — 사적(커플 내) 전적, 전역 순위판 아님).
-- match_id = `${seed}:${시작ts}` 로 양쪽 동일 → PK 멱등(양쪽이 각자 insert 해도 1행).
-- ============================================================================
create table if not exists public.tetris_results (
  match_id     text primary key check (char_length(match_id) <= 64),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  winner_user  uuid,                          -- null = 무승부(동시 탑아웃 등)
  loser_user   uuid,
  winner_score int not null default 0,
  loser_score  int not null default 0,
  ended_at     timestamptz not null default now()
);
create index if not exists tetris_results_couple_idx on public.tetris_results(couple_id, ended_at desc);
alter table public.tetris_results enable row level security;
drop policy if exists tetris_res_select on public.tetris_results;
drop policy if exists tetris_res_insert on public.tetris_results;
create policy tetris_res_select on public.tetris_results for select using (public.is_couple_member(couple_id));
create policy tetris_res_insert on public.tetris_results for insert with check (
  public.is_couple_member(couple_id)
  and (
    winner_user = auth.uid() or loser_user = auth.uid()
    or (winner_user is null and loser_user is null) -- 무승부(동시 탑아웃): 커플 멤버면 기록 허용 [리뷰 2026-07-07]
  )
);
-- update/delete 정책 미부여 — 기록 조작 방지(멱등 insert 만)

-- ============================================================================
-- 우리 섬 [2026-07-22] — 커플당 지속형 공유 세계(정원+펫+꾸미기). 커플당 1개(couple_id PK).
-- 권위 상태=state jsonb + version 낙관적 락. 부루마블과 달리 '차례' 없음 — 둘 다 언제나 액션,
-- 버전만 강제(동시 갱신 유실 방지). 룰은 클라(src/lib/island.ts), 서버는 버전만.
-- ============================================================================
create table if not exists public.couple_island (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  state      jsonb not null,
  version    int not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.couple_island enable row level security;
drop policy if exists island_select on public.couple_island;
create policy island_select on public.couple_island for select using (public.is_couple_member(couple_id));
-- insert/update 는 RPC(security definer) 만
do $$ begin alter publication supabase_realtime add table public.couple_island; exception when duplicate_object then null; end $$;

-- 섬 생성(커플당 1개, 멱등) — 이미 있으면 기존 것 반환(덮어쓰지 않음). 초기 state 는 클라 구성.
create or replace function public.island_create(p_state jsonb)
returns public.couple_island language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.couple_island;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  select couple_id into v_couple from public.couple_members where user_id = v_uid limit 1;
  if v_couple is null then raise exception '커플이 없습니다.'; end if;
  insert into public.couple_island (couple_id, state, version, updated_by)
    values (v_couple, p_state, 1, v_uid)
    on conflict (couple_id) do nothing;
  select * into v_row from public.couple_island where couple_id = v_couple;
  return v_row;
end;
$$;
grant execute on function public.island_create(jsonb) to authenticated, anon;

-- 액션 커밋 — 커플 멤버 + 버전 일치(낙관적 락)해야 통과. 차례 없음(둘 다 자유).
create or replace function public.island_action(p_expected_version int, p_state jsonb)
returns public.couple_island language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.couple_island;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
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
grant execute on function public.island_action(int, jsonb) to authenticated, anon;

-- ============================================================================
-- 홈 빨랫줄 사진 선택 (2026-08-04) — couples.hung_paths
-- 홈 히어로의 끈에 걸 사진을 **커플이 직접 고른다**(기본은 최근 4장 자동).
-- cover_path 와 똑같은 방식: 컬럼 하나 + 컬럼 단위 grant 확장.
-- ⚠ 이 grant 는 **누적이 아니라 재선언**이다 — 컬럼을 추가할 때 기존 컬럼을 빠뜨리면
--    시작일/대표사진 수정이 조용히 막힌다(revoke 가 먼저 돌기 때문).
-- ============================================================================
alter table public.couples add column if not exists hung_paths text[];
revoke update on public.couples from anon, authenticated;
grant  update (start_date, cover_path, hung_paths) on public.couples to authenticated;

-- ============================================================================
-- 제품 신뢰·5탭 IA 백엔드 확장 (2026-08-25)
-- 기존 프로젝트 정본은 migrations/20260825010000_product_trust_and_ia.sql.
-- 이 복사본은 새 빈 프로젝트 bootstrap이 같은 최종 스키마를 갖게 하기 위한 것이다.
-- ============================================================================
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

-- ============================================================================
-- 3차 리뷰 반영(2026-08-26) — migrations/20260826000000_review_round3.sql 원문 포함
-- (신규 bootstrap = 운영 migration 동일 보장, review-round3-sync 테스트가 잠근다)
-- ============================================================================
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

-- ============================================================================
-- 옛 게임 표 정리(2026-09-24) — migrations/20260924000000_drop_old_game_tables.sql 원문 포함
-- (신규 bootstrap 도 위에서 만든 옛 게임 표를 여기서 다시 내린다 — 운영 DB 와 같은 최종 스키마)
-- ============================================================================
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

-- ============================================================================
-- 3초 로그 영상 보관 기간(2026-09-24) — migrations/20260924010000_log_video_retention.sql 원문 포함
-- ============================================================================
-- 3초 로그 영상 보관 기간 — 90일이 지나면 영상만 정리한다 [2026-09-24]
-- [사용자: "너가 뺴야할 기능들 제안했던것도 다 뺄 수 있도록 진행해"
--  — 제안: "3초 로그 영상: 오래된 영상 자동 정리(90일 뒤 영상만 지우고 글은 유지)"]
--
-- 영상 한 편 ≈ 0.5MB, 둘이 하루 두 번이면 1년에 약 0.76GB — 무료 플랜 저장 공간(1GB)을 사진과 나눠 쓴다.
-- 90일이 지난 로그는 영상만 떼어 내고 글·이모지·날짜·댓글은 남긴다(행이 그대로라 연속 기록도 안 끊긴다).
--
-- 이 파일은 표도 행도 지우지 않는다(열 하나 · 제약 완화 · 함수 하나). 실제 정리는 daily-reminders 가 매 실행마다
-- 아래 함수를 불러 조금씩(회당 100편) 한다 — **이 SQL 을 실행하는 순간이 정리를 켜는 스위치다.**
-- 함수가 없으면 daily-reminders 는 정리를 조용히 건너뛴다. 다시 돌려도 안전하다.
-- schema.sql 끝에 이 파일이 그대로 포함된다(신규 bootstrap = 운영 migration 동일 보장 — logretention.test).
begin;

-- ── 1) 영상이 정리된 시각 + 내용 제약 완화 ─────────────────────────────────────
-- 로그는 '영상 또는 글' 중 하나가 꼭 있어야 한다(clogs_content_check). 영상만 있던 로그에서 영상을 떼면
-- 둘 다 없어지므로, 정리된 로그(video_expired_at 있음)만 예외로 둔다.
alter table public.couple_logs add column if not exists video_expired_at timestamptz;
alter table public.couple_logs drop constraint if exists clogs_content_check;
alter table public.couple_logs add constraint clogs_content_check check (
  video_path is not null
  or video_expired_at is not null
  or (body is not null and length(trim(body)) > 0)
);

-- ── 2) 오래된 영상 떼어 내기 — 서비스롤 전용 ───────────────────────────────────
-- 떼어 낸 (로그 id, 영상 경로)를 돌려주면 호출한 쪽이 Storage 에서 파일을 지운다.
-- DB 를 **먼저** 바꾸는 이유: 파일 삭제가 실패해도 남는 건 아무도 안 가리키는 고아 파일이라 media-gc 가
-- 수거한다. 반대 순서면 로그가 없는 파일을 가리키는 깨진 영상이 남는다(계정 삭제와 같은 원칙).
-- 날짜는 KST 기준 log_date(그 로그가 '어느 날의 기록'인지)로 잰다.
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
      select l.id, l.video_path
      from public.couple_logs l
      where l.video_path is not null
        and l.log_date < (now() at time zone 'Asia/Seoul')::date - p_keep_days
      order by l.log_date, l.id
      limit least(greatest(coalesce(p_limit, 0), 0), 500)
      for update of l skip locked
    )
    update public.couple_logs l
    set video_path = null, video_expired_at = now()
    from picked
    where l.id = picked.id
    returning l.id as expired_id, picked.video_path as expired_path
  loop
    log_id := r.expired_id;
    path := r.expired_path;
    return next;
  end loop;
end;
$$;
revoke all on function public.expire_log_videos(int, int) from public, anon, authenticated;
grant execute on function public.expire_log_videos(int, int) to service_role;

commit;

-- RLS 를 '행마다 함수 호출'에서 '한 번 계산한 집합'으로 · 함수 권한 정리 · 인덱스 · 크론 대기 시간 [2026-09-29 DB 점검]
--
-- 무엇이 느렸나: 정책이 is_couple_member(couple_id) · can_view_entry(entry_id) 를 **행마다** 불렀다. 둘 다 SECURITY DEFINER
-- 라 인라인이 안 되고, 행마다 함수 → 서브쿼리 → couple_members 조회가 돈다. 일기 반응 634행을 읽는 데 84ms(실측, 같은 결과를
-- 집합으로 계산하면 1ms) — 앱이 실제로 평균 155ms(반응) · 63ms(댓글) · 30ms(사진)씩 걸리던 이유다. 데이터가 커질수록 선형으로 는다.
-- auth.uid() 도 행마다 다시 계산됐다(Supabase 진단 auth_rls_initplan 39건).
--
-- 고침: 내 커플 목록을 private.my_couple_ids() 가 **문장당 한 번** 돌려주고(uncorrelated 서브쿼리라 해시로 한 번만 계산),
-- 정책은 couple_id in (select private.my_couple_ids()) 로 본다. auth.uid() 는 (select auth.uid()) 로 감싸 한 번만 계산한다.
-- 의미는 그대로다 — 쓰기 정책의 조건도 같고, 바뀐 건 계산 방식과 '누구에게 적용되나'(to authenticated)뿐이다.
--   · 익명 로그인 세션도 역할이 authenticated 라 그대로 통과한다. 빠지는 건 로그인 자체를 안 한(anon 키만 든) 요청뿐 —
--     예전엔 그 요청도 정책 함수를 돌리고 0행을 받았고, 이제는 정책에 걸리지 않아 곧바로 0행이다.
--   · storage.objects 정책(couple_photos_obj_all)은 건드리지 않는다 — 모든 역할에 적용되는 그대로.
-- ⚠ private.my_couple_ids() 는 authenticated 가 실행할 수 있어야 한다 — 정책 식은 **질의한 사용자의 권한으로** 돈다
--   (실행 권한을 걷으면 모든 조회가 permission denied 로 멈춘다). 노출 스키마(public)에 두지 않는 이유는 /rest/v1/rpc 로 안 보이게.
-- ⚠ 새 정책은 이 형태로 쓴다: (select auth.uid()) · couple_id in (select private.my_couple_ids()). rls-perf-sync.test 가 지킨다.
--
-- 함께 하는 것:
--   · 아직 인덱스가 없던 couple_id 3곳(일기 반응 · 일기 댓글 · 로그 댓글)과 couple_members.user_id(모든 정책이 이 조회를 탄다)
--   · 함수 권한: 트리거 전용 함수 4개와 앱 RPC 5개 · 정책 도우미를 로그인 안 한 요청에서 못 부르게. 트리거는 발동할 때 EXECUTE 를
--     다시 보지 않으므로 걷어도 동작한다. forbid_created_by_change 의 search_path 도 고정.
--   · 크론이 함수 응답을 기다리는 시간 5초(기본) → 30초: 함수가 4~11초 걸려 성공해도 기록엔 '시간 초과'로 남았다
--     (요청 자체는 나간다). 크론 명령에는 CRON_SECRET 이 들어 있어 레포에 못 적는다 — 그래서 명령 끝에 인자만 덧붙이는 식으로 고친다.
-- 이 파일은 전부 멱등이다(drop policy if exists → create · create or replace · if not exists · 이미 30초면 건너뜀).
-- schema.sql 끝에 이 파일이 그대로 포함된다(신규 bootstrap = 운영 migration 동일 보장 — rls-perf-sync.test).
begin;
set local lock_timeout = '10s';

-- ── 1) 헬퍼: 내가 속한 커플 ────────────────────────────────────────────────────
create schema if not exists private;
grant usage on schema private to authenticated, anon;

create or replace function private.my_couple_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.couple_id from public.couple_members m where m.user_id = (select auth.uid());
$$;
revoke all on function private.my_couple_ids() from public, anon;
grant execute on function private.my_couple_ids() to authenticated;

-- ── 2) 인덱스 ──────────────────────────────────────────────────────────────────
create index if not exists couple_members_user_idx on public.couple_members (user_id);
create index if not exists entry_reactions_couple_idx on public.entry_reactions (couple_id);
create index if not exists entry_comments_couple_idx on public.entry_comments (couple_id, created_at);
create index if not exists log_comments_couple_idx on public.log_comments (couple_id, created_at);

-- ── 3) 정책 ────────────────────────────────────────────────────────────────────
-- 활동함
drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

drop policy if exists activity_reads_insert on public.activity_reads;
drop policy if exists activity_reads_select on public.activity_reads;
drop policy if exists activity_reads_update on public.activity_reads;
create policy activity_reads_insert on public.activity_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));
create policy activity_reads_select on public.activity_reads for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy activity_reads_update on public.activity_reads for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 채팅 읽음
drop policy if exists chat_reads_insert on public.chat_reads;
drop policy if exists chat_reads_select on public.chat_reads;
drop policy if exists chat_reads_update on public.chat_reads;
create policy chat_reads_insert on public.chat_reads for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy chat_reads_select on public.chat_reads for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy chat_reads_update on public.chat_reads for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 버킷리스트
drop policy if exists bucket_delete on public.couple_bucket;
drop policy if exists bucket_insert on public.couple_bucket;
drop policy if exists bucket_select on public.couple_bucket;
drop policy if exists bucket_update on public.couple_bucket;
create policy bucket_delete on public.couple_bucket for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy bucket_insert on public.couple_bucket for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy bucket_select on public.couple_bucket for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy bucket_update on public.couple_bucket for update to authenticated
  using (couple_id in (select private.my_couple_ids()))
  with check (couple_id in (select private.my_couple_ids()));

-- 일정
drop policy if exists events_delete on public.couple_events;
drop policy if exists events_insert on public.couple_events;
drop policy if exists events_select on public.couple_events;
drop policy if exists events_update on public.couple_events;
create policy events_delete on public.couple_events for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy events_insert on public.couple_events for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy events_select on public.couple_events for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy events_update on public.couple_events for update to authenticated
  using (couple_id in (select private.my_couple_ids()))
  with check (couple_id in (select private.my_couple_ids()));

-- 섬
drop policy if exists island_select on public.couple_island;
create policy island_select on public.couple_island for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 3초 로그
drop policy if exists clogs_delete on public.couple_logs;
drop policy if exists clogs_insert on public.couple_logs;
drop policy if exists clogs_select on public.couple_logs;
drop policy if exists clogs_update on public.couple_logs;
create policy clogs_select on public.couple_logs for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy clogs_insert on public.couple_logs for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and (
    (log_date = (now() at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
    or
    (log_date = ((now() - interval '5 min') at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from (now() - interval '5 min') at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
  )
);
create policy clogs_update on public.couple_logs for update to authenticated using (created_by = (select auth.uid())) with check (
  created_by = (select auth.uid()) and couple_id in (select private.my_couple_ids())  -- couple_id 변조로 타 커플 주입 차단
  and (
    (log_date = (now() at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
    or
    (log_date = ((now() - interval '5 min') at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from (now() - interval '5 min') at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
  )
);
create policy clogs_delete on public.couple_logs for delete to authenticated
  using (created_by = (select auth.uid()));

-- 구성원
drop policy if exists members_delete on public.couple_members;
drop policy if exists members_select on public.couple_members;
drop policy if exists members_update on public.couple_members;
create policy members_delete on public.couple_members for delete to authenticated
  using (user_id = (select auth.uid()));
create policy members_select on public.couple_members for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy members_update on public.couple_members for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 사진
drop policy if exists photos_delete on public.couple_photos;
drop policy if exists photos_insert on public.couple_photos;
drop policy if exists photos_select on public.couple_photos;
create policy photos_delete on public.couple_photos for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy photos_insert on public.couple_photos for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy photos_select on public.couple_photos for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 커플
drop policy if exists couples_select on public.couples;
drop policy if exists couples_update on public.couples;
create policy couples_select on public.couples for select to authenticated
  using (id in (select private.my_couple_ids()));
create policy couples_update on public.couples for update to authenticated
  using (id in (select private.my_couple_ids()))
  with check (id in (select private.my_couple_ids()));

-- 진단 로그 · 알림 설정 · 푸시 구독(본인 것만)
drop policy if exists debug_own_insert on public.debug_logs;
drop policy if exists debug_own_select on public.debug_logs;
create policy debug_own_insert on public.debug_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy debug_own_select on public.debug_logs for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists nprefs_own on public.notify_prefs;
create policy nprefs_own on public.notify_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 일기장 — 비밀일기는 작성자만(visibility = 'private')
drop policy if exists deco_delete on public.deco_entries;
drop policy if exists deco_insert on public.deco_entries;
drop policy if exists deco_select on public.deco_entries;
drop policy if exists deco_update on public.deco_entries;
create policy deco_delete on public.deco_entries for delete to authenticated
  using (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy deco_insert on public.deco_entries for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy deco_select on public.deco_entries for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (visibility = 'shared' or created_by = (select auth.uid())));
create policy deco_update on public.deco_entries for update to authenticated
  using (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()))
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));

-- 일기 댓글 · 반응 — 볼 수 있는 일기(can_view_entry 와 같은 규칙)에만. 조회는 집합으로, 쓰기는 한 행이라 함수 그대로.
drop policy if exists ec_delete on public.entry_comments;
drop policy if exists ec_insert on public.entry_comments;
drop policy if exists ec_select on public.entry_comments;
create policy ec_delete on public.entry_comments for delete to authenticated
  using (created_by = (select auth.uid()));
create policy ec_insert on public.entry_comments for insert to authenticated with check (
  public.can_view_entry(entry_id) and created_by = (select auth.uid())
  and couple_id = (select d.couple_id from public.deco_entries d where d.id = entry_comments.entry_id)
);
create policy ec_select on public.entry_comments for select to authenticated using (
  entry_id in (
    select e.id from public.deco_entries e
    where e.couple_id in (select private.my_couple_ids())
      and (e.visibility = 'shared' or e.created_by = (select auth.uid()))
  )
);

drop policy if exists er_delete on public.entry_reactions;
drop policy if exists er_insert on public.entry_reactions;
drop policy if exists er_select on public.entry_reactions;
create policy er_delete on public.entry_reactions for delete to authenticated
  using (created_by = (select auth.uid()));
create policy er_insert on public.entry_reactions for insert to authenticated with check (
  public.can_view_entry(entry_id) and created_by = (select auth.uid())
  and couple_id = (select d.couple_id from public.deco_entries d where d.id = entry_reactions.entry_id)
);
create policy er_select on public.entry_reactions for select to authenticated using (
  entry_id in (
    select e.id from public.deco_entries e
    where e.couple_id in (select private.my_couple_ids())
      and (e.visibility = 'shared' or e.created_by = (select auth.uid()))
  )
);

-- 편지(UI 는 내려갔지만 데이터가 남아 있다) — 열릴 시각이 지나야 상대가 본다
drop policy if exists letters_delete on public.letters;
drop policy if exists letters_insert on public.letters;
drop policy if exists letters_select on public.letters;
create policy letters_delete on public.letters for delete to authenticated
  using (from_user = (select auth.uid()));
create policy letters_insert on public.letters for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and from_user = (select auth.uid()));
create policy letters_select on public.letters for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (from_user = (select auth.uid()) or open_at <= now()));

-- 로그 댓글
drop policy if exists lc_delete on public.log_comments;
drop policy if exists lc_insert on public.log_comments;
drop policy if exists lc_select on public.log_comments;
create policy lc_delete on public.log_comments for delete to authenticated
  using (created_by = (select auth.uid()));
create policy lc_insert on public.log_comments for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and couple_id = (select l.couple_id from public.couple_logs l where l.id = log_comments.log_id)
);
create policy lc_select on public.log_comments for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 기분
drop policy if exists mood_insert on public.mood_checkins;
drop policy if exists mood_select on public.mood_checkins;
drop policy if exists mood_update on public.mood_checkins;
create policy mood_insert on public.mood_checkins for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy mood_select on public.mood_checkins for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy mood_update on public.mood_checkins for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 쿡 반응 · 쿡
drop policy if exists pr_delete on public.poke_reactions;
drop policy if exists pr_insert on public.poke_reactions;
drop policy if exists pr_select on public.poke_reactions;
create policy pr_delete on public.poke_reactions for delete to authenticated
  using (created_by = (select auth.uid()));
create policy pr_insert on public.poke_reactions for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and couple_id = (select p.couple_id from public.pokes p where p.id = poke_reactions.poke_id)
);
create policy pr_select on public.poke_reactions for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

drop policy if exists pokes_insert on public.pokes;
drop policy if exists pokes_select on public.pokes;
create policy pokes_insert on public.pokes for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and from_user = (select auth.uid()));
create policy pokes_select on public.pokes for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 오늘의 질문 — 내가 답해야 상대 답이 보인다(qa_i_answered 는 상대 행에서만 돈다)
drop policy if exists qa_insert on public.qa_answers;
drop policy if exists qa_select on public.qa_answers;
drop policy if exists qa_update on public.qa_answers;
create policy qa_insert on public.qa_answers for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy qa_select on public.qa_answers for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (user_id = (select auth.uid()) or public.qa_i_answered(couple_id, question_id)));
create policy qa_update on public.qa_answers for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

drop policy if exists quiz_insert on public.quiz_responses;
drop policy if exists quiz_select on public.quiz_responses;
create policy quiz_insert on public.quiz_responses for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy quiz_select on public.quiz_responses for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (user_id = (select auth.uid()) or public.quiz_i_answered(couple_id, question_id)));

-- ── 4) 함수 권한 ───────────────────────────────────────────────────────────────
-- 트리거 전용 — 트리거가 부르는 것이라 누구도 직접 실행할 필요가 없다(발동할 때는 EXECUTE 를 다시 보지 않는다).
revoke execute on function public.capture_couple_activity() from public, anon, authenticated;
revoke execute on function public.forbid_created_by_change() from public, anon, authenticated;
revoke execute on function public.sync_event_recurrence() from public, anon, authenticated;
revoke execute on function public.touch_member_updated_at() from public, anon, authenticated;
alter function public.forbid_created_by_change() set search_path = public;

-- 앱이 부르는 RPC — 로그인한 사용자만(안에서도 auth.uid() 를 확인하지만 문 앞에서 한 번 더).
revoke execute on function public.create_couple(text, date) from public, anon;
revoke execute on function public.join_couple(text, text) from public, anon;
revoke execute on function public.island_create(jsonb) from public, anon;
revoke execute on function public.island_action(integer, jsonb) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.create_couple(text, date) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.island_create(jsonb) to authenticated;
grant execute on function public.island_action(integer, jsonb) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- 정책이 부르는 도우미 — 정책은 질의한 사용자의 권한으로 돈다.
-- is_couple_member 는 storage.objects 정책(모든 역할)도 부르므로 anon 실행 권한을 남긴다.
revoke execute on function public.can_view_entry(uuid) from public, anon;
revoke execute on function public.qa_i_answered(uuid, text) from public, anon;
revoke execute on function public.quiz_i_answered(uuid, text) from public, anon;
revoke execute on function public.is_couple_member(uuid) from public;
grant execute on function public.can_view_entry(uuid) to authenticated;
grant execute on function public.qa_i_answered(uuid, text) to authenticated;
grant execute on function public.quiz_i_answered(uuid, text) to authenticated;
grant execute on function public.is_couple_member(uuid) to anon, authenticated;

-- ── 5) 크론이 함수 응답을 기다리는 시간 ─────────────────────────────────────────
-- 명령의 끝(body := '…'::jsonb)) 뒤에 timeout_milliseconds 만 덧붙인다 — CRON_SECRET 이 든 나머지는 그대로 둔다.
-- 크론이 없는 프로젝트(신규 bootstrap)에서는 아무 일도 하지 않는다.
do $$
declare
  r record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  for r in execute $q$
    select jobid, command from cron.job
    where jobname in ('daily-reminders', 'daily-reminders-catchup', 'activity-nudge-morning', 'activity-nudge-evening')
      and command not like '%timeout_milliseconds%'
      and command ~ 'body\s*:=\s*''[^'']*''::jsonb\s*\)'
  $q$
  loop
    perform cron.alter_job(
      r.jobid,
      command := regexp_replace(r.command, '(body\s*:=\s*''[^'']*''::jsonb)\s*\)', '\1, timeout_milliseconds := 30000)')
    );
  end loop;
end $$;

commit;

-- Shared home copy, styling, app colour and hero rendering. Additive only; no existing data is overwritten.
begin;
set local lock_timeout = '10s';
alter table public.couples add column if not exists shared_appearance jsonb;
alter table public.couples add column if not exists appearance_version bigint not null default 0;

-- Existing couples SELECT RLS and realtime publication also cover these columns.
-- Do not grant direct UPDATE: all changes must pass validation and compare-and-swap.
create or replace function public.save_couple_appearance(p_couple uuid, p_settings jsonb, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_version bigint;
  v_home jsonb;
  k text;
  lim integer;
begin
  if not exists (select 1 from public.couple_members where couple_id = p_couple and user_id = (select auth.uid())) then
    raise sqlstate '42501' using message = 'Couple membership required';
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or octet_length(p_settings::text) > 8192
     or (p_settings - array['home','theme','pixelArt']) <> '{}'::jsonb then
    raise sqlstate '22023' using message = 'Invalid appearance settings';
  end if;
  if jsonb_typeof(p_settings->'theme') is distinct from 'string'
     or p_settings->>'theme' not in ('rose','coral','purple','blue','mint','lime')
     or jsonb_typeof(p_settings->'pixelArt') is distinct from 'boolean'
     or jsonb_typeof(p_settings->'home') is distinct from 'object' then
    raise sqlstate '22023' using message = 'Invalid appearance styles';
  end if;
  v_home := p_settings->'home';
  if (v_home - array['greeting','subtitle','story','dayLabel','font','align','accent','showDays','showUnread','dayFormat']) <> '{}'::jsonb then
    raise sqlstate '22023' using message = 'Unknown home setting';
  end if;
  foreach k in array array['greeting','subtitle','story','dayLabel'] loop
    if k = 'subtitle' and v_home->k = 'null'::jsonb then continue; end if;
    lim := case k when 'greeting' then 40 when 'subtitle' then 80 when 'story' then 60 else 12 end;
    if jsonb_typeof(v_home->k) is distinct from 'string' or char_length(v_home->>k) > lim then
      raise sqlstate '22023' using message = 'Invalid home text';
    end if;
  end loop;
  foreach k in array array['font','align','accent','dayFormat'] loop
    if jsonb_typeof(v_home->k) is distinct from 'string' then
      raise sqlstate '22023' using message = 'Missing home style';
    end if;
  end loop;
  if v_home->>'font' not in ('clean','pixel','serif') or v_home->>'align' not in ('left','center')
     or v_home->>'accent' not in ('ink','theme','partner') or v_home->>'dayFormat' not in ('days','dplus')
     or jsonb_typeof(v_home->'showDays') is distinct from 'boolean'
     or jsonb_typeof(v_home->'showUnread') is distinct from 'boolean' then
    raise sqlstate '22023' using message = 'Invalid home style';
  end if;
  select appearance_version into v_version from public.couples where id = p_couple for update;
  if not found then raise sqlstate 'PT404' using message = 'Couple not found'; end if;
  if p_version is distinct from v_version then
    raise sqlstate 'PT409' using message = 'Appearance changed; reload before saving';
  end if;
  update public.couples set shared_appearance = p_settings, appearance_version = appearance_version + 1 where id = p_couple
    returning appearance_version into v_version;
  return jsonb_build_object('settings',p_settings,'version',v_version);
end;
$$;
revoke all on function public.save_couple_appearance(uuid,jsonb,bigint) from public, anon;
grant execute on function public.save_couple_appearance(uuid,jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;

-- 일정 시간(선택) — 플래너인데 날짜만 있어 "저녁 7시 약속"을 적을 곳이 없었다(2026-10-30 UX 점검).
-- 'HH:MM'(24시간) 텍스트, null = 종일. 옛 앱은 이 칸을 모르고 안 보내므로 편집해도 값이 그대로 남는다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 한 번 더 실행해도 안전).
alter table public.couple_events
  add column if not exists event_time text;
alter table public.couple_events drop constraint if exists events_time_valid;
alter table public.couple_events add constraint events_time_valid
  check (event_time is null or event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;

-- 정원 합치기 전체 순위(모든 커플 공통) — 판이 끝나면 자동 등록, 사람마다 최고 점수 한 줄. (2026-10-31)
-- [사용자: "점수는 랭킹은 끝나면 무조건 등록 … 모든 채널 공통 … 개인 닉네임하고 점수를 1등부터 10등까지"]
-- 표는 본인 행만 직접 읽을 수 있고(user_id 를 남에게 안 보인다), 순위는 security definer 함수가 닉네임 · 점수만 돌려준다.
-- 쓰기는 submit_merge_score 하나뿐 — 최고 점수만 남기고(낮은 점수로 덮어쓰지 않는다) 닉네임은 그때그때 최신으로.
-- 계정을 지우면 auth.users 연쇄 삭제로 함께 사라진다. 여러 번 돌려도 같은 결과(GitHub 연동이 다시 돌려도 안전).
begin;
set local lock_timeout = '10s';

create table if not exists public.merge_scores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  score      integer not null check (score >= 0 and score <= 10000000),
  top_lv     smallint not null default 0 check (top_lv between 0 and 13),
  games      integer not null default 0,
  best_at    timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists merge_scores_rank_idx on public.merge_scores (score desc, best_at asc);
alter table public.merge_scores enable row level security;
revoke all on public.merge_scores from anon;
drop policy if exists merge_scores_select_own on public.merge_scores;
create policy merge_scores_select_own on public.merge_scores for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.submit_merge_score(p_nickname text, p_score integer, p_top integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_nick text := left(btrim(coalesce(p_nickname, '')), 20);
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception '점수가 올바르지 않아요.' using errcode = 'PT400';
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
  insert into public.merge_scores as m (user_id, nickname, score, top_lv, games, best_at, updated_at)
  values (v_uid, v_nick, p_score, least(greatest(coalesce(p_top, 0), 0), 13), 1, now(), now())
  on conflict (user_id) do update set
    nickname   = excluded.nickname,
    best_at    = case when excluded.score > m.score then now() else m.best_at end,
    score      = greatest(m.score, excluded.score),
    top_lv     = greatest(m.top_lv, excluded.top_lv),
    games      = m.games + 1,
    updated_at = now();
end;
$$;

-- 1~10등 + 내 순위(10등 밖이어도 '나'를 한 줄 덧붙인다). 같은 점수면 먼저 낸 사람이 위.
create or replace function public.merge_leaderboard()
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by s.score desc, s.best_at asc))::integer as rank,
           s.nickname, s.score, s.top_lv, s.user_id = auth.uid() as is_me
    from public.merge_scores s
  )
  select r.rank, r.nickname, r.score, r.top_lv, r.is_me
  from ranked r
  where r.rank <= 10 or r.is_me
  order by r.rank;
$$;

revoke all on function public.submit_merge_score(text, integer, integer) from public, anon;
revoke all on function public.merge_leaderboard() from public, anon;
grant execute on function public.submit_merge_score(text, integer, integer) to authenticated;
grant execute on function public.merge_leaderboard() to authenticated;
notify pgrst, 'reload schema';
commit;

-- 정원 합치기 순위를 '사람마다 최고 한 줄' → **판마다 한 줄**로. (2026-11-01)
-- [사용자: "랭킹은 딱 게임 끝나면 … 랭킹판이 나와서 자기 랭킹이 보이는 시스템이고 중복으로도 입력되는 구조여야해"]
-- 같은 사람이 여러 판으로 순위에 여러 번 오를 수 있다. 끝난 판을 넣으면 그 판의 순위(같은 점수면 먼저 낸 판이 위)를 바로 돌려준다.
-- 표는 본인 행만 직접 읽고(남의 user_id 비공개), 순위는 security definer 함수가 닉네임 · 점수만 돌려준다.
-- 옛 앱(submit_merge_score · merge_leaderboard)도 같은 판 표를 쓰도록 두 함수를 다시 정의한다 — 시그니처는 그대로라 옛 화면이 깨지지 않는다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 다시 돌려도 안전).
begin;
set local lock_timeout = '10s';

create table if not exists public.merge_runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nickname   text not null,
  score      integer not null check (score >= 0 and score <= 10000000),
  top_lv     smallint not null default 0 check (top_lv between 0 and 13),
  created_at timestamptz not null default now()
);
create index if not exists merge_runs_rank_idx on public.merge_runs (score desc, id asc);
create index if not exists merge_runs_user_idx on public.merge_runs (user_id);
alter table public.merge_runs enable row level security;
revoke all on public.merge_runs from anon;
drop policy if exists merge_runs_select_own on public.merge_runs;
create policy merge_runs_select_own on public.merge_runs for select to authenticated
  using (user_id = (select auth.uid()));

-- 지금까지의 최고 기록을 첫 판들로 옮긴다(표가 비어 있을 때 한 번만)
insert into public.merge_runs (user_id, nickname, score, top_lv, created_at)
select s.user_id, s.nickname, s.score, s.top_lv, s.best_at
from public.merge_scores s
where not exists (select 1 from public.merge_runs);

-- 판 하나 넣기 → 그 판의 id · 순위 · 전체 판 수
create or replace function public.submit_merge_run(p_nickname text, p_score integer, p_top integer)
returns table (run_id bigint, rank integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_nick text := left(btrim(coalesce(p_nickname, '')), 20);
  v_id   bigint;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception '점수가 올바르지 않아요.' using errcode = 'PT400';
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
  insert into public.merge_runs (user_id, nickname, score, top_lv)
  values (v_uid, v_nick, p_score, least(greatest(coalesce(p_top, 0), 0), 13))
  returning id into v_id;
  return query
    select v_id,
           (select count(*)::integer + 1 from public.merge_runs r where r.score > p_score or (r.score = p_score and r.id < v_id)),
           (select count(*)::integer from public.merge_runs);
end;
$$;

-- 1~10등 + (10등 밖이면) 이번 판 한 줄. is_this = 이번 판, is_me = 내 판.
create or replace function public.merge_run_board(p_run bigint default null)
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean, is_this boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by r.score desc, r.id asc))::integer as rank,
           r.id, r.nickname, r.score, r.top_lv, r.user_id = auth.uid() as is_me
    from public.merge_runs r
  )
  select k.rank, k.nickname, k.score, k.top_lv, k.is_me, k.id = p_run as is_this
  from ranked k
  where k.rank <= 10 or k.id = p_run
  order by k.rank;
$$;

-- 옛 앱 호환: 넣기는 판 표에, 순위는 판 표에서(내 판이 10등 밖이면 내 최고 판 한 줄)
create or replace function public.submit_merge_score(p_nickname text, p_score integer, p_top integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.submit_merge_run(p_nickname, p_score, p_top);
end;
$$;

create or replace function public.merge_leaderboard()
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by r.score desc, r.id asc))::integer as rank,
           r.nickname, r.score, r.top_lv, r.user_id = auth.uid() as is_me
    from public.merge_runs r
  ), mine as (
    select min(rank) as best from ranked where is_me
  )
  select k.rank, k.nickname, k.score, k.top_lv, k.is_me
  from ranked k
  where k.rank <= 10 or k.rank = (select best from mine)
  order by k.rank;
$$;

revoke all on function public.submit_merge_run(text, integer, integer) from public, anon;
revoke all on function public.merge_run_board(bigint) from public, anon;
revoke all on function public.submit_merge_score(text, integer, integer) from public, anon;
revoke all on function public.merge_leaderboard() from public, anon;
grant execute on function public.submit_merge_run(text, integer, integer) to authenticated;
grant execute on function public.merge_run_board(bigint) to authenticated;
grant execute on function public.submit_merge_score(text, integer, integer) to authenticated;
grant execute on function public.merge_leaderboard() to authenticated;
notify pgrst, 'reload schema';
commit;

-- 정원 합치기 단계 13 → 17 (2026-11-01 — 무등산수박 · 천도복숭아 · 월궁 계수열매 · 세계수의 씨앗).
-- 판 표의 최고 단계 범위와 넣기 함수의 clamp 를 17 로 올린다. 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';
alter table public.merge_runs drop constraint if exists merge_runs_top_lv_check;
alter table public.merge_runs add constraint merge_runs_top_lv_check check (top_lv between 0 and 17);
alter table public.merge_scores drop constraint if exists merge_scores_top_lv_check;
alter table public.merge_scores add constraint merge_scores_top_lv_check check (top_lv between 0 and 17);

create or replace function public.submit_merge_run(p_nickname text, p_score integer, p_top integer)
returns table (run_id bigint, rank integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_nick text := left(btrim(coalesce(p_nickname, '')), 20);
  v_id   bigint;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception '점수가 올바르지 않아요.' using errcode = 'PT400';
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
  insert into public.merge_runs (user_id, nickname, score, top_lv)
  values (v_uid, v_nick, p_score, least(greatest(coalesce(p_top, 0), 0), 17))
  returning id into v_id;
  return query
    select v_id,
           (select count(*)::integer + 1 from public.merge_runs r where r.score > p_score or (r.score = p_score and r.id < v_id)),
           (select count(*)::integer from public.merge_runs);
end;
$$;
revoke all on function public.submit_merge_run(text, integer, integer) from public, anon;
grant execute on function public.submit_merge_run(text, integer, integer) to authenticated;
notify pgrst, 'reload schema';
commit;

-- 정원 합치기 — 내 최고 기록이 역전되면 푸시 (2026-11-01)
-- [사용자: "내 최고 탑 점수가 다른 사람한테 역전당하면 푸쉬 가도록 해줘"]
-- 판이 순위에 오르면 앱이 send-poke-push 에 { overtake_run } 을 보내고, 함수(서비스 롤)가 이 함수로 '역전당한 사람'을 받는다.
-- 역전 = 다른 사람의 최고 기록이 **순위판 10등 안**이었고(보이던 기록), 새 판 점수가 그 기록보다 높다. 10등 밖까지 알리면
--   점수를 낼 때마다 수십 명에게 가는 스팸이 된다.
-- 판마다 **한 번만** 본다(overtake_checked 를 먼저 잡는다) · 판을 낸 본인만(p_user) · 낸 지 10분 안만 — 같은 판으로 알림을 되풀이해 쏠 수 없다.
-- 앱 사용자(anon · authenticated)는 부를 수 없다(서비스 롤 전용). 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

alter table public.merge_runs add column if not exists overtake_checked boolean not null default false;

create or replace function public.merge_overtaken(p_run bigint, p_user uuid)
returns table (user_id uuid, best integer, run_nickname text, run_score integer)
language sql
volatile
security definer
set search_path = public
as $$
  with claim as (
    update public.merge_runs r
       set overtake_checked = true
     where r.id = p_run
       and r.user_id = p_user
       and not r.overtake_checked
       and r.created_at > now() - interval '10 minutes'
    returning r.id, r.user_id, r.nickname, r.score
  ),
  others as (
    select o.user_id, max(o.score)::integer as best
      from public.merge_runs o, claim c
     where o.id <> c.id and o.user_id <> c.user_id
     group by o.user_id
  )
  select x.user_id, x.best, c.nickname, c.score
    from others x, claim c
   where x.best < c.score
     and (select count(*) from public.merge_runs q where q.id <> c.id and q.score > x.best) < 10;
$$;

revoke all on function public.merge_overtaken(bigint, uuid) from public, anon, authenticated;
grant execute on function public.merge_overtaken(bigint, uuid) to service_role;

commit;

-- 낚시 랭킹 (2026-11-02) — [사용자: "개인당 점수도 반영하고 … 물고기 랭킹판을 별도로 … 개인단위 그리고 커플단위로 산정"]
-- 끌어올린 물고기 한 마리 = 한 줄. 점수는 서버가 계산한다(공식은 src/lib/fishing.ts 의 catchPoints 와 같아야 한다 — fishingscore.test).
--   점수 = 10 × 1.8^등급 × 성장 단계(치어 1 · 어린 1.3 · 다 큰 2) × 솜씨(1 + 0.5 × 줄 다루기) × 완벽한 챔질 1.1 × 수조에 담음 1.25. 쓰레기는 2점.
--   개인 = 내 점수의 합. 커플 = 둘의 합 + 낮은 쪽 점수(둘 다 낚시해야 커진다). 커플은 지금 구성원 둘로 센다 — 연결을 끊으면 상대 점수가 따라오지 않는다.
-- 표는 본인 행만 직접 읽고(남의 user_id 비공개), 순위는 security definer 함수가 닉네임 · 점수만 돌려준다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 다시 돌려도 안전).
begin;
set local lock_timeout = '10s';

create table if not exists public.fish_catches (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nickname   text not null,
  name       text not null,
  grade      smallint not null check (grade between 0 and 7),
  stage      smallint not null check (stage between 0 and 2),
  junk       boolean not null default false,
  stored     boolean not null default false,
  points     integer not null check (points >= 0),
  created_at timestamptz not null default now()
);
create index if not exists fish_catches_user_idx on public.fish_catches (user_id, created_at desc);
create index if not exists fish_catches_time_idx on public.fish_catches (created_at);
alter table public.fish_catches enable row level security;
revoke all on public.fish_catches from anon;
drop policy if exists fish_catches_select_own on public.fish_catches;
create policy fish_catches_select_own on public.fish_catches for select to authenticated
  using (user_id = (select auth.uid()));

-- 한 마리 넣기 → 받은 점수. 너무 빠른 연속 호출(2초 안)과 하루 300마리 넘는 호출은 점수 없이 넘어간다(0).
create or replace function public.submit_fish_catch(
  p_nickname text, p_name text, p_grade integer, p_stage integer,
  p_quality double precision, p_perfect boolean, p_stored boolean, p_junk boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_nick  text := left(btrim(coalesce(p_nickname, '')), 20);
  v_grade integer := least(greatest(coalesce(p_grade, 0), 0), 7);
  v_stage integer := least(greatest(coalesce(p_stage, 0), 0), 2);
  v_q     double precision := least(greatest(coalesce(p_quality, 0), 0), 1);
  v_pts   integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if exists (select 1 from public.fish_catches c where c.user_id = v_uid and c.created_at > now() - interval '2 seconds') then
    return 0;
  end if;
  if (select count(*) from public.fish_catches c where c.user_id = v_uid
      and c.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 300 then
    return 0;
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
  if coalesce(p_junk, false) then
    v_pts := 2;
  else
    v_pts := floor(10 * power(1.8::double precision, v_grade)
      * (case v_stage when 2 then 2 when 1 then 1.3 else 1 end)
      * (1 + 0.5 * v_q)
      * (case when coalesce(p_perfect, false) then 1.1 else 1 end)
      * (case when coalesce(p_stored, false) then 1.25 else 1 end) + 0.5)::integer;
  end if;
  insert into public.fish_catches (user_id, nickname, name, grade, stage, junk, stored, points)
  values (v_uid, v_nick, left(btrim(coalesce(p_name, '')), 30), v_grade, v_stage, coalesce(p_junk, false), coalesce(p_stored, false), v_pts);
  return v_pts;
end;
$$;

-- 순위판 — p_scope: person | couple, p_period: month(이번 달, KST) | all. 1~20등 + (20등 밖이면) 내 줄.
create or replace function public.fish_board(p_scope text, p_period text)
returns table (rank integer, name text, score bigint, catches integer, best_name text, best_grade smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select c.* from public.fish_catches c
    where p_period <> 'month'
       or c.created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
  ), u as (
    select r.user_id, sum(r.points)::bigint as score, count(*)::integer as catches, min(r.id) as first_id
    from r group by r.user_id
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c order by c.user_id, c.id desc
  ), best as (
    select distinct on (r.user_id) r.user_id, r.name, r.grade, r.points
    from r where not r.junk order by r.user_id, r.points desc, r.id asc
  ), people as (
    select n.nickname as name, u.score, u.catches, b.name as best_name, b.grade as best_grade,
           u.user_id = auth.uid() as is_me, u.first_id
    from u join nick n on n.user_id = u.user_id left join best b on b.user_id = u.user_id
    where p_scope = 'person'
  ), couples as (
    select string_agg(coalesce(n.nickname, '짝꿍'), ' ♥ ' order by m.user_id) as name,
           (sum(coalesce(u.score, 0)) + min(coalesce(u.score, 0)))::bigint as score,
           sum(coalesce(u.catches, 0))::integer as catches,
           (array_agg(b.name order by b.points desc nulls last))[1] as best_name,
           (array_agg(b.grade order by b.points desc nulls last))[1] as best_grade,
           coalesce(bool_or(m.user_id = auth.uid()), false) as is_me,
           min(u.first_id) as first_id
    from public.couple_members m
    left join u on u.user_id = m.user_id
    left join nick n on n.user_id = m.user_id
    left join best b on b.user_id = m.user_id
    where p_scope = 'couple'
    group by m.couple_id
    having count(*) = 2 and sum(coalesce(u.score, 0)) > 0
  ), ranked as (
    select (row_number() over (order by a.score desc, a.first_id asc))::integer as rank, a.*
    from (select * from people union all select * from couples) a
  )
  select k.rank, k.name, k.score, k.catches, k.best_name, k.best_grade, k.is_me
  from ranked k
  where k.rank <= 20 or k.is_me
  order by k.rank;
$$;

revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean) from public, anon;
revoke all on function public.fish_board(text, text) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean) to authenticated;
grant execute on function public.fish_board(text, text) to authenticated;
notify pgrst, 'reload schema';
commit;

-- 낚시 결과의 순위 한 줄 (2026-11-02) — [사용자: "단순하지만 임펙트있게" → "다 해"]
-- 끌어올릴 때마다 '이번 달 12위 → 9위', '상대를 제쳤어요'를 보여 주려고 내 이번 달 순위만 가볍게 돌려준다. 순위판과 같은 기준(fish_board).
-- user_id 는 내려가지 않는다. 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

create or replace function public.fish_standing()
returns table (rank integer, score bigint, total integer, gap_up bigint, partner_name text, partner_score bigint)
language sql
stable
security definer
set search_path = public
as $$
  with u as (
    select c.user_id, sum(c.points)::bigint as score, min(c.id) as first_id
    from public.fish_catches c
    where c.created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    group by c.user_id
  ), k as (
    select u.user_id, u.score, (row_number() over (order by u.score desc, u.first_id asc))::integer as rk from u
  ), me as (
    select k.score, k.rk from k where k.user_id = auth.uid()
  ), mate as (
    select b.user_id
    from public.couple_members a
    join public.couple_members b on b.couple_id = a.couple_id and b.user_id <> a.user_id
    where a.user_id = auth.uid()
    limit 1
  )
  select (select me.rk from me),
         coalesce((select me.score from me), 0)::bigint,
         (select count(*)::integer from u),
         (select k.score - me.score + 1 from k, me where k.rk = me.rk - 1)::bigint,
         (select c.nickname from public.fish_catches c where c.user_id = (select mate.user_id from mate) order by c.id desc limit 1),
         coalesce((select u.score from u where u.user_id = (select mate.user_id from mate)), 0)::bigint;
$$;

revoke all on function public.fish_standing() from public, anon;
grant execute on function public.fish_standing() to authenticated;
notify pgrst, 'reload schema';
commit;

-- 낚시 크기 랭킹 (2026-11-03) — [사용자: "물고기 cm 랭킹도 있어야해 물고기 종류별로"]
-- 물고기 계열마다 사람별 가장 긴 한 마리로 순위를 낸다. 주인 · 쓰레기는 길이를 안 올린다(주인은 길이가 정해져 있어 순위가 무의미하다).
-- 값은 합치기 순위판처럼 앱이 보낸 것을 믿고 범위만 자른다. 옛 기록은 길이가 없어 순위에 안 오른다.
-- 옛 앱이 8개 인자로 불러도 되게 새 인자는 기본값을 둔다 — 같은 이름의 8개짜리가 남으면 호출이 모호해져서 먼저 지운다.
-- 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

alter table public.fish_catches add column if not exists family text;
alter table public.fish_catches add column if not exists cm real;
create index if not exists fish_catches_size_idx on public.fish_catches (family, cm desc) where cm is not null;

drop function if exists public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean);
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
  v_uid   uuid := auth.uid();
  v_nick  text := left(btrim(coalesce(p_nickname, '')), 20);
  v_grade integer := least(greatest(coalesce(p_grade, 0), 0), 7);
  v_stage integer := least(greatest(coalesce(p_stage, 0), 0), 2);
  v_q     double precision := least(greatest(coalesce(p_quality, 0), 0), 1);
  v_cm    real := case when coalesce(p_junk, false) or p_family is null or p_cm is null or p_cm <= 0 then null else least(p_cm, 2000) end;
  v_pts   integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if exists (select 1 from public.fish_catches c where c.user_id = v_uid and c.created_at > now() - interval '2 seconds') then
    return 0;
  end if;
  if (select count(*) from public.fish_catches c where c.user_id = v_uid
      and c.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 300 then
    return 0;
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
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
  values (v_uid, v_nick, left(btrim(coalesce(p_name, '')), 30), v_grade, v_stage, coalesce(p_junk, false), coalesce(p_stored, false), v_pts,
          case when v_cm is null then null else left(btrim(p_family), 30) end, v_cm);
  return v_pts;
end;
$$;

-- 계열별 크기 순위 — 사람마다 가장 긴 한 마리. 1~20등 + (20등 밖이면) 내 줄. 닉네임 · 길이만 나간다.
create or replace function public.fish_size_board(p_family text)
returns table (rank integer, name text, cm real, catch_name text, caught_at timestamptz, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (c.user_id) c.user_id, c.cm, c.name as catch_name, c.created_at, c.id
    from public.fish_catches c
    where c.family = p_family and c.cm is not null
    order by c.user_id, c.cm desc, c.id asc
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c order by c.user_id, c.id desc
  ), ranked as (
    select (row_number() over (order by b.cm desc, b.id asc))::integer as rank, n.nickname as name, b.cm, b.catch_name, b.created_at as caught_at, b.user_id = auth.uid() as is_me
    from best b join nick n on n.user_id = b.user_id
  )
  select r.rank, r.name, r.cm, r.catch_name, r.caught_at, r.is_me from ranked r where r.rank <= 20 or r.is_me order by r.rank;
$$;

revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) from public, anon;
revoke all on function public.fish_size_board(text) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) to authenticated;
grant execute on function public.fish_size_board(text) to authenticated;
notify pgrst, 'reload schema';
commit;

-- 오늘 방문자 수 (2026-11-03) — [사용자: 특정 계정에만 "오늘 하루 방문자 수 표기해줘 홈 화면 오른쪽 위에"]
-- 방문자 = 오늘(KST) 앱을 연 기기 수. 기기마다 브라우저에 만든 무작위 id 하나만 남긴다 — 사용자 id · IP 를 저장하지 않고, 90일 지나면 지운다.
-- 로그인 화면에서 나간 방문자도 세려고 note_visit 은 anon 도 부른다(값을 부풀릴 수는 있어도 읽을 수 없다).
-- 읽기는 today_visitors 한 곳 — 볼 수 있는 계정은 **서버가 이메일 해시로** 가린다. 공개 레포라 이메일을 그대로 적지 않고, 다른 계정엔 null 만 간다.
-- 표는 직접 못 읽는다(RLS 켜고 정책 없음). 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

create table if not exists public.daily_visits (
  day    date not null,
  device text not null,
  primary key (day, device)
);
alter table public.daily_visits enable row level security;
revoke all on public.daily_visits from anon, authenticated;

create or replace function public.note_visit(p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_dev text := left(btrim(coalesce(p_device, '')), 64);
begin
  if v_dev = '' then return; end if;
  insert into public.daily_visits (day, device) values (v_day, v_dev) on conflict do nothing;
  if found then
    delete from public.daily_visits where day < v_day - 90;
  end if;
end;
$$;

create or replace function public.today_visitors()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when encode(sha256(convert_to(lower(coalesce(auth.jwt() ->> 'email', '')), 'UTF8')), 'hex') = 'b4da66f25586ffc7a0691f1af44b5050d9b03b0488c1b3dd15bfa8cc9f330500'
    then (select count(*)::integer from public.daily_visits v where v.day = (now() at time zone 'Asia/Seoul')::date)
  end;
$$;

revoke all on function public.note_visit(text) from public;
revoke all on function public.today_visitors() from public, anon;
grant execute on function public.note_visit(text) to anon, authenticated;
grant execute on function public.today_visitors() to authenticated;
notify pgrst, 'reload schema';
commit;

-- 낚시 점수 제한을 원자적으로 (2026-11-05, 낚시 리뷰)
-- '2초 안 연속 호출 · 하루 300마리'를 확인한 뒤 넣는 사이에 틈이 있어서, 같은 사람이 동시에 여러 번 부르면 둘 다 확인을 통과했다.
-- 사람마다 트랜잭션 잠금(pg_advisory_xact_lock)을 먼저 잡아 확인과 넣기를 한 줄로 세운다. 다른 사람끼리는 서로 기다리지 않는다.
-- 점수 공식 · 인자 · 권한은 20261103000000_fish_size_board.sql 과 같다. 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

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
  v_uid   uuid := auth.uid();
  v_nick  text := left(btrim(coalesce(p_nickname, '')), 20);
  v_grade integer := least(greatest(coalesce(p_grade, 0), 0), 7);
  v_stage integer := least(greatest(coalesce(p_stage, 0), 0), 2);
  v_q     double precision := least(greatest(coalesce(p_quality, 0), 0), 1);
  v_cm    real := case when coalesce(p_junk, false) or p_family is null or p_cm is null or p_cm <= 0 then null else least(p_cm, 2000) end;
  v_pts   integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fish_catch:' || v_uid::text, 0));
  if exists (select 1 from public.fish_catches c where c.user_id = v_uid and c.created_at > now() - interval '2 seconds') then
    return 0;
  end if;
  if (select count(*) from public.fish_catches c where c.user_id = v_uid
      and c.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 300 then
    return 0;
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
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
  values (v_uid, v_nick, left(btrim(coalesce(p_name, '')), 30), v_grade, v_stage, coalesce(p_junk, false), coalesce(p_stored, false), v_pts,
          case when v_cm is null then null else left(btrim(p_family), 30) end, v_cm);
  return v_pts;
end;
$$;

revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) to authenticated;
notify pgrst, 'reload schema';
commit;

-- 일기장 리뷰 (2026-11-06) — 비밀일기 없애기 · 썸네일 · 고친 시각 · 날씨 · 길이 제한
--
-- ⚠ 한 방향 변경(사용자 결정 2026-11-05: "비밀일기 기능은 없애버려 … 전부 공개로 전환").
--   일기는 이제 둘이 함께 보는 것만 있다. 여기서 '공개'는 **같은 커플의 두 사람에게만** 보인다는 뜻이다 —
--   다른 사용자 · 로그인 안 한 요청은 예전처럼 0행이다(deco_select 는 그대로 couple_id in (select private.my_couple_ids())).
--   · 이미 있던 비밀일기(visibility = 'private')는 전부 'shared' 로 바꾼다. 어느 행이 비밀이었는지는
--     private.diary_private_backup 에 id 로 남긴다 — 되돌리기(롤백)는 이 표로만 할 수 있다(아래 '롤백').
--   · 옛 앱은 아직 '나만 보기'를 보낼 수 있다 → 넣기 · 고치기 직전에 트리거가 'shared' 로 고정한다.
--   · 정책(RLS) · storage 정책은 바꾸지 않는다. 비밀 행이 없으니 'visibility = shared or 작성자' 조건과
--     deco_photo_blocked 는 '커플 구성원' 과 같은 결과가 된다(의미가 같아 바꿀 이유가 없고, 바꾸면 위험만 는다).
--
-- 함께 하는 것(전부 선택 칸 — 옛 앱은 모른 채 써도 된다):
--   · updated_at  : 마지막으로 고친 시각(트리거가 채운다). 고친 일기의 초안이 다른 기기의 더 새 글을 덮지 않게 비교한다.
--   · thumb_paths : 480px 썸네일(photo_paths 와 같은 순서). 144px 칸에 1280px 원본을 받던 것. 옛 행은 null → 원본을 그린다.
--   · weather     : 저장할 때의 오늘 날씨 한 줄(도시 단위).
--   · 길이 제한   : 제목 · 위치 · 태그 · 스티커 · 사진 수. NOT VALID 로 걸고(새 쓰기부터), 옛 행이 다 맞을 때만 VALIDATE.
--     한계는 앱보다 넉넉하다(앱: 제목 80 · 위치 40 · 태그 10개 × 20자) — 옛 앱의 쓰기가 막히지 않게.
--
-- 이 파일은 여러 번 돌려도 같은 결과다(if not exists · create or replace · drop … if exists · on conflict do nothing).
-- 지우는 데이터는 없다(비밀 → 공개 전환은 값을 바꾸는 것이고, 바뀐 행 id 는 백업 표에 남는다).
-- schema.sql 끝에 이 파일이 그대로 포함된다(diaryreview.test 가 잠근다).
--
-- 롤백(필요할 때 SQL 편집기에서 — 트리거를 먼저 내려야 'private' 로 되돌릴 수 있다):
--   drop trigger if exists deco_before_write on public.deco_entries;
--   update public.deco_entries d set visibility = 'private'
--     from private.diary_private_backup b where b.entry_id = d.id;
--   -- 칸 · 제약은 남겨 둬도 옛 앱과 맞는다(전부 선택 칸). 굳이 걷으려면:
--   -- alter table public.deco_entries drop constraint if exists deco_title_len, drop constraint if exists deco_location_len,
--   --   drop constraint if exists deco_tags_len, drop constraint if exists deco_stickers_len,
--   --   drop constraint if exists deco_photos_len, drop constraint if exists deco_weather_len;
begin;
set local lock_timeout = '10s';

-- ── 1) 새 칸 ───────────────────────────────────────────────────────────────────
alter table public.deco_entries add column if not exists updated_at timestamptz;
alter table public.deco_entries add column if not exists thumb_paths text[];
alter table public.deco_entries add column if not exists weather text;
alter table public.deco_entries alter column visibility set default 'shared';

-- ── 2) 비밀일기 → 함께 보는 일기 (한 방향, 백업 먼저) ──────────────────────────────
create schema if not exists private;
create table if not exists private.diary_private_backup (
  entry_id uuid primary key references public.deco_entries(id) on delete cascade,
  converted_at timestamptz not null default now()
);
-- 노출 스키마가 아니어도 권한은 걷는다 — 이 표는 SQL 편집기(관리자)만 본다
alter table private.diary_private_backup enable row level security;
revoke all on table private.diary_private_backup from public, anon, authenticated;

insert into private.diary_private_backup (entry_id)
  select id from public.deco_entries where visibility is distinct from 'shared'
  on conflict (entry_id) do nothing;
update public.deco_entries set visibility = 'shared' where visibility is distinct from 'shared';

-- ── 3) 넣기 · 고치기 직전: 공개 고정 + 고친 시각 ─────────────────────────────────
-- 옛 앱이 '나만 보기'로 보내도 함께 보는 일기가 된다(사용자 결정). 고치면 updated_at 을 지금으로.
create or replace function public.deco_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.visibility := 'shared';
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;
-- 트리거 전용 — 아무도 직접 못 부른다(발동 때는 EXECUTE 를 다시 보지 않는다)
revoke execute on function public.deco_before_write() from public, anon, authenticated;
drop trigger if exists deco_before_write on public.deco_entries;
create trigger deco_before_write before insert or update on public.deco_entries
  for each row execute function public.deco_before_write();

-- ── 4) 길이 제한 (새 쓰기부터 · 옛 행이 다 맞으면 VALIDATE) ────────────────────────
create or replace function private.deco_tags_ok(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null
    or (cardinality(p) <= 20 and coalesce((select bool_and(char_length(t) <= 50) from unnest(p) as t), true));
$$;
grant execute on function private.deco_tags_ok(text[]) to authenticated;

alter table public.deco_entries drop constraint if exists deco_title_len;
alter table public.deco_entries add constraint deco_title_len
  check (title is null or char_length(title) <= 200) not valid;
alter table public.deco_entries drop constraint if exists deco_location_len;
alter table public.deco_entries add constraint deco_location_len
  check (location is null or char_length(location) <= 200) not valid;
alter table public.deco_entries drop constraint if exists deco_tags_len;
alter table public.deco_entries add constraint deco_tags_len
  check (private.deco_tags_ok(hashtags)) not valid;
alter table public.deco_entries drop constraint if exists deco_stickers_len;
alter table public.deco_entries add constraint deco_stickers_len
  check (stickers is null or (jsonb_typeof(stickers) = 'array' and jsonb_array_length(stickers) <= 30)) not valid;
alter table public.deco_entries drop constraint if exists deco_photos_len;
alter table public.deco_entries add constraint deco_photos_len
  check (coalesce(cardinality(photo_paths), 0) <= 4 and coalesce(cardinality(thumb_paths), 0) <= 4) not valid;
alter table public.deco_entries drop constraint if exists deco_weather_len;
alter table public.deco_entries add constraint deco_weather_len
  check (weather is null or char_length(weather) <= 80) not valid;

-- 옛 행이 하나라도 어기면 그 제약은 NOT VALID 로 둔다(새 쓰기만 막는다 — 옛 일기를 고치거나 지우지 않는다).
do $$
declare
  c text;
begin
  foreach c in array array['deco_title_len', 'deco_location_len', 'deco_tags_len', 'deco_stickers_len', 'deco_photos_len', 'deco_weather_len'] loop
    begin
      execute format('alter table public.deco_entries validate constraint %I', c);
    exception when check_violation then
      raise notice '% 는 옛 행이 어겨서 NOT VALID 로 둔다', c;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

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

-- 기록 공통 정리 (2026-11-06) — 미디어 파일은 올린 사람만 지운다 · media-gc 주간 점검(삭제 없음).
-- schema.sql 끝에 이 파일이 그대로 붙어 있다(신규 bootstrap = 운영 migration — recordscommon.test 가 잠근다).
-- 여러 번 돌려도 같다(drop policy if exists + create · 크론은 지우고 다시 건다). 행 데이터는 건드리지 않는다.

-- ── 1) storage.objects: 보기는 커플 · 올리기/고치기/지우기는 올린 사람만 ───────────────
-- 예전 couple_photos_obj_all 은 for all 이라, 같은 커플이면 API 로 **상대가 올린** 사진 · 일기 사진 ·
-- 3초 로그 영상을 지우거나 같은 이름으로 덮어쓸 수 있었다(앱 화면에 그런 버튼이 없어도 REST 로는 됐다).
-- 이제 SELECT 만 커플 멤버에게 열고, INSERT 는 내 커플 폴더 + 올린 사람이 나, UPDATE/DELETE 는 올린 사람만.
--
-- 올린 사람은 Storage 가 직접 적는다 — 업로드 때 JWT 의 sub 를 owner_id(문자열)와 owner(uuid, 옛 칸)에 넣는다.
-- 앱은 이 칸을 보내지 않으므로 옛 앱의 업로드도 그대로 통과한다. owner_id 가 생기기 전 파일을 위해 owner 도 본다.
--
-- 상대 파일을 지우던 앱 흐름은 이렇게 된다(remove 는 RLS 에 걸린 파일을 오류 없이 건너뛴다):
--   · 상대 사진 삭제(couple_photos 행은 둘 다 지울 수 있다) → 행만 지워지고 파일은 고아로 남아 media-gc(서비스 롤)가 수거.
--   · 일기 · 3초 로그 삭제, 영상 교체, 업로드 실패 정리 → 작성자 본인 파일이라 그대로 지워진다.
--   · 영상 90일 정리(daily-reminders) · 계정 삭제(manage-account) · media-gc → 서비스 롤이라 RLS 를 타지 않는다.
-- 비밀일기 사진 가드(private.deco_photo_blocked)는 SELECT 에 **그대로** 둔다. 2026-11-06 부터 일기는 전부 공유라
-- 이 가드는 늘 거짓이지만, 지워도 얻는 게 없고 되살릴 때 위험하니 남긴다(나중에 지워도 되는 줄).
-- 대상은 to authenticated — 예전 정책도 로그인 안 한 요청엔 auth.uid() 가 비어 아무것도 안 열렸다(같은 결과).
-- 폴더 이름은 글자로 비교한다 — uuid 로 바꾸면 폴더가 uuid 모양이 아닌 경로 하나 때문에 질의 전체가 오류가 난다.
begin;

drop policy if exists couple_photos_obj_all on storage.objects;

drop policy if exists couple_photos_obj_select on storage.objects;
create policy couple_photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'couple-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and not private.deco_photo_blocked(name));

drop policy if exists couple_photos_obj_insert on storage.objects;
create policy couple_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'couple-photos'
              and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
              and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
              and not private.deco_photo_blocked(name));

drop policy if exists couple_photos_obj_update on storage.objects;
create policy couple_photos_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'couple-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
         and not private.deco_photo_blocked(name))
  with check (bucket_id = 'couple-photos'
              and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
              and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
              and not private.deco_photo_blocked(name));

drop policy if exists couple_photos_obj_delete on storage.objects;
create policy couple_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'couple-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
         and not private.deco_photo_blocked(name));

-- ── 2) media-gc 주간 점검 — dry-run 만, 지우지 않는다 ─────────────────────────────────
-- 고아 파일은 지금 사람이 손으로 dry-run 을 돌려야 보였다. 위 1) 뒤로는 상대 사진을 지우면 파일이 고아로 남으니
-- 매주 일요일 04:00 KST(토 19:00 UTC)에 후보 수만 세게 한다. 결과는 pg_net 응답 기록(net._http_response)과 함수 로그에 남는다.
-- 실제 정리는 지금처럼 사람이 확인 뒤 confirm 으로 돌린다 — 본문에 confirm 을 절대 넣지 않는다.
-- 크론 비밀은 이 파일에 없다: daily-reminders 작업의 명령을 DB 안에서 복사해 주소와 본문만 바꾼다(README §7).
-- 명령 본문은 출력하지 않는다(notice 에도 길이 · 참거짓만). 모양이 예상과 다르면 아무것도 걸지 않고 건너뛴다.
do $$
declare
  v_src text;
  v_cmd text;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$
    select command from cron.job
    where jobname = 'daily-reminders'
      and command ~ '/functions/v1/daily-reminders[''?]'
      and command ~ 'body\s*:=\s*''[^'']*''::jsonb'
    limit 1
  $q$ into v_src;
  if v_src is null then
    raise notice 'media-gc-weekly-dryrun: daily-reminders 명령 모양이 달라 건너뜀';
    return;
  end if;
  v_cmd := regexp_replace(v_src, '/functions/v1/daily-reminders', '/functions/v1/media-gc');
  v_cmd := regexp_replace(v_cmd, 'body\s*:=\s*''[^'']*''::jsonb', 'body := ''{"dry_run": true}''::jsonb');
  if v_cmd !~ '/functions/v1/media-gc[''?]' or v_cmd ~* 'confirm' then
    raise notice 'media-gc-weekly-dryrun: 바꾼 명령 검사에 실패해 건너뜀';
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'media-gc-weekly-dryrun' $q$;
  execute $q$ select cron.schedule('media-gc-weekly-dryrun', '0 19 * * 6', $1) $q$ using v_cmd;
end $$;

commit;

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

-- 홈 · 계획 리뷰(2026-11-05) — 일정의 '이번만 건너뛰기'와 여러 날 일정(여행).
-- 두 칸 모두 선택 칸이다: 옛 앱은 모르고 안 보내므로 편집해도 값이 그대로 남는다(event_time 과 같은 방식).
--   skip_dates : 건너뛴 회차의 시작일들. 반복 일정에만 뜻이 있다. 화면 · 알림(daily-reminders)이 그 회차를 건너뛴다.
--   end_date   : 여러 날 일정의 끝나는 날. 없으면 하루짜리. 달력엔 이어지는 날마다, 알림은 시작일 기준.
-- couple_events 는 표 단위 권한(컬럼 grant 없음)이라 새 칸도 기존 정책(events_insert · events_update)으로 바로 쓴다.
-- 편집 충돌 검사(updated_at 비교)는 이미 있는 updated_at 칸과 sync_event_recurrence 트리거(갱신마다 now())를 쓴다 — 여기서 바꾸지 않는다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 한 번 더 실행해도 안전). 행을 지우지 않는다.
begin;

alter table public.couple_events
  add column if not exists skip_dates date[] not null default '{}';
alter table public.couple_events
  add column if not exists end_date date;

-- 끝나는 날이 시작일 이하이거나 1년(366일)을 넘으면 하루짜리로 되돌린다. check 로 막지 않는 이유: 옛 앱은 end_date 를 모른 채
-- 시작일만 옮긴다 — check 면 그 편집이 통째로 거부된다. 트리거는 값을 고쳐 받아 준다. 건너뛴 날은 최근 400개까지.
create or replace function public.normalize_event_span()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.end_date is not null
     and (new.end_date <= new.event_date or new.end_date > new.event_date + 366) then
    new.end_date := null;
  end if;
  if new.skip_dates is null then
    new.skip_dates := '{}';
  elsif cardinality(new.skip_dates) > 400 then
    new.skip_dates := (select array_agg(d order by d) from (
      select d from unnest(new.skip_dates) as d order by d desc limit 400) recent);
  end if;
  return new;
end;
$$;
revoke execute on function public.normalize_event_span() from public, anon, authenticated;
drop trigger if exists couple_events_normalize_span on public.couple_events;
create trigger couple_events_normalize_span
  before insert or update on public.couple_events
  for each row execute function public.normalize_event_span();

notify pgrst, 'reload schema';
commit;

-- 정원 합치기 순위판 지킴이 (2026-11-06, 게임 리뷰)
-- 문제: submit_merge_run 은 1천만 점 이하면 아무 점수 · 아무 20자 이름이나 받았고 횟수 제한도 없었다.
--   가짜 1등 한 줄이면 send-poke-push 의 overtake_run 이 10등 안의 모르는 사람들에게 푸시까지 보냈다.
-- 고침(시그니처 · 반환 모양은 그대로 — 옛 앱의 호출이 그대로 돈다):
--   · 사람마다 트랜잭션 잠금(pg_advisory_xact_lock) 뒤 20초에 한 판 · 하루(KST) 200판 — 넘으면 PT429.
--   · 점수가 그 판의 최고 단계로 낼 수 있는 범위 밖이면 PT422. 상한 (L-1)·2^(L+5) · 하한 2^L(3단계부터) · 1 ≤ L ≤ 17.
--     증명은 src/lib/merge.ts 의 scoreCeiling 주석(타일 하나 ≤ (l-1)·2^l, 16칸, 보너스 < 기본) — merge.test 가 같은 식인지 본다.
--   · 닉네임: 공백 정리 · 12자 · 보이지 않는 글자와 주소(링크)는 PT422. 빈 이름은 옛 동작대로 '이름 없음'.
--   · 순위판 · 순위 계산 · 역전 알림은 범위 안 · 정상 이름인 판만 본다 — 이미 들어간 가짜 판은 지우지 않고 가린다.
--   · 역전 푸시는 이 지킴이를 지난 판(guarded)만, 받는 사람마다 하루 한 번(merge_overtake_notified).
-- 옛 RPC(submit_merge_score · merge_leaderboard)도 같은 지킴이를 탄다. 오류는 PT4xx 만(40001 · 40P01 금지 — README §11).
-- 여러 번 돌려도 같은 결과(GitHub 연동이 다시 돌려도 안전). 행을 지우거나 바꾸지 않는다.
begin;
set local lock_timeout = '10s';

alter table public.merge_runs add column if not exists guarded boolean not null default false;
create index if not exists merge_runs_user_time_idx on public.merge_runs (user_id, created_at desc);

create table if not exists public.merge_overtake_notified (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
alter table public.merge_overtake_notified enable row level security;
revoke all on public.merge_overtake_notified from public, anon, authenticated;

-- 점수 범위 — merge.ts 의 scoreCeiling · scoreFloor 와 같은 식
create or replace function public.merge_score_plausible(p_score integer, p_top integer)
returns boolean
language sql
immutable
as $$
  select p_score is not null and p_top is not null
     and p_top between 1 and 17
     and p_score >= (case when p_top >= 3 then (1::bigint << p_top) else 1 end)
     and p_score <= least(10000000::bigint, (p_top - 1)::bigint * (1::bigint << (p_top + 5)));
$$;

-- 닉네임 정리 — 못 쓰는 이름이면 null. merge.ts 의 normalizeNick · NICK_URL_RE 와 같은 규칙
create or replace function public.merge_clean_nick(p_nickname text)
returns text
language sql
immutable
as $$
  select case
    when x.v = '' then null
    when x.v ~ '[\u0001-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]' then null
    when x.v ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|kr|io|me|ly|gg|xyz|co|app|dev|site|link|to|tv|shop|info|biz|top|club)([^a-z0-9]|$))' then null
    else left(x.v, 12)
  end
  from (select btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g')) as v) x;
$$;

-- 순위판에 보이는 판
create or replace function public.merge_run_visible(p_nickname text, p_score integer, p_top integer)
returns boolean
language sql
immutable
as $$
  select public.merge_score_plausible(p_score, p_top) and public.merge_clean_nick(p_nickname) is not null;
$$;

-- 판 하나 넣기 → 그 판의 id · 순위 · 전체 판 수(보이는 판만 센다)
create or replace function public.submit_merge_run(p_nickname text, p_score integer, p_top integer)
returns table (run_id bigint, rank integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_raw  text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  v_nick text;
  v_id   bigint;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if not public.merge_score_plausible(p_score, p_top) then
    raise exception '이 판의 점수는 순위에 올릴 수 없어요.' using errcode = 'PT422';
  end if;
  if v_raw = '' then
    v_nick := '이름 없음';
  else
    v_nick := public.merge_clean_nick(v_raw);
    if v_nick is null then
      raise exception '이 닉네임은 쓸 수 없어요.' using errcode = 'PT422';
    end if;
  end if;
  -- 확인과 넣기를 한 줄로 — 같은 사람이 동시에 여러 번 불러도 둘 다 확인을 통과하지 못한다
  perform pg_advisory_xact_lock(hashtextextended('merge_run:' || v_uid::text, 0));
  if exists (select 1 from public.merge_runs r where r.user_id = v_uid and r.created_at > now() - interval '20 seconds') then
    raise exception '조금 뒤에 다시 올려 주세요.' using errcode = 'PT429';
  end if;
  if (select count(*) from public.merge_runs r where r.user_id = v_uid
      and r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 200 then
    raise exception '오늘은 더 올릴 수 없어요.' using errcode = 'PT429';
  end if;
  insert into public.merge_runs (user_id, nickname, score, top_lv, guarded)
  values (v_uid, v_nick, p_score, p_top, true)
  returning id into v_id;
  return query
    select v_id,
           (select count(*)::integer + 1 from public.merge_runs r
             where public.merge_run_visible(r.nickname, r.score, r.top_lv)
               and (r.score > p_score or (r.score = p_score and r.id < v_id))),
           (select count(*)::integer from public.merge_runs r where public.merge_run_visible(r.nickname, r.score, r.top_lv));
end;
$$;

-- 1~10등 + (10등 밖이면) 이번 판 한 줄 — 보이는 판만
create or replace function public.merge_run_board(p_run bigint default null)
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean, is_this boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by r.score desc, r.id asc))::integer as rank,
           r.id, r.nickname, r.score, r.top_lv, r.user_id = auth.uid() as is_me
    from public.merge_runs r
    where public.merge_run_visible(r.nickname, r.score, r.top_lv)
  )
  select k.rank, k.nickname, k.score, k.top_lv, k.is_me, k.id = p_run as is_this
  from ranked k
  where k.rank <= 10 or k.id = p_run
  order by k.rank;
$$;

-- 옛 앱 호환: 넣기는 같은 지킴이(submit_merge_run)로, 순위도 보이는 판만
create or replace function public.submit_merge_score(p_nickname text, p_score integer, p_top integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.submit_merge_run(p_nickname, p_score, p_top);
end;
$$;

create or replace function public.merge_leaderboard()
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by r.score desc, r.id asc))::integer as rank,
           r.nickname, r.score, r.top_lv, r.user_id = auth.uid() as is_me
    from public.merge_runs r
    where public.merge_run_visible(r.nickname, r.score, r.top_lv)
  ), mine as (
    select min(rank) as best from ranked where is_me
  )
  select k.rank, k.nickname, k.score, k.top_lv, k.is_me
  from ranked k
  where k.rank <= 10 or k.rank = (select best from mine)
  order by k.rank;
$$;

-- 역전 알림 대상 — 지킴이를 지난 판만 · 보이는 판끼리 · 받는 사람마다 하루(KST) 한 번
create or replace function public.merge_overtaken(p_run bigint, p_user uuid)
returns table (user_id uuid, best integer, run_nickname text, run_score integer)
language sql
volatile
security definer
set search_path = public
as $$
  with claim as (
    update public.merge_runs r
       set overtake_checked = true
     where r.id = p_run
       and r.user_id = p_user
       and r.guarded
       and not r.overtake_checked
       and r.created_at > now() - interval '10 minutes'
    returning r.id, r.user_id, r.nickname, r.score
  ),
  visible as (
    select o.id, o.user_id, o.score
      from public.merge_runs o
     where public.merge_run_visible(o.nickname, o.score, o.top_lv)
  ),
  others as (
    select o.user_id, max(o.score)::integer as best
      from visible o, claim c
     where o.id <> c.id and o.user_id <> c.user_id
     group by o.user_id
  ),
  victims as (
    select x.user_id, x.best, c.nickname, c.score
      from others x, claim c
     where x.best < c.score
       and (select count(*) from visible q where q.id <> c.id and q.score > x.best) < 10
  ),
  fresh as (
    insert into public.merge_overtake_notified (user_id, day)
    select v.user_id, (now() at time zone 'Asia/Seoul')::date from victims v
    on conflict do nothing
    returning merge_overtake_notified.user_id
  )
  select v.user_id, v.best, v.nickname, v.score
    from victims v
    join fresh f on f.user_id = v.user_id;
$$;

revoke all on function public.merge_score_plausible(integer, integer) from public, anon, authenticated;
revoke all on function public.merge_clean_nick(text) from public, anon, authenticated;
revoke all on function public.merge_run_visible(text, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_merge_run(text, integer, integer) from public, anon;
revoke all on function public.merge_run_board(bigint) from public, anon;
revoke all on function public.submit_merge_score(text, integer, integer) from public, anon;
revoke all on function public.merge_leaderboard() from public, anon;
revoke all on function public.merge_overtaken(bigint, uuid) from public, anon, authenticated;
grant execute on function public.submit_merge_run(text, integer, integer) to authenticated;
grant execute on function public.merge_run_board(bigint) to authenticated;
grant execute on function public.submit_merge_score(text, integer, integer) to authenticated;
grant execute on function public.merge_leaderboard() to authenticated;
grant execute on function public.merge_overtaken(bigint, uuid) to service_role;
notify pgrst, 'reload schema';
commit;

-- ============================================================================
-- 앱 공통 리뷰(2026-11-05) — migrations/20261106070000_app_wide.sql 원문
-- ============================================================================
-- 앱 공통 리뷰 (2026-11-05) — 공개 키로 DB 를 채우는 두 길 막기 · 로그 보관 기간 · 새 외래키 인덱스. README §10.13.
-- schema.sql 끝에 이 파일이 그대로 붙어 있다(신규 bootstrap = 운영 migration — appwide.test 가 잠근다).
-- 여러 번 돌려도 같다(create or replace · if not exists · 제약은 지우고 NOT VALID 로 다시 · 크론은 지우고 다시 건다).
-- ⚠ 이 파일 자체는 **행을 하나도 지우지 않는다.** 오래된 로그 정리는 아래 크론이 매일 03:30 KST 에 나이(30일 · 180일 · 14일)로만 지운다.
-- 롤백(SQL 편집기): select cron.unschedule('purge-old-logs-daily');  — 정리만 멈춘다. 나머지는 남겨 둬도 옛 앱과 맞는다(README §10.13).
begin;
set local lock_timeout = '10s';

-- ── 1) note_visit: UUID 모양만 · 하루 3000 기기에서 멈춘다 ────────────────────────────────
-- anon 이 부르는 함수라 p_device 를 바꿔 가며 부르면 한 번에 한 행씩 끝없이 쌓였다(표 크기 = 공격자 마음).
-- 앱(VisitPing)은 crypto.randomUUID 모양만 보낸다. 방문자 수는 이 앱 규모에서 하루 수십이라 3000 은 넉넉한 천장이다.
-- 90일 지난 방문 기록 정리는 예전 함수 그대로(앱이 부를 때 한다 — 이 migration 이 지우는 게 아니다).
create or replace function public.note_visit(p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_dev text := lower(btrim(coalesce(p_device, '')));
begin
  if v_dev !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
  if (select count(*) from public.daily_visits v where v.day = v_day) >= 3000 then return; end if;
  insert into public.daily_visits (day, device) values (v_day, v_dev) on conflict do nothing;
  if found then
    delete from public.daily_visits where day < v_day - 90;
  end if;
end;
$$;
revoke all on function public.note_visit(text) from public;
grant execute on function public.note_visit(text) to anon, authenticated;

-- ── 2) debug_logs 길이 제한(NOT VALID — 이미 있는 행은 검사하지 않는다) ───────────────────────
-- 로그인한 누구나 자기 로그를 무제한 길이로 넣을 수 있었다. 앱(lib/debug)은 같은 값으로 잘라 보낸다.
alter table public.debug_logs drop constraint if exists debug_logs_len;
alter table public.debug_logs add constraint debug_logs_len
  check (char_length(tag) <= 64
         and (detail is null or char_length(detail) <= 4096)
         and (ua is null or char_length(ua) <= 512)) not valid;

-- ── 3) 오래된 로그 정리 함수 — 크론만 부른다 ─────────────────────────────────────────────
-- debug_logs 30일 · activity_events 180일(활동함은 최근 소식만 보여 준다) · cron.job_run_details 14일.
-- 크론 실행 기록 표는 권한이 없을 수 있어 따로 감싼다(실패해도 앞의 둘은 지워진다).
create schema if not exists private;
create or replace function private.purge_old_logs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.debug_logs where created_at < now() - interval '30 days';
  delete from public.activity_events where created_at < now() - interval '180 days';
  begin
    execute 'delete from cron.job_run_details where end_time < now() - interval ''14 days''';
  exception when others then
    null;
  end;
end;
$$;
revoke all on function private.purge_old_logs() from public, anon, authenticated;

-- ── 4) 매일 03:30 KST(18:30 UTC) — 비밀이 필요 없다(HTTP 가 아니라 SQL 한 줄) ─────────────────
-- 이름으로 지우고 다시 건다(멱등). cron.job 에서는 jobid 만 읽는다(명령 본문은 읽지 않는다).
do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-logs-daily' $q$;
  execute $q$ select cron.schedule('purge-old-logs-daily', '30 18 * * *', 'select private.purge_old_logs()') $q$;
end $$;

-- ── 5) 새 외래키 인덱스 — 계정 삭제(auth.users on delete cascade)가 표를 통째로 훑지 않게 ─────────
-- photo_comments · photo_reactions 의 photo_id, log_reactions 의 log_id 는 이미 맨 앞 칸 인덱스가 있다.
create index if not exists photo_comments_created_by_idx on public.photo_comments (created_by);
create index if not exists photo_reactions_created_by_idx on public.photo_reactions (created_by);
create index if not exists log_reactions_user_idx on public.log_reactions (user_id);

notify pgrst, 'reload schema';
commit;

-- 크기 순위를 한 번에 (2026-11-07) [사용자: "한번에 다 보여주되 가독성을 높이자 … 어떤 액션을 강요하지마"]
-- 물고기를 하나씩 고르지 않게 모든 계열의 순위를 한 번에 돌려준다. 계열마다 1~20등 + (20등 밖이면) 내 줄. 닉네임 · 길이만 나간다.
-- 옛 앱이 부르는 fish_size_board(p_family) 는 그대로 둔다. 새 함수 하나만 더하고 행은 건드리지 않는다. 여러 번 돌려도 같은 결과.
begin;

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
    where c.family is not null and c.cm is not null
    order by c.family, c.user_id, c.cm desc, c.id asc
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c order by c.user_id, c.id desc
  ), ranked as (
    select b.family, (row_number() over (partition by b.family order by b.cm desc, b.id asc))::integer as rank,
           n.nickname as name, b.cm, b.catch_name, b.user_id = auth.uid() as is_me
    from best b join nick n on n.user_id = b.user_id
  )
  select r.family, r.rank, r.name, r.cm, r.catch_name, r.is_me
  from ranked r where r.rank <= 20 or r.is_me order by r.family, r.rank;
$$;

revoke all on function public.fish_size_board_all() from public, anon;
grant execute on function public.fish_size_board_all() to authenticated;
notify pgrst, 'reload schema';
commit;

-- 안드로이드 앱 푸시 토큰 (2026-11-07) [사용자: 앱으로 설치해도 알림이 오게]
-- 앱 안 WebView 엔 웹 푸시가 없어 FCM 으로 보낸다. 토큰은 기기마다 하나 — 같은 기기에서 계정을 바꾸면 새 사용자에게 넘어간다.
-- 그래서 직접 쓰기 대신 RPC 로 등록한다(남의 행을 RLS 로는 못 고친다). 새 표 · 새 함수만 더하고 기존 행은 건드리지 않는다.
begin;

create table if not exists public.native_push_tokens (
  token text primary key check (char_length(token) between 1 and 4096),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index if not exists native_push_tokens_user_idx on public.native_push_tokens (user_id);

alter table public.native_push_tokens enable row level security;
drop policy if exists native_push_tokens_select_own on public.native_push_tokens;
create policy native_push_tokens_select_own on public.native_push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists native_push_tokens_delete_own on public.native_push_tokens;
create policy native_push_tokens_delete_own on public.native_push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.native_push_tokens from anon;
grant select, delete on public.native_push_tokens to authenticated;

create or replace function public.register_native_push(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  insert into public.native_push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.register_native_push(text, text) from public, anon;
grant execute on function public.register_native_push(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- 앱 푸시 토큰 다듬기 (2026-11-07) [사용자: 앱 · 푸시 리뷰 "Fix all"] README §10.20
-- ① register_native_push: 아무 문자열(4096자까지)이나 받고 사용자마다 끝없이 쌓였다 → FCM 토큰 모양(영숫자 : _ -, 20~512자)만 받고,
--    등록할 때 그 사용자의 최신 5개만 남긴다. ⚠ 기존 행은 이 파일에서 지우지 않는다 — 그 사용자가 다음에 등록할 때만 정리된다.
-- ② unregister_native_push: 로그아웃 때 행 삭제가 실패한 기기(연결 불량)가 다음 실행에 그 토큰으로 지운다.
--    로그아웃 뒤라 세션이 없을 수 있어 anon 도 부른다 — 토큰은 그 기기만 아는 값이고, 그 토큰의 행을 지우는 것 말고는 아무것도 안 한다.
-- 멱등(create or replace) · 한 트랜잭션 · 표와 정책은 그대로.
begin;

create or replace function public.register_native_push(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 512 or p_token !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'bad token' using errcode = 'PT400';
  end if;
  if p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'bad platform' using errcode = 'PT400';
  end if;
  insert into public.native_push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- 최신 5개만 — 앱을 지웠다 다시 깐 기기 · 바뀐 토큰이 쌓여 알림 한 번에 죽은 토큰 수십 개로 보내지 않게
  delete from public.native_push_tokens t
  where t.user_id = v_uid
    and t.token <> p_token
    and t.token in (
      select k.token from public.native_push_tokens k
      where k.user_id = v_uid
      order by k.updated_at desc, k.token
      offset 5
    );
end;
$$;
revoke all on function public.register_native_push(text, text) from public, anon;
grant execute on function public.register_native_push(text, text) to authenticated;

create or replace function public.unregister_native_push(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or char_length(p_token) > 4096 then
    return;
  end if;
  delete from public.native_push_tokens where token = p_token;
end;
$$;
revoke all on function public.unregister_native_push(text) from public;
grant execute on function public.unregister_native_push(text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- 모험(2026-11-07) — 지역을 돌며 계보 생물을 잡고 키워 싸우는 게임의 저장. 사람마다 한 행(커플과 무관).
-- 저장은 adventure_save RPC 로만 버전을 맞춰 쓴다(두 기기가 동시에 쓰면 늦은 쪽이 PT409 — 40001 은 쓰지 않는다, README §11).
-- 읽기는 본인 행만. 2단계(온라인 대전)에서 상대 팀은 따로 RPC 로 꺼낸다.
begin;

create table if not exists public.adventure_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.adventure_saves enable row level security;

drop policy if exists adventure_saves_select_own on public.adventure_saves;
create policy adventure_saves_select_own on public.adventure_saves for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.adventure_saves from anon;
grant select on public.adventure_saves to authenticated;

create or replace function public.adventure_save(p_state jsonb, p_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v integer;
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
    update public.adventure_saves
      set state = p_state, version = version + 1, updated_at = now()
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

notify pgrst, 'reload schema';
commit;

-- 모험 온라인 대전(2026-11-08) — 대전 팀 · 점수 · 판 기록. README §14.6
-- 판은 엣지 함수 adventure-battle 이 서비스 롤로 돌린다(앱은 행동만 보낸다). 그래서 세 표 모두 앱이 직접 쓰지 못한다 —
-- 본인 행 읽기 정책만 있고 쓰기 권한은 없다. 순위 · 상대 목록 · 전적은 security definer 함수가 닉네임 · 점수만 돌려준다.
-- 점수 정산은 adventure_settle 한 곳(행 잠금, 서비스 롤만) — 두 판이 동시에 끝나도 점수가 엇갈리지 않게.
begin;

create table if not exists public.adventure_teams (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  team jsonb not null,
  power integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.adventure_teams enable row level security;
drop policy if exists adventure_teams_select_own on public.adventure_teams;
create policy adventure_teams_select_own on public.adventure_teams for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.adventure_ratings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  streak integer not null default 0,
  best integer not null default 1000,
  updated_at timestamptz not null default now()
);
alter table public.adventure_ratings enable row level security;
drop policy if exists adventure_ratings_select_own on public.adventure_ratings;
create policy adventure_ratings_select_own on public.adventure_ratings for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.adventure_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid references auth.users (id) on delete set null,
  opponent_name text not null default '',
  bot boolean not null default false,
  state jsonb not null,
  status text not null default 'active' check (status in ('active', 'done')),
  result text check (result in ('win', 'lose')),
  delta integer not null default 0,
  opp_delta integer not null default 0,
  turn integer not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.adventure_matches enable row level security;
create index if not exists adventure_matches_user_idx on public.adventure_matches (user_id, created_at desc);
create index if not exists adventure_matches_opp_idx on public.adventure_matches (opponent_id, created_at desc);
drop policy if exists adventure_matches_select_mine on public.adventure_matches;
create policy adventure_matches_select_mine on public.adventure_matches for select to authenticated
  using (user_id = (select auth.uid()) or opponent_id = (select auth.uid()));

revoke all on public.adventure_teams, public.adventure_ratings, public.adventure_matches from anon;
revoke insert, update, delete on public.adventure_teams, public.adventure_ratings, public.adventure_matches from authenticated;
grant select on public.adventure_teams, public.adventure_ratings, public.adventure_matches to authenticated;

-- 점수 정산(서비스 롤만) — 이긴 쪽 · 진 쪽 점수와 연승을 한 번에. 연습 상대(p_opp null)면 나만.
create or replace function public.adventure_settle(p_user uuid, p_opp uuid, p_win boolean, p_k integer, p_k_def integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me integer;
  opp integer;
  expect numeric;
  d integer;
  od integer := 0;
begin
  insert into public.adventure_ratings (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_opp is not null then
    insert into public.adventure_ratings (user_id) values (p_opp) on conflict (user_id) do nothing;
  end if;
  select rating into me from public.adventure_ratings where user_id = p_user for update;
  if p_opp is not null then
    select rating into opp from public.adventure_ratings where user_id = p_opp for update;
  else
    opp := me;
  end if;
  expect := 1 / (1 + power(10::numeric, (opp - me) / 400.0));
  d := round(p_k * ((case when p_win then 1 else 0 end) - expect));
  update public.adventure_ratings set
    rating = greatest(0, rating + d),
    wins = wins + (case when p_win then 1 else 0 end),
    losses = losses + (case when p_win then 0 else 1 end),
    streak = case when p_win then streak + 1 else 0 end,
    best = greatest(best, rating + d),
    updated_at = now()
  where user_id = p_user;
  if p_opp is not null then
    od := round(p_k_def * ((case when p_win then 0 else 1 end) - (1 - expect)));
    update public.adventure_ratings set
      rating = greatest(0, rating + od),
      wins = wins + (case when p_win then 0 else 1 end),
      losses = losses + (case when p_win then 1 else 0 end),
      best = greatest(best, rating + od),
      updated_at = now()
    where user_id = p_opp;
  end if;
  return json_build_object('delta', d, 'opp_delta', od, 'rating', greatest(0, me + d));
end;
$$;
revoke all on function public.adventure_settle(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_settle(uuid, uuid, boolean, integer, integer) to service_role;

-- 순위 — 점수 순 1~p_limit 등 + 내 줄. 닉네임 · 점수 · 전적 · 대표 생물만(팀 전체 · 계정은 안 나간다).
create or replace function public.adventure_board(p_limit integer default 30)
returns table (rank bigint, nickname text, rating integer, wins integer, losses integer, lead text, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select r.user_id, t.nickname, r.rating, r.wins, r.losses, t.team -> 0 ->> 'species' as lead,
           rank() over (order by r.rating desc, r.wins desc, r.updated_at) as rank
    from public.adventure_ratings r
    join public.adventure_teams t on t.user_id = r.user_id
    where r.wins + r.losses > 0
  )
  select rank, nickname, rating, wins, losses, lead, user_id = (select auth.uid())
  from ranked
  where rank <= least(greatest(coalesce(p_limit, 30), 1), 100) or user_id = (select auth.uid())
  order by rank;
$$;
revoke all on function public.adventure_board(integer) from public, anon;
grant execute on function public.adventure_board(integer) to authenticated;

-- 내 전적 — 도전(내가 건 판)과 방어(남이 내 팀에 건 판) 최근 30판
create or replace function public.adventure_history()
returns table (id uuid, attack boolean, opponent text, bot boolean, result text, delta integer, finished_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id,
         m.user_id = (select auth.uid()),
         case when m.user_id = (select auth.uid()) then m.opponent_name
              else coalesce((select t.nickname from public.adventure_teams t where t.user_id = m.user_id), '도전자') end,
         m.bot,
         case when m.user_id = (select auth.uid()) then m.result
              when m.result = 'win' then 'lose' else 'win' end,
         case when m.user_id = (select auth.uid()) then m.delta else m.opp_delta end,
         m.finished_at
  from public.adventure_matches m
  where m.status = 'done'
    and (m.user_id = (select auth.uid()) or (m.opponent_id = (select auth.uid()) and not m.bot))
  order by m.finished_at desc nulls last
  limit 30;
$$;
revoke all on function public.adventure_history() from public, anon;
grant execute on function public.adventure_history() to authenticated;

notify pgrst, 'reload schema';
commit;

-- 모험 대전 · 저장 지키기(2026-11-09 리뷰 "Fix all") — README §14.6 '대전 지키기'.
-- 멱등(create or replace · if not exists · drop … if exists) · 한 트랜잭션 · 이 파일은 판 · 점수 행을 지우지 않는다(오래된 판 정리는 크론이 나중에 나이로만).
-- 롤백(SQL 편집기)은 README §14.6 '대전 지키기' 표 — 크론만 멈추려면 select cron.unschedule('adventure-retention-daily');
begin;

-- ── 1) 저장은 합쳐서 쓴다 — 옛 번들이 모르는 칸(골드로 산 장신구 등)을 지우지 못하게 ─────────────────────
-- 옛 번들의 normalizeSave 는 아는 칸만 다시 지어 보낸다. 통째로 바꾸면 새 칸이 사라졌다 → 최상위 칸만 덮어쓴다(state || p_state).
-- 지워져야 하는 최상위 칸은 없다(daily · field 는 날짜를 보고 읽으므로 옛 값이 남아도 무해).
create or replace function public.adventure_save(p_state jsonb, p_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v integer;
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

-- ── 2) 새 칸 ──────────────────────────────────────────────────────────────────────────────
-- 상대 고르기에 계정 id 대신 팀 행의 무작위 id(내리고 다시 올리면 바뀐다)
alter table public.adventure_teams add column if not exists public_id uuid not null default gen_random_uuid();
create unique index if not exists adventure_teams_public_id_key on public.adventure_teams (public_id);
-- 연습 판 전적(점수와 따로) · 하루 점수 상승 상한(KST 날짜)
alter table public.adventure_ratings add column if not exists practice_wins integer not null default 0;
alter table public.adventure_ratings add column if not exists practice_losses integer not null default 0;
alter table public.adventure_ratings add column if not exists day_gain integer not null default 0;
alter table public.adventure_ratings add column if not exists gain_day date;
-- 판에 보낸 입력 기록 · 판을 연 엔진(함수를 다시 배포하면 열려 있던 판은 무효)
alter table public.adventure_matches add column if not exists log jsonb;
alter table public.adventure_matches add column if not exists engine text;
alter table public.adventure_matches drop constraint if exists adventure_matches_status_check;
alter table public.adventure_matches add constraint adventure_matches_status_check check (status in ('active', 'done', 'void'));
create index if not exists adventure_matches_pair_idx on public.adventure_matches (user_id, opponent_id, created_at desc);
create index if not exists adventure_matches_created_idx on public.adventure_matches (created_at);

-- 닉네임은 대소문자를 무시하고 하나만 — 이미 겹친 이름이 있으면 만들지 않고 알린다(함수가 먼저 따로 거른다)
do $$
begin
  if to_regclass('public.adventure_teams_nick_lower_key') is null then
    if exists (select 1 from public.adventure_teams group by lower(nickname) having count(*) > 1) then
      raise notice 'adventure_teams: 겹친 닉네임이 있어 unique 를 건너뛴다';
    else
      create unique index adventure_teams_nick_lower_key on public.adventure_teams (lower(nickname));
    end if;
  end if;
end $$;

-- ── 3) 판 기록은 건 사람만 읽는다 — 방어한 사람은 전적 RPC(adventure_history)로만 ─────────────────────
-- 예전엔 방어한 쪽이 도전자의 계정 id 와 팀 전체(state)를 읽을 수 있었다.
drop policy if exists adventure_matches_select_mine on public.adventure_matches;
create policy adventure_matches_select_mine on public.adventure_matches for select to authenticated
  using (user_id = (select auth.uid()));

-- ── 4) 점수 정산 — 연습 판은 점수를 안 바꾸고 · 하루 상승 +120 상한 · 두 행을 id 순으로 잠근다 ─────────────
-- 연습 판은 opp := me 라 기대 승률이 늘 0.5 → 이길 때마다 +8 이 쌓였다(순위 농사). 서명은 그대로 — 옛 함수도 같은 규칙을 탄다.
create or replace function public.adventure_settle(p_user uuid, p_opp uuid, p_win boolean, p_k integer, p_k_def integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_cap constant integer := 120;
  me integer;
  opp integer;
  my_gain integer;
  opp_gain integer;
  expect numeric;
  d integer := 0;
  od integer := 0;
begin
  insert into public.adventure_ratings (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_opp is null or p_opp = p_user then
    update public.adventure_ratings set
      practice_wins = practice_wins + (case when p_win then 1 else 0 end),
      practice_losses = practice_losses + (case when p_win then 0 else 1 end),
      updated_at = now()
    where user_id = p_user
    returning rating into me;
    return json_build_object('delta', 0, 'opp_delta', 0, 'rating', me, 'practice', true);
  end if;
  insert into public.adventure_ratings (user_id) values (p_opp) on conflict (user_id) do nothing;
  -- 같은 순서로 잠근다 — A→B 와 B→A 가 동시에 끝나도 서로를 기다리지 않게
  perform 1 from public.adventure_ratings where user_id in (p_user, p_opp) order by user_id for update;
  select rating, case when gain_day = v_day then day_gain else 0 end into me, my_gain
    from public.adventure_ratings where user_id = p_user;
  select rating, case when gain_day = v_day then day_gain else 0 end into opp, opp_gain
    from public.adventure_ratings where user_id = p_opp;
  expect := 1 / (1 + power(10::numeric, (opp - me) / 400.0));
  d := round(p_k * ((case when p_win then 1 else 0 end) - expect));
  if d > 0 then
    d := least(d, greatest(0, v_cap - my_gain));
  end if;
  od := round(p_k_def * ((case when p_win then 0 else 1 end) - (1 - expect)));
  if od > 0 then
    od := least(od, greatest(0, v_cap - opp_gain));
  end if;
  update public.adventure_ratings set
    rating = greatest(0, rating + d),
    wins = wins + (case when p_win then 1 else 0 end),
    losses = losses + (case when p_win then 0 else 1 end),
    streak = case when p_win then streak + 1 else 0 end,
    best = greatest(best, greatest(0, rating + d)),
    day_gain = my_gain + greatest(d, 0),
    gain_day = v_day,
    updated_at = now()
  where user_id = p_user;
  update public.adventure_ratings set
    rating = greatest(0, rating + od),
    wins = wins + (case when p_win then 0 else 1 end),
    losses = losses + (case when p_win then 1 else 0 end),
    best = greatest(best, greatest(0, rating + od)),
    day_gain = opp_gain + greatest(od, 0),
    gain_day = v_day,
    updated_at = now()
  where user_id = p_opp;
  return json_build_object('delta', d, 'opp_delta', od, 'rating', greatest(0, me + d));
end;
$$;
revoke all on function public.adventure_settle(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_settle(uuid, uuid, boolean, integer, integer) to service_role;

-- ── 5) 같은 사람에게는 하루(KST) 세 판까지 — 한 사람을 계속 두들겨 점수를 빼 가지 못하게(PT429) ─────────────
-- 함수(옛 · 새)가 판을 넣을 때마다 탄다. 같은 사용자의 시작은 잠금으로 줄을 세운다(동시에 넷이 들어오지 않게).
create schema if not exists private;
create or replace function private.adventure_matches_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if new.opponent_id is null or new.bot then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ourdays:adventure:start:' || new.user_id::text, 0));
  select count(*) into n from public.adventure_matches
    where user_id = new.user_id and opponent_id = new.opponent_id
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  if n >= 3 then
    raise exception 'same opponent' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
revoke all on function private.adventure_matches_cap() from public, anon, authenticated;
drop trigger if exists adventure_matches_cap on public.adventure_matches;
create trigger adventure_matches_cap before insert on public.adventure_matches
  for each row execute function private.adventure_matches_cap();

-- ── 6) 탈퇴한 방어자의 닉네임을 남의 판 기록에서 지운다 ──────────────────────────────────────────
-- 계정을 지우면 opponent_id 가 on delete set null 로 비워진다 — 그 순간 이름(칸 · 판 상태의 이름)을 바꾼다.
create or replace function private.adventure_matches_scrub_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.opponent_id is not null and new.opponent_id is null then
    new.opponent_name := '탈퇴한 사용자';
    if jsonb_typeof(new.state -> 'sides') = 'array' and jsonb_typeof(new.state -> 'sides' -> 1) = 'object' then
      new.state := jsonb_set(new.state, '{sides,1,name}', to_jsonb('탈퇴한 사용자'::text), false);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.adventure_matches_scrub_name() from public, anon, authenticated;
drop trigger if exists adventure_matches_scrub_name on public.adventure_matches;
create trigger adventure_matches_scrub_name before update of opponent_id on public.adventure_matches
  for each row execute function private.adventure_matches_scrub_name();

-- ── 7) 상대 후보 — 점수가 가까운 순(200명이 넘어도 가까운 사람이 나온다) · 오늘 세 번 붙은 사람은 빼고 ──────────
-- 서비스 롤(엣지 함수)만. 계정 id 는 돌려주지 않는다(public_id 만).
create or replace function public.adventure_candidates(p_user uuid, p_rating integer, p_limit integer default 200)
returns table (public_id uuid, nickname text, team jsonb, rating integer, wins integer, losses integer)
language sql
stable
set search_path = ''
as $$
  select t.public_id, t.nickname, t.team, coalesce(r.rating, 1000), coalesce(r.wins, 0), coalesce(r.losses, 0)
  from public.adventure_teams t
  left join public.adventure_ratings r on r.user_id = t.user_id
  where t.user_id <> p_user
    and (select count(*) from public.adventure_matches m
         where m.user_id = p_user and m.opponent_id = t.user_id
           and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) < 3
  order by abs(coalesce(r.rating, 1000) - coalesce(p_rating, 1000)), t.updated_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke all on function public.adventure_candidates(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_candidates(uuid, integer, integer) to service_role;

-- ── 8) 보관 — 하루 넘게 열린 판은 진 것으로 정산하고, 60일 지난 판은 지운다(크론만 부른다) ──────────────────
create or replace function private.adventure_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  s json;
begin
  for m in
    select id, user_id, opponent_id, bot from public.adventure_matches
    where status = 'active' and created_at < now() - interval '1 day'
    for update skip locked
  loop
    update public.adventure_matches set status = 'done', result = 'lose', finished_at = now()
      where id = m.id and status = 'active';
    if found then
      s := public.adventure_settle(m.user_id, case when m.bot then null else m.opponent_id end, false, 32, 16);
      update public.adventure_matches set delta = (s ->> 'delta')::integer, opp_delta = (s ->> 'opp_delta')::integer
        where id = m.id;
    end if;
  end loop;
  delete from public.adventure_matches where status <> 'active' and created_at < now() - interval '60 days';
end;
$$;
revoke all on function private.adventure_retention() from public, anon, authenticated;

-- 매일 03:45 KST(18:45 UTC) — SQL 한 줄이라 비밀이 없다. 이름으로 지우고 다시 건다(멱등). cron.job 에서는 jobid 만 읽는다.
do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'adventure-retention-daily' $q$;
  execute $q$ select cron.schedule('adventure-retention-daily', '45 18 * * *', 'select private.adventure_retention()') $q$;
end $$;

notify pgrst, 'reload schema';
commit;

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

-- 대전 · 저장 다듬기(2026-11-09) — README §14.6 '대전 · 저장 다듬기'.
-- 멱등(create or replace · if not exists) · 한 트랜잭션 · 이 파일은 행을 지우지 않는다(60일 정리는 그대로 크론이 나이로만).
-- 함수는 각자의 가장 최근 정의(20261107050000_adventure_guard)에서 필요한 줄만 바꿨다 — 서명 · 권한 그대로(옛 함수도 그대로 부른다).
-- 롤백(SQL 편집기)은 README §14.6 '대전 · 저장 다듬기'의 롤백 SQL.
begin;

-- ── 1) 순위의 같은 점수 순서 — 처음 대전에 들어온 때(updated_at 은 정산마다 바뀌어 순서가 흔들렸다) ─────────
-- 이미 있는 행은 모두 이 migration 의 시각이 된다 — 그 사이는 user_id 순(늘 같은 순서).
alter table public.adventure_ratings add column if not exists created_at timestamptz not null default now();

-- ── 2) 점수 정산 — 상승 상한에 걸리면 방어자가 잃는 점수도 같은 비율로 ─────────────────────────
-- 20261107050000 의 정의에서 바뀐 것: 도전자의 상승을 상한으로 깎아도 방어자는 깎기 전 점수를 그대로 잃었다(한도에 닿은 사람이
-- 계속 이기면 남의 점수만 빠졌다). 이제 od 를 d / (깎기 전 d) 로 줄이고(상한에 다 차면 0) 'capped' 를 돌려준다.
create or replace function public.adventure_settle(p_user uuid, p_opp uuid, p_win boolean, p_k integer, p_k_def integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_cap constant integer := 120;
  me integer;
  opp integer;
  my_gain integer;
  opp_gain integer;
  expect numeric;
  d integer := 0;
  d_raw integer := 0;
  od integer := 0;
  v_capped boolean := false;
begin
  insert into public.adventure_ratings (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_opp is null or p_opp = p_user then
    update public.adventure_ratings set
      practice_wins = practice_wins + (case when p_win then 1 else 0 end),
      practice_losses = practice_losses + (case when p_win then 0 else 1 end),
      updated_at = now()
    where user_id = p_user
    returning rating into me;
    return json_build_object('delta', 0, 'opp_delta', 0, 'rating', me, 'practice', true, 'capped', false);
  end if;
  insert into public.adventure_ratings (user_id) values (p_opp) on conflict (user_id) do nothing;
  -- 같은 순서로 잠근다 — A→B 와 B→A 가 동시에 끝나도 서로를 기다리지 않게
  perform 1 from public.adventure_ratings where user_id in (p_user, p_opp) order by user_id for update;
  select rating, case when gain_day = v_day then day_gain else 0 end into me, my_gain
    from public.adventure_ratings where user_id = p_user;
  select rating, case when gain_day = v_day then day_gain else 0 end into opp, opp_gain
    from public.adventure_ratings where user_id = p_opp;
  expect := 1 / (1 + power(10::numeric, (opp - me) / 400.0));
  d_raw := round(p_k * ((case when p_win then 1 else 0 end) - expect));
  d := d_raw;
  od := round(p_k_def * ((case when p_win then 0 else 1 end) - (1 - expect)));
  if d_raw > 0 then
    d := least(d_raw, greatest(0, v_cap - my_gain));
    if d < d_raw then
      v_capped := true;
      -- 이긴 쪽이 덜 오른 만큼 진 쪽(방어자)도 덜 잃는다 — 상한에 다 찼으면 둘 다 그대로
      od := round(od * d::numeric / d_raw);
    end if;
  end if;
  if od > 0 then
    od := least(od, greatest(0, v_cap - opp_gain));
  end if;
  update public.adventure_ratings set
    rating = greatest(0, rating + d),
    wins = wins + (case when p_win then 1 else 0 end),
    losses = losses + (case when p_win then 0 else 1 end),
    streak = case when p_win then streak + 1 else 0 end,
    best = greatest(best, greatest(0, rating + d)),
    day_gain = my_gain + greatest(d, 0),
    gain_day = v_day,
    updated_at = now()
  where user_id = p_user;
  update public.adventure_ratings set
    rating = greatest(0, rating + od),
    wins = wins + (case when p_win then 0 else 1 end),
    losses = losses + (case when p_win then 1 else 0 end),
    best = greatest(best, greatest(0, rating + od)),
    day_gain = opp_gain + greatest(od, 0),
    gain_day = v_day,
    updated_at = now()
  where user_id = p_opp;
  return json_build_object('delta', d, 'opp_delta', od, 'rating', greatest(0, me + d), 'capped', v_capped);
end;
$$;
revoke all on function public.adventure_settle(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_settle(uuid, uuid, boolean, integer, integer) to service_role;

-- ── 3) 판 닫기 + 정산을 한 트랜잭션으로 · 판 id 로 멱등 ─────────────────────────────────────
-- 예전엔 함수가 닫기(update) → 정산(RPC) → delta 쓰기를 따로 보냈다: 정산이 실패하면 되여는 update 가 또 실패할 수 있었고,
-- 응답을 잃은 앱이 다시 보내면 이미 닫힌 판이라 404 만 받았다. 이제 한 번에 하고, 이미 끝난 판(done · void)은 남겨 둔 결과를 그대로 돌려준다.
-- status: 'done'(새로 닫음 또는 이미 닫힘 — again true) · 'void' · 'missing'(내 판이 아니거나 없음). 서비스 롤(엣지 함수)만.
create or replace function public.adventure_finish(
  p_match uuid, p_user uuid, p_win boolean, p_ticks integer, p_state jsonb, p_log jsonb, p_k integer, p_k_def integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  s json;
  v_rating integer;
begin
  select id, user_id, opponent_id, bot, status, result, delta into m
    from public.adventure_matches
    where id = p_match and user_id = p_user
    for update;
  if not found then
    return json_build_object('status', 'missing');
  end if;
  if m.status <> 'active' then
    select rating into v_rating from public.adventure_ratings where user_id = p_user;
    return json_build_object('status', m.status, 'result', m.result, 'delta', coalesce(m.delta, 0),
      'rating', coalesce(v_rating, 1000), 'practice', m.bot, 'again', true);
  end if;
  update public.adventure_matches set
    status = 'done',
    result = case when p_win then 'win' else 'lose' end,
    turn = greatest(coalesce(p_ticks, 0), 0),
    finished_at = now(),
    state = coalesce(p_state, state),
    log = p_log
  where id = p_match;
  s := public.adventure_settle(m.user_id, case when m.bot then null else m.opponent_id end, p_win, p_k, p_k_def);
  update public.adventure_matches set delta = (s ->> 'delta')::integer, opp_delta = (s ->> 'opp_delta')::integer
    where id = p_match;
  return json_build_object('status', 'done', 'result', case when p_win then 'win' else 'lose' end,
    'delta', (s ->> 'delta')::integer, 'rating', (s ->> 'rating')::integer,
    'practice', coalesce((s ->> 'practice')::boolean, false), 'capped', coalesce((s ->> 'capped')::boolean, false), 'again', false);
end;
$$;
revoke all on function public.adventure_finish(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_finish(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer) to service_role;

-- ── 4) 판 넣기 지키기 — 하루 60판(KST 자정부터 · 무효 판은 안 센다) · 다른 기기에서 막 연 판 · 같은 상대 세 판 ───────
-- 20261107050000 의 정의에서 바뀐 것: 하루 판 수는 함수가 '지난 24시간'(무효 판까지)으로 따로 셌다 — 문구는 '오늘 · 내일'인데
-- 실제론 어제 저녁 판까지 셌고, 두 기기가 동시에 열면 둘 다 통과했다. 이제 같은 사용자 잠금 안에서 센다(연습 판도 하루 판에 든다).
-- 150초(한 판의 최대 길이) 안에 연 판이 열려 있으면 'busy'(PT409) — 다른 기기의 판을 진 것으로 닫지 않는다.
-- 같은 상대 세 판도 무효 판은 안 센다. 오류: 'daily limit' · 'same opponent' 는 PT429(문구로 가른다), 'busy' 는 PT409.
create schema if not exists private;
create or replace function private.adventure_matches_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ourdays:adventure:start:' || new.user_id::text, 0));
  if exists (select 1 from public.adventure_matches
             where user_id = new.user_id and status = 'active' and created_at > now() - interval '150 seconds') then
    raise exception 'busy' using errcode = 'PT409';
  end if;
  select count(*) into n from public.adventure_matches
    where user_id = new.user_id and status <> 'void' and created_at >= v_since;
  if n >= 60 then
    raise exception 'daily limit' using errcode = 'PT429';
  end if;
  if new.opponent_id is null or new.bot then
    return new;
  end if;
  select count(*) into n from public.adventure_matches
    where user_id = new.user_id and opponent_id = new.opponent_id and status <> 'void'
      and created_at >= v_since;
  if n >= 3 then
    raise exception 'same opponent' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
revoke all on function private.adventure_matches_cap() from public, anon, authenticated;
drop trigger if exists adventure_matches_cap on public.adventure_matches;
create trigger adventure_matches_cap before insert on public.adventure_matches
  for each row execute function private.adventure_matches_cap();

-- ── 5) 상대 후보 — 같은 상대 세 판에서 무효 판은 빼고 센다(트리거와 같은 규칙) ─────────────────────
create or replace function public.adventure_candidates(p_user uuid, p_rating integer, p_limit integer default 200)
returns table (public_id uuid, nickname text, team jsonb, rating integer, wins integer, losses integer)
language sql
stable
set search_path = ''
as $$
  select t.public_id, t.nickname, t.team, coalesce(r.rating, 1000), coalesce(r.wins, 0), coalesce(r.losses, 0)
  from public.adventure_teams t
  left join public.adventure_ratings r on r.user_id = t.user_id
  where t.user_id <> p_user
    and (select count(*) from public.adventure_matches m
         where m.user_id = p_user and m.opponent_id = t.user_id and m.status <> 'void'
           and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) < 3
  order by abs(coalesce(r.rating, 1000) - coalesce(p_rating, 1000)), t.updated_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke all on function public.adventure_candidates(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_candidates(uuid, integer, integer) to service_role;

-- ── 6) 오늘의 대전 현황 — 판 수 · 오른 점수 · 상대마다 판 수(public_id 로만) ─────────────────────────
-- 화면이 '오늘 남은 판 n/60 · 오른 점수 n/120 · 이 상대와 n판 남음'을 보여 준다. 서비스 롤(엣지 함수 me)만.
create or replace function public.adventure_today(p_user uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as at
  ), mine as (
    select m.opponent_id, m.bot from public.adventure_matches m, since
    where m.user_id = p_user and m.status <> 'void' and m.created_at >= since.at
  )
  select json_build_object(
    'duels', (select count(*) from mine),
    'gain', coalesce((select case when r.gain_day = (now() at time zone 'Asia/Seoul')::date then r.day_gain else 0 end
                      from public.adventure_ratings r where r.user_id = p_user), 0),
    'opponents', coalesce((
      select json_agg(json_build_object('id', t.public_id, 'n', x.n))
      from (select opponent_id, count(*) as n from mine where opponent_id is not null and not bot group by opponent_id) x
      join public.adventure_teams t on t.user_id = x.opponent_id
    ), '[]'::json)
  );
$$;
revoke all on function public.adventure_today(uuid) from public, anon, authenticated;
grant execute on function public.adventure_today(uuid) to service_role;

-- ── 7) 닉네임 겹침 — 대소문자만 무시하고 글자 그대로 ───────────────────────────────────────
-- 함수가 PostgREST ilike 로 찾았는데 PostgREST 는 '*' 를 '%' 로 바꿔, '*' 가 든 이름은 아무 이름과도 겹친다고 나왔다. 서비스 롤만.
create or replace function public.adventure_nick_taken(p_nick text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.adventure_teams t
    where lower(t.nickname) = lower(p_nick) and t.user_id is distinct from p_user
  );
$$;
revoke all on function public.adventure_nick_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.adventure_nick_taken(text, uuid) to service_role;

-- ── 8) 순위 — 위 30등 + 내 앞뒤 다섯 · 같은 점수는 처음 들어온 순(흔들리지 않게) ─────────────────────
-- 20261107040000 의 정의에서 바뀐 것: 같은 점수는 rank() 에 updated_at 순이라 정산할 때마다 자리가 바뀌었고, 30등 밖이면 내 줄만 보였다.
-- 서명 · 반환 칸 · 권한 그대로(옛 앱도 그대로 그린다 — 등수가 건너뛰면 사이가 빈 것).
create or replace function public.adventure_board(p_limit integer default 30)
returns table (rank bigint, nickname text, rating integer, wins integer, losses integer, lead text, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select r.user_id, t.nickname, r.rating, r.wins, r.losses, t.team -> 0 ->> 'species' as lead,
           row_number() over (order by r.rating desc, r.created_at, r.user_id) as rank
    from public.adventure_ratings r
    join public.adventure_teams t on t.user_id = r.user_id
    where r.wins + r.losses > 0
  ), mine as (
    select ranked.rank from ranked where ranked.user_id = (select auth.uid())
  )
  select ranked.rank, ranked.nickname, ranked.rating, ranked.wins, ranked.losses, ranked.lead, ranked.user_id = (select auth.uid())
  from ranked
  where ranked.rank <= least(greatest(coalesce(p_limit, 30), 1), 100)
     or exists (select 1 from mine where abs(ranked.rank - mine.rank) <= 5)
  order by ranked.rank;
$$;
revoke all on function public.adventure_board(integer) from public, anon;
grant execute on function public.adventure_board(integer) to authenticated;

-- ── 9) 보관 — 하루 넘게 열린 판은 무효로(점수 그대로), 60일 지난 판은 지운다(크론만 부른다) ─────────────
-- 20261107050000 의 정의에서 바뀐 것: 열린 판을 K 32 · 16 고정값으로 진 것으로 정산했다(연습 판 K · 판을 연 엔진과 무관하게).
-- 하루 지난 판은 이미 me · opponents · start 가 정산했어야 할 판이라, 여기 남은 건 버려진 판 — 누구 점수도 바꾸지 않고 닫는다.
create or replace function private.adventure_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.adventure_matches set status = 'void', finished_at = now()
    where status = 'active' and created_at < now() - interval '1 day';
  delete from public.adventure_matches where status <> 'active' and created_at < now() - interval '60 days';
end;
$$;
revoke all on function private.adventure_retention() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- 이달의 대회(2026-11-12) [사용자: "달마다 물고기 한 종을 정해 크기를 겨루고, 1등에게 칭호와 한정 찌를 줍니다"]
-- 달마다 한 계열을 정해 그 달(KST)에 잡은 것만으로 크기 순위를 낸다. 함수 둘만 더한다 — 표 · 행 · 기존 함수는 건드리지 않는다.
-- 여러 번 돌려도 같은 결과(create or replace). 롤백은 README '이달의 대회'의 drop function 두 줄.
begin;

-- 그 달의 어종 — 'YYYY-MM' → 계열 key. 앱(src/lib/fishcontest.ts 의 CONTEST_FAMILIES · contestFamily)과 글자 하나까지 같은 목록 · 공식이다
-- (fishcontest.test 가 이 파일의 목록을 읽어 36달을 견준다). 해시가 아니라 돌림(월 일련번호 mod 15)인 이유:
--   · 정수 계산만이라 브라우저에서 똑같이 재현된다(hashtext · md5 는 앱이 못 따라 한다).
--   · 이웃한 두 달이 같은 어종이 되지 않는다(해시는 연달아 겹칠 수 있다). 15 는 12 의 약수가 아니라 해마다 같은 달의 어종이 바뀐다.
-- 목록은 시작 미끼로 무는 '기본 계열'이고 Lv.12 안의 낚시터에서 나오는 것만 — 주인 · 깊은 바다 전용 · 미끼 1% 규칙에 걸리는 계열은 뺐다.
-- 민물 · 바다 · 관상어가 번갈아 오게 늘어놓았다. ⚠ 순서나 길이를 바꾸면 모든 달의 어종이 바뀐다 — 바꿀 땐 새 migration 과 앱을 같이, 달이 바뀔 때.
-- 나쁜 값(형식 · 달 범위)은 오류 없이 null — 순위 함수가 빈 결과를 돌려준다.
create schema if not exists private;
create or replace function private.contest_family(p_month text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then null
    else (array[
      'crucian', 'mackerel', 'guppy', 'smelt', 'flounder', 'pale_chub', 'tetra', 'rockfish',
      'sweetfish', 'goldfish', 'black_seabream', 'chinese_minnow', 'betta', 'rockfish_bollak', 'bullhead'
    ]::text[])[((split_part(p_month, '-', 1)::integer * 12 + split_part(p_month, '-', 2)::integer - 1) % 15) + 1]
  end;
$$;
revoke all on function private.contest_family(text) from public, anon, authenticated;

-- 그 달의 대회 순위 — 그 달의 어종을 그 달(KST 1일 0시 ~ 다음 달 1일 0시 전)에 잡은 것만. 사람마다 가장 긴 한 마리.
-- 같은 길이면 먼저 잡은 사람(created_at → id). 1~20등 + (20등 밖이면) 내 줄. 닉네임 · 길이 · 잡은 때만 나간다(user_id 는 안 나간다).
-- 보이는 규칙은 fish_size_board_all 과 같다 — 아는 계열만(private.fish_family_ok) · 닉네임 · 이름은 내보낼 때 정리(private.clean_board_text).
-- 주인 · 쓰레기는 submit_fish_catch 가 길이를 안 넣으니 저절로 빠진다. 1등 상품(칭호 · 한정 찌)은 앱이 이 결과를 보고 섬 상태에 적는다 —
-- 서버는 순위만 낸다(상품은 모습뿐이라 위조돼도 점수 · 하트에 영향이 없다 — README '이달의 대회').
create or replace function public.fish_month_contest(p_month text)
returns table (family text, rank integer, name text, cm real, catch_name text, caught_at timestamptz, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select private.contest_family(p_month) as family,
           case when private.contest_family(p_month) is null then null
                else (p_month || '-01')::timestamp at time zone 'Asia/Seoul' end as t0,
           case when private.contest_family(p_month) is null then null
                else ((p_month || '-01')::timestamp + interval '1 month') at time zone 'Asia/Seoul' end as t1
  ), best as (
    select distinct on (c.user_id) c.user_id, c.cm, c.name as catch_name, c.created_at, c.id
    from public.fish_catches c, m
    where m.family is not null and private.fish_family_ok(m.family)
      and c.family = m.family and c.cm is not null
      and c.created_at >= m.t0 and c.created_at < m.t1
    order by c.user_id, c.cm desc, c.created_at asc, c.id asc
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c where c.user_id in (select b.user_id from best b)
    order by c.user_id, c.id desc
  ), ranked as (
    select (row_number() over (order by b.cm desc, b.created_at asc, b.id asc))::integer as rank,
           coalesce(private.clean_board_text(n.nickname, 20), '이름 없음') as name, b.cm,
           coalesce(private.clean_board_text(b.catch_name, 30), '') as catch_name, b.created_at as caught_at,
           b.user_id = auth.uid() as is_me
    from best b join nick n on n.user_id = b.user_id
  )
  select m.family, r.rank, r.name, r.cm, r.catch_name, r.caught_at, r.is_me
  from ranked r, m where r.rank <= 20 or r.is_me order by r.rank;
$$;
revoke all on function public.fish_month_contest(text) from public, anon;
grant execute on function public.fish_month_contest(text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- ── migrations/20261107090000_fish_families_54.sql ──
-- 4차 어종 54계열(2026-11-13) — 낚시 순위 · 크기 순위가 아는 계열 목록에 더한다.
-- 20261107060000_review_guard 의 private.fish_family_ok 와 같은 정의에 계열만 늘렸다(목록은 src/lib/aquarium.ts 의 FAMILIES 순서 — serverguard.test 가 견준다).
-- 함수 하나를 다시 정의할 뿐이다 — 표 · 행 · 다른 함수 · 권한은 그대로. 몇 번 다시 돌려도 같다.
begin;

create or replace function private.fish_family_ok(p_family text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_family = any (array[
    'guppy', 'ricefish', 'pale_chub', 'zebra_danio', 'corydoras', 'platy', 'chinese_minnow', 'crucian', 'lanternfish', 'molly',
    'anchovy', 'dark_chub', 'goby', 'loach', 'bluegill', 'tetra', 'saury', 'smelt', 'sweetfish', 'bitterling',
    'goldfish', 'hatchetfish', 'gourami', 'boxfish', 'butterflyfish', 'bullhead', 'mudskipper', 'sleeper', 'gudgeon', 'betta',
    'scorpionfish', 'halfbeak', 'pleco', 'mackerel', 'rockfish_bollak', 'catfish', 'flounder', 'shiri', 'common_carp', 'rockfish',
    'blue_tang', 'masu_salmon', 'angel', 'filefish', 'black_seabream', 'oscar', 'sailfin_sandfish', 'starfish', 'largemouth_bass', 'rainbow_trout',
    'skygazer', 'cod', 'spanish_mackerel', 'clown', 'sea_bream', 'snakehead', 'mandarin_fish', 'blobfish', 'jellyfish', 'perch_kkeokji',
    'sea_bass', 'lionfish', 'hairtail', 'salmon', 'piranha', 'cutlassfish_pollock', 'squid', 'discus', 'char', 'nurse_shark',
    'parrotfish', 'moray', 'leopard_shark', 'barracuda', 'grass_carp', 'skate', 'koi', 'croaker', 'eel', 'yellowtail',
    'seahorse', 'barred_knifejaw', 'ray', 'viperfish', 'octopus', 'goosefish', 'gulper_eel', 'striped_jack', 'grouper', 'lenok',
    'puffer', 'dolphinfish', 'electric_eel', 'arowana', 'redtail_catfish', 'blue_shark', 'sturgeon', 'frilled_shark', 'bluefin', 'anglerfish',
    'arapaima', 'sea_turtle', 'oarfish', 'sunfish', 'hammerhead', 'marlin', 'whale_shark', 'great_white', 'manta', 'swordfish',
    'coelacanth', 'megamouth', 'giant_squid', 'rising', 'astral', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- ── migrations/20261107100000_fish_families_mammals.sql ──
-- 해양 포유류 6계열(2026-11-13) — 점박이물범 · 물개 · 큰바다사자 · 독도 강치 · 해달 · 수달을 낚시 순위 · 크기 순위가 아는 계열 목록에 더한다.
-- 20261107090000_fish_families_54 의 private.fish_family_ok 와 같은 정의에 계열만 늘렸다(목록은 src/lib/aquarium.ts 의 FAMILIES 순서 — serverguard.test 가 견준다).
-- 함수 하나를 다시 정의할 뿐이다 — 표 · 행 · 다른 함수 · 권한은 그대로. 몇 번 다시 돌려도 같다.
begin;

create or replace function private.fish_family_ok(p_family text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_family = any (array[
    'guppy', 'ricefish', 'pale_chub', 'zebra_danio', 'corydoras', 'platy', 'chinese_minnow', 'crucian', 'lanternfish', 'molly',
    'anchovy', 'dark_chub', 'goby', 'loach', 'bluegill', 'tetra', 'saury', 'smelt', 'sweetfish', 'bitterling',
    'goldfish', 'hatchetfish', 'gourami', 'boxfish', 'butterflyfish', 'bullhead', 'mudskipper', 'sleeper', 'gudgeon', 'betta',
    'scorpionfish', 'halfbeak', 'pleco', 'mackerel', 'rockfish_bollak', 'catfish', 'flounder', 'shiri', 'common_carp', 'rockfish',
    'blue_tang', 'masu_salmon', 'angel', 'filefish', 'black_seabream', 'oscar', 'sailfin_sandfish', 'starfish', 'largemouth_bass', 'rainbow_trout',
    'skygazer', 'cod', 'spanish_mackerel', 'clown', 'sea_bream', 'snakehead', 'mandarin_fish', 'blobfish', 'jellyfish', 'perch_kkeokji',
    'sea_bass', 'lionfish', 'hairtail', 'salmon', 'piranha', 'cutlassfish_pollock', 'squid', 'discus', 'char', 'otter',
    'nurse_shark', 'parrotfish', 'moray', 'leopard_shark', 'barracuda', 'grass_carp', 'skate', 'koi', 'croaker', 'eel',
    'yellowtail', 'seahorse', 'barred_knifejaw', 'spotted_seal', 'ray', 'fur_seal', 'viperfish', 'octopus', 'goosefish', 'gulper_eel',
    'striped_jack', 'grouper', 'lenok', 'puffer', 'sea_otter', 'dolphinfish', 'electric_eel', 'arowana', 'redtail_catfish', 'blue_shark',
    'sturgeon', 'frilled_shark', 'bluefin', 'anglerfish', 'arapaima', 'sea_turtle', 'oarfish', 'sunfish', 'steller_sea_lion', 'hammerhead',
    'marlin', 'whale_shark', 'great_white', 'manta', 'swordfish', 'coelacanth', 'megamouth', 'giant_squid', 'japanese_sea_lion', 'rising',
    'astral', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- ── migrations/20261114020000_fish_families_shrimp.sql ──
-- 새우류 3계열(2026-11-14) — 체리새우 · 대하 · 독도새우를 낚시 순위 · 크기 순위가 아는 계열 목록에 더한다.
-- 20261107100000_fish_families_mammals 의 private.fish_family_ok 와 같은 정의에 계열만 늘렸다(목록은 src/lib/aquarium.ts 의 FAMILIES 순서 — serverguard.test 가 견준다).
-- 함수 하나를 다시 정의할 뿐이다 — 표 · 행 · 다른 함수 · 권한은 그대로. 몇 번 다시 돌려도 같다.
begin;

create or replace function private.fish_family_ok(p_family text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_family = any (array[
    'guppy', 'ricefish', 'cherry_shrimp', 'pale_chub', 'zebra_danio', 'corydoras', 'platy', 'chinese_minnow', 'crucian', 'lanternfish',
    'molly', 'anchovy', 'dark_chub', 'goby', 'loach', 'bluegill', 'tetra', 'saury', 'smelt', 'sweetfish',
    'bitterling', 'goldfish', 'hatchetfish', 'gourami', 'boxfish', 'butterflyfish', 'bullhead', 'mudskipper', 'sleeper', 'gudgeon',
    'betta', 'scorpionfish', 'halfbeak', 'pleco', 'mackerel', 'rockfish_bollak', 'catfish', 'fleshy_prawn', 'flounder', 'shiri',
    'common_carp', 'rockfish', 'blue_tang', 'masu_salmon', 'angel', 'filefish', 'black_seabream', 'oscar', 'sailfin_sandfish', 'dokdo_shrimp',
    'starfish', 'largemouth_bass', 'rainbow_trout', 'skygazer', 'cod', 'spanish_mackerel', 'clown', 'sea_bream', 'snakehead', 'mandarin_fish',
    'blobfish', 'jellyfish', 'perch_kkeokji', 'sea_bass', 'lionfish', 'hairtail', 'salmon', 'piranha', 'cutlassfish_pollock', 'squid',
    'discus', 'char', 'otter', 'nurse_shark', 'parrotfish', 'moray', 'leopard_shark', 'barracuda', 'grass_carp', 'skate',
    'koi', 'croaker', 'eel', 'yellowtail', 'seahorse', 'barred_knifejaw', 'spotted_seal', 'ray', 'fur_seal', 'viperfish',
    'octopus', 'goosefish', 'gulper_eel', 'striped_jack', 'grouper', 'lenok', 'puffer', 'sea_otter', 'dolphinfish', 'electric_eel',
    'arowana', 'redtail_catfish', 'blue_shark', 'sturgeon', 'frilled_shark', 'bluefin', 'anglerfish', 'arapaima', 'sea_turtle', 'oarfish',
    'sunfish', 'steller_sea_lion', 'hammerhead', 'marlin', 'whale_shark', 'great_white', 'manta', 'swordfish', 'coelacanth', 'megamouth',
    'giant_squid', 'japanese_sea_lion', 'rising', 'astral', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
