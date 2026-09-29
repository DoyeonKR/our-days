-- RLS 를 '행마다 함수 호출'에서 '한 번 계산한 집합'으로 · 함수 권한 정리 · 인덱스 · 크론 대기 시간 [2026-09-29 DB 점검]
--
-- 무엇이 느렸나: 정책이 is_couple_member(couple_id) · can_view_entry(entry_id) 를 **행마다** 불렀다. 둘 다 SECURITY DEFINER
-- 라 인라인이 안 되고, 행마다 함수 → 서브쿼리 → couple_members 조회가 돈다. 일기 반응 634행을 읽는 데 84ms(실측, 같은 결과를
-- 집합으로 계산하면 1ms) — 앱이 실제로 평균 155ms(반응) · 63ms(댓글) · 30ms(사진)씩 걸리던 이유다. 데이터가 커질수록 선형으로 는다.
-- auth.uid() 도 행마다 다시 계산됐다(Supabase 진단 auth_rls_initplan 39건).
--
-- 고침: 내 커플 목록을 private.my_couple_ids() 가 **문장당 한 번** 돌려주고(uncorrelated 서브쿼리라 해시로 한 번만 계산),
-- 정책은 couple_id in (select private.my_couple_ids()) 로 본다. auth.uid() 는 (select auth.uid()) 로 감싸 한 번만 계산한다.
-- 의미는 그대로다 — 쓰기 정책의 조건도 같고, 바뀐 건 계산 방식과 '누구에게 적용되나'(to authenticated)뿐이다.
--   · 익명 로그인 세션도 역할이 authenticated 라 그대로 통과한다. 빠지는 건 로그인 자체를 안 한(anon 키만 든) 요청뿐 —
--     예전엔 그 요청도 정책 함수를 돌리고 0행을 받았고, 이제는 정책에 걸리지 않아 곧바로 0행이다.
--   · storage.objects 정책(couple_photos_obj_all)은 건드리지 않는다 — 모든 역할에 적용되는 그대로.
-- ⚠ private.my_couple_ids() 는 authenticated 가 실행할 수 있어야 한다 — 정책 식은 **질의한 사용자의 권한으로** 돈다
--   (실행 권한을 걷으면 모든 조회가 permission denied 로 멈춘다). 노출 스키마(public)에 두지 않는 이유는 /rest/v1/rpc 로 안 보이게.
-- ⚠ 새 정책은 이 형태로 쓴다: (select auth.uid()) · couple_id in (select private.my_couple_ids()). rls-perf-sync.test 가 지킨다.
--
-- 함께 하는 것:
--   · 아직 인덱스가 없던 couple_id 3곳(일기 반응 · 일기 댓글 · 로그 댓글)과 couple_members.user_id(모든 정책이 이 조회를 탄다)
--   · 함수 권한: 트리거 전용 함수 4개와 앱 RPC 5개 · 정책 도우미를 로그인 안 한 요청에서 못 부르게. 트리거는 발동할 때 EXECUTE 를
--     다시 보지 않으므로 걷어도 동작한다. forbid_created_by_change 의 search_path 도 고정.
--   · 크론이 함수 응답을 기다리는 시간 5초(기본) → 30초: 함수가 4~11초 걸려 성공해도 기록엔 '시간 초과'로 남았다
--     (요청 자체는 나간다). 크론 명령에는 CRON_SECRET 이 들어 있어 레포에 못 적는다 — 그래서 명령 끝에 인자만 덧붙이는 식으로 고친다.
-- 이 파일은 전부 멱등이다(drop policy if exists → create · create or replace · if not exists · 이미 30초면 건너뜀).
-- schema.sql 끝에 이 파일이 그대로 포함된다(신규 bootstrap = 운영 migration 동일 보장 — rls-perf-sync.test).
begin;
set local lock_timeout = '10s';

-- ── 1) 헬퍼: 내가 속한 커플 ────────────────────────────────────────────────────
create schema if not exists private;
grant usage on schema private to authenticated, anon;

create or replace function private.my_couple_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.couple_id from public.couple_members m where m.user_id = (select auth.uid());
$$;
revoke all on function private.my_couple_ids() from public, anon;
grant execute on function private.my_couple_ids() to authenticated;

-- ── 2) 인덱스 ──────────────────────────────────────────────────────────────────
create index if not exists couple_members_user_idx on public.couple_members (user_id);
create index if not exists entry_reactions_couple_idx on public.entry_reactions (couple_id);
create index if not exists entry_comments_couple_idx on public.entry_comments (couple_id, created_at);
create index if not exists log_comments_couple_idx on public.log_comments (couple_id, created_at);

