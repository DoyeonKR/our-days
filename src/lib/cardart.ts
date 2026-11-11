/* 게임 탭 카드 배경 — 원화 대신 작은 사본(public/cards/, scripts/art-variants.mjs 가 굽는다). [2026-11-11]
 * 원화(낚시터 · 수조 1024×1280, 섬 마을 1195×1316)를 카드 배경으로 그대로 깔아 게임 탭을 열 때마다 0.8~1MB 를 받았다.
 * 화면 폭 카드(낚시 · 섬)는 720px, 반 칸 카드(수조)는 480px 사본이다. 원화를 바꾸면 스크립트를 다시 돌린다
 * (cardart.test 가 원화마다 사본이 있는지 본다). 게임 화면 안(낚시터 · 수조 배경)은 그대로 원화를 쓴다. */

/** 낚시터 원화 key(spot_*) → 카드 사본 */
export const fishingCardArt = (spotKey: string) => `/cards/fishing-${spotKey}.webp`;
/** 수조 원화 key(tank_N) → 카드 사본 */
export const tankCardArt = (tankKey: string) => `/cards/aqua-${tankKey}.webp`;
/** 섬 카드 — 섬 펫 무대 그림(/island/village-autumn-v1.webp)의 사본 */
export const ISLAND_CARD_ART = "/cards/island-village-autumn-v1.webp";
