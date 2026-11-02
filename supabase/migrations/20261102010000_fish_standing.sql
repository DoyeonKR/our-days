-- 낚시 결과의 순위 한 줄 (2026-11-02) — [사용자: "단순하지만 임펙트있게" → "다 해"]
-- 끌어올릴 때마다 '이번 달 12위 → 9위', '상대를 제쳤어요'를 보여 주려고 내 이번 달 순위만 가볍게 돌려준다. 순위판과 같은 기준(fish_board).
-- user_id 는 내려가지 않는다. 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

create or replace function public.fish_standing()
returns table (rank integer, score bigint, total integer, gap_up bigint, partner_name text, partner_score bigint)
language sql
stable
security definer
set search_path = public
as $$
  with u as (
    select c.user_id, sum(c.points)::bigint as score, min(c.id) as first_id
    from public.fish_catches c
    where c.created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    group by c.user_id
  ), k as (
    select u.user_id, u.score, (row_number() over (order by u.score desc, u.first_id asc))::integer as rk from u
  ), me as (
    select k.score, k.rk from k where k.user_id = auth.uid()
  ), mate as (
    select b.user_id
    from public.couple_members a
    join public.couple_members b on b.couple_id = a.couple_id and b.user_id <> a.user_id
    where a.user_id = auth.uid()
    limit 1
  )
  select (select me.rk from me),
         coalesce((select me.score from me), 0)::bigint,
         (select count(*)::integer from u),
         (select k.score - me.score + 1 from k, me where k.rk = me.rk - 1)::bigint,
         (select c.nickname from public.fish_catches c where c.user_id = (select mate.user_id from mate) order by c.id desc limit 1),
         coalesce((select u.score from u where u.user_id = (select mate.user_id from mate)), 0)::bigint;
$$;

revoke all on function public.fish_standing() from public, anon;
grant execute on function public.fish_standing() to authenticated;
notify pgrst, 'reload schema';
commit;
