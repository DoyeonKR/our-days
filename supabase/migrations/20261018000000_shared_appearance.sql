-- Shared home copy, styling, app colour and hero rendering. Additive only; no existing data is overwritten.
begin;
set local lock_timeout = '10s';
alter table public.couples add column if not exists shared_appearance jsonb;
alter table public.couples add column if not exists appearance_version bigint not null default 0;

-- Existing couples SELECT RLS and realtime publication also cover these columns.
-- Do not grant direct UPDATE: all changes must pass validation and compare-and-swap.
create or replace function public.save_couple_appearance(p_couple uuid, p_settings jsonb, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_version bigint;
  v_home jsonb;
  k text;
  lim integer;
begin
  if not exists (select 1 from public.couple_members where couple_id = p_couple and user_id = (select auth.uid())) then
    raise sqlstate '42501' using message = 'Couple membership required';
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or octet_length(p_settings::text) > 8192
     or (p_settings - array['home','theme','pixelArt']) <> '{}'::jsonb then
    raise sqlstate '22023' using message = 'Invalid appearance settings';
  end if;
  if jsonb_typeof(p_settings->'theme') is distinct from 'string'
     or p_settings->>'theme' not in ('rose','coral','purple','blue','mint','lime')
     or jsonb_typeof(p_settings->'pixelArt') is distinct from 'boolean'
     or jsonb_typeof(p_settings->'home') is distinct from 'object' then
    raise sqlstate '22023' using message = 'Invalid appearance styles';
  end if;
  v_home := p_settings->'home';
  if (v_home - array['greeting','subtitle','story','dayLabel','font','align','accent','showDays','showUnread','dayFormat']) <> '{}'::jsonb then
    raise sqlstate '22023' using message = 'Unknown home setting';
  end if;
  foreach k in array array['greeting','subtitle','story','dayLabel'] loop
    if k = 'subtitle' and v_home->k = 'null'::jsonb then continue; end if;
    lim := case k when 'greeting' then 40 when 'subtitle' then 80 when 'story' then 60 else 12 end;
    if jsonb_typeof(v_home->k) is distinct from 'string' or char_length(v_home->>k) > lim then
      raise sqlstate '22023' using message = 'Invalid home text';
    end if;
  end loop;
  foreach k in array array['font','align','accent','dayFormat'] loop
    if jsonb_typeof(v_home->k) is distinct from 'string' then
      raise sqlstate '22023' using message = 'Missing home style';
    end if;
  end loop;
  if v_home->>'font' not in ('clean','pixel','serif') or v_home->>'align' not in ('left','center')
     or v_home->>'accent' not in ('ink','theme','partner') or v_home->>'dayFormat' not in ('days','dplus')
     or jsonb_typeof(v_home->'showDays') is distinct from 'boolean'
     or jsonb_typeof(v_home->'showUnread') is distinct from 'boolean' then
    raise sqlstate '22023' using message = 'Invalid home style';
  end if;
  select appearance_version into v_version from public.couples where id = p_couple for update;
  if not found then raise sqlstate 'PT404' using message = 'Couple not found'; end if;
  if p_version is distinct from v_version then
    raise sqlstate 'PT409' using message = 'Appearance changed; reload before saving';
  end if;
  update public.couples set shared_appearance = p_settings, appearance_version = appearance_version + 1 where id = p_couple
    returning appearance_version into v_version;
  return jsonb_build_object('settings',p_settings,'version',v_version);
end;
$$;
revoke all on function public.save_couple_appearance(uuid,jsonb,bigint) from public, anon;
grant execute on function public.save_couple_appearance(uuid,jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
