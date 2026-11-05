-- 기록 공통 정리 (2026-11-06) — 미디어 파일은 올린 사람만 지운다 · media-gc 주간 점검(삭제 없음).
-- schema.sql 끝에 이 파일이 그대로 붙어 있다(신규 bootstrap = 운영 migration — recordscommon.test 가 잠근다).
-- 여러 번 돌려도 같다(drop policy if exists + create · 크론은 지우고 다시 건다). 행 데이터는 건드리지 않는다.

-- ── 1) storage.objects: 보기는 커플 · 올리기/고치기/지우기는 올린 사람만 ───────────────
-- 예전 couple_photos_obj_all 은 for all 이라, 같은 커플이면 API 로 **상대가 올린** 사진 · 일기 사진 ·
-- 3초 로그 영상을 지우거나 같은 이름으로 덮어쓸 수 있었다(앱 화면에 그런 버튼이 없어도 REST 로는 됐다).
-- 이제 SELECT 만 커플 멤버에게 열고, INSERT 는 내 커플 폴더 + 올린 사람이 나, UPDATE/DELETE 는 올린 사람만.
--
-- 올린 사람은 Storage 가 직접 적는다 — 업로드 때 JWT 의 sub 를 owner_id(문자열)와 owner(uuid, 옛 칸)에 넣는다.
-- 앱은 이 칸을 보내지 않으므로 옛 앱의 업로드도 그대로 통과한다. owner_id 가 생기기 전 파일을 위해 owner 도 본다.
--
-- 상대 파일을 지우던 앱 흐름은 이렇게 된다(remove 는 RLS 에 걸린 파일을 오류 없이 건너뛴다):
--   · 상대 사진 삭제(couple_photos 행은 둘 다 지울 수 있다) → 행만 지워지고 파일은 고아로 남아 media-gc(서비스 롤)가 수거.
--   · 일기 · 3초 로그 삭제, 영상 교체, 업로드 실패 정리 → 작성자 본인 파일이라 그대로 지워진다.
--   · 영상 90일 정리(daily-reminders) · 계정 삭제(manage-account) · media-gc → 서비스 롤이라 RLS 를 타지 않는다.
-- 비밀일기 사진 가드(private.deco_photo_blocked)는 SELECT 에 **그대로** 둔다. 2026-11-06 부터 일기는 전부 공유라
-- 이 가드는 늘 거짓이지만, 지워도 얻는 게 없고 되살릴 때 위험하니 남긴다(나중에 지워도 되는 줄).
-- 대상은 to authenticated — 예전 정책도 로그인 안 한 요청엔 auth.uid() 가 비어 아무것도 안 열렸다(같은 결과).
-- 폴더 이름은 글자로 비교한다 — uuid 로 바꾸면 폴더가 uuid 모양이 아닌 경로 하나 때문에 질의 전체가 오류가 난다.
begin;

drop policy if exists couple_photos_obj_all on storage.objects;

drop policy if exists couple_photos_obj_select on storage.objects;
create policy couple_photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'couple-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and not private.deco_photo_blocked(name));

drop policy if exists couple_photos_obj_insert on storage.objects;
create policy couple_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'couple-photos'
              and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
              and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
              and not private.deco_photo_blocked(name));

drop policy if exists couple_photos_obj_update on storage.objects;
create policy couple_photos_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'couple-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
         and not private.deco_photo_blocked(name))
  with check (bucket_id = 'couple-photos'
              and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
              and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
              and not private.deco_photo_blocked(name));

drop policy if exists couple_photos_obj_delete on storage.objects;
create policy couple_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'couple-photos'
         and (storage.foldername(name))[1] in (select (private.my_couple_ids())::text)
         and (owner_id = (select auth.uid())::text or owner = (select auth.uid()))
         and not private.deco_photo_blocked(name));

-- ── 2) media-gc 주간 점검 — dry-run 만, 지우지 않는다 ─────────────────────────────────
-- 고아 파일은 지금 사람이 손으로 dry-run 을 돌려야 보였다. 위 1) 뒤로는 상대 사진을 지우면 파일이 고아로 남으니
-- 매주 일요일 04:00 KST(토 19:00 UTC)에 후보 수만 세게 한다. 결과는 pg_net 응답 기록(net._http_response)과 함수 로그에 남는다.
-- 실제 정리는 지금처럼 사람이 확인 뒤 confirm 으로 돌린다 — 본문에 confirm 을 절대 넣지 않는다.
-- 크론 비밀은 이 파일에 없다: daily-reminders 작업의 명령을 DB 안에서 복사해 주소와 본문만 바꾼다(README §7).
-- 명령 본문은 출력하지 않는다(notice 에도 길이 · 참거짓만). 모양이 예상과 다르면 아무것도 걸지 않고 건너뛴다.
do $$
declare
  v_src text;
  v_cmd text;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$
    select command from cron.job
    where jobname = 'daily-reminders'
      and command ~ '/functions/v1/daily-reminders[''?]'
      and command ~ 'body\s*:=\s*''[^'']*''::jsonb'
    limit 1
  $q$ into v_src;
  if v_src is null then
    raise notice 'media-gc-weekly-dryrun: daily-reminders 명령 모양이 달라 건너뜀';
    return;
  end if;
  v_cmd := regexp_replace(v_src, '/functions/v1/daily-reminders', '/functions/v1/media-gc');
  v_cmd := regexp_replace(v_cmd, 'body\s*:=\s*''[^'']*''::jsonb', 'body := ''{"dry_run": true}''::jsonb');
  if v_cmd !~ '/functions/v1/media-gc[''?]' or v_cmd ~* 'confirm' then
    raise notice 'media-gc-weekly-dryrun: 바꾼 명령 검사에 실패해 건너뜀';
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'media-gc-weekly-dryrun' $q$;
  execute $q$ select cron.schedule('media-gc-weekly-dryrun', '0 19 * * 6', $1) $q$ using v_cmd;
end $$;

commit;
