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
