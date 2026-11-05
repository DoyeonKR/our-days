-- 낚시 점수 제한을 원자적으로 (2026-11-05, 낚시 리뷰)
-- '2초 안 연속 호출 · 하루 300마리'를 확인한 뒤 넣는 사이에 틈이 있어서, 같은 사람이 동시에 여러 번 부르면 둘 다 확인을 통과했다.
-- 사람마다 트랜잭션 잠금(pg_advisory_xact_lock)을 먼저 잡아 확인과 넣기를 한 줄로 세운다. 다른 사람끼리는 서로 기다리지 않는다.
-- 점수 공식 · 인자 · 권한은 20261103000000_fish_size_board.sql 과 같다. 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

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
  perform pg_advisory_xact_lock(hashtextextended('fish_catch:' || v_uid::text, 0));
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

revoke all on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) from public, anon;
grant execute on function public.submit_fish_catch(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision) to authenticated;
notify pgrst, 'reload schema';
commit;
