/** 섬 작물 · 음식 · 생산 재료의 그림 파일(2026-10-31 — [사용자: "농작물 이미지 … 다 올라가면 상점과 실제 농작물과 음식에 다 반영해"]).
 *  여기 적힌 key 만 파일을 읽고, 나머지는 지금처럼 도트(pixelcrop) · 일러스트로 그린다(없는 파일을 매번 요청해 404 를 내지 않게).
 *  ⚠ 손으로 고치지 않는다 — `node scripts/farm-art-sync.mjs [그림 폴더]` 가 public/farm 을 훑어(그리고 폴더를 주면 거기서 가져와)
 *    원본 512px · 화면용 160px 사본을 굽고 이 파일을 다시 쓴다. 파일 이름은 key(strawberry.webp) 나 한국어 이름(딸기.png) 둘 다 된다.
 *  작물 = public/farm/crop/<key>.webp (다 자란 모습) · 음식과 생산 재료 = public/farm/food/<key>.webp. farmimages.test 가 파일과 대조한다. */
export const CROP_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
]);
export const FOOD_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
]);
