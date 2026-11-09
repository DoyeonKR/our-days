-- 모험 대전 · 저장 지키기(2026-11-09 리뷰 "Fix all") — README §14.6 '대전 지키기'.
-- 멱등(create or replace · if not exists · drop … if exists) · 한 트랜잭션 · 이 파일은 판 · 점수 행을 지우지 않는다(오래된 판 정리는 크론이 나중에 나이로만).
-- 롤백(SQL 편집기)은 README §14.6 '대전 지키기' 표 — 크론만 멈추려면 select cron.unschedule('adventure-retention-daily');
begin;

-- ── 1) 저장은 합쳐서 쓴다 — 옛 번들이 모르는 칸(골드로 산 장신구 등)을 지우지 못하게 ─────────────────────
-- 옛 번들의 normalizeSave 는 아는 칸만 다시 지어 보낸다. 통째로 바꾸면 새 칸이 사라졌다 → 최상위 칸만 덮어쓴다(state || p_state).
-- 지워져야 하는 최상위 칸은 없다(daily · field 는 날짜를 보고 읽으므로 옛 값이 남아도 무해).
create or replace function public.adventure_save(p_state jsonb, p_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 300000 then
    raise exception 'bad state' using errcode = 'PT422';
  end if;
  if coalesce(p_version, 0) = 0 then
    insert into public.adventure_saves (user_id, state, version)
    values (v_uid, p_state, 1)
    on conflict (user_id) do nothing
    returning version into v;
  else
    update public.adventure_saves
      set state = adventure_saves.state || p_state, version = version + 1, updated_at = now()
      where user_id = v_uid and version = p_version
      returning version into v;
  end if;
  if v is null then
    raise exception 'stale' using errcode = 'PT409';
  end if;
  return v;
end;
$$;
revoke all on function public.adventure_save(jsonb, integer) from public, anon;
grant execute on function public.adventure_save(jsonb, integer) to authenticated;

-- ── 2) 새 칸 ──────────────────────────────────────────────────────────────────────────────
-- 상대 고르기에 계정 id 대신 팀 행의 무작위 id(내리고 다시 올리면 바뀐다)
alter table public.adventure_teams add column if not exists public_id uuid not null default gen_random_uuid();
create unique index if not exists adventure_teams_public_id_key on public.adventure_teams (public_id);
-- 연습 판 전적(점수와 따로) · 하루 점수 상승 상한(KST 날짜)
alter table public.adventure_ratings add column if not exists practice_wins integer not null default 0;
alter table public.adventure_ratings add column if not exists practice_losses integer not null default 0;
alter table public.adventure_ratings add column if not exists day_gain integer not null default 0;
alter table public.adventure_ratings add column if not exists gain_day date;
-- 판에 보낸 입력 기록 · 판을 연 엔진(함수를 다시 배포하면 열려 있던 판은 무효)
alter table public.adventure_matches add column if not exists log jsonb;
alter table public.adventure_matches add column if not exists engine text;
alter table public.adventure_matches drop constraint if exists adventure_matches_status_check;
alter table public.adventure_matches add constraint adventure_matches_status_check check (status in ('active', 'done', 'void'));
create index if not exists adventure_matches_pair_idx on public.adventure_matches (user_id, opponent_id, created_at desc);
create index if not exists adventure_matches_created_idx on public.adventure_matches (created_at);

-- 닉네임은 대소문자를 무시하고 하나만 — 이미 겹친 이름이 있으면 만들지 않고 알린다(함수가 먼저 따로 거른다)
do $$
begin
  if to_regclass('public.adventure_teams_nick_lower_key') is null then
    if exists (select 1 from public.adventure_teams group by lower(nickname) having count(*) > 1) then
      raise notice 'adventure_teams: 겹친 닉네임이 있어 unique 를 건너뛴다';
    else
      create unique index adventure_teams_nick_lower_key on public.adventure_teams (lower(nickname));
    end if;
  end if;
end $$;

-- ── 3) 판 기록은 건 사람만 읽는다 — 방어한 사람은 전적 RPC(adventure_history)로만 ─────────────────────
-- 예전엔 방어한 쪽이 도전자의 계정 id 와 팀 전체(state)를 읽을 수 있었다.
drop policy if exists adventure_matches_select_mine on public.adventure_matches;
create policy adventure_matches_select_mine on public.adventure_matches for select to authenticated
  using (user_id = (select auth.uid()));

-- ── 4) 점수 정산 — 연습 판은 점수를 안 바꾸고 · 하루 상승 +120 상한 · 두 행을 id 순으로 잠근다 ─────────────
-- 연습 판은 opp := me 라 기대 승률이 늘 0.5 → 이길 때마다 +8 이 쌓였다(순위 농사). 서명은 그대로 — 옛 함수도 같은 규칙을 탄다.
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
  od integer := 0;
