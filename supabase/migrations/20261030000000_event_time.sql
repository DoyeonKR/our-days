-- 일정 시간(선택) — 플래너인데 날짜만 있어 "저녁 7시 약속"을 적을 곳이 없었다(2026-10-30 UX 점검).
-- 'HH:MM'(24시간) 텍스트, null = 종일. 옛 앱은 이 칸을 모르고 안 보내므로 편집해도 값이 그대로 남는다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 한 번 더 실행해도 안전).
alter table public.couple_events
  add column if not exists event_time text;
alter table public.couple_events drop constraint if exists events_time_valid;
alter table public.couple_events add constraint events_time_valid
  check (event_time is null or event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;
