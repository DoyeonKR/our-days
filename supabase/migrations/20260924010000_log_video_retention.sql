-- 3초 로그 영상 보관 기간 — 90일이 지나면 영상만 정리한다 [2026-09-24]
-- [사용자: "너가 뺴야할 기능들 제안했던것도 다 뺄 수 있도록 진행해"
--  — 제안: "3초 로그 영상: 오래된 영상 자동 정리(90일 뒤 영상만 지우고 글은 유지)"]
--
-- 영상 한 편 ≈ 0.5MB, 둘이 하루 두 번이면 1년에 약 0.76GB — 무료 플랜 저장 공간(1GB)을 사진과 나눠 쓴다.
-- 90일이 지난 로그는 영상만 떼어 내고 글·이모지·날짜·댓글은 남긴다(행이 그대로라 연속 기록도 안 끊긴다).
--
-- 이 파일은 표도 행도 지우지 않는다(열 하나 · 제약 완화 · 함수 하나). 실제 정리는 daily-reminders 가 매 실행마다
-- 아래 함수를 불러 조금씩(회당 100편) 한다 — **이 SQL 을 실행하는 순간이 정리를 켜는 스위치다.**
-- 함수가 없으면 daily-reminders 는 정리를 조용히 건너뛴다. 다시 돌려도 안전하다.
-- schema.sql 끝에 이 파일이 그대로 포함된다(신규 bootstrap = 운영 migration 동일 보장 — logretention.test).
begin;

-- ── 1) 영상이 정리된 시각 + 내용 제약 완화 ─────────────────────────────────────
-- 로그는 '영상 또는 글' 중 하나가 꼭 있어야 한다(clogs_content_check). 영상만 있던 로그에서 영상을 떼면
-- 둘 다 없어지므로, 정리된 로그(video_expired_at 있음)만 예외로 둔다.
alter table public.couple_logs add column if not exists video_expired_at timestamptz;
alter table public.couple_logs drop constraint if exists clogs_content_check;
alter table public.couple_logs add constraint clogs_content_check check (
  video_path is not null
  or video_expired_at is not null
  or (body is not null and length(trim(body)) > 0)
);

-- ── 2) 오래된 영상 떼어 내기 — 서비스롤 전용 ───────────────────────────────────
-- 떼어 낸 (로그 id, 영상 경로)를 돌려주면 호출한 쪽이 Storage 에서 파일을 지운다.
-- DB 를 **먼저** 바꾸는 이유: 파일 삭제가 실패해도 남는 건 아무도 안 가리키는 고아 파일이라 media-gc 가
-- 수거한다. 반대 순서면 로그가 없는 파일을 가리키는 깨진 영상이 남는다(계정 삭제와 같은 원칙).
-- 날짜는 KST 기준 log_date(그 로그가 '어느 날의 기록'인지)로 잰다.
create or replace function public.expire_log_videos(p_keep_days int, p_limit int)
returns table (log_id uuid, path text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  -- 0·7 같은 값을 실수로 넘겨도 최근 영상이 날아가지 않게 바닥을 둔다.
  if p_keep_days is null or p_keep_days < 30 then
    raise exception 'keep days must be at least 30' using errcode = '22023';
  end if;
  for r in
    with picked as (
      select l.id, l.video_path
      from public.couple_logs l
      where l.video_path is not null
        and l.log_date < (now() at time zone 'Asia/Seoul')::date - p_keep_days
      order by l.log_date, l.id
      limit least(greatest(coalesce(p_limit, 0), 0), 500)
      for update of l skip locked
    )
    update public.couple_logs l
    set video_path = null, video_expired_at = now()
    from picked
    where l.id = picked.id
    returning l.id as expired_id, picked.video_path as expired_path
  loop
    log_id := r.expired_id;
    path := r.expired_path;
    return next;
  end loop;
end;
$$;
revoke all on function public.expire_log_videos(int, int) from public, anon, authenticated;
grant execute on function public.expire_log_videos(int, int) to service_role;

commit;