begin
  insert into public.adventure_ratings (user_id) values (p_user) on conflict (user_id) do nothing;
  if p_opp is null or p_opp = p_user then
    update public.adventure_ratings set
      practice_wins = practice_wins + (case when p_win then 1 else 0 end),
      practice_losses = practice_losses + (case when p_win then 0 else 1 end),
      updated_at = now()
    where user_id = p_user
    returning rating into me;
    return json_build_object('delta', 0, 'opp_delta', 0, 'rating', me, 'practice', true);
  end if;
  insert into public.adventure_ratings (user_id) values (p_opp) on conflict (user_id) do nothing;
  -- 같은 순서로 잠근다 — A→B 와 B→A 가 동시에 끝나도 서로를 기다리지 않게
  perform 1 from public.adventure_ratings where user_id in (p_user, p_opp) order by user_id for update;
  select rating, case when gain_day = v_day then day_gain else 0 end into me, my_gain
    from public.adventure_ratings where user_id = p_user;
  select rating, case when gain_day = v_day then day_gain else 0 end into opp, opp_gain
    from public.adventure_ratings where user_id = p_opp;
  expect := 1 / (1 + power(10::numeric, (opp - me) / 400.0));
  d := round(p_k * ((case when p_win then 1 else 0 end) - expect));
  if d > 0 then
    d := least(d, greatest(0, v_cap - my_gain));
  end if;
  od := round(p_k_def * ((case when p_win then 0 else 1 end) - (1 - expect)));
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
  return json_build_object('delta', d, 'opp_delta', od, 'rating', greatest(0, me + d));
end;
$$;
revoke all on function public.adventure_settle(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_settle(uuid, uuid, boolean, integer, integer) to service_role;

-- ── 5) 같은 사람에게는 하루(KST) 세 판까지 — 한 사람을 계속 두들겨 점수를 빼 가지 못하게(PT429) ─────────────
-- 함수(옛 · 새)가 판을 넣을 때마다 탄다. 같은 사용자의 시작은 잠금으로 줄을 세운다(동시에 넷이 들어오지 않게).
create schema if not exists private;
create or replace function private.adventure_matches_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if new.opponent_id is null or new.bot then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ourdays:adventure:start:' || new.user_id::text, 0));
  select count(*) into n from public.adventure_matches
    where user_id = new.user_id and opponent_id = new.opponent_id
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
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

-- ── 6) 탈퇴한 방어자의 닉네임을 남의 판 기록에서 지운다 ──────────────────────────────────────────
-- 계정을 지우면 opponent_id 가 on delete set null 로 비워진다 — 그 순간 이름(칸 · 판 상태의 이름)을 바꾼다.
create or replace function private.adventure_matches_scrub_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.opponent_id is not null and new.opponent_id is null then
    new.opponent_name := '탈퇴한 사용자';
    if jsonb_typeof(new.state -> 'sides') = 'array' and jsonb_typeof(new.state -> 'sides' -> 1) = 'object' then
      new.state := jsonb_set(new.state, '{sides,1,name}', to_jsonb('탈퇴한 사용자'::text), false);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.adventure_matches_scrub_name() from public, anon, authenticated;
drop trigger if exists adventure_matches_scrub_name on public.adventure_matches;
create trigger adventure_matches_scrub_name before update of opponent_id on public.adventure_matches
  for each row execute function private.adventure_matches_scrub_name();

-- ── 7) 상대 후보 — 점수가 가까운 순(200명이 넘어도 가까운 사람이 나온다) · 오늘 세 번 붙은 사람은 빼고 ──────────
-- 서비스 롤(엣지 함수)만. 계정 id 는 돌려주지 않는다(public_id 만).
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
         where m.user_id = p_user and m.opponent_id = t.user_id
           and m.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')) < 3
  order by abs(coalesce(r.rating, 1000) - coalesce(p_rating, 1000)), t.updated_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;
revoke all on function public.adventure_candidates(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.adventure_candidates(uuid, integer, integer) to service_role;

-- ── 8) 보관 — 하루 넘게 열린 판은 진 것으로 정산하고, 60일 지난 판은 지운다(크론만 부른다) ──────────────────
create or replace function private.adventure_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  s json;
begin
  for m in
    select id, user_id, opponent_id, bot from public.adventure_matches
    where status = 'active' and created_at < now() - interval '1 day'
    for update skip locked
  loop
    update public.adventure_matches set status = 'done', result = 'lose', finished_at = now()
      where id = m.id and status = 'active';
    if found then
      s := public.adventure_settle(m.user_id, case when m.bot then null else m.opponent_id end, false, 32, 16);
      update public.adventure_matches set delta = (s ->> 'delta')::integer, opp_delta = (s ->> 'opp_delta')::integer
        where id = m.id;
    end if;
  end loop;
  delete from public.adventure_matches where status <> 'active' and created_at < now() - interval '60 days';
end;
$$;
revoke all on function private.adventure_retention() from public, anon, authenticated;

-- 매일 03:45 KST(18:45 UTC) — SQL 한 줄이라 비밀이 없다. 이름으로 지우고 다시 건다(멱등). cron.job 에서는 jobid 만 읽는다.
do $$
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'adventure-retention-daily' $q$;
  execute $q$ select cron.schedule('adventure-retention-daily', '45 18 * * *', 'select private.adventure_retention()') $q$;
end $$;

notify pgrst, 'reload schema';
commit;
