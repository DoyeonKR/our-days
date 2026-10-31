-- 정원 합치기 — 내 최고 기록이 역전되면 푸시 (2026-11-01)
-- [사용자: "내 최고 탑 점수가 다른 사람한테 역전당하면 푸쉬 가도록 해줘"]
-- 판이 순위에 오르면 앱이 send-poke-push 에 { overtake_run } 을 보내고, 함수(서비스 롤)가 이 함수로 '역전당한 사람'을 받는다.
-- 역전 = 다른 사람의 최고 기록이 **순위판 10등 안**이었고(보이던 기록), 새 판 점수가 그 기록보다 높다. 10등 밖까지 알리면
--   점수를 낼 때마다 수십 명에게 가는 스팸이 된다.
-- 판마다 **한 번만** 본다(overtake_checked 를 먼저 잡는다) · 판을 낸 본인만(p_user) · 낸 지 10분 안만 — 같은 판으로 알림을 되풀이해 쏠 수 없다.
-- 앱 사용자(anon · authenticated)는 부를 수 없다(서비스 롤 전용). 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

alter table public.merge_runs add column if not exists overtake_checked boolean not null default false;

create or replace function public.merge_overtaken(p_run bigint, p_user uuid)
returns table (user_id uuid, best integer, run_nickname text, run_score integer)
language sql
volatile
security definer
set search_path = public
as $$
  with claim as (
    update public.merge_runs r
       set overtake_checked = true
     where r.id = p_run
       and r.user_id = p_user
       and not r.overtake_checked
       and r.created_at > now() - interval '10 minutes'
    returning r.id, r.user_id, r.nickname, r.score
  ),
  others as (
    select o.user_id, max(o.score)::integer as best
      from public.merge_runs o, claim c
     where o.id <> c.id and o.user_id <> c.user_id
     group by o.user_id
  )
  select x.user_id, x.best, c.nickname, c.score
    from others x, claim c
   where x.best < c.score
     and (select count(*) from public.merge_runs q where q.id <> c.id and q.score > x.best) < 10;
$$;

revoke all on function public.merge_overtaken(bigint, uuid) from public, anon, authenticated;
grant execute on function public.merge_overtaken(bigint, uuid) to service_role;

commit;
