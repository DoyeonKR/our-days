-- 섬 저장 충돌('stale')의 오류 코드 40001 → PT409. [2026-09-27 장애 — 사용자: "모든 정보가 없어진 것 같아"]
--
-- 무슨 일이었나: island_action 이 버전이 안 맞으면 errcode 40001(serialization_failure)로 오류를 냈다.
-- PostgREST 14 는 40001 을 '잠깐 뒤 다시 하면 되는 충돌'로 보고 **트랜잭션을 서버 안에서 스스로 재시도**한다.
-- 그런데 우리 충돌은 기다린다고 풀리지 않는다(같은 p_expected_version 을 몇 번을 다시 보내도 버전은 안 맞는다) —
-- 요청 하나가 영원히 끝나지 않는 재시도 고리가 됐다. 게이트웨이엔 요청이 하나뿐이라 API 로그에는 안 보이고,
-- DB 에만 'ERROR stale' 과 롤백이 초당 수백 번 쌓였다(7월 1일부터 롤백 약 46억 번).
-- 두 사람이 거의 동시에 섬을 저장할 때마다 고리가 하나씩 생겨 데이터 API 연결을 하나씩 붙잡았고,
-- 2026-09-27 저녁 고리 7개가 연결을 다 쥐면서 CPU 가 가득 차 데이터 API 전체가 503(PGRST002)으로 멈췄다.
-- 앱에는 사진·기록·일정이 전부 사라진 것처럼 보였다(데이터는 그대로였다).
-- 참고: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
--
-- 고침: 충돌은 PT409 로 낸다 — PostgREST 가 HTTP 409 로 바로 돌려주고 재시도하지 않는다.
-- 앱은 오류 코드를 보지 않고 '실패면 최신을 다시 읽는다'라 앱 쪽은 바꿀 게 없다.
-- ⚠ 이 파일은 함수만 바꾼다. **이미 돌고 있는 고리는 이걸로 안 멈춘다** — 적용 직후 해당 연결을 끊어야 한다
--   (pg_terminate_backend, 또는 대시보드에서 프로젝트 재시작).
-- ⚠ 앞으로 RPC 에서 errcode 40001 · 40P01 을 직접 내지 않는다(rpcerrcode.test 가 잠근다).

begin;

create or replace function public.island_action(p_expected_version int, p_state jsonb)
returns public.couple_island language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_row public.couple_island;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.' using errcode = '28000'; end if;
  select couple_id into v_couple from public.couple_members where user_id = v_uid limit 1;
  if v_couple is null then raise exception '커플이 없습니다.'; end if;
  select * into v_row from public.couple_island where couple_id = v_couple for update;
  if v_row.couple_id is null then raise exception 'no island'; end if;
  if v_row.version <> p_expected_version then raise exception 'stale' using errcode = 'PT409'; end if;
  update public.couple_island
    set state = p_state, version = version + 1, updated_by = v_uid, updated_at = now()
    where couple_id = v_couple
    returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.island_action(int, jsonb) to authenticated, anon;

commit;
