-- 모험 DB 정리 [2026-11-15] [사용자: "정리할거 정리하고" — 모험은 같은 날 앱에서 걷었다(README §14.6)]
-- 모험(생물 잡기 · 실시간 전투 · 온라인 대전)의 화면 · 엔진 · 대전 함수 소스는 레포에서 지웠다. 부르는 앱이 없어 새 기록이 쌓일 길도 없다.
-- 남은 표 넷 · RPC · 크론 · 트리거 함수를 내린다.
--
-- ⚠ 되돌릴 수 없는 drop 이라 같은 트랜잭션 안에서 **먼저 백업**한다 — 표마다 모든 행을 jsonb 로 private.adventure_backup 에 한 줄씩(작다: 저장 2 · 팀 1 · 대전 1).
--   되살리려면 옛 migration(20261107030000 · 040000 · 050000 · 070000)의 create 블록을 다시 실행하고 이 백업의 rows 를 jsonb_populate_recordset 으로 넣는다.
-- 계정 삭제 함수(purge_account_data)는 이 표들을 부르지 않는다(외래키 on delete cascade 로 지워졌다) — 그래서 함수는 그대로 둔다.
-- 앱의 내보내기 목록(accountPolicy)에서 같은 커밋으로 뺐다. 옛 앱의 내보내기는 없는 표를 건너뛴다(42P01 · PGRST205).
-- 배포된 엣지 함수 adventure-battle 은 SQL 로 못 지운다 — 대시보드 Edge Functions 에서 지운다(부르는 앱 없음, 이 뒤로는 부르면 DB 오류만 난다).
-- 한 트랜잭션 · 다시 돌려도 안전하다(if exists · 백업은 표가 있을 때만). schema.sql 끝에 그대로 붙는다.
begin;

-- ── 1) 백업 ─────────────────────────────────────────────────────────────────────
create table if not exists private.adventure_backup (
  tbl text not null,
  taken_at timestamptz not null default now(),
  rows jsonb not null
);
revoke all on private.adventure_backup from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['adventure_saves', 'adventure_teams', 'adventure_ratings', 'adventure_matches'] loop
    if to_regclass('public.' || t) is not null then
      execute format('insert into private.adventure_backup (tbl, rows) select %L, coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t, t);
    end if;
  end loop;
end $$;

-- ── 2) 크론 ─────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('cron.job') is not null and exists (select 1 from cron.job where jobname = 'adventure-retention-daily') then
    perform cron.unschedule('adventure-retention-daily');
  end if;
end $$;

-- ── 3) RPC ──────────────────────────────────────────────────────────────────────
drop function if exists public.adventure_board(integer);
drop function if exists public.adventure_candidates(uuid, integer, integer);
drop function if exists public.adventure_finish(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer);
drop function if exists public.adventure_history();
drop function if exists public.adventure_nick_taken(text, uuid);
drop function if exists public.adventure_save(jsonb, integer);
drop function if exists public.adventure_settle(uuid, uuid, boolean, integer, integer);
drop function if exists public.adventure_today(uuid);
drop function if exists private.adventure_retention();

-- ── 4) 표(정책 · 트리거 · 인덱스가 같이 내려간다) → 트리거 함수 ─────────────────
drop table if exists public.adventure_matches;
drop table if exists public.adventure_ratings;
drop table if exists public.adventure_teams;
drop table if exists public.adventure_saves;
drop function if exists private.adventure_matches_cap();
drop function if exists private.adventure_matches_scrub_name();

notify pgrst, 'reload schema';
commit;
