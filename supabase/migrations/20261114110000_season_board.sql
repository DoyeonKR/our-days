-- 시즌 순위 (2026-11-18) [README §14.7 '안 한 것: 시즌 순위']
-- 이번 달(KST 달력 달) 시즌 미션을 몇 개 채웠는지로 커플 순위를 낸다. 같은 수면 그 수에 먼저 닿은 커플이 앞.
-- 미션 진행은 섬 상태(s.season)라 커플이 함께 본다 — 두 사람이 같은 수를 보내므로 커플 점수는 합이 아니라 최대(지금도 그 커플인 사람만).
-- 표를 새로 둔다(season_runs) — 합치기 주간 도전판(20261114050000_merge_weekly)과 같은 틀:
--   쓰기는 submit_season 으로만, 직접 읽기는 우리 커플 줄만, 순위는 season_board 가 닉네임 · 채운 수만 낸다.
-- 넣기 지킴이: 사람마다 잠금(pg_advisory_xact_lock) 뒤 20초에 한 번 · 하루(KST) 30번(PT429),
--   채운 수는 1 ~ 12(한 달 미션 수 — 앱 lib/season 의 MISSION_COUNT, seasonboard.test 가 견준다)만, 달은 서버의 KST 달만(PT422),
--   닉네임은 합치기 순위와 같은 merge_clean_nick(못 쓰면 PT422), 커플이 아니면 PT403.
--   우리 커플이 이미 그 수 이상을 올렸으면 넣지 않는다(두 폰이 같은 수를 보내도 한 줄 · 먼저 닿은 시각이 그대로).
-- 서버는 미션을 다시 셀 수 없다(진행은 섬 상태 jsonb) — 범위 확인까지만 한다. 보상은 없다(순위만 — 하트를 만들지 않는다).
-- 오류는 PT4xx 만(40001 · 40P01 금지 — README §11). 여러 번 돌려도 같은 결과(if not exists · create or replace · drop policy if exists).
begin;
set local lock_timeout = '10s';

create table if not exists public.season_runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  nickname   text not null,
  done       smallint not null check (done between 1 and 12),
  created_at timestamptz not null default now()
);
create index if not exists season_runs_month_idx on public.season_runs (month, couple_id, done desc, id);
create index if not exists season_runs_user_time_idx on public.season_runs (user_id, created_at desc);
create index if not exists season_runs_couple_idx on public.season_runs (couple_id);
alter table public.season_runs enable row level security;
-- 쓰기는 submit_season 으로만. 직접 읽기는 우리 커플 줄만(순위는 season_board 가 닉네임 · 채운 수만 낸다).
revoke all on public.season_runs from public, anon, authenticated;
grant select on public.season_runs to authenticated;
drop policy if exists season_runs_select_couple on public.season_runs;
create policy season_runs_select_couple on public.season_runs for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

create schema if not exists private;

