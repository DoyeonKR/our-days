/** Changed GLBs need a new cache key: sw.js intentionally serves art stale-first.
 * Hashes are of the delivered GLB bytes, not a guessed app/deployment version.
 */
export const FISH_MODEL_REVISIONS: Readonly<Record<string,string>> = Object.freeze({
 whale_shark:'c45f42015733',
 oceanic_manta:'614cceae533e',
 // 2026-11-17 떠 있던 지느러미 · 수염 · 다리 · 촉수를 몸에 붙임(floating-repair.mjs)
 altum_angel:'cb12839e5704',blue_discus:'9daf1439d243',bullhead:'a16b65b0667e',catfish:'bc30bfdd18bb',cherry_shrimp:'dfbfefc06354',coelacanth:'f7cced81fbb0',
 crown_betta:'8006fb324375',dokdo_shrimp:'524f97cb7ada',fleshy_prawn:'98083cfa8c8e',fry_angel:'a7590e67930d',fry_anglerfish:'ad39a515025c',fry_catfish:'dfbbc0aee5bf',
 fry_cherry_shrimp:'1771bca5b1ba',fry_coelacanth:'7a3e3b5a41c0',fry_dokdo_shrimp:'ed34ac436b6c',fry_fleshy_prawn:'385ebf72be4d',fry_gulper_eel:'3064930fd175',fry_guppy:'acfe3fb4ec5b',
 fry_hammerhead:'f8a79952025a',fry_jellyfish:'313d00bbe601',fry_lenok:'ea662ef6c9ae',fry_masu_salmon:'b814127fe309',fry_oarfish:'b1513d088add',fry_rising:'8dcc3542cd6a',
 fry_seahorse:'dc5067d5383e',fry_smelt:'15b2dc7622ca',fullred_guppy:'fe4c03a15f2d',genesis_fish:'70f886f3e4d3',hammerhead:'df0577fdc8c6',jellyfish:'090b7c35e524',
 juv_angel:'6aa2021b09d6',juv_astral:'b54b05b2d432',juv_bullhead:'1b4530858ad4',juv_catfish:'c65b88cd43eb',juv_cherry_shrimp:'0910fe4d1d22',juv_clown:'8daaf879d5ca',
 juv_coelacanth:'a31732140cc9',juv_dokdo_shrimp:'3423eb802643',juv_fleshy_prawn:'d5483545537d',juv_gulper_eel:'d6a3e3e73b66',juv_guppy:'730e7d32090b',juv_hammerhead:'68201f8a5081',
 juv_jellyfish:'0f728a54baa4',juv_masu_salmon:'21d7944a6e82',juv_oarfish:'eafe3db21da5',juv_smelt:'545d95bcce11',juv_sweetfish:'db23f68fd9e7',lenok:'5616279bb454',
 leopard_discus:'2dc03f7cca7b',moon_jelly:'fb473ccf69fa',mosaic_guppy:'af66393c53c4',oarfish:'ccfd9a986e49',pearl_carp:'3440a4705933',percula_clown:'58fa4a2c26ce',
 pigeon_discus:'fa54cd3233d0',platinum_angel:'16e19036a0b9',red_arowana:'3b2537b7e904',silver_angel:'f6e3c22af6fd',smelt:'0f3d2b414814',sweetfish:'dd39a7b80218',
 turquoise_discus:'2924452b5c72',tuxedo_guppy:'b6a048b8dd3a',
 // 2026-11-17 새우류 · 해파리를 원화 입체로 다시(relief-build.mjs · jelly-build.mjs)
 imugi_fish:'75bd0d776b1b',
 golden_dragonfish:'8174a89a7cb9',
 azure_dragonfish:'56a1eaafd996',
 fry_corydoras:'d899008d1dfa',juv_corydoras:'5b600651820b',
 juv_nurse_shark:'9eaa536bdf7c',fry_nurse_shark:'ec05a0ba7333',nurse_shark:'01c976ead1b3',
 molly:'b5bea7a6b915',fry_molly:'26e0586e7e0a',juv_molly:'bad8f0f2bf92',
 great_white:'614c51e92d14',juv_great_white:'796ac4c0fd46',fry_great_white:'aaa219cfcec1',
 leopard_shark:'05442349ab1c',fry_leopard_shark:'af3155d39ff0',juv_leopard_shark:'8e69f69b70d9',
 blue_shark:'92b715c4ef58',fry_blue_shark:'08194959a66a',juv_blue_shark:'b644f0116adc',
 fry_moray:'d14218b2c670',juv_moray:'197e20f10785',moray:'60a770ec3d31',
 corydoras:'84d0cc351109',fry_butterflyfish:'8ef27216e2dc',juv_butterflyfish:'1c6e2912ea50',butterflyfish:'6bad644a2249',
 fry_barracuda:'d72e86246bc9',juv_barracuda:'354c073a7b35',barracuda:'8207053b34a1',
 fry_frilled_shark:'5c580463f82b',juv_frilled_shark:'2dd008da6992',frilled_shark:'afbd12a5e186',
 // 2026-11-15 포유류 V3(네 방향 그림 → 입체) — 18모습
 fry_spotted_seal:'fa68d3fa3b2d',juv_spotted_seal:'3bc1f5d613b8',spotted_seal:'a2737e75533f',
 fry_fur_seal:'e008aaac65aa',juv_fur_seal:'9cb961f1b376',fur_seal:'26ed58f6ca81',
 fry_steller_sea_lion:'3eabb7954c1d',juv_steller_sea_lion:'5cdbf38e49d3',steller_sea_lion:'e912c8e5b672',
 fry_japanese_sea_lion:'8d7c2e91a0b0',juv_japanese_sea_lion:'ee1eb52891f6',japanese_sea_lion:'f4c4f7af857d',
 fry_sea_otter:'2202cbdaf56e',juv_sea_otter:'8d9008c66cb6',sea_otter:'e6e49c2c1160',
 fry_otter:'e569d4d046ea',juv_otter:'9b2b02ba149e',otter:'541cc7634e80',
 // 2026-11-18 고래 다섯 · 톱상어 — 가슴지느러미를 몸 밖으로 벌리고 꼬리 윗면을 등 색으로(whales/build.mjs)
 fry_minke_whale:'094d7d7fd82b',juv_minke_whale:'5da28e4b90b5',minke_whale:'5fb2fe89a218',fry_gray_whale:'664e8098f77a',juv_gray_whale:'e31beacf6436',gray_whale:'f9dc50614899',fry_humpback_whale:'07b66434abcf',juv_humpback_whale:'6c68ac1104a0',humpback_whale:'95a94d730ad5',fry_sperm_whale:'92072c39c2d6',juv_sperm_whale:'e61f420476d9',sperm_whale:'aabb90da7dfb',fry_blue_whale:'128389807ff9',juv_blue_whale:'9de94fa42a98',blue_whale:'6800e8739dbd',fry_sawshark:'3b001221d971',juv_sawshark:'598d5dd7831a',sawshark:'2ed5a2e7438f',
 // 2026-11-18 범고래 새끼 · 어린 개체 전용 모델 — 다 큰 모델에서 비율만 바꿔 다시 구움(orca-young-build.mjs)
 fry_orca:'8acf0d5ebcd3',juv_orca:'f7ef99a634e6',
 // 2026-11-18 오징어 · 대왕오징어 6모습 v3(문어 · 크라켄 v3 는 후보로만 — ceph-v3/octopus-candidates) — 그림을 세운 판 → 진짜 입체(design/aqua3d-review/ceph-v3-build.mjs, 옛 판은 ceph-v3/old)
 squid:'f0d61bb4f4ef',fry_squid:'dbb560d407e9',juv_squid:'672cb9888bb5',giant_squid:'b20f33b91910',fry_giant_squid:'49ac264f7958',juv_giant_squid:'6e5ef195a1fd',
 // 2026-11-18 게 · 바닷가재 — 다리마다 따로 걷게 다리 번호(_AQUA_PART)를 굽고, 겹친 다리 사이를 자르고 가려진 다리를 채움(crab-build.mjs · crabwalk.ts)
 fry_snow_crab:'64ac1b27db8c',juv_snow_crab:'ba52799067f7',snow_crab:'a78443b606a3',fry_king_crab:'45b0a57fefd4',juv_king_crab:'a49bb2e4c99b',king_crab:'ffa49cad52e6',fry_lobster:'96f41f943e80',juv_lobster:'b87ac4beb466',lobster:'3fffaada39d9',
 // 2026-11-18 문어 3모습 v3 2차 — 그림에서 따라 그린 팔 길 · 그림 팔 띠 · 빨판 구슬(ceph-v3-build.mjs, 옛 판은 ceph-v3/old · 크라켄은 아직 후보)
 octopus:'ed3538cb8af1',fry_octopus:'151ee01ccf72',juv_octopus:'368731f67977',
});
/** 주인 모델(public/aqua/models/boss/, 2026-11-15) — 같은 규칙(바이트 해시) */
export const BOSS_MODEL_REVISIONS: Readonly<Record<string,string>> = Object.freeze({
 boss_sanho:'865dbb2b6640',boss_geomeun:'788d7345e218',
});
export function bossRevisionQuery(key:string):string {
 const revision=BOSS_MODEL_REVISIONS[key];return revision?`?v=${revision}`:'';
}
export function fishRevisionQuery(key:string):string {
 const revision=FISH_MODEL_REVISIONS[key];return revision?`?v=${revision}`:'';
}
