-- 앱 공통 리뷰 (2026-11-05) — 공개 키로 DB 를 채우는 두 길 막기 · 로그 보관 기간 · 새 외래키 인덱스. README §10.13.
-- schema.sql 끝에 이 파일이 그대로 붙어 있다(신규 bootstrap = 운영 migration — appwide.test 가 잠근다).
-- 여러 번 돌려도 같다(create or replace · if not exists · 제약은 지우고 NOT VALID 로 다시 · 크론은 지우고 다시 건다).
-- ⚠ 이 파일 자체는 **행을 하나도 지우지 않는다.** 오래된 로그 정리는 아래 크론이 매일 03:30 KST 에 나이(30일 · 180일 · 14일)로만 지운다.
-- 롤백(SQL 편집기): select cron.unschedule('purge-old-logs-daily');  — 정리만 멈춘다. 나머지는 남겨 둬도 옛 앱과 맞는다(README §10.13).
begin;
set local lock_timeout = '10s';

-- ── 1) note_visit: UUID 모양만 · 하루 3000 기기에서 멈춘다 ────────────────────────────────
-- anon 이 부르는 함수라 p_device 를 바꿔 가며 부르면 한 번에 한 행씩 끝없이 쌓였다(표 크기 = 공격자 마음).
-- 앱(VisitPing)은 crypto.randomUUID 모양만 보낸다. 방문자 수는 이 앱 규모에서 하루 수십이라 3000 은 넉넉한 천장이다.
-- 90일 지난 방문 기록 정리는 예전 함수 그대로(앱이 부를 때 한다 — 이 migration 이 지우는 게 아니다).
create or replace function public.note_visit(p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_dev text := lower(btrim(coalesce(p_device, '')));
begin
  if v_dev !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
  if (select count(*) from public.daily_visits v where v.day = v_day) >= 3000 then return; end if;
  insert into public.daily_visits (day, device) values (v_day, v_dev) on conflict do nothing;
  if found then
    delete from public.daily_visits where day < v_day - 90;
  end if;
end;
$$;
revoke all on function public.note_visit(text) from public;
grant execute on function public.note_visit(text) to anon, authenticated;

-- ── 2) debug_logs 길이 제한(NOT VALID — 이미 있는 행은 검사하지 않는다) ───────────────────────
-- 로그인한 누구나 자기 로그를 무제한 길이로 넣을 수 있었다. 앱(lib/debug)은 같은 값으로 잘라 보낸다.
alter table public.debug_logs drop constraint if exists debug_logs_len;
alter table public.debug_logs add constraint debug_logs_len
  check (char_length(tag) <= 64
         and (detail is null or char_length(detail) <= 4096)
         and (ua is null or char_length(ua) <= 512)) not valid;

-- ── 3) 오래된 로그 정리 함수 — 크론만 부른다 ─────────────────────────────────────────────
-- debug_logs 30일 · activity_events 180일(활동함은 최근 소식만 보여 준다) · cron.job_run_details 14일.
-- 크론 실행 기록 표는 권한이 없을 수 있어 따로 감싼다(실패해도 앞의 둘은 지워진다).
create schema if not exists private;
create or replace function private.purge_old_logs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.debug_logs where created_at < now() - interval '30 days';
  delete from public.activity_events where created_at < now() - interval '180 days';
  begin
    execute 'delete from cron.job_run_details where end_time < now() - interval ''14 days''';
  exception when others then
    null;
  end;
end;
$$;
revoke all on function private.purge_old_logs() from public, anon, authenticated;

-- ── 4) 매일 03:30 KST(18:30 UTC) — 비밀이 필요 없다(HTTP 가 아니라 SQL 한 줄) ─────────────────
-- 이름으로 지우고 다시 건다(멱등). cron.job 에서는 jobid 만 읽는다(명령 본문은 읽지 않는다).
do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-logs-daily' $q$;
  execute $q$ select cron.schedule('purge-old-logs-daily', '30 18 * * *', 'select private.purge_old_logs()') $q$;
end $$;

-- ── 5) 새 외래키 인덱스 — 계정 삭제(auth.users on delete cascade)가 표를 통째로 훑지 않게 ─────────
-- photo_comments · photo_reactions 의 photo_id, log_reactions 의 log_id 는 이미 맨 앞 칸 인덱스가 있다.
create index if not exists photo_comments_created_by_idx on public.photo_comments (created_by);
create index if not exists photo_reactions_created_by_idx on public.photo_reactions (created_by);
create index if not exists log_reactions_user_idx on public.log_reactions (user_id);

notify pgrst, 'reload schema';
commit;