-- ── 3) 정책 ────────────────────────────────────────────────────────────────────
-- 활동함
drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

drop policy if exists activity_reads_insert on public.activity_reads;
drop policy if exists activity_reads_select on public.activity_reads;
drop policy if exists activity_reads_update on public.activity_reads;
create policy activity_reads_insert on public.activity_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));
create policy activity_reads_select on public.activity_reads for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy activity_reads_update on public.activity_reads for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 채팅 읽음
drop policy if exists chat_reads_insert on public.chat_reads;
drop policy if exists chat_reads_select on public.chat_reads;
drop policy if exists chat_reads_update on public.chat_reads;
create policy chat_reads_insert on public.chat_reads for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy chat_reads_select on public.chat_reads for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy chat_reads_update on public.chat_reads for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 버킷리스트
drop policy if exists bucket_delete on public.couple_bucket;
drop policy if exists bucket_insert on public.couple_bucket;
drop policy if exists bucket_select on public.couple_bucket;
drop policy if exists bucket_update on public.couple_bucket;
create policy bucket_delete on public.couple_bucket for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy bucket_insert on public.couple_bucket for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy bucket_select on public.couple_bucket for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy bucket_update on public.couple_bucket for update to authenticated
  using (couple_id in (select private.my_couple_ids()))
  with check (couple_id in (select private.my_couple_ids()));

-- 일정
drop policy if exists events_delete on public.couple_events;
drop policy if exists events_insert on public.couple_events;
drop policy if exists events_select on public.couple_events;
drop policy if exists events_update on public.couple_events;
create policy events_delete on public.couple_events for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy events_insert on public.couple_events for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy events_select on public.couple_events for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy events_update on public.couple_events for update to authenticated
  using (couple_id in (select private.my_couple_ids()))
  with check (couple_id in (select private.my_couple_ids()));

