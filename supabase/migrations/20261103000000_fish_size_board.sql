-- 낚시 크기 랭킹 (2026-11-03) — [사용자: "물고기 cm 랭킹도 있어야해 물고기 종류별로"]
-- 물고기 계열마다 사람별 가장 긴 한 마리로 순위를 낸다. 주인 · 쓰레기는 길이를 안 올린다(주인은 길이가 정해져 있어 순위가 무의미하다).
-- 값은 합치기 순위판처럼 앱이 보낸 것을 믿고 범위만 자른다. 옛 기록은 길이가 없어 순위에 안 오른다.
-- 옛 앱이 8개 인자로 불러도 되게 새 인자는 기본값을 둔다 — 같은 이름의 8개짜리가 남으면 호출이 모호해져서 먼저 지운다.
-- 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

alter table public.fish_catches add column if not exists family text;
alter table public.fish_catches add column if not exists cm real;
create index if not exists fish_catches_size_idx on public.fish_catches (family, cm desc) where cm is not null;

drop function if exists public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean);
create or replace function public.submit_fish_catch(
  p_nickname text, p_name text, p_grade integer, p_stage integer,
  p_quality double precision, p_perfect boolean, p_stored boolean, p_junk boolean,
  p_family text default null, p_cm double precision default null
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
  v_cm    real := case when coalesce(p_junk, false) or p_family is null or p_cm is null or p_cm <= 0 then null else least(p_cm, 2000) end;
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
  insert into public.fish_catches (user_id, nickname, name, grade, stage, junk, stored, points, family, cm)
  values (v_uid, v_nick, left(btrim(coalesce(p_name, '')), 30), v_grade, v_stage, coalesce(p_junk, false), coalesce(p_stored, false), v_pts,
          case when v_cm is null then null else left(btrim(p_family), 30) end, v_cm);
  return v_pts;
end;
$$;

-- 계열별 크기 순위 — 사람마다 가장 긴 한 마리. 1~20등 + (20등 밖이면) 내 줄. 닉네임 · 길이만 나간다.
create or replace function public.fish_size_board(p_family text)
returns table (rank integer, name text, cm real, catch_name text, caught_at timestamptz, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (c.user_id) c.user_id, c.cm, c.name as catch_name, c.created_at, c.id
    from public.fish_catches c
    where c.family = p_family and c.cm is not null
    order by c.user_id, c.cm desc, c.id asc
  ), nick as (
    select distinct on (c.user_id) c.user_id, c.nickname
    from public.fish_catches c order by c.user_id, c.id desc
  ), ranked as (
    select (row_number() over (order by b.cm desc, b.id asc))::integer as rank, n.nickname as name, b.cm, b.catch_name, b.created_at as caught_at, b.user_id = auth.uid() as is_me
    from best b join nick n on n.user_id = b.user_id
  )
  select r.rank, r.name, r.cm, r.catch_name, r.caught_at, r.is_me from ranked r where r.rank <= 20 or r.is_me order by r.rank;
$$;

revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) from public, anon;
revoke all on function public.fish_size_board(text) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) to authenticated;
grant execute on function public.fish_size_board(text) to authenticated;
notify pgrst, 'reload schema';
commit;
