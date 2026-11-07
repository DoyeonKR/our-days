-- 모험(2026-11-07) — 지역을 돌며 계보 생물을 잡고 키워 싸우는 게임의 저장. 사람마다 한 행(커플과 무관).
-- 저장은 adventure_save RPC 로만 버전을 맞춰 쓴다(두 기기가 동시에 쓰면 늦은 쪽이 PT409 — 40001 은 쓰지 않는다, README §11).
-- 읽기는 본인 행만. 2단계(온라인 대전)에서 상대 팀은 따로 RPC 로 꺼낸다.
begin;

create table if not exists public.adventure_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.adventure_saves enable row level security;

drop policy if exists adventure_saves_select_own on public.adventure_saves;
create policy adventure_saves_select_own on public.adventure_saves for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.adventure_saves from anon;
grant select on public.adventure_saves to authenticated;

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
      set state = p_state, version = version + 1, updated_at = now()
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

notify pgrst, 'reload schema';
commit;
