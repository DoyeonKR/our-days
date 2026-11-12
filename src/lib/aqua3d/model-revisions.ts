/** Changed GLBs need a new cache key: sw.js intentionally serves art stale-first.
 * Hashes are of the delivered GLB bytes, not a guessed app/deployment version.
 */
export const FISH_MODEL_REVISIONS: Readonly<Record<string,string>> = Object.freeze({
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
});
export function fishRevisionQuery(key:string):string {
 const revision=FISH_MODEL_REVISIONS[key];return revision?`?v=${revision}`:'';
}
