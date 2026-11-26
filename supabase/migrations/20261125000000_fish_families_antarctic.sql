-- 남극 10종(2026-11-25 — 젠투 · 턱끈 · 아델리펭귄 · 메로 · 남극빙어 · 클리오네 · 바다돼지 · 남극 대왕등각류 · 남극성게 · 살프 사슬)을 낚시 순위 · 크기 순위가 아는 계열 목록에 더한다.
-- 20261122140000_fish_families_walrus_penguin 의 private.fish_family_ok 와 같은 정의에 계열만 늘렸다(목록은 src/lib/aquarium.ts 의 FAMILIES 순서 — serverguard.test 가 견준다).
-- 함수 하나를 다시 정의할 뿐이다 — 표 · 행 · 다른 함수 · 권한은 그대로. 몇 번 다시 돌려도 같다.
begin;

create or replace function private.fish_family_ok(p_family text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_family = any (array[
    'guppy', 'ricefish', 'cherry_shrimp', 'pale_chub', 'zebra_danio', 'corydoras', 'platy', 'chinese_minnow', 'crucian', 'lanternfish',
    'molly', 'anchovy', 'dark_chub', 'goby', 'loach', 'bluegill', 'tetra', 'saury', 'antarctic_urchin', 'smelt',
    'sweetfish', 'bitterling', 'goldfish', 'hatchetfish', 'gourami', 'boxfish', 'butterflyfish', 'bullhead', 'mudskipper', 'sleeper',
    'gudgeon', 'betta', 'scorpionfish', 'halfbeak', 'pleco', 'mackerel', 'rockfish_bollak', 'catfish', 'fleshy_prawn', 'lobster',
    'flounder', 'shiri', 'common_carp', 'rockfish', 'blue_tang', 'masu_salmon', 'gentoo_penguin', 'angel', 'filefish', 'giant_isopod',
    'black_seabream', 'oscar', 'sailfin_sandfish', 'adelie_penguin', 'dokdo_shrimp', 'icefish', 'starfish', 'snow_crab', 'largemouth_bass', 'rainbow_trout',
    'skygazer', 'cod', 'spanish_mackerel', 'clown', 'sea_bream', 'snakehead', 'mandarin_fish', 'blobfish', 'jellyfish', 'sea_pig',
    'perch_kkeokji', 'sea_bass', 'lionfish', 'hairtail', 'chinstrap_penguin', 'salmon', 'piranha', 'cutlassfish_pollock', 'squid', 'discus',
    'char', 'otter', 'nurse_shark', 'parrotfish', 'moray', 'leopard_shark', 'barracuda', 'grass_carp', 'skate', 'koi',
    'croaker', 'eel', 'yellowtail', 'seahorse', 'barred_knifejaw', 'clione', 'spotted_seal', 'ray', 'fur_seal', 'viperfish',
    'king_crab', 'octopus', 'emperor_penguin', 'goosefish', 'gulper_eel', 'striped_jack', 'grouper', 'lenok', 'toothfish', 'puffer',
    'sea_otter', 'dolphinfish', 'electric_eel', 'arowana', 'redtail_catfish', 'blue_shark', 'sturgeon', 'sawshark', 'frilled_shark', 'bluefin',
    'anglerfish', 'arapaima', 'sea_turtle', 'oarfish', 'salp', 'sunfish', 'steller_sea_lion', 'hammerhead', 'marlin', 'minke_whale',
    'whale_shark', 'walrus', 'great_white', 'manta', 'swordfish', 'coelacanth', 'megamouth', 'gray_whale', 'humpback_whale', 'giant_squid',
    'japanese_sea_lion', 'sperm_whale', 'orca', 'rising', 'blue_whale', 'astral', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
