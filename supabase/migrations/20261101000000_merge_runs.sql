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
