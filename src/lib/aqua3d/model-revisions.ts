/** Changed GLBs need a new cache key: sw.js intentionally serves art stale-first.
 * Hashes are of the delivered GLB bytes, not a guessed app/deployment version.
 */
export const FISH_MODEL_REVISIONS: Readonly<Record<string,string>> = Object.freeze({
 whale_shark:'c45f42015733',
 oceanic_manta:'614cceae533e',
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
 fry_spotted_seal:'c828e1336d1f',juv_spotted_seal:'b53158ce7368',spotted_seal:'e39b32845c6d',
 fry_fur_seal:'1a442b2b648b',juv_fur_seal:'4f7fe5a1fb59',fur_seal:'185ecd63178e',
 fry_steller_sea_lion:'f8179fe04a91',juv_steller_sea_lion:'d54b107219b9',steller_sea_lion:'f87b60ca9f2d',
 fry_japanese_sea_lion:'eef92c3f670a',juv_japanese_sea_lion:'a1454c82204e',japanese_sea_lion:'ad5e44b0016f',
 fry_sea_otter:'983c226b8a33',juv_sea_otter:'62417a0bda85',sea_otter:'fde7ebd7da79',
 fry_otter:'0b44aa44ef33',juv_otter:'37d609359971',otter:'e2681cba3552',
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
