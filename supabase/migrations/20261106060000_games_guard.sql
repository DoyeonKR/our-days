-- 정원 합치기 순위판 지킴이 (2026-11-06, 게임 리뷰)
-- 문제: submit_merge_run 은 1천만 점 이하면 아무 점수 · 아무 20자 이름이나 받았고 횟수 제한도 없었다.
--   가짜 1등 한 줄이면 send-poke-push 의 overtake_run 이 10등 안의 모르는 사람들에게 푸시까지 보냈다.
-- 고침(시그니처 · 반환 모양은 그대로 — 옛 앱의 호출이 그대로 돈다):
--   · 사람마다 트랜잭션 잠금(pg_advisory_xact_lock) 뒤 20초에 한 판 · 하루(KST) 200판 — 넘으면 PT429.
--   · 점수가 그 판의 최고 단계로 낼 수 있는 범위 밖이면 PT422. 상한 (L-1)·2^(L+5) · 하한 2^L(3단계부터) · 1 ≤ L ≤ 17.
--     증명은 src/lib/merge.ts 의 scoreCeiling 주석(타일 하나 ≤ (l-1)·2^l, 16칸, 보너스 < 기본) — merge.test 가 같은 식인지 본다.
--   · 닉네임: 공백 정리 · 12자 · 보이지 않는 글자와 주소(링크)는 PT422. 빈 이름은 옛 동작대로 '이름 없음'.
--   · 순위판 · 순위 계산 · 역전 알림은 범위 안 · 정상 이름인 판만 본다 — 이미 들어간 가짜 판은 지우지 않고 가린다.
--   · 역전 푸시는 이 지킴이를 지난 판(guarded)만, 받는 사람마다 하루 한 번(merge_overtake_notified).
-- 옛 RPC(submit_merge_score · merge_leaderboard)도 같은 지킴이를 탄다. 오류는 PT4xx 만(40001 · 40P01 금지 — README §11).
-- 여러 번 돌려도 같은 결과(GitHub 연동이 다시 돌려도 안전). 행을 지우거나 바꾸지 않는다.
begin;
set local lock_timeout = '10s';

alter table public.merge_runs add column if not exists guarded boolean not null default false;
create index if not exists merge_runs_user_time_idx on public.merge_runs (user_id, created_at desc);

create table if not exists public.merge_overtake_notified (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
alter table public.merge_overtake_notified enable row level security;
revoke all on public.merge_overtake_notified from public, anon, authenticated;

-- 점수 범위 — merge.ts 의 scoreCeiling · scoreFloor 와 같은 식
create or replace function public.merge_score_plausible(p_score integer, p_top integer)
returns boolean
language sql
immutable
as $$
  select p_score is not null and p_top is not null
     and p_top between 1 and 17
     and p_score >= (case when p_top >= 3 then (1::bigint << p_top) else 1 end)
     and p_score <= least(10000000::bigint, (p_top - 1)::bigint * (1::bigint << (p_top + 5)));
$$;

-- 닉네임 정리 — 못 쓰는 이름이면 null. merge.ts 의 normalizeNick · NICK_URL_RE 와 같은 규칙
create or replace function public.merge_clean_nick(p_nickname text)
returns text
language sql
immutable
as $$
  select case
    when x.v = '' then null
    when x.v ~ '[\u0001-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]' then null
    when x.v ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|kr|io|me|ly|gg|xyz|co|app|dev|site|link|to|tv|shop|info|biz|top|club)([^a-z0-9]|$))' then null
    else left(x.v, 12)
  end
  from (select btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g')) as v) x;
$$;

-- 순위판에 보이는 판
create or replace function public.merge_run_visible(p_nickname text, p_score integer, p_top integer)
returns boolean
language sql
immutable
as $$
  select public.merge_score_plausible(p_score, p_top) and public.merge_clean_nick(p_nickname) is not null;
$$;

-- 판 하나 넣기 → 그 판의 id · 순위 · 전체 판 수(보이는 판만 센다)
create or replace function public.submit_merge_run(p_nickname text, p_score integer, p_top integer)
returns table (run_id bigint, rank integer, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_raw  text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  v_nick text;
  v_id   bigint;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.' using errcode = 'PT401';
  end if;
  if not public.merge_score_plausible(p_score, p_top) then
    raise exception '이 판의 점수는 순위에 올릴 수 없어요.' using errcode = 'PT422';
  end if;
  if v_raw = '' then
    v_nick := '이름 없음';
  else
    v_nick := public.merge_clean_nick(v_raw);
    if v_nick is null then
      raise exception '이 닉네임은 쓸 수 없어요.' using errcode = 'PT422';
    end if;
  end if;
  -- 확인과 넣기를 한 줄로 — 같은 사람이 동시에 여러 번 불러도 둘 다 확인을 통과하지 못한다
  perform pg_advisory_xact_lock(hashtextextended('merge_run:' || v_uid::text, 0));
  if exists (select 1 from public.merge_runs r where r.user_id = v_uid and r.created_at > now() - interval '20 seconds') then
    raise exception '조금 뒤에 다시 올려 주세요.' using errcode = 'PT429';
  end if;
  if (select count(*) from public.merge_runs r where r.user_id = v_uid
      and r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) >= 200 then
    raise exception '오늘은 더 올릴 수 없어요.' using errcode = 'PT429';
  end if;
  insert into public.merge_runs (user_id, nickname, score, top_lv, guarded)
  values (v_uid, v_nick, p_score, p_top, true)
  returning id into v_id;
  return query
    select v_id,
           (select count(*)::integer + 1 from public.merge_runs r
             where public.merge_run_visible(r.nickname, r.score, r.top_lv)
               and (r.score > p_score or (r.score = p_score and r.id < v_id))),
           (select count(*)::integer from public.merge_runs r where public.merge_run_visible(r.nickname, r.score, r.top_lv));
end;
$$;

-- 1~10등 + (10등 밖이면) 이번 판 한 줄 — 보이는 판만
create or replace function public.merge_run_board(p_run bigint default null)
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean, is_this boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by r.score desc, r.id asc))::integer as rank,
           r.id, r.nickname, r.score, r.top_lv, r.user_id = auth.uid() as is_me
    from public.merge_runs r
    where public.merge_run_visible(r.nickname, r.score, r.top_lv)
  )
  select k.rank, k.nickname, k.score, k.top_lv, k.is_me, k.id = p_run as is_this
  from ranked k
  where k.rank <= 10 or k.id = p_run
  order by k.rank;