-- 섬
drop policy if exists island_select on public.couple_island;
create policy island_select on public.couple_island for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 3초 로그
drop policy if exists clogs_delete on public.couple_logs;
drop policy if exists clogs_insert on public.couple_logs;
drop policy if exists clogs_select on public.couple_logs;
drop policy if exists clogs_update on public.couple_logs;
create policy clogs_select on public.couple_logs for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy clogs_insert on public.couple_logs for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and (
    (log_date = (now() at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
    or
    (log_date = ((now() - interval '5 min') at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from (now() - interval '5 min') at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
  )
);
create policy clogs_update on public.couple_logs for update to authenticated using (created_by = (select auth.uid())) with check (
  created_by = (select auth.uid()) and couple_id in (select private.my_couple_ids())  -- couple_id 변조로 타 커플 주입 차단
  and (
    (log_date = (now() at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from now() at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
    or
    (log_date = ((now() - interval '5 min') at time zone 'Asia/Seoul')::date
      and slot = (case when extract(hour from (now() - interval '5 min') at time zone 'Asia/Seoul') < 12 then 'am' else 'pm' end))
  )
);
create policy clogs_delete on public.couple_logs for delete to authenticated
  using (created_by = (select auth.uid()));

-- 구성원
drop policy if exists members_delete on public.couple_members;
drop policy if exists members_select on public.couple_members;
drop policy if exists members_update on public.couple_members;
create policy members_delete on public.couple_members for delete to authenticated
  using (user_id = (select auth.uid()));
create policy members_select on public.couple_members for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy members_update on public.couple_members for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 사진
drop policy if exists photos_delete on public.couple_photos;
drop policy if exists photos_insert on public.couple_photos;
drop policy if exists photos_select on public.couple_photos;
create policy photos_delete on public.couple_photos for delete to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy photos_insert on public.couple_photos for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy photos_select on public.couple_photos for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 커플
drop policy if exists couples_select on public.couples;
drop policy if exists couples_update on public.couples;
create policy couples_select on public.couples for select to authenticated
  using (id in (select private.my_couple_ids()));
create policy couples_update on public.couples for update to authenticated
  using (id in (select private.my_couple_ids()))
  with check (id in (select private.my_couple_ids()));

-- 진단 로그 · 알림 설정 · 푸시 구독(본인 것만)
drop policy if exists debug_own_insert on public.debug_logs;
drop policy if exists debug_own_select on public.debug_logs;
create policy debug_own_insert on public.debug_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy debug_own_select on public.debug_logs for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists nprefs_own on public.notify_prefs;
create policy nprefs_own on public.notify_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 일기장 — 비밀일기는 작성자만(visibility = 'private')
drop policy if exists deco_delete on public.deco_entries;
drop policy if exists deco_insert on public.deco_entries;
drop policy if exists deco_select on public.deco_entries;
drop policy if exists deco_update on public.deco_entries;
create policy deco_delete on public.deco_entries for delete to authenticated
  using (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy deco_insert on public.deco_entries for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));
create policy deco_select on public.deco_entries for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (visibility = 'shared' or created_by = (select auth.uid())));
create policy deco_update on public.deco_entries for update to authenticated
  using (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()))
  with check (couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid()));

-- 일기 댓글 · 반응 — 볼 수 있는 일기(can_view_entry 와 같은 규칙)에만. 조회는 집합으로, 쓰기는 한 행이라 함수 그대로.
drop policy if exists ec_delete on public.entry_comments;
drop policy if exists ec_insert on public.entry_comments;
drop policy if exists ec_select on public.entry_comments;
create policy ec_delete on public.entry_comments for delete to authenticated
  using (created_by = (select auth.uid()));
create policy ec_insert on public.entry_comments for insert to authenticated with check (
  public.can_view_entry(entry_id) and created_by = (select auth.uid())
  and couple_id = (select d.couple_id from public.deco_entries d where d.id = entry_comments.entry_id)
);
create policy ec_select on public.entry_comments for select to authenticated using (
  entry_id in (
    select e.id from public.deco_entries e
    where e.couple_id in (select private.my_couple_ids())
      and (e.visibility = 'shared' or e.created_by = (select auth.uid()))
  )
);

drop policy if exists er_delete on public.entry_reactions;
drop policy if exists er_insert on public.entry_reactions;
drop policy if exists er_select on public.entry_reactions;
create policy er_delete on public.entry_reactions for delete to authenticated
  using (created_by = (select auth.uid()));
create policy er_insert on public.entry_reactions for insert to authenticated with check (
  public.can_view_entry(entry_id) and created_by = (select auth.uid())
  and couple_id = (select d.couple_id from public.deco_entries d where d.id = entry_reactions.entry_id)
);
create policy er_select on public.entry_reactions for select to authenticated using (
  entry_id in (
    select e.id from public.deco_entries e
    where e.couple_id in (select private.my_couple_ids())
      and (e.visibility = 'shared' or e.created_by = (select auth.uid()))
  )
);

-- 편지(UI 는 내려갔지만 데이터가 남아 있다) — 열릴 시각이 지나야 상대가 본다
drop policy if exists letters_delete on public.letters;
drop policy if exists letters_insert on public.letters;
drop policy if exists letters_select on public.letters;
create policy letters_delete on public.letters for delete to authenticated
  using (from_user = (select auth.uid()));
create policy letters_insert on public.letters for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and from_user = (select auth.uid()));
create policy letters_select on public.letters for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (from_user = (select auth.uid()) or open_at <= now()));

-- 로그 댓글
drop policy if exists lc_delete on public.log_comments;
drop policy if exists lc_insert on public.log_comments;
drop policy if exists lc_select on public.log_comments;
create policy lc_delete on public.log_comments for delete to authenticated
  using (created_by = (select auth.uid()));
create policy lc_insert on public.log_comments for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and couple_id = (select l.couple_id from public.couple_logs l where l.id = log_comments.log_id)
);
create policy lc_select on public.log_comments for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 기분
drop policy if exists mood_insert on public.mood_checkins;
drop policy if exists mood_select on public.mood_checkins;
drop policy if exists mood_update on public.mood_checkins;
create policy mood_insert on public.mood_checkins for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy mood_select on public.mood_checkins for select to authenticated
  using (couple_id in (select private.my_couple_ids()));
create policy mood_update on public.mood_checkins for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

-- 쿡 반응 · 쿡
drop policy if exists pr_delete on public.poke_reactions;
drop policy if exists pr_insert on public.poke_reactions;
drop policy if exists pr_select on public.poke_reactions;
create policy pr_delete on public.poke_reactions for delete to authenticated
  using (created_by = (select auth.uid()));
create policy pr_insert on public.poke_reactions for insert to authenticated with check (
  couple_id in (select private.my_couple_ids()) and created_by = (select auth.uid())
  and couple_id = (select p.couple_id from public.pokes p where p.id = poke_reactions.poke_id)
);
create policy pr_select on public.poke_reactions for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

