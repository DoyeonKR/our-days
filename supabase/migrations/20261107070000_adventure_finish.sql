-- 대전 · 저장 다듬기(2026-11-09) — README §14.6 '대전 · 저장 다듬기'.
-- 멱등(create or replace · if not exists) · 한 트랜잭션 · 이 파일은 행을 지우지 않는다(60일 정리는 그대로 크론이 나이로만).
-- 함수는 각자의 가장 최근 정의(20261107050000_adventure_guard)에서 필요한 줄만 바꿨다 — 서명 · 권한 그대로(옛 함수도 그대로 부른다).
-- 롤백(SQL 편집기)은 README §14.6 '대전 · 저장 다듬기'의 롤백 SQL.
begin;

-- ── 1) 순위의 같은 점수 순서 — 처음 대전에 들어온 때(updated_at 은 정산마다 바뀌어 순서가 흔들렸다) ─────────
-- 이미 있는 행은 모두 이 migration 의 시각이 된다 — 그 사이는 user_id 순(늘 같은 순서).
alter table public.adventure_ratings add column if not exists created_at timestamptz not null default now();

-- ── 2) 점수 정산 — 상승 상한에 걸리면 방어자가 잃는 점수도 같은 비율로 ─────────────────────────
-- 20261107050000 의 정의에서 바뀐 것: 도전자의 상승을 상한으로 깎아도 방어자는 깎기 전 점수를 그대로 잃었다(한도에 닿은 사람이
-- 계속 이기면 남의 점수만 빠졌다). 이제 od 를 d / (깎기 전 d) 로 줄이고(상한에 다 차면 0) 'capped' 를 돌려준다.
create or replace function public.adventure_settle(p_user uuid, p_opp uuid, p_win boolean, p_k integer, p_k_def integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_cap constant integer := 120;
  me integer;
  opp integer;
  my_gain integer;
  opp_gain integer;
  expect numeric;
  d integer := 0;
  d_raw integer := 0;
  od integer := 0;
  v_capped boolean := false;
begin
  insert into public.adventure_ratings (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_opp is null or p_opp = p_user then
    update public.adventure_ratings set
      practice_wins = practice_wins + (case when p_win then 1 else 0 end),
      practice_losses = practice_losses + (case when p_win then 0 else 1 end),
      updated_at = now()
    where user_id = p_user
    returning rating into me;
    return json_build_object('delta', 0, 'opp_delta', 0, 'rating', me, 'practice', true, 'capped', false);
  end if;
  insert into public.adventure_ratings (user_id) values (p_opp) on conflict (user_id) do nothing;
  -- 같은 순서로 잠근다 — A→B 와 B→A 가 동시에 끝나도 서로를 기다리지 않게
  perform 1 from public.adventure_ratings where user_id in (p_user, p_opp) order by user_id for update;
  select rating, case when gain_day = v_day then day_gain else 0 end into me, my_gain
    from public.adventure_ratings where user_id = p_user;
  select rating, case when gain_day = v_day then day_gain else 0 end into opp, opp_gain
    from public.adventure_ratings where user_id = p_opp;
  expect := 1 / (1 + power(10::numeric, (opp - me) / 400.0));
  d_raw := round(p_k * ((case when p_win then 1 else 0 end) - expect));
  d := d_raw;
  od := round(p_k_def * ((case when p_win then 0 else 1 end) - (1 - expect)));
  if d_raw > 0 then
    d := least(d_raw, greatest(0, v_cap - my_gain));
    if d < d_raw then
      v_capped := true;
      -- 이긴 쪽이 덜 오른 만큼 진 쪽(방어자)도 덜 잃는다 — 상한에 다 찼으면 둘 다 그대로
      od := round(od * d::numeric / d_raw);
    end if;
  end if;
  if od > 0 then
    od := least(od, greatest(0, v_cap - opp_gain));
  end if;
  update public.adventure_ratings set
    rating = greatest(0, rating + d),
    wins = wins + (case when p_win then 1 else 0 end),
    losses = losses + (case when p_win then 0 else 1 end),
    streak = case when p_win then streak + 1 else 0 end,
    best = greatest(best, greatest(0, rating + d)),
    day_gain = my_gain + greatest(d, 0),
    gain_day = v_day,
    updated_at = now()
  where user_id = p_user;
  update public.adventure_ratings set
    rating = greatest(0, rating + od),
    wins = wins + (case when p_win then 0 else 1 end),
    losses = losses + (case when p_win then 1 else 0 end),
    best = greatest(best, greatest(0, rating + od)),
    day_gain = opp_gain + greatest(od, 0),
    gain_day = v_day,
    updated_at = now()
  where user_id = p_opp;
  return json_build_object('delta', d, 'opp_delta', od, 'rating', greatest(0, me + d), 'capped', v_capped);
end;
$$;
revoke all on function public.adventure_settle(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_settle(uuid, uuid, boolean, integer, integer) to service_role;

-- ── 3) 판 닫기 + 정산을 한 트랜잭션으로 · 판 id 로 멱등 ─────────────────────────────────────
-- 예전엔 함수가 닫기(update) → 정산(RPC) → delta 쓰기를 따로 보냈다: 정산이 실패하면 되여는 update 가 또 실패할 수 있었고,
-- 응답을 잃은 앱이 다시 보내면 이미 닫힌 판이라 404 만 받았다. 이제 한 번에 하고, 이미 끝난 판(done · void)은 남겨 둔 결과를 그대로 돌려준다.
-- status: 'done'(새로 닫음 또는 이미 닫힘 — again true) · 'void' · 'missing'(내 판이 아니거나 없음). 서비스 롤(엣지 함수)만.
create or replace function public.adventure_finish(
  p_match uuid, p_user uuid, p_win boolean, p_ticks integer, p_state jsonb, p_log jsonb, p_k integer, p_k_def integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  s json;
  v_rating integer;
begin
  select id, user_id, opponent_id, bot, status, result, delta into m
    from public.adventure_matches
    where id = p_match and user_id = p_user
    for update;
  if not found then
    return json_build_object('status', 'missing');
  end if;
  if m.status <> 'active' then
    select rating into v_rating from public.adventure_ratings where user_id = p_user;
    return json_build_object('status', m.status, 'result', m.result, 'delta', coalesce(m.delta, 0),
      'rating', coalesce(v_rating, 1000), 'practice', m.bot, 'again', true);
  end if;
  update public.adventure_matches set
    status = 'done',
    result = case when p_win then 'win' else 'lose' end,
    turn = greatest(coalesce(p_ticks, 0), 0),
    finished_at = now(),
    state = coalesce(p_state, state),
    log = p_log
  where id = p_match;
  s := public.adventure_settle(m.user_id, case when m.bot then null else m.opponent_id end, p_win, p_k, p_k_def);
  update public.adventure_matches set delta = (s ->> 'delta')::integer, opp_delta = (s ->> 'opp_delta')::integer
    where id = p_match;
  return json_build_object('status', 'done', 'result', case when p_win then 'win' else 'lose' end,
    'delta', (s ->> 'delta')::integer, 'rating', (s ->> 'rating')::integer,
    'practice', coalesce((s ->> 'practice')::boolean, false), 'capped', coalesce((s ->> 'capped')::boolean, false), 'again', false);
end;
$$;
revoke all on function public.adventure_finish(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_finish(uuid, uuid, boolean, integer, jsonb, jsonb, integer, integer) to service_role;

-- ── 4) 판 넣기 지키기 — 하루 60판(KST 자정부터 · 무효 판은 안 센다) · 다른 기기에서 막 연 판 · 같은 상대 세 판 ───────
-- 20261107050000 의 정의에서 바뀐 것: 하루 판 수는 함수가 '지난 24시간'(무효 판까지)으로 따로 셌다 — 문구는 '오늘 · 내일'인데
-- 실제론 어제 저녁 판까지 셌고, 두 기기가 동시에 열면 둘 다 통과했다. 이제 같은 사용자 잠금 안에서 센다(연습 판도 하루 판에 든다).
-- 150초(한 판의 최대 길이) 안에 연 판이 열려 있으면 'busy'(PT409) — 다른 기기의 판을 진 것으로 닫지 않는다.
-- 같은 상대 세 판도 무효 판은 안 센다. 오류: 'daily limit' · 'same opponent' 는 PT429(문구로 가른다), 'busy' 는 PT409.
create schema if not exists private;
create or replace function private.adventure_matches_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ourdays:adventure:start:' || new.user_id::text, 0));
  if exists (select 1 from public.adventure_matches
             where user_id = new.user_id and status = 'active' and created_at > now() - interval '150 seconds') then
    raise exception 'busy' using errcode = 'PT409';
  end if;
  select count(*) into n from public.adventure_matches
    where user_id = new.user_id and status <> 'void' and created_at >= v_since;
  if n >= 60 then
    raise exception 'daily limit' using errcode = 'PT429';
  end if;
  if new.opponent_id is null or new.bot then
    return new;
  end if;
  select count(*) into n from public.adventure_matches
    where user_id = new.user_id and opponent_id = new.opponent_id and status <> 'void'
      and created_at >= v_since;
  if n >= 3 then
    raise exception 'same opponent' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
revoke all on function private.adventure_matches_cap() from public, anon, authenticated;
drop trigger if exists adventure_matches_cap on public.adventure_matches;
create trigger adventure_matches_cap before insert on public.adventure_matches
  for each row execute function private.adventure_matches_cap();

-- ── 5) 상대 후보 — 같은 상대 세 판에서 무효 판은 빼고 센다(트리거와 같은 규칙) ─────────────────────
create or replace function public.adventure_candidates(p_user uuid, p_rating integer, p_limit integer default 200)
returns table (public_id uuid, nickname text, team jsonb, rating integer, wins integer, losses integer)
language sql
stable
set search_path = ''
as $$
  select t.public_id, t.nickname, t.team, coalesce(r.rating, 1000), coalesce(r.wins, 0), coalesce(r.losses, 0)
  from public.adventure_teams t
  left join public.adventure_ratings r on r.user_id = t.user_id
  where t.user_id <> p_user
    and (select count(*) from public.adventure_matches m
         where m.user_id = p_user and m.opponent_id = t.user_id and m.status <> 'void'
           and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) < 3
  order by abs(coalesce(r.rating, 1000) - coalesce(p_rating, 1000)), t.updated_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke all on function public.adventure_candidates(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_candidates(uuid, integer, integer) to service_role;

-- ── 6) 오늘의 대전 현황 — 판 수 · 오른 점수 · 상대마다 판 수(public_id 로만) ─────────────────────────
-- 화면이 '오늘 남은 판 n/60 · 오른 점수 n/120 · 이 상대와 n판 남음'을 보여 준다. 서비스 롤(엣지 함수 me)만.
create or replace function public.adventure_today(p_user uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as at
  ), mine as (
    select m.opponent_id, m.bot from public.adventure_matches m, since
    where m.user_id = p_user and m.status <> 'void' and m.created_at >= since.at
  )
  select json_build_object(
    'duels', (select count(*) from mine),
    'gain', coalesce((select case when r.gain_day = (now() at time zone 'Asia/Seoul')::date then r.day_gain else 0 end
                      from public.adventure_ratings r where r.user_id = p_user), 0),
    'opponents', coalesce((
      select json_agg(json_build_object('id', t.public_id, 'n', x.n))
      from (select opponent_id, count(*) as n from mine where opponent_id is not null and not bot group by opponent_id) x
      join public.adventure_teams t on t.user_id = x.opponent_id
    ), '[]'::json)
  );
$$;
revoke all on function public.adventure_today(uuid) from public, anon, authenticated;
grant execute on function public.adventure_today(uuid) to service_role;

-- ── 7) 닉네임 겹침 — 대소문자만 무시하고 글자 그대로 ───────────────────────────────────────
-- 함수가 PostgREST ilike 로 찾았는데 PostgREST 는 '*' 를 '%' 로 바꿔, '*' 가 든 이름은 아무 이름과도 겹친다고 나왔다. 서비스 롤만.
create or replace function public.adventure_nick_taken(p_nick text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.adventure_teams t
    where lower(t.nickname) = lower(p_nick) and t.user_id is distinct from p_user
  );
$$;
revoke all on function public.adventure_nick_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.adventure_nick_taken(text, uuid) to service_role;

-- ── 8) 순위 — 위 30등 + 내 앞뒤 다섯 · 같은 점수는 처음 들어온 순(흔들리지 않게) ─────────────────────
-- 20261107040000 의 정의에서 바뀐 것: 같은 점수는 rank() 에 updated_at 순이라 정산할 때마다 자리가 바뀌었고, 30등 밖이면 내 줄만 보였다.
-- 서명 · 반환 칸 · 권한 그대로(옛 앱도 그대로 그린다 — 등수가 건너뛰면 사이가 빈 것).
create or replace function public.adventure_board(p_limit integer default 30)
returns table (rank bigint, nickname text, rating integer, wins integer, losses integer, lead text, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select r.user_id, t.nickname, r.rating, r.wins, r.losses, t.team -> 0 ->> 'species' as lead,
           row_number() over (order by r.rating desc, r.created_at, r.user_id) as rank
    from public.adventure_ratings r
    join public.adventure_teams t on t.user_id = r.user_id
    where r.wins + r.losses > 0
  ), mine as (
    select ranked.rank from ranked where ranked.user_id = (select auth.uid())
  )
  select ranked.rank, ranked.nickname, ranked.rating, ranked.wins, ranked.losses, ranked.lead, ranked.user_id = (select auth.uid())
  from ranked
  where ranked.rank <= least(greatest(coalesce(p_limit, 30), 1), 100)
     or exists (select 1 from mine where abs(ranked.rank - mine.rank) <= 5)
  order by ranked.rank;
$$;
revoke all on function public.adventure_board(integer) from public, anon;
grant execute on function public.adventure_board(integer) to authenticated;

-- ── 9) 보관 — 하루 넘게 열린 판은 무효로(점수 그대로), 60일 지난 판은 지운다(크론만 부른다) ─────────────
-- 20261107050000 의 정의에서 바뀐 것: 열린 판을 K 32 · 16 고정값으로 진 것으로 정산했다(연습 판 K · 판을 연 엔진과 무관하게).
-- 하루 지난 판은 이미 me · opponents · start 가 정산했어야 할 판이라, 여기 남은 건 버려진 판 — 누구 점수도 바꾸지 않고 닫는다.
create or replace function private.adventure_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.adventure_matches set status = 'void', finished_at = now()
    where status = 'active' and created_at < now() - interval '1 day';
  delete from public.adventure_matches where status <> 'active' and created_at < now() - interval '60 days';
end;
$$;
revoke all on function private.adventure_retention() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