-- 그 시각이 속한 달의 1일(KST) — 앱 monthOf(kstDate(now).slice(0, 7))와 같은 달
create or replace function private.season_month_start(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', (p_at at time zone 'Asia/Seoul'))::date;
$$;

-- 그 달의 커플 점수 — 지금도 그 커플인 사람의 줄 중 가장 큰 채운 수, 그 수에 처음 닿은 줄 id(먼저 닿은 커플이 앞).
-- 이름은 줄을 올린 사람마다 마지막 닉네임(올린 순서).
create or replace function private.season_totals(p_month date)
returns table (couple_id uuid, done integer, names text, done_id bigint)
language sql
stable
set search_path = ''
as $$
  with live as (
    select r.id, r.couple_id, r.user_id, r.done, r.nickname
    from public.season_runs r
    join public.couple_members m on m.couple_id = r.couple_id and m.user_id = r.user_id
    where r.month = p_month and r.done between 1 and 12
  ), best as (
    select l.couple_id, max(l.done) as done from live l group by l.couple_id
  ), firsts as (
    select b.couple_id, b.done, min(l.id) as done_id
    from best b join live l on l.couple_id = b.couple_id and l.done = b.done
    group by b.couple_id, b.done
  ), nick as (
    select distinct on (l.couple_id, l.user_id) l.couple_id, l.user_id, l.id,
           coalesce(public.merge_clean_nick(l.nickname), '이름 없음') as nickname
    from live l
    order by l.couple_id, l.user_id, l.id desc
  )
  select f.couple_id, f.done::integer,
         (select string_agg(n.nickname, ' · ' order by n.id asc) from nick n where n.couple_id = f.couple_id),
         f.done_id
  from firsts f;
$$;

-- 이번 달 채운 수 올리기 → 그 줄 id(이미 같거나 더 많이 올렸으면 null) · 우리 커플 수 · 커플 순위 · 참여 커플 수
create or replace function public.submit_season(p_month date, p_nickname text, p_done integer)
returns table (run_id bigint, couple_done integer, couple_rank integer, couples integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_now    date := private.season_month_start(now());
  v_couple uuid;
  v_nick   text;
  v_id     bigint;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if p_month is distinct from v_now then
    raise exception '이번 달 시즌이 아니에요.' using errcode = 'PT422';
  end if;
  if p_done is null or p_done < 1 or p_done > 12 then
    raise exception '이 수는 올릴 수 없어요.' using errcode = 'PT422';
  end if;
  v_nick := public.merge_clean_nick(p_nickname);
  if v_nick is null then
    raise exception '이 닉네임은 쓸 수 없어요.' using errcode = 'PT422';
  end if;
  select m.couple_id into v_couple from public.couple_members m where m.user_id = v_uid order by m.joined_at desc limit 1;
  if v_couple is null then
    raise exception '커플을 맺으면 시즌 순위에 올라가요.' using errcode = 'PT403';
  end if;
  -- 확인과 넣기를 한 줄로 — 같은 사람이 동시에 여러 번 불러도 둘 다 확인을 통과하지 못한다
  perform pg_advisory_xact_lock(hashtextextended('season:' || v_uid::text, 0));
  -- 우리 커플이 이미 그 수 이상이면 넣지 않는다(상대 폰이 먼저 올렸다 · 같은 수를 다시 보냈다) — 먼저 닿은 시각이 남는다
  if not exists (
    select 1 from public.season_runs r
    join public.couple_members m on m.couple_id = r.couple_id and m.user_id = r.user_id
    where r.couple_id = v_couple and r.month = p_month and r.done >= p_done
  ) then
    if exists (select 1 from public.season_runs r where r.user_id = v_uid and r.created_at > now() - interval '20 seconds') then
      raise exception '조금 뒤에 다시 올려 주세요.' using errcode = 'PT429';
    end if;
    if (select count(*) from public.season_runs r where r.user_id = v_uid
        and r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 30 then
      raise exception '오늘은 더 올릴 수 없어요.' using errcode = 'PT429';
    end if;
    insert into public.season_runs (user_id, couple_id, month, nickname, done)
    values (v_uid, v_couple, p_month, v_nick, p_done)
    returning id into v_id;
  end if;
  return query
    with t as (select * from private.season_totals(p_month)),
    k as (select t.couple_id, t.done, (row_number() over (order by t.done desc, t.done_id asc))::integer as rk from t)
    select v_id,
           (select k.done from k where k.couple_id = v_couple),
           (select k.rk from k where k.couple_id = v_couple),
           (select count(*)::integer from k);
end;
$$;

-- 이번 달(또는 지난 달) 커플 순위 — 1~20등 + (20등 밖이면) 우리 커플 줄. 닉네임 · 채운 수만 나간다(user_id · couple_id 는 안 나간다).
-- 그 밖의 달은 빈 결과. ended = 그 달이 서버 시각으로 끝났는지.
create or replace function public.season_board(p_month date default null)
returns table (month date, rank integer, names text, done integer, is_mine boolean, couples integer, ended boolean)
language sql
stable
security definer
set search_path = public
as $$
  with w as (
    select coalesce(p_month, private.season_month_start(now())) as month
  ), ok as (
    select w.month from w
    where w.month in (private.season_month_start(now()), (private.season_month_start(now()) - interval '1 month')::date)
  ), t as (
    select x.* from ok, private.season_totals(ok.month) x
  ), k as (
    select t.couple_id, t.done, t.names,
           (row_number() over (order by t.done desc, t.done_id asc))::integer as rk,
           t.couple_id in (select private.my_couple_ids()) as mine
    from t
  )
  select ok.month, k.rk, k.names, k.done, k.mine,
         (select count(*)::integer from k),
         ok.month < private.season_month_start(now())
  from k, ok
  where k.rk <= 20 or k.mine
  order by k.rk;
$$;

revoke all on function private.season_month_start(timestamptz) from public, anon, authenticated;
revoke all on function private.season_totals(date) from public, anon, authenticated;
revoke all on function public.submit_season(date, text, integer) from public, anon;
revoke all on function public.season_board(date) from public, anon;
grant execute on function public.submit_season(date, text, integer) to authenticated;
grant execute on function public.season_board(date) to authenticated;
notify pgrst, 'reload schema';
commit;
