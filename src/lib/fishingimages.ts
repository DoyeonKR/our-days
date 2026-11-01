/** 낚시 그림 파일 — 여기 적힌 key 만 파일을 읽고, 나머지는 임시 그림(낚시터 = CSS 하늘 · 물 / 장비 = 이름 상자)으로 그린다.
 *  ⚠ 손으로 고치지 않는다 — `node scripts/fishing-art.mjs sync [그림 폴더]` 가 public/fishing 에 굽고 이 파일을 다시 쓴다.
 *  그릴 목록과 프롬프트는 design/FISHING-ART.md. fishing.test 가 파일과 대조한다. */
export const FISHING_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
]);
