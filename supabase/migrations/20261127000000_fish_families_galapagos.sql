-- 갈라파고스 제도(2026-11-27 — 최상위 낚시터 Lv.40 및 신규 50종) 계열을 private.fish_family_ok 목록에 더한다.
-- 목록은 src/lib/aquarium.ts 의 FAMILIES 순서(총 203종) — serverguard.test 가 견준다.
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
    'galapagos_damselfish', 'mandarinfish', 'sally_lightfoot_crab', 'moorish_idol', 'picasso_triggerfish', 'king_angelfish', 'spanish_hogfish', 'garden_eel', 'porcupinefish', 'spotted_trumpetfish',
    'red_snapper', 'skipjack_tuna', 'amberjack', 'marble_ray', 'blacktip_reef_shark', 'whitetip_reef_shark', 'croaker', 'eel', 'yellowtail', 'seahorse',
    'barred_knifejaw', 'clione', 'spotted_seal', 'ray', 'fur_seal', 'viperfish', 'king_crab', 'octopus', 'emperor_penguin', 'goosefish',
    'gulper_eel', 'pygmy_seahorse', 'red_lipped_batfish', 'galapagos_lobster', 'clown_triggerfish', 'galapagos_penguin', 'hawksbill_turtle', 'striped_jack', 'grouper', 'lenok',
    'toothfish', 'puffer', 'sea_otter', 'dolphinfish', 'electric_eel', 'arowana', 'golden_cownose_ray', 'ribbon_eel', 'giant_clam', 'loggerhead_turtle',
    'redtail_catfish', 'bumphead_parrotfish', 'galapagos_fur_seal', 'giant_trevally', 'wahoo', 'blue_shark', 'sturgeon', 'sawshark', 'frilled_shark', 'bluefin',
    'anglerfish', 'yellowfin_tuna', 'spotted_dolphin', 'silky_shark', 'galapagos_shark', 'arapaima', 'sea_turtle', 'oarfish', 'salp', 'sunfish',
    'steller_sea_lion', 'hammerhead', 'bottlenose_dolphin', 'marlin', 'minke_whale', 'manatee', 'whale_shark', 'walrus', 'great_white', 'blue_ringed_octopus',
    'nautilus', 'marine_iguana', 'galapagos_sea_lion', 'manta', 'swordfish', 'coelacanth', 'megamouth', 'gray_whale', 'humpback_whale', 'giant_squid',
    'japanese_sea_lion', 'sperm_whale', 'orca', 'kappa', 'rising', 'goliath_grouper', 'spotted_eagle_ray', 'sailfish', 'scalloped_hammerhead', 'pilot_whale',
    'leafy_seadragon', 'leatherback_turtle', 'napoleon_wrasse', 'mobula_ray', 'blue_marlin', 'tiger_shark', 'blue_whale', 'astral', 'beluga', 'yujin',
    'polar_bear', 'brydes_whale', 'kraken'
  ]::text[]), false);
$$;
revoke all on function private.fish_family_ok(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
