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
