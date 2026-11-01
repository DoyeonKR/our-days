/** 우리 수조의 그림 파일 — 여기 적힌 key 만 파일을 읽고, 나머지는 components/AquaArt 의 임시 그림으로 그린다(없는 파일을 요청해 404 를 내지 않게).
 *  ⚠ 손으로 고치지 않는다 — `node scripts/aqua-art-sync.mjs [그림 폴더]` 가 원본 · 화면용 사본을 굽고 이 파일을 다시 쓴다.
 *  물고기 = public/aqua/fish/<key>.webp(치어 fry_<계열> · 어린 물고기 juv_<계열> · 최종 <종>) · 악세사리 = public/aqua/decor/<key>.webp ·
 *  수조 배경 = public/aqua/tank/tank_<단계>.webp. 그릴 목록과 프롬프트는 design/AQUARIUM-ART.md, aquarium.test 가 파일과 대조한다. */
export const FISH_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
]);
export const DECOR_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
]);
export const TANK_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
]);
