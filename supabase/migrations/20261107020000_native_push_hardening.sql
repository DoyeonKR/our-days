-- 앱 푸시 토큰 다듬기 (2026-11-07) [사용자: 앱 · 푸시 리뷰 "Fix all"] README §10.20
-- ① register_native_push: 아무 문자열(4096자까지)이나 받고 사용자마다 끝없이 쌓였다 → FCM 토큰 모양(영숫자 : _ -, 20~512자)만 받고,
--    등록할 때 그 사용자의 최신 5개만 남긴다. ⚠ 기존 행은 이 파일에서 지우지 않는다 — 그 사용자가 다음에 등록할 때만 정리된다.
-- ② unregister_native_push: 로그아웃 때 행 삭제가 실패한 기기(연결 불량)가 다음 실행에 그 토큰으로 지운다.
--    로그아웃 뒤라 세션이 없을 수 있어 anon 도 부른다 — 토큰은 그 기기만 아는 값이고, 그 토큰의 행을 지우는 것 말고는 아무것도 안 한다.
-- 멱등(create or replace) · 한 트랜잭션 · 표와 정책은 그대로.
begin;

create or replace function public.register_native_push(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 512 or p_token !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'bad token' using errcode = 'PT400';
  end if;
  if p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'bad platform' using errcode = 'PT400';
  end if;
  insert into public.native_push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- 최신 5개만 — 앱을 지웠다 다시 깐 기기 · 바뀐 토큰이 쌓여 알림 한 번에 죽은 토큰 수십 개로 보내지 않게
  delete from public.native_push_tokens t
  where t.user_id = v_uid
    and t.token <> p_token
    and t.token in (
      select k.token from public.native_push_tokens k
      where k.user_id = v_uid
      order by k.updated_at desc, k.token
      offset 5
    );
end;
$$;
revoke all on function public.register_native_push(text, text) from public, anon;
grant execute on function public.register_native_push(text, text) to authenticated;

create or replace function public.unregister_native_push(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or char_length(p_token) > 4096 then
    return;
  end if;
  delete from public.native_push_tokens where token = p_token;
end;
$$;
revoke all on function public.unregister_native_push(text) from public;
grant execute on function public.unregister_native_push(text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
