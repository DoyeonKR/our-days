-- 정원 합치기 주간 도전판 (2026-11-13) [사용자 승인: "합치기 주간 도전판"]
-- 주(KST 월요일 0시 ~ 다음 월요일 0시 전)마다 특별한 판 규칙 하나(돌밭 · 60수 · 같은 출발 · 거름 풍년 · 넓은 밭)를 정하고,
-- 커플 점수 = 그 주 두 사람 각자의 최고 도전 점수의 합으로 커플 순위를 낸다.
-- 표를 새로 둔다(merge_weekly_runs) — merge_runs 에 칸을 더하지 않는 이유:
--   · merge_runs 를 읽는 함수(전체 순위판 · 순위 계산 · 옛 순위 · 역전 알림)는 모두 보통 판의 점수 범위로 거른다.
--     도전판(5×5 · 시작 재료)은 범위가 달라 섞이면 전체 순위를 흐리거나, 그 함수들을 전부 다시 정의해야 한다(옛 앱이 부르는 것까지).
--   · 새 표는 기존 함수 · 행 · 정책을 하나도 건드리지 않는다. 롤백은 새 것만 내리면 된다(README §14.4.5 '주간 도전판').
-- 넣기 지킴이는 보통 판과 같다: 사람마다 잠금(pg_advisory_xact_lock) 뒤 20초에 한 판 · 하루(KST) 200판(PT429),
--   점수가 그 규칙 · 최고 단계로 낼 수 있는 범위 밖이면 PT422(식은 src/lib/merge.ts 의 weeklyScoreCeiling · weeklyScoreFloor — mergeweekly.test),
--   닉네임은 merge_clean_nick(공백 정리 · 12자 · 링크와 보이지 않는 글자 금지, 못 쓰면 PT422).
-- 주와 규칙은 서버가 now() 로 정한다 — 앱이 보낸 주 · 규칙이 다르면 PT422(지난 주 판은 경계 뒤 10분까지만 받는다).
-- 주간 보상(섬 하트)은 앱이 섬 상태(s.merge.weekPaid)에 적는다 — 서버는 점수 · 순위만 낸다.
-- 오류는 PT4xx 만(40001 · 40P01 금지 — README §11). 여러 번 돌려도 같은 결과(if not exists · create or replace · drop policy if exists).
begin;
set local lock_timeout = '10s';

create table if not exists public.merge_weekly_runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  week       date not null,
  rule       text not null check (rule in ('stones', 'moves', 'preset', 'fert', 'big')),
  nickname   text not null,
  score      integer not null check (score >= 1 and score <= 10000000),
  top_lv     smallint not null check (top_lv between 1 and 17),
  created_at timestamptz not null default now()
);
create index if not exists merge_weekly_runs_week_idx on public.merge_weekly_runs (week, couple_id, user_id, score desc);
create index if not exists merge_weekly_runs_user_time_idx on public.merge_weekly_runs (user_id, created_at desc);
create index if not exists merge_weekly_runs_couple_idx on public.merge_weekly_runs (couple_id);
alter table public.merge_weekly_runs enable row level security;
-- 쓰기는 submit_merge_weekly 로만. 직접 읽기는 우리 커플 줄만(순위는 merge_weekly_board 가 닉네임 · 점수만 낸다).
revoke all on public.merge_weekly_runs from public, anon, authenticated;
grant select on public.merge_weekly_runs to authenticated;
drop policy if exists merge_weekly_runs_select_couple on public.merge_weekly_runs;
create policy merge_weekly_runs_select_couple on public.merge_weekly_runs for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

create schema if not exists private;

