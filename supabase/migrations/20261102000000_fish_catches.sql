-- 낚시 랭킹 (2026-11-02) — [사용자: "개인당 점수도 반영하고 … 물고기 랭킹판을 별도로 … 개인단위 그리고 커플단위로 산정"]
-- 끌어올린 물고기 한 마리 = 한 줄. 점수는 서버가 계산한다(공식은 src/lib/fishing.ts 의 catchPoints 와 같아야 한다 — fishingscore.test).
--   점수 = 10 × 1.8^등급 × 성장 단계(치어 1 · 어린 1.3 · 다 큰 2) × 솜씨(1 + 0.5 × 줄 다루기) × 완벽한 챔질 1.1 × 수조에 담음 1.25. 쓰레기는 2점.
--   개인 = 내 점수의 합. 커플 = 둘의 합 + 낮은 쪽 점수(둘 다 낚시해야 커진다). 커플은 지금 구성원 둘로 센다 — 연결을 끊으면 상대 점수가 따라오지 않는다.
-- 표는 본인 행만 직접 읽고(남의 user_id 비공개), 순위는 security definer 함수가 닉네임 · 점수만 돌려준다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 다시 돌려도 안전).
begin;
set local lock_timeout = '10s';

create table if not exists public.fish_catches (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nickname   text not null,
  name       text not null,
  grade      smallint not null check (grade between 0 and 7),
  stage      smallint not null check (stage between 0 and 2),
  junk       boolean not null default false,
  stored     boolean not null default false,
  points     integer not null check (points >= 0),
  created_at timestamptz not null default now()
);
create index if not exists fish_catches_user_idx on public.fish_catches (user_id, created_at desc);
create index if not exists fish_catches_time_idx on public.fish_catches (created_at);
alter table public.fish_catches enable row level security;
revoke all on public.fish_catches from anon;
drop policy if exists fish_catches_select_own on public.fish_catches;
create policy fish_catches_select_own on public.fish_catches for select to authenticated
  using (user_id = (select auth.uid()));

-- 한 마리 넣기 → 받은 점수. 너무 빠른 연속 호출(2초 안)과 하루 300마리 넘는 호출은 점수 없이 넘어간다(0).
create or replace function public.submit_fish_catch(
  p_nickname text, p_name text, p_grade integer, p_stage integer,
  p_quality double precision, p_perfect boolean, p_stored boolean, p_junk boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_nick  text := left(btrim(coalesce(p_nickname, '')), 20);
  v_grade integer := least(greatest(coalesce(p_grade, 0), 0), 7);
  v_stage integer := least(greatest(coalesce(p_stage, 0), 0), 2);
  v_q     double precision := least(greatest(coalesce(p_quality, 0), 0), 1);
  v_pts   integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if exists (select 1 from public.fish_catches c where c.user_id = v_uid and c.created_at > now() - interval '2 seconds') then
    return 0;
  end if;
  if (select count(*) from public.fish_catches c where c.user_id = v_uid
      and c.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 300 then
    return 0;
  end if;
  if v_nick = '' then v_nick := '이름 없음'; end if;
  if coalesce(p_junk, false) then
    v_pts := 2;
  else
    v_pts := floor(10 * power(1.8::double precision, v_grade)
      * (case v_stage when 2 then 2 when 1 then 1.3 else 1 end)
      * (1 + 0.5 * v_q)
      * (case when coalesce(p_perfect, false) then 1.1 else 1 end)
      * (case when coalesce(p_stored, false) then 1.25 else 1 end) + 0.5)::integer;
  end if;
  insert into public.fish_catches (user_id, nickname, name, grade, stage, junk, stored, points)
  values (v_uid, v_nick, left(btrim(coalesce(p_name, '')), 30), v_grade, v_stage, coalesce(p_junk, false), coalesce(p_stored, false), v_pts);
  return v_pts;
end;
$$;

-- 순위판 — p_scope: person | couple, p_period: month(이번 달, KST) | all. 1~20등 + (20등 밖이면) 내 줄.
create or replace function public.fish_board(p_scope text, p_period text)
returns table (rank integer, name text, score bigint, catches integer, best_name text, best_grade smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select c.* from public.fish_catches c
    where p_period <> 'month'
       or c.created_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
  ), u as (
    select r.user_id, sum(r.points)::bigint as score, count(*)::integer as catches, min(r.id) as first_id
    from r group by r.user_id
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c order by c.user_id, c.id desc
  ), best as (
    select distinct on (r.user_id) r.user_id, r.name, r.grade, r.points
    from r where not r.junk order by r.user_id, r.points desc, r.id asc
  ), people as (
    select n.nickname as name, u.score, u.catches, b.name as best_name, b.grade as best_grade,
           u.user_id = auth.uid() as is_me, u.first_id
    from u join nick n on n.user_id = u.user_id left join best b on b.user_id = u.user_id
    where p_scope = 'person'
  ), couples as (
    select string_agg(coalesce(n.nickname, '짝꿍'), ' ♥ ' order by m.user_id) as name,
           (sum(coalesce(u.score, 0)) + min(coalesce(u.score, 0)))::bigint as score,
           sum(coalesce(u.catches, 0))::integer as catches,
           (array_agg(b.name order by b.points desc nulls last))[1] as best_name,
           (array_agg(b.grade order by b.points desc nulls last))[1] as best_grade,
           coalesce(bool_or(m.user_id = auth.uid()), false) as is_me,
           min(u.first_id) as first_id
    from public.couple_members m
    left join u on u.user_id = m.user_id
    left join nick n on n.user_id = m.user_id
    left join best b on b.user_id = m.user_id
    where p_scope = 'couple'
    group by m.couple_id
    having count(*) = 2 and sum(coalesce(u.score, 0)) > 0
  ), ranked as (
    select (row_number() over (order by a.score desc, a.first_id asc))::integer as rank, a.*
    from (select * from people union all select * from couples) a
  )
  select k.rank, k.name, k.score, k.catches, k.best_name, k.best_grade, k.is_me
  from ranked k
  where k.rank <= 20 or k.is_me
  order by k.rank;
$$;

revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean) from public, anon;
revoke all on function public.fish_board(text, text) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean) to authenticated;
grant execute on function public.fish_board(text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
