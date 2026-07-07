-- ============================================================================
-- 우리의 하루 · 커플 연동 + 쿡찌르기 백엔드 스키마 (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행하세요.
-- 인증은 '익명 로그인(Anonymous sign-in)' 을 씁니다:
--   Dashboard > Authentication > Providers > Anonymous 를 반드시 ON.
-- 실시간(쿡찌르기 즉시 수신)은 pokes 테이블을 realtime publication 에 추가합니다.
-- ============================================================================

-- 안전하게 재실행 가능하도록 정리 (개발용). 운영 데이터가 있으면 주의.
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

-- couple_members: 같은 커플 구성원만 서로 조회. insert/delete 는 RPC/본인 한정.
create policy members_select on public.couple_members
  for select using (public.is_couple_member(couple_id));
create policy members_delete on public.couple_members
  for delete using (user_id = auth.uid());   -- 본인만 나갈 수 있음

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
drop policy if exists couple_photos_obj_all on storage.objects;
create policy couple_photos_obj_all on storage.objects for all
  using (bucket_id = 'couple-photos'
         and public.is_couple_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'couple-photos'
              and public.is_couple_member(((storage.foldername(name))[1])::uuid));

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
create policy mood_update on public.mood_checkins for update using (user_id = auth.uid()) with check (user_id = auth.uid());
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
do $$ begin
  alter publication supabase_realtime add table public.quiz_responses;
exception when duplicate_object then null; end $$; -- 재실행 멱등

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
create policy chat_reads_update on public.chat_reads for update using (user_id = auth.uid()) with check (user_id = auth.uid());
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
  game text not null check (game in ('reaction','memory','tap','order','timing')),
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

  -- 방향: memory/tap=높은 점수 승, 그 외(reaction/order/timing)=낮은 점수 승.
  -- ⚠ src/lib/game.ts GAME_DIR 와 동일해야 한다.
  if v_c.game = 'reaction' and abs(v_ch_score - v_op_score) <= 15 then
    v_result := 'draw';
  elsif v_ch_score = v_op_score then
    v_result := 'draw';
  elsif v_c.game in ('memory','tap') then
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
  game text not null check (game in ('reaction','memory','tap','order','timing')),
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
  game text not null check (game in ('reaction','memory','tap','order','timing')),
  best_score int not null,
  display_name text not null,
  message text,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_ranks enable row level security;
drop policy if exists ranks_select on public.game_ranks;
drop policy if exists ranks_update on public.game_ranks;
-- 전체 공개(로그인 사용자면 모든 커플의 랭킹 읽기 가능 — 의도된 글로벌 순위판)
create policy ranks_select on public.game_ranks for select using (auth.role() = 'authenticated');
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
  v_higher boolean := p_game in ('memory','tap');  -- ⚠ src/lib/game.ts GAME_DIR 와 동일
  v_is_best boolean := false;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  if p_game not in ('reaction','memory','tap','order','timing') then raise exception 'bad game'; end if;
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
  if v_plays >= 1 then
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

  return json_build_object('remaining', 1 - (v_plays + 1), 'isBest', v_is_best, 'rank', v_rank, 'nick', v_disp);
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
  if v_row.version <> p_expected_version then raise exception 'stale' using errcode = '40001'; end if;

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
  return v_row;
end;
$$;
grant execute on function public.bg_resign(uuid) to authenticated, anon;

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