-- 그 시각이 속한 주의 월요일(KST). 1970-01-05(월)부터 7일씩 — 앱 weekSerialOf · weekStartOf 와 같은 정수 계산.
create or replace function private.merge_week_start(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select date '1970-01-05' + ((((p_at at time zone 'Asia/Seoul')::date - date '1970-01-05') / 7) * 7);
$$;

-- 그 주(월요일)의 규칙 — 주 일련번호 mod 5. 앱 WEEKLY_RULES 와 같은 순서(mergeweekly.test 가 견준다). 월요일이 아니면 null.
-- 돌림(mod)이라 이웃한 두 주가 같은 규칙이 되지 않고, ISO 주 번호(53주 해)에 흔들리지 않는다.
create or replace function private.merge_week_rule(p_week date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_week is null or p_week < date '1970-01-05' or extract(isodow from p_week) <> 1 then null
    else (array['stones', 'moves', 'preset', 'fert', 'big']::text[])[((p_week - date '1970-01-05') / 7) % 5 + 1]
  end;
$$;

-- 도전판 점수 범위 — merge.ts 의 weeklyScoreCeiling · weeklyScoreFloor · weeklyTopMax 와 같은 식.
--   상한 2 · 칸(큰 판 25, 나머지 16) · (L-1) · 2^L, 60수는 최고 7단계 · 2 · (L-1) · 248 도. 하한 2^L(같은 출발은 5단계부터, 나머지 3단계부터).
create or replace function private.merge_weekly_plausible(p_rule text, p_score integer, p_top integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_rule in ('stones', 'moves', 'preset', 'fert', 'big')
    and p_top between 1 and (case when p_rule = 'moves' then 7 else 17 end)
    and p_score >= (case when p_top > (case when p_rule = 'preset' then 4 else 2 end) then (1::bigint << p_top) else 1 end)
    and p_score <= least(
      10000000::bigint,
      2 * (case when p_rule = 'big' then 25 else 16 end)::bigint * (p_top - 1)::bigint * (1::bigint << p_top),
      (case when p_rule = 'moves' then 2 * (p_top - 1)::bigint * 248 else 10000000::bigint end)
    ),
    false);
$$;

-- 그 주의 커플 점수 — 사람마다 그 주 최고 한 판(지금도 그 커플인 사람만), 커플마다 합. 같은 점수면 합을 먼저 이룬 커플.
create or replace function private.merge_weekly_totals(p_week date)
returns table (couple_id uuid, score integer, names text, done_id bigint)
language sql
stable
set search_path = ''
as $$
  with best as (
    select distinct on (r.couple_id, r.user_id) r.couple_id, r.user_id, r.score, r.id
    from public.merge_weekly_runs r
    join public.couple_members m on m.couple_id = r.couple_id and m.user_id = r.user_id
    where r.week = p_week and private.merge_weekly_plausible(r.rule, r.score, r.top_lv)
    order by r.couple_id, r.user_id, r.score desc, r.id asc
  ), nick as (
    select distinct on (r.couple_id, r.user_id) r.couple_id, r.user_id,
           coalesce(public.merge_clean_nick(r.nickname), '이름 없음') as nickname
    from public.merge_weekly_runs r
    where r.week = p_week
    order by r.couple_id, r.user_id, r.id desc
  )
  select b.couple_id, sum(b.score)::integer, string_agg(n.nickname, ' · ' order by b.score desc, b.id asc), max(b.id)
  from best b join nick n on n.couple_id = b.couple_id and n.user_id = b.user_id
  group by b.couple_id;
$$;

-- 도전 한 판 넣기 → 그 판 id · 이번 주 내 최고 · 우리 커플 점수 · 커플 순위 · 참여 커플 수
create or replace function public.submit_merge_weekly(p_week date, p_rule text, p_nickname text, p_score integer, p_top integer)
returns table (run_id bigint, my_best integer, couple_score integer, couple_rank integer, couples integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_now    date := private.merge_week_start(now());
  v_couple uuid;
  v_nick   text;
  v_id     bigint;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if p_week is null or not (p_week = v_now or (p_week = v_now - 7
      and now() < (v_now::timestamp at time zone 'Asia/Seoul') + interval '10 minutes')) then
    raise exception '이번 주 도전이 아니에요.' using errcode = 'PT422';
  end if;
  if p_rule is distinct from private.merge_week_rule(p_week) then
    raise exception '이번 주 규칙과 달라요.' using errcode = 'PT422';
  end if;
  if not private.merge_weekly_plausible(p_rule, p_score, p_top) then
    raise exception '이 판의 점수는 올릴 수 없어요.' using errcode = 'PT422';
  end if;
  v_nick := public.merge_clean_nick(p_nickname);
  if v_nick is null then
    raise exception '이 닉네임은 쓸 수 없어요.' using errcode = 'PT422';
  end if;
  select m.couple_id into v_couple from public.couple_members m where m.user_id = v_uid order by m.joined_at desc limit 1;
  if v_couple is null then
    raise exception '커플을 맺으면 도전 기록이 올라가요.' using errcode = 'PT403';
  end if;
  -- 확인과 넣기를 한 줄로 — 같은 사람이 동시에 여러 번 불러도 둘 다 확인을 통과하지 못한다
  perform pg_advisory_xact_lock(hashtextextended('merge_weekly:' || v_uid::text, 0));
  if exists (select 1 from public.merge_weekly_runs r where r.user_id = v_uid and r.created_at > now() - interval '20 seconds') then
    raise exception '조금 뒤에 다시 올려 주세요.' using errcode = 'PT429';
  end if;
  if (select count(*) from public.merge_weekly_runs r where r.user_id = v_uid
      and r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 200 then
    raise exception '오늘은 더 올릴 수 없어요.' using errcode = 'PT429';
  end if;
  insert into public.merge_weekly_runs (user_id, couple_id, week, rule, nickname, score, top_lv)
  values (v_uid, v_couple, p_week, p_rule, v_nick, p_score, p_top)
  returning id into v_id;
  return query
    with t as (select * from private.merge_weekly_totals(p_week)),
    k as (select t.couple_id, t.score, (row_number() over (order by t.score desc, t.done_id asc))::integer as rk from t)
    select v_id,
           (select max(r.score) from public.merge_weekly_runs r where r.user_id = v_uid and r.week = p_week and r.couple_id = v_couple),
           (select k.score from k where k.couple_id = v_couple),
           (select k.rk from k where k.couple_id = v_couple),
           (select count(*)::integer from k);
end;
$$;

-- 이번 주(또는 지난 주) 커플 순위 — 1~20등 + (20등 밖이면) 우리 커플 줄. 닉네임 · 점수만 나간다(user_id · couple_id 는 안 나간다).
-- 내 최고 · 상대 최고는 우리 커플 줄에만. 지난 주는 주간 보상 정산용(앱이 끝난 주의 우리 점수를 읽는다). 그 밖의 주는 빈 결과.
-- ended = 그 주가 서버 시각으로 끝났는지 — 앱은 이게 참일 때만 보상을 적는다(기기 시계가 앞선 폰이 진행 중인 주를 받아 가지 않게).
create or replace function public.merge_weekly_board(p_week date default null)
returns table (week date, rule text, rank integer, names text, score integer, is_mine boolean, my_best integer, partner_best integer, couples integer, ended boolean)
language sql
stable
security definer
set search_path = public
as $$
  with w as (
    select coalesce(p_week, private.merge_week_start(now())) as week
  ), ok as (
    select w.week from w
    where w.week in (private.merge_week_start(now()), private.merge_week_start(now()) - 7)
  ), t as (
    select x.* from ok, private.merge_weekly_totals(ok.week) x
  ), k as (
    select t.couple_id, t.score, t.names,
           (row_number() over (order by t.score desc, t.done_id asc))::integer as rk,
           t.couple_id in (select private.my_couple_ids()) as mine
    from t
  ), me as (
    select r.user_id = auth.uid() as is_me, max(r.score)::integer as best
    from public.merge_weekly_runs r, ok
    where r.week = ok.week and r.couple_id in (select private.my_couple_ids())
      and exists (select 1 from public.couple_members c where c.couple_id = r.couple_id and c.user_id = r.user_id)
      and private.merge_weekly_plausible(r.rule, r.score, r.top_lv)
    group by r.user_id = auth.uid()
  )
  select ok.week, private.merge_week_rule(ok.week), k.rk, k.names, k.score, k.mine,
         case when k.mine then coalesce((select me.best from me where me.is_me), 0) end,
         case when k.mine then coalesce((select me.best from me where not me.is_me), 0) end,
         (select count(*)::integer from k),
         ok.week < private.merge_week_start(now())
  from k, ok
  where k.rk <= 20 or k.mine
  order by k.rk;
$$;

revoke all on function private.merge_week_start(timestamptz) from public, anon, authenticated;
revoke all on function private.merge_week_rule(date) from public, anon, authenticated;
revoke all on function private.merge_weekly_plausible(text, integer, integer) from public, anon, authenticated;
revoke all on function private.merge_weekly_totals(date) from public, anon, authenticated;
revoke all on function public.submit_merge_weekly(date, text, text, integer, integer) from public, anon;
revoke all on function public.merge_weekly_board(date) from public, anon;
grant execute on function public.submit_merge_weekly(date, text, text, integer, integer) to authenticated;
grant execute on function public.merge_weekly_board(date) to authenticated;
notify pgrst, 'reload schema';
commit;
