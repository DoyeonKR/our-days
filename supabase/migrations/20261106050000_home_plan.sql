-- 홈 · 계획 리뷰(2026-11-05) — 일정의 '이번만 건너뛰기'와 여러 날 일정(여행).
-- 두 칸 모두 선택 칸이다: 옛 앱은 모르고 안 보내므로 편집해도 값이 그대로 남는다(event_time 과 같은 방식).
--   skip_dates : 건너뛴 회차의 시작일들. 반복 일정에만 뜻이 있다. 화면 · 알림(daily-reminders)이 그 회차를 건너뛴다.
--   end_date   : 여러 날 일정의 끝나는 날. 없으면 하루짜리. 달력엔 이어지는 날마다, 알림은 시작일 기준.
-- couple_events 는 표 단위 권한(컬럼 grant 없음)이라 새 칸도 기존 정책(events_insert · events_update)으로 바로 쓴다.
-- 편집 충돌 검사(updated_at 비교)는 이미 있는 updated_at 칸과 sync_event_recurrence 트리거(갱신마다 now())를 쓴다 — 여기서 바꾸지 않는다.
-- 여러 번 돌려도 같은 결과(GitHub 연동이 한 번 더 실행해도 안전). 행을 지우지 않는다.
begin;

alter table public.couple_events
  add column if not exists skip_dates date[] not null default '{}';
alter table public.couple_events
  add column if not exists end_date date;

-- 끝나는 날이 시작일 이하이거나 1년(366일)을 넘으면 하루짜리로 되돌린다. check 로 막지 않는 이유: 옛 앱은 end_date 를 모른 채
-- 시작일만 옮긴다 — check 면 그 편집이 통째로 거부된다. 트리거는 값을 고쳐 받아 준다. 건너뛴 날은 최근 400개까지.
create or replace function public.normalize_event_span()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.end_date is not null
     and (new.end_date <= new.event_date or new.end_date > new.event_date + 366) then
    new.end_date := null;
  end if;
  if new.skip_dates is null then
    new.skip_dates := '{}';
  elsif cardinality(new.skip_dates) > 400 then
    new.skip_dates := (select array_agg(d order by d) from (
      select d from unnest(new.skip_dates) as d order by d desc limit 400) recent);
  end if;
  return new;
end;
$$;
revoke execute on function public.normalize_event_span() from public, anon, authenticated;
drop trigger if exists couple_events_normalize_span on public.couple_events;
create trigger couple_events_normalize_span
  before insert or update on public.couple_events
  for each row execute function public.normalize_event_span();

notify pgrst, 'reload schema';
commit;
