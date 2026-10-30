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
