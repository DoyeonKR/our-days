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