$$;

-- 옛 앱 호환: 넣기는 같은 지킴이(submit_merge_run)로, 순위도 보이는 판만
create or replace function public.submit_merge_score(p_nickname text, p_score integer, p_top integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.submit_merge_run(p_nickname, p_score, p_top);
end;
$$;

create or replace function public.merge_leaderboard()
returns table (rank integer, nickname text, score integer, top_lv smallint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by r.score desc, r.id asc))::integer as rank,
           r.nickname, r.score, r.top_lv, r.user_id = auth.uid() as is_me
    from public.merge_runs r
    where public.merge_run_visible(r.nickname, r.score, r.top_lv)
  ), mine as (
    select min(rank) as best from ranked where is_me
  )
  select k.rank, k.nickname, k.score, k.top_lv, k.is_me
  from ranked k
  where k.rank <= 10 or k.rank = (select best from mine)
  order by k.rank;
$$;

-- 역전 알림 대상 — 지킴이를 지난 판만 · 보이는 판끼리 · 받는 사람마다 하루(KST) 한 번
create or replace function public.merge_overtaken(p_run bigint, p_user uuid)
returns table (user_id uuid, best integer, run_nickname text, run_score integer)
language sql
volatile
security definer
set search_path = public
as $$
  with claim as (
    update public.merge_runs r
       set overtake_checked = true
     where r.id = p_run
       and r.user_id = p_user
       and r.guarded
       and not r.overtake_checked
       and r.created_at > now() - interval '10 minutes'
    returning r.id, r.user_id, r.nickname, r.score
  ),
  visible as (
    select o.id, o.user_id, o.score
      from public.merge_runs o
     where public.merge_run_visible(o.nickname, o.score, o.top_lv)
  ),
  others as (
    select o.user_id, max(o.score)::integer as best
      from visible o, claim c
     where o.id <> c.id and o.user_id <> c.user_id
     group by o.user_id
  ),
  victims as (
    select x.user_id, x.best, c.nickname, c.score
      from others x, claim c
     where x.best < c.score
       and (select count(*) from visible q where q.id <> c.id and q.score > x.best) < 10
  ),
  fresh as (
    insert into public.merge_overtake_notified (user_id, day)
    select v.user_id, (now() at time zone 'Asia/Seoul')::date from victims v
    on conflict do nothing
    returning merge_overtake_notified.user_id
  )
  select v.user_id, v.best, v.nickname, v.score
    from victims v
    join fresh f on f.user_id = v.user_id;
$$;

revoke all on function public.merge_score_plausible(integer, integer) from public, anon, authenticated;
revoke all on function public.merge_clean_nick(text) from public, anon, authenticated;
revoke all on function public.merge_run_visible(text, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_merge_run(text, integer, integer) from public, anon;
revoke all on function public.merge_run_board(bigint) from public, anon;
revoke all on function public.submit_merge_score(text, integer, integer) from public, anon;
revoke all on function public.merge_leaderboard() from public, anon;
revoke all on function public.merge_overtaken(bigint, uuid) from public, anon, authenticated;
grant execute on function public.submit_merge_run(text, integer, integer) to authenticated;
grant execute on function public.merge_run_board(bigint) to authenticated;
grant execute on function public.submit_merge_score(text, integer, integer) to authenticated;
grant execute on function public.merge_leaderboard() to authenticated;
grant execute on function public.merge_overtaken(bigint, uuid) to service_role;
notify pgrst, 'reload schema';
commit;
