-- 오늘 방문자 수 (2026-11-03) — [사용자: 특정 계정에만 "오늘 하루 방문자 수 표기해줘 홈 화면 오른쪽 위에"]
-- 방문자 = 오늘(KST) 앱을 연 기기 수. 기기마다 브라우저에 만든 무작위 id 하나만 남긴다 — 사용자 id · IP 를 저장하지 않고, 90일 지나면 지운다.
-- 로그인 화면에서 나간 방문자도 세려고 note_visit 은 anon 도 부른다(값을 부풀릴 수는 있어도 읽을 수 없다).
-- 읽기는 today_visitors 한 곳 — 볼 수 있는 계정은 **서버가 이메일 해시로** 가린다. 공개 레포라 이메일을 그대로 적지 않고, 다른 계정엔 null 만 간다.
-- 표는 직접 못 읽는다(RLS 켜고 정책 없음). 여러 번 돌려도 같은 결과.
begin;
set local lock_timeout = '10s';

create table if not exists public.daily_visits (
  day    date not null,
  device text not null,
  primary key (day, device)
);
alter table public.daily_visits enable row level security;
revoke all on public.daily_visits from anon, authenticated;

create or replace function public.note_visit(p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_dev text := left(btrim(coalesce(p_device, '')), 64);
begin
  if v_dev = '' then return; end if;
  insert into public.daily_visits (day, device) values (v_day, v_dev) on conflict do nothing;
  if found then
    delete from public.daily_visits where day < v_day - 90;
  end if;
end;
$$;

create or replace function public.today_visitors()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when encode(sha256(convert_to(lower(coalesce(auth.jwt() ->> 'email', '')), 'UTF8')), 'hex') = 'b4da66f25586ffc7a0691f1af44b5050d9b03b0488c1b3dd15bfa8cc9f330500'
    then (select count(*)::integer from public.daily_visits v where v.day = (now() at time zone 'Asia/Seoul')::date)
  end;
$$;

revoke all on function public.note_visit(text) from public;
revoke all on function public.today_visitors() from public, anon;
grant execute on function public.note_visit(text) to anon, authenticated;
grant execute on function public.today_visitors() to authenticated;
notify pgrst, 'reload schema';
commit;
