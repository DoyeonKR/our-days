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
alter publication supabase_realtime add table public.pokes;
alter publication supabase_realtime add table public.couple_events;
alter publication supabase_realtime add table public.couple_photos;

-- ----------------------------------------------------------------------------
-- Storage: 커플 공유 사진 버킷 (비공개) + 커플 단위 접근 정책
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('couple-photos', 'couple-photos', false)
on conflict (id) do nothing;

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
alter publication supabase_realtime add table public.mood_checkins;

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
alter publication supabase_realtime add table public.qa_answers;

-- 데코북 (꾸민 일기 페이지). 사진은 Storage 'couple-photos' 재사용.
create table if not exists public.deco_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  entry_date date not null,
  title text, body text, location text, mood_emoji text, bg text,
  hashtags text[] default '{}',
  stickers jsonb default '[]',
  photo_paths text[] default '{}',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists deco_entries_couple_idx on public.deco_entries (couple_id, entry_date desc);
alter table public.deco_entries enable row level security;
drop policy if exists deco_select on public.deco_entries;
drop policy if exists deco_insert on public.deco_entries;
drop policy if exists deco_update on public.deco_entries;
drop policy if exists deco_delete on public.deco_entries;
create policy deco_select on public.deco_entries for select using (public.is_couple_member(couple_id));
create policy deco_insert on public.deco_entries for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
create policy deco_update on public.deco_entries for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy deco_delete on public.deco_entries for delete using (public.is_couple_member(couple_id));
alter publication supabase_realtime add table public.deco_entries;

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
alter publication supabase_realtime add table public.couple_bucket;

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

-- ⚠ 기념일 예약 푸시: Edge Function 'daily-reminders' + pg_cron('0 0 * * *') + pg_net 로
--   구성(코드/DB 밖). CRON_SECRET 헤더로 보호. 상세는 README/함수 소스 참고.
