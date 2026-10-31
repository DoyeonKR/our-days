-- 정원 합치기 단계 13 → 17 (2026-11-01 — 무등산수박 · 천도복숭아 · 월궁 계수열매 · 세계수의 씨앗).
-- 판 표의 최고 단계 범위와 넣기 함수의 clamp 를 17 로 올린다. 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';
alter table public.merge_runs drop constraint if exists merge_runs_top_lv_check;
alter table public.merge_runs add constraint merge_runs_top_lv_check check (top_lv between 0 and 17);
alter table public.merge_scores drop constraint if exists merge_scores_top_lv_check;
alter table public.merge_scores add constraint merge_scores_top_lv_check check (top_lv between 0 and 17);

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
  values (v_uid, v_nick, p_score, least(greatest(coalesce(p_top, 0), 0), 17))
  returning id into v_id;
  return query
    select v_id,
           (select count(*)::integer + 1 from public.merge_runs r where r.score > p_score or (r.score = p_score and r.id < v_id)),
           (select count(*)::integer from public.merge_runs);
end;
$$;
revoke all on function public.submit_merge_run(text, integer, integer) from public, anon;
grant execute on function public.submit_merge_run(text, integer, integer) to authenticated;
notify pgrst, 'reload schema';
commit;
