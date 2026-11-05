-- 안드로이드 앱 푸시 토큰 (2026-11-07) [사용자: 앱으로 설치해도 알림이 오게]
-- 앱 안 WebView 엔 웹 푸시가 없어 FCM 으로 보낸다. 토큰은 기기마다 하나 — 같은 기기에서 계정을 바꾸면 새 사용자에게 넘어간다.
-- 그래서 직접 쓰기 대신 RPC 로 등록한다(남의 행을 RLS 로는 못 고친다). 새 표 · 새 함수만 더하고 기존 행은 건드리지 않는다.
begin;

create table if not exists public.native_push_tokens (
  token text primary key check (char_length(token) between 1 and 4096),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index if not exists native_push_tokens_user_idx on public.native_push_tokens (user_id);

alter table public.native_push_tokens enable row level security;
drop policy if exists native_push_tokens_select_own on public.native_push_tokens;
create policy native_push_tokens_select_own on public.native_push_tokens for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists native_push_tokens_delete_own on public.native_push_tokens;
create policy native_push_tokens_delete_own on public.native_push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.native_push_tokens from anon;
grant select, delete on public.native_push_tokens to authenticated;

create or replace function public.register_native_push(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = 'PT401';
  end if;
  insert into public.native_push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;
revoke all on function public.register_native_push(text, text) from public, anon;
grant execute on function public.register_native_push(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
