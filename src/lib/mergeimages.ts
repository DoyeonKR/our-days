/** 정원 합치기 타일의 그림 파일(public/merge/<key>.webp)이 **있는** 단계 — 여기 적힌 key 만 파일을 읽고,
 *  나머지는 MergeArt 의 벡터 그림으로 그린다(없는 파일을 매번 요청해 404 를 내지 않게).
 *  그림을 넣는 법: public/merge/<key>.webp (512×512, 투명 배경) 를 넣고 아래 목록에 key 를 더한다.
 *  key 는 lib/merge.ts 의 CHAIN 과 같다 — merge.test 가 파일이 실제로 있는지 대조한다. */
export const MERGE_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([
  "lettuce",
  "carrot",
  "strawberry",
  "corn",
  "shiitake",
  "ginseng",
  "matsutake",
  "saffron",
  "black_truffle",
  "ruby_grape",
  "white_truffle",
  "wild_ginseng",
  "lingzhi",
]);