drop policy if exists pokes_insert on public.pokes;
drop policy if exists pokes_select on public.pokes;
create policy pokes_insert on public.pokes for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and from_user = (select auth.uid()));
create policy pokes_select on public.pokes for select to authenticated
  using (couple_id in (select private.my_couple_ids()));

-- 오늘의 질문 — 내가 답해야 상대 답이 보인다(qa_i_answered 는 상대 행에서만 돈다)
drop policy if exists qa_insert on public.qa_answers;
drop policy if exists qa_select on public.qa_answers;
drop policy if exists qa_update on public.qa_answers;
create policy qa_insert on public.qa_answers for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy qa_select on public.qa_answers for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (user_id = (select auth.uid()) or public.qa_i_answered(couple_id, question_id)));
create policy qa_update on public.qa_answers for update to authenticated
  using (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()))
  with check (user_id = (select auth.uid()) and couple_id in (select private.my_couple_ids()));

drop policy if exists quiz_insert on public.quiz_responses;
drop policy if exists quiz_select on public.quiz_responses;
create policy quiz_insert on public.quiz_responses for insert to authenticated
  with check (couple_id in (select private.my_couple_ids()) and user_id = (select auth.uid()));
create policy quiz_select on public.quiz_responses for select to authenticated
  using (couple_id in (select private.my_couple_ids())
         and (user_id = (select auth.uid()) or public.quiz_i_answered(couple_id, question_id)));

-- ── 4) 함수 권한 ───────────────────────────────────────────────────────────────
-- 트리거 전용 — 트리거가 부르는 것이라 누구도 직접 실행할 필요가 없다(발동할 때는 EXECUTE 를 다시 보지 않는다).
revoke execute on function public.capture_couple_activity() from public, anon, authenticated;
revoke execute on function public.forbid_created_by_change() from public, anon, authenticated;
revoke execute on function public.sync_event_recurrence() from public, anon, authenticated;
revoke execute on function public.touch_member_updated_at() from public, anon, authenticated;
alter function public.forbid_created_by_change() set search_path = public;

-- 앱이 부르는 RPC — 로그인한 사용자만(안에서도 auth.uid() 를 확인하지만 문 앞에서 한 번 더).
revoke execute on function public.create_couple(text, date) from public, anon;
revoke execute on function public.join_couple(text, text) from public, anon;
revoke execute on function public.island_create(jsonb) from public, anon;
revoke execute on function public.island_action(integer, jsonb) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.create_couple(text, date) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.island_create(jsonb) to authenticated;
grant execute on function public.island_action(integer, jsonb) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- 정책이 부르는 도우미 — 정책은 질의한 사용자의 권한으로 돈다.
-- is_couple_member 는 storage.objects 정책(모든 역할)도 부르므로 anon 실행 권한을 남긴다.
revoke execute on function public.can_view_entry(uuid) from public, anon;
revoke execute on function public.qa_i_answered(uuid, text) from public, anon;
revoke execute on function public.quiz_i_answered(uuid, text) from public, anon;
revoke execute on function public.is_couple_member(uuid) from public;
grant execute on function public.can_view_entry(uuid) to authenticated;
grant execute on function public.qa_i_answered(uuid, text) to authenticated;
grant execute on function public.quiz_i_answered(uuid, text) to authenticated;
grant execute on function public.is_couple_member(uuid) to anon, authenticated;

-- ── 5) 크론이 함수 응답을 기다리는 시간 ─────────────────────────────────────────
-- 명령의 끝(body := '…'::jsonb)) 뒤에 timeout_milliseconds 만 덧붙인다 — CRON_SECRET 이 든 나머지는 그대로 둔다.
-- 크론이 없는 프로젝트(신규 bootstrap)에서는 아무 일도 하지 않는다.
do $$
declare
  r record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  for r in execute $q$
    select jobid, command from cron.job
    where jobname in ('daily-reminders', 'daily-reminders-catchup', 'activity-nudge-morning', 'activity-nudge-evening')
      and command not like '%timeout_milliseconds%'
      and command ~ 'body\s*:=\s*''[^'']*''::jsonb\s*\)'
  $q$
  loop
    perform cron.alter_job(
      r.jobid,
      command := regexp_replace(r.command, '(body\s*:=\s*''[^'']*''::jsonb)\s*\)', '\1, timeout_milliseconds := 30000)')
    );
  end loop;
end $$;

commit;
