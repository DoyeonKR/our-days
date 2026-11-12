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
