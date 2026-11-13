-- 해양 포유류 6계열(2026-11-13) — 점박이물범 · 물개 · 큰바다사자 · 독도 강치 · 해달 · 수달을 낚시 순위 · 크기 순위가 아는 계열 목록에 더한다.
-- 20261107090000_fish_families_54 의 private.fish_family_ok 와 같은 정의에 계열만 늘렸다(목록은 src/lib/aquarium.ts 의 FAMILIES 순서 — serverguard.test 가 견준다).
-- 함수 하나를 다시 정의할 뿐이다 — 표 · 행 · 다른 함수 · 권한은 그대로. 몇 번 다시 돌려도 같다.
begin;

create or replace function private.fish_family_ok(p_family text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_family = any (array[
    'guppy', 'ricefish', 'pale_chub', 'zebra_danio', 'corydoras', 'platy', 'chinese_minnow', 'crucian', 'lanternfish', 'molly',
    'anchovy', 'dark_chub', 'goby', 'loach', 'bluegill', 'tetra', 'saury', 'smelt', 'sweetfish', 'bitterling',
    'goldfish', 'hatchetfish', 'gourami', 'boxfish', 'butterflyfish', 'bullhead', 'mudskipper', 'sleeper', 'gudgeon', 'betta',
    'scorpionfish', 'halfbeak', 'pleco', 'mackerel', 'rockfish_bollak', 'catfish', 'flounder', 'shiri', 'common_carp', 'rockfish',
    'blue_tang', 'masu_salmon', 'angel', 'filefish', 'black_seabream', 'oscar', 'sailfin_sandfish', 'starfish', 'largemouth_bass', 'rainbow_trout',
    'skygazer', 'cod', 'spanish_mackerel', 'clown', 'sea_bream', 'snakehead', 'mandarin_fish', 'blobfish', 'jellyfish', 'perch_kkeokji',
    'sea_bass', 'lionfish', 'hairtail', 'salmon', 'piranha', 'cutlassfish_pollock', 'squid', 'discus', 'char', 'otter',
    'nurse_shark', 'parrotfish', 'moray', 'leopard_shark', 'barracuda', 'grass_carp', 'skate', 'koi', 'croaker', 'eel',
    'yellowtail', 'seahorse', 'barred_knifejaw', 'spotted_seal', 'ray', 'fur_seal', 'viperfish', 'octopus', 'goosefish', 'gulper_eel',
    'striped_jack', 'grouper', 'lenok', 'puffer', 'sea_otter', 'dolphinfish', 'electric_eel', 'arowana', 'redtail_catfish', 'blue_shark',
    'sturgeon', 'frilled_shark', 'bluefin', 'anglerfish', 'arapaima', 'sea_turtle', 'oarfish', 'sunfish', 'steller_sea_lion', 'hammerhead',
    'marlin', 'whale_shark', 'great_white', 'manta', 'swordfish', 'coelacanth', 'megamouth', 'giant_squid', 'japanese_sea_lion', 'rising',
    'astral', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
