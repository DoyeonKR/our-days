// 계보 30폼 도트 — 몸통(48칸 × 44행) 표 + 팔레트 + 걷기·수면 조립. [2026-10-04 펫 개편, docs/PET-LINEAGES.md]
//
// 이 파일의 몸통 행은 도형으로 초안을 뜨고(타원 · 다각형 · 선 + 광원 좌상단 5톤 명암 + 바깥 외곽선) PNG 로 구워
// 눈으로 확인한 뒤 row() 런으로 옮긴 결과다(README §10.8 방식 — 숫자로만 맞춘 그림은 '규격은 맞는데 못생긴' 걸
// 못 잡는다). **진화마다 몸 구조가 바뀐다**: 크기만 키우고 장식을 얹은 1차판은 퇴짜 맞았다
// [사용자: "진화해도 크기만 달라지지 모습이 바뀌지가 않아"]. 계보마다 알 모양 → 날씬하게 선 모습 → 날개·갑옷·망토 같은
// 실루엣으로 갈린다(불꽃: 불씨 → 도롱뇽 → 날개 용 / 풍뎅이: 굼벵이 → 둥근 딱정벌레 → 딱지날개 전사 …).
//
// 규약(기존 전용 골격 TIGER_BODY · DRAGON_BODY 와 같다):
//   · 몸통은 0~43행. 44~47행은 비운다 — 다리는 공용 feet()(걷기 6프레임·벌어짐·한쪽 발 들기)가 채운다.
//     43행에 잉크가 있어야 다리와 이어진다.
//   · 눈은 얼굴 크롭 창(행 0~29 · x 6~41) 안에 둔다 — 작은 아이콘이 얼굴만 잘라 쓴다(PetPixel FACE).
//   · 글자: o 외곽선 · H b B d D 몸 램프 · c C 배 · A a 마킹 · f F h / r R t / u U v 강조 램프 셋 · e w L 눈 · p 볼 ·
//     n 코 · m 입 · q Q 부리 · g s 반짝임. 어느 글자가 무슨 색인지는 폼마다 pal(아래 표)이 정한다.
//   · 장식(heroIdentity)·왕관(crowned)은 안 얹는다 — 실루엣이 이미 단계마다 다르다.
// ⚠ 이 행들은 손으로 점을 센 게 아니다. 고칠 땐 행을 통째로 갈아라(같은 방법으로 다시 굽는 게 제일 싸다).
// ⚠ 새 폼을 넣으면 lineages.ts 표와 lineage.test(레지스트리 순회: 걷기 · 앵커 · 얼굴 창 · 장비 겹침 · 정의된 글자)가 같이 본다.

import { type Palette, type Sprite, ramp } from "./pixel.ts";
import { CURL, EMPTY, bodyFrames, bottomAlign, row } from "./pixelpet48.ts";
import { LINEAGE_OF_FORM } from "./lineages.ts";

type Tri = readonly [string, string, string];
export type LineagePal = { body: Tri; belly?: Tri; mark?: Tri; a1?: Tri; a2?: Tri; a3?: Tri; beak?: Tri; eye?: string };
type FormArt = { pal: LineagePal; body: readonly string[] };
export type LineageArt = { fur: string; pad: string; forms: readonly [FormArt, FormArt, FormArt] };

/** 폼 팔레트 — 기본 글자(몸 · 배 · 마킹 · 눈 · 볼 …)에 강조 램프 셋(f F h / r R t / u U v)을 얹는다.
 *  기존 petPalette 와 같은 5톤 램프(ramp)를 쓴다 — 색상 이동(밝은 쪽 따뜻하게 · 그늘 차갑게)까지 한 문법이다. */
export function lineagePalette(spec: LineagePal): Palette {
  const B = ramp(spec.body);
  const C = ramp(spec.belly ?? spec.body);
  const M = ramp(spec.mark ?? spec.body);
  const out: Palette = {
    o: B.o, H: B.H, b: B.b, B: B.B, d: B.d, D: B.D,
    c: C.b, C: C.d,
    i: "#ffb894",
    e: spec.eye ?? "#2b2440", w: "#fffdf7", L: "#ffffff", p: "#ff9fb8",
    n: B.D, m: B.o, y: C.d,
    A: M.B, a: M.D,
    q: "#ffc93f", Q: "#e0a02e",
    k: "#ffd75e", K: "#c8901c", g: "#8fe3ff", s: "#fff3b0",
  };
  const accents: [Tri | undefined, string][] = [[spec.a1, "fFh"], [spec.a2, "rRt"], [spec.a3, "uUv"]];
  for (const [tri, names] of accents) {
    if (!tri) continue;
    out[names[0]] = tri[0]; out[names[1]] = tri[1]; out[names[2]] = tri[2];
  }
  if (spec.beak) { const Q = ramp(spec.beak); out.q = Q.B; out.Q = Q.d; }
  return out;
}

/** 불꽃 도롱뇽 — 성장기(ember_2). */
const EMBER_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([23, "o"]),
  row([22, "ofo"]),
  row([22, "offo"]), // 10
  row([21, "offfo"]),
  row([21, "oFFFo"]),
  row([21, "oFFFFo"]),
  row([20, "oFFFFFo"]),
  row([20, "oFFFFFFo"]),
  row([19, "oFFFFFFFo"]),
  row([19, "oFFFFFFFo"]),
  row([20, "ohhhhhho"]),
  row([19, "oohhhhhhoo"]),
  row([18, "obbbbbbbbbbo"]), // 20
  row([16, "ooHHHHbbbbbbbboo"]),
  row([15, "obHHHHHHbbbbbbbBBo"]),
  row([11, "o..oboooooHbbbbbboooooo..oooooo"]),
  row([6, "oooooFooooowwwoobbbbboowwwooooFFFFffo"]),
  row([5, "ofFFFFFhhHowLLwwobbbbbowLLwwohhFFFFFo"]),
  row([6, "oFFFFFhhHowLeewobbbbbowLeewohhFFFFo"]),
  row([7, "ooFFhhbHowweeeobbbbbowweeeohhhFFo"]),
  row([9, "oFhhbbHoweeobbbbbbboweeoBdhhFo"]),
  row([9, "ooooppbbooobbbbbbbbboooppdooooo"]),
  row([7, "ooFFhhbbbbbbbbmbbbbmbBBBBBddhhFFFoo"]), // 30
  row([4, "oooFFFFhhbbbbbbbbcmmmmcBBBBBddhhhFFFFfo"]),
  row([3, "offfFFFFhhhbbbbbccccccccccBBBddhhhFFFFffo"]),
  row([4, "ooooFFFhhBdbbbbccccccccccBBddbbhhFooooo"]),
  row([8, "oobbBBdbbbccccccccccccdddbbbBdFffo"]),
  row([10, "oBddbbbbccccccccccccddddBBdFFFo"]),
  row([11, "ooobbbbccccccccccccdddDFFFFFo"]),
  row([13, "oBBBBccccccccccccdddDFFFFo"]),
  row([14, "oBBBccccccccccccddDhhFFFo"]),
  row([14, "oBBBBccccccccccddDDhhhFo"]),
  row([15, "odBBccccccccccdDDohhho"]), // 40
  row([16, "oodddccccccdDDoo.ooo"]),
  row([18, "odddddddDDDo"]),
  row([19, "oooooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 불꽃 도롱뇽 — 중간형(ember_3). */
const EMBER_3: readonly string[] = [
  row([23, "o"]), // 0
  row([22, "ofo"]),
  row([22, "offo"]),
  row([21, "oFFFo"]),
  row([20, "oFFFFFo"]),
  row([20, "oFFFFFFo"]),
  row([4, "ooooooooo"], [20, "oFFFFFFo"], [35, "ooooooooo"]),
  row([3, "offFFFFFFFoo"], [20, "ohhhhhho"], [33, "ooFFFFFFFffo"]),
  row([4, "oFFFFFFFFhho..ooHHbbbbbboo..ohhFFFFFFFoo"]),
  row([5, "oFFFFFFFhhhooHHHHHbbbbbbBoohhhFFFFFFo"]),
  row([6, "oFFFFFhhhhoHHHHHHbbbbbbBBohhhhFFFFo"]), // 10
  row([7, "oFFFFhhhoHHHHHHbbbbbbbBBBhhhhFFFo"]),
  row([8, "ooFhhhhbooooobbbbbbooooodhhhhFooo"]),
  row([7, "ooFFhhhhoowwwoobbbboowwwoohhhhFFFFoo"]),
  row([4, "oooFFFFhhhhowLLwwobbbbowLLwwohhhhFFFFFFoo"]),
  row([0, "ooooFFFFFFFhhhhowLeewobbbbowLeewohhhhFFFFFFFfoo"]),
  row([0, "ffffFFFFFFFhhhhowweeeobbbbowweeeohhhhFFFFFFFfffo"]),
  row([0, "ooooFFFFFFFhhhhboweeobbbbBBoweeodhhhhFFFFoooooo"]),
  row([4, "oooFFFFFhhhbbooobbbccBBBoooddhhhFFFoo..ofo"]),
  row([7, "oooFhhhhBbbbbccccccccddddDhhhhFo"], [43, "ofo"]),
  row([8, "oFFFhhhhBBBcccmccmcccddDhhhhFFFo..offfo"]), // 20
  row([7, "oFFFFhhhhhBBccccmmccccdDhhhhhFFFFo.oFFFo"]),
  row([7, "oFFFFFhhhoodBccccccccDDoohhhFFFFFFoFFFFo"]),
  row([6, "oFFFFFFhoo..oHdddccddDBo..oohFFFFFFFFFFFo"]),
  row([5, "oFFFFFFFo"], [17, "oHHHHHccbbbbBo"], [34, "oFFFFFFFFFFFFo"]),
  row([4, "ofFFFFooo..oobHHHHccccbbbBBo"], [35, "oooooFFffFFFo"]),
  row([3, "offFooo"], [14, "obbHHHHccccccbbBbbo"], [40, "oFFffFFo"]),
  row([4, "ooo"], [13, "obbbHHHccccccccbBbbbo"], [40, "oFFFFFFF"]),
  row([12, "obbbbHHHcCCCCCCcBBBbbbo"], [40, "ohhhhhhh"]),
  row([12, "obbobHHHccccccccBBBdbbo"], [40, "ohhhhhho"]),
  row([11, "obbbobbbbccccccccBBBdbbbo"], [40, "ohhhhhho"]), // 30
  row([10, "obbbobbbbccCCCCCCccBBddbbboo"], [41, "oBBhhho"]),
  row([9, "obbboobbbbccccccccccBdddobbbbo..oBBdoo"]),
  row([8, "oHbbo.obbbbccccccccccBdddoobHbbo.oBBBo"]),
  row([7, "obbbBdoobbbbccCCCCCCccBddDoobbbBdoBBBdo"]),
  row([8, "oBBdo..obbbccccccccccdddo..oBBdooBBBdo"]),
  row([9, "oDo"], [15, "obbbccccccccccdddo"], [36, "oDooBBBdo"]),
  row([10, "o"], [15, "obbbbcCCCCCCcdddDo"], [37, "ooBBBBdo"]),
  row([15, "oBBBBccccccccdddDo"], [36, "ooBBBBdo"]),
  row([16, "oBBBccccccccddDoooooBBBBddo"]),
  row([16, "oBBBcCCCCCCcdDDBBBBBBBBddo"]), // 40
  row([17, "oBBBccccccdDDBBBBBBddddo"]),
  row([18, "odddccccdDDddddddddooo"]),
  row([19, "odddccdDDooooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 불꽃 도롱뇽 — 최종형(ember_4). */
const EMBER_4: readonly string[] = [
  row([23, "o"]), // 0
  row([11, "o"], [22, "ofo"], [36, "o"]),
  row([10, "oroo"], [22, "offo"], [34, "ooro"]),
  row([10, "oRRRo"], [21, "oFFFo"], [33, "oRRRo"]),
  row([11, "oRRRo"], [20, "oFFFFFo"], [32, "oRRRo"]),
  row([12, "oRRRo"], [20, "oFFFFFFo"], [31, "oRRRo"]),
  row([12, "oRRRRo..oFFFFFFo..oRRRo"]),
  row([13, "oRRtto.ohhhhhhooottRo"]),
  row([0, "o"], [14, "ottttoohhhhhhotttto"]),
  row([0, "fo"], [15, "ottoHHHbbbbbbbtto"], [46, "o"]),
  row([0, "ofo"], [16, "oHHHHHHbbbbbbbBo"], [45, "ofo"]), // 10
  row([0, "offo"], [15, "oHHHHHHbbbbbbbbBBo"], [43, "oofo"]),
  row([1, "offo"], [14, "oHoooooHbbbbboooooBo"], [42, "offfo"]),
  row([1, "offfo"], [13, "oboowwwoobbbboowwwoodo"], [41, "oFffo"]),
  row([2, "ofFFo"], [13, "obowLLwwobbbbowLLwwodo"], [39, "ooFFFo"]),
  row([2, "oFFFFoo"], [13, "obowLeewobbbbowLeewodo"], [38, "oFFFFFo"]),
  row([3, "oFFFFFo"], [13, "obowweeeobbbbowweeeodo..oFFFFFo"]),
  row([2, "ooFFFFFFoo.obboweeobbbbbBoweeoddoooFFFFFFooo"]),
  row([1, "offoFFFFFFFoobbbooobbbbbBBBooodddoFFFFFFFofffo"]),
  row([2, "offFFFFFFFFobbbbbbbccccccBBddddDFFFFFFFFFffo"]),
  row([3, "ofFFFFFFFFFBbbbbccccccccccddddDFFFFFFFFFfo"]), // 20
  row([3, "oFFFFFFFFFFhBBBcccmccccmcccddDhFFFFFFFFFo"]),
  row([4, "oFFFFFFFFFhhBBccccmmmmccccDDhhFFFFFFFFo"]),
  row([5, "oFFFFFFFhhhodBwccccccccwDDohhhFFFFFFo"]),
  row([2, "ooooFFFFFFFhhhhooddccccccDDoohhhhFFFFFFFooo"]),
  row([1, "offffFFFFFFhhhhhhHHHHbbbbbbbBhhhhhhFFFFFFfffo"]),
  row([2, "ooffFFFFFFhhhhhHHHHHHbbbbbbbBhhhhhFFFFFFfoo"]),
  row([4, "ofFFFFFFhhhoHHHHHHbbbbbbbbBBhhhhFFFFFoo"]),
  row([5, "ooFFFFFFhhHHHHHHccccccbbbBBBhhFFFFFo"], [46, "o"]),
  row([7, "oFFFFFhbHHHHHccccccccbbBBBdhFFFFFo"], [45, "ofo"]),
  row([7, "oFFFFFFbHHHHccccccccccbBBBdFFFFFFFo..offo"]), // 30
  row([6, "ofFFFFFbbbHbccCCCCCCCCccBBBddFFFFFfo.oFFFo"]),
  row([5, "offFFHHbbbbbbccccccccccccBBBdHHbboFffoFFFFo"]),
  row([6, "oooHHbbbBbbccccccccccccccBdHHbbbBoooFFFFFF"]),
  row([8, "obbbbBdbbcccCCCCCCCCcccBdbbbbBdo.oFFFFFF"]),
  row([8, "obbBBddbbccccccccccccccddbbBBddo.ohFFFFF"]),
  row([9, "oBBddbbbccccccccccccccdddBBddo..ohhhhhF"]),
  row([10, "oooobbbcccCCCCCCCCcccdddoooo"], [41, "ohhhhhh"]),
  row([13, "oBBbbccccccccccccdddDo"], [40, "obBBhhhh"]),
  row([14, "oBBBccccccccccccddDo"], [39, "oBBBBoooo"]),
  row([15, "oBBBcCCCCCCCCcddDoooooooBBBBo"]), // 40
  row([16, "oBBBccccccccdDDoBbbBBBBBBdo"]),
  row([17, "odddccccccdDDooBBBBBBddoo"]),
  row([18, "oooddddDDooo..oooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 번개 새 — 성장기(volt_2). */
const VOLT_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([22, "o"]),
  row([21, "ofo"]), // 10
  row([21, "ofo"]),
  row([22, "oFo"]),
  row([20, "oooFFo"]),
  row([19, "oFFFFFFo"]),
  row([20, "oFFFFFFo"]),
  row([20, "oFFFFoo"]),
  row([20, "oFFFFo"]),
  row([21, "ohhho"]),
  row([21, "ohhhho"]),
  row([18, "ooobbbbbbooo"]), // 20
  row([17, "obHHHbbbbbbbBo"]),
  row([15, "ooHHHHHHbbbbbbbBoo"]),
  row([14, "ooooooHHHbbbbboooooo"]),
  row([13, "ooowwwooHbbbbboowwwooo"]),
  row([13, "oowLLwwoHbbbbbowLLwwoo"]),
  row([13, "oowLeewobbbbbbowLeewoo"]),
  row([12, "obowweeeobbbbbbowweeeodo"]),
  row([12, "obboweeobbbbbbbboweeoBdo"]),
  row([11, "oHbbbooobbccccccbboooBdHbo"]),
  row([10, "oHHppbbbbbccqqqqccBBBBBppbbo"]), // 30
  row([9, "obHbbbdbbcccccqqcccccBBbHbbbdo"]),
  row([9, "obbbbBdbbcccccqqcccccBBbbbbBdo"]),
  row([9, "obbbbBdbcccccccccccccCdbbbbBdo"]),
  row([9, "obbbBBdbcccccccccccccCdbbbBBdo"]),
  row([9, "oBbBBdDbccccccccccccCCdBbBBdDo"]),
  row([10, "oBBddbbcccccccccccCCCddBBddFo"]),
  row([11, "oddBBBccccccccccCCCCdDDddFo"]),
  row([12, "oooBBBccccccccCCCCddDooFFo"]),
  row([15, "oBBcccccccCCCCCDDo.oFo"]),
  row([16, "odddccCCCCCCdDDo.oFo"]), // 40
  row([17, "odddCCCCCCDDDo"], [34, "o"]),
  row([18, "oooddddDDooo"]),
  row([21, "oooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 번개 새 — 중간형(volt_3). */
const VOLT_3: readonly string[] = [
  EMPTY, // 0
  row([22, "o"]),
  row([21, "ofo"]),
  row([22, "ofo"]),
  row([21, "ooFFo"]),
  row([20, "oFFFFFo"]),
  row([16, "o"], [20, "oFFFFFFo"], [31, "o"]),
  row([14, "ooFo"], [21, "oFFFoo"], [30, "oFoo"]),
  row([13, "oFFFFo..ohhhoo..oFFFFo"]),
  row([14, "oFFFFoobhhhhbooFFFFo"]),
  row([14, "oFFFbHHHbbbbbbbBFFFo"]), // 10
  row([15, "ohhHHHHHbbbbbbbhho"]),
  row([15, "oHHHHHHbbbbbbbbBBo"]),
  row([14, "oHHHHHHHbbbbbbbbBBBo"]),
  row([13, "obHooooobbbbbboooooBdo"]),
  row([13, "oboowwwoobbbboowwwoodo"]),
  row([13, "obowLLwwobbbbowLLwwodo"]),
  row([13, "obowLeewobbbbowLeewodo"]),
  row([12, "obbowweeeobbbbowweeeodDo"]),
  row([13, "obboweeobbbbbBoweeoddo"]),
  row([13, "obbbooobbbbBBBBooodddo"]), // 20
  row([12, "oppbbbbbbbqqqqBBBdddppo"]),
  row([13, "oBbbbbbBBqqqqBBdddddDo"]),
  row([14, "oBBBBBBBBqqBddddddDo"]),
  row([15, "oBBBBBBBqqddddddDo"]),
  row([14, "oBoBBBBBdddddddDDoHo"]),
  row([13, "obboHddddddddddDDBbHHo"]),
  row([11, "oobbbBHHHHddddDDbbBBbHHbo"]),
  row([10, "oHHbbbBHHHHccccccbbBBHHHbboo"]),
  row([9, "ofHbbbbBHHHccccccccBBBHHbbbbfo"]),
  row([10, "oHbbbbBbbbccccccccBBBHHbbbbfo"]), // 30
  row([10, "obbbbBBbbbccccccccBBBbbbbbBo"]),
  row([10, "obbbbBBbbcccccccccCBBbbbbbBo"]),
  row([10, "obbbbBBbbcccccccccCBdbbbbbBo"]),
  row([9, "obbbbBBdbbcccccccccCBdbbbbBBdoo"]),
  row([8, "oFbbbbBBdbbcccccccccCddbbbbBBdFFo"]),
  row([9, "obbbBBBdbbccccccccCCddbbbBBBdFo"]),
  row([9, "obbbBBdbbbccccccccCCddbbbBBddo"]),
  row([10, "obBBBdBBBcccccccCCCddDbBBBdo"]),
  row([10, "oBBBdooBBBccccccCCddDooBBddo"]),
  row([10, "oBBBFooBBBcccccCCCdDDooBBddo"]), // 40
  row([11, "oBdFFooBBccccCCCCDDo.oFddo"]),
  row([11, "odooho.oddCCCCCCDDo..ohodo"]),
  row([12, "o..o"], [19, "oddCCCCDDo..oho.o"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 번개 새 — 최종형(volt_4). */
const VOLT_4: readonly string[] = [
  EMPTY, // 0
  row([22, "o"]),
  row([21, "ofo"]),
  row([15, "o"], [22, "oFo"], [32, "o"]),
  row([12, "o.ofo"], [20, "oooFFo"], [31, "ofo.o"]),
  row([11, "ofo.ofo.oFFFFFFo"], [30, "ofo.ofo"]),
  row([4, "o"], [11, "ofoooFFo.oFFFFFFo.oFFooofo"], [43, "o"]),
  row([3, "ofo"], [11, "oFoFFFFFooFFFFoo.oFFFFFoFo"], [42, "ofo"]),
  row([3, "ofo"], [11, "oFoFFFFFFoFFFFo.oFFFFFFoFo"], [42, "ofo"]),
  row([4, "ofo"], [11, "oFFoFFFoo.ohhhho.ooFFFoFFo"], [41, "ofo"]),
  row([4, "ofFo"], [11, "oFFohhho.oohhhhoo.ohhhoFFo"], [40, "oFfo"]), // 10
  row([4, "oFFo"], [11, "oFFohhhhobHbbbbbbohhhhoFFo"], [40, "oFFo"]),
  row([5, "oFFo..oFFooooHHHHHbbbbbbBooooFFo..oFFo"]),
  row([1, "o"], [5, "oFFo..obbbooHHHHHHbbbbbbBBoobbbo..oFFo"], [46, "o"]),
  row([0, "ofo..oFFFo.obbbobooooobbbbboooooobbbo.oFFFo..ofo"]),
  row([1, "ofo..oFFboobbbooowwwoobbboowwwoobbboobFFo..ofo"]),
  row([1, "offo.obbboobbbbowLLwwobbbowLLwwobbboobbbo.offo"]),
  row([2, "oFFoobbbbobbbbowLeewobbbowLeewobbbobbbbooFFo"]),
  row([3, "oFFoobbbobbbbowweeeobbbowweeeobbbobbbooFFo"]),
  row([3, "oFFFobbbbbbbbboweeobbbBBoweeodbbbbbbboFFFo"]),
  row([4, "oFFbbbbbbbbBbbooobbbBBBBooodDbbbbbbbbFFo"]), // 20
  row([4, "oFbbbbbbbbbbbbbbbbBBBBBBdddDbbbbbbbbbbFo"]),
  row([2, "o..obbbbbbbbbbBBBBBBqqqqdddddDbbbbbbbbbbo..o"]),
  row([1, "ofoooobbbbbbbbbbBBBBBqqqqdddDDbbbbbbbbbboooofo"]),
  row([2, "oFFFobbbbbbbbbbodBBddqqdddDDobbbbbbbbbboFFFo"]),
  row([3, "oFFFbbbbbbBBBBobbdddqqdDDdDoBBBBbbbbbbFFFo"]),
  row([4, "oFbbbbbbBBBBBBobbbbbBBBddoBBBBBBbbbbbbFo"]),
  row([5, "obbbbbBBBBBBBobbbBBBBdddoBBBBBBBbbbbbo"]),
  row([6, "obbbbBBBBBBBHHBBBBBdddbBBBBBBBBbbbbo"]),
  row([7, "obbbBBBBBBHHHHdddddDbbBBBBBBBBbbbo"]),
  row([7, "ooobbbBBBHHHHHccccccbbBBBBBBbbbooo"]), // 30
  row([4, "ooobbffffBBBHHHHccccccccbBBBBBBffffbbooo"]),
  row([1, "oooFFFbbfffffBbHHHccccFFFcccBBBdBfffffbbFFFoo"]),
  row([0, "offfFFFbbbFfffBbbbbccccFFFcccBBBdBfffFbbbFFFffo"]),
  row([1, "oooooooooFFFfobbbcccccFFccccCBddofFFFoooooooo"]),
  row([10, "oFFFbbbbccccFFFFFccCBddDFFFo"]),
  row([8, "oooFFFFbbbccccFFFFFcCCdddFFFFooo"]),
  row([7, "oFFFFFFFbbbccccccFFccCCdddFFFFFFFo"]),
  row([8, "oFFFFFFbbbccccccFccCCCddDFFFFFFo"]),
  row([8, "oFFFFFFFBbbccccFccCCCdddFFFFFFFo"]),
  row([9, "oFFFoooBBBccccccCCCCddDoooFFFo"]), // 40
  row([10, "oFFo..oBBBcccCCCCCdDDo..oFFo"]),
  row([11, "oFo"], [17, "odddCCCCCCdDDo"], [34, "oFo"]),
  row([12, "oho"], [18, "ooddddddDDoo"], [33, "oho"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 밤송이 고슴도치 — 성장기(burr_2). */
const BURR_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  row([29, "ooo"]),
  row([28, "oRrroo"]),
  row([27, "oRRrrrro"]),
  row([26, "oRRRrrro"]),
  row([25, "otRRRRro"]),
  row([23, "oottRRRRo"]),
  row([22, "obttttRRo"]),
  row([21, "obbbbttRo"]), // 10
  row([19, "ooHHbbbboo"]),
  row([18, "oHHHHbbbbbo"]),
  row([18, "oHHHbbbbbbbo"]),
  row([17, "oHHHHbbbbbbbbo"]),
  row([16, "oHHHHHbbbbbbbbo"]),
  row([16, "oHHHHbbbbbbbbbBo"]),
  row([15, "oHHHHHbbbbbbbbbBBo"]),
  row([14, "oHHHHHbbbbbbbbbbBBo"]),
  row([14, "oHHHHbbbbbbbbbbbBBBo"]),
  row([14, "oHHHbbbbbbbbbbbBBBBo"]), // 20
  row([14, "obbbbbbbbbbbbbbBBBBo"]),
  row([13, "obbbbbbbbbbbbbbbBBBBdo"]),
  row([13, "obbbooooobbbbboooooBdo"]),
  row([13, "obboowwwoocccoowwwoodo"]),
  row([12, "obbbowLLwwocccowLLwwoddo"]),
  row([12, "obbbowLeewocccowLeewoddo"]),
  row([12, "obbbowweeeocccowweeeoddo"]),
  row([12, "obbbcoweeocccccoweeodddo"]),
  row([12, "obbcccoooccnncccoooccddo"]),
  row([12, "obbcccccccnnnncccccccdDo"]), // 30
  row([12, "obbccccccccccccccccccdDo"]),
  row([12, "oBbccccccccccccccccccdDo"]),
  row([12, "oBBccccccmcmmcmccccccDDo"]),
  row([12, "oBBcccccccmccmcccccccDDo"]),
  row([13, "oBBccccccccccccccccDDo"]),
  row([13, "oBBccccccccccccccccDDo"]),
  row([13, "ooBBccccccccccccccDDoo"]),
  row([12, "occcBBccccccccccccDDccco"]),
  row([11, "occcccdBBccccccccdDDccccco"]),
  row([11, "occcccdddddddddddDDDccccco"]), // 40
  row([11, "occcccooodddddddDoooccccco"]),
  row([12, "occco"], [20, "oooddooo"], [31, "occco"]),
  row([13, "ooo"], [23, "oo"], [32, "ooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 밤송이 고슴도치 — 중간형(burr_3). */
const BURR_3: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([18, "o"], [23, "oo"], [29, "o"]),
  row([17, "ofo..oAAo..ofo"]), // 10
  row([13, "oo..oAAo.oAAo.oAAo..oo"]),
  row([12, "ofAoooAAAoAAAAoAAAoooAfo"]),
  row([8, "o"], [12, "oAAAAoAAAAAAAAAAAAoAAAAo"], [39, "o"]),
  row([7, "ofooooAAAAAaaaaaaaaaaaaaAAAAoooofo"]),
  row([8, "ofAAooAAaaaaaooooooaaaaaAAooAAfo"]),
  row([8, "oAAAAaaaaaAAAAAAAAAAAAaaaaaAAAAo"]),
  row([5, "oooooAAAaaaAAAAAAAAAAAAAAAAaaaAAAooooo"]),
  row([4, "offAAoAAaaAAAAAAAAAAAAAAAAAAAAaaAAoAAffo"]),
  row([5, "oAAAAaaaAAAAAAAAAAAAAAAAAAAAAAaaaAAAAo"]),
  row([6, "oAAAaaAAAAAAAAAAAAAAAAAAAAAAAAaaAAAo"]), // 20
  row([5, "ooAAaaAAAbbAAAAAAAAAAAAAAAAbbAAAaaAAoo"]),
  row([3, "ooAAAAaaAAHbbbAAAAAAAAAAAAAAHbbbAAaaaAAAoo"]),
  row([2, "ofAAAAaaAAbbbbBdAAAAAAAAAAAAbbbbBdAAaaAAAAfo"]),
  row([3, "ooAAAaaAAbbbBBooooocccccooooobBBdAAaaAAAoo"]),
  row([5, "oAAaAAAABBBoowwwoocccoowwwooBdAAAAaaAo"]),
  row([2, "oooAAaaAAAAAddowLLwwocccowLLwwodAAAAAaaAAooo"]),
  row([1, "ofAAAAaaAAAAAAAowLeewocccowLeewoAAAAAAaaAAAAfo"]),
  row([2, "oAAAAaaAAAAAAAowweeeocccowweeeoAAAAAAaaAAAAo"]),
  row([2, "ofAAAaaAAAAAAccoweeocccccoweeocAAAAAaaaAAAfo"]),
  row([3, "oAAAaaAAAAAAcccooocccccccoooccAAAAaaaaAAAo"]), // 30
  row([4, "oAAaAAAAAAAccccccccnnccccccccAAAaaaaaAao"]),
  row([4, "oAAaAAAAAAccccccccnnnnccccccccAaaaaaaaao"]),
  row([5, "oAaAAAAAAAccccccccccccccccccAaaaaaaaao"]),
  row([5, "oAaAAAAAAAccccccccccccccccccaAaaAaaaAo"]),
  row([3, "ooAAaAAAAAAAccccccmcmmcmccccccAaaAaaaaAAoo"]),
  row([2, "offAAaAAAAAAAAccccccmccmccccccaaaaaaaaaAAffo"]),
  row([3, "oooAaaAAAAAAAccccccccccccccccaaaaaaaaaAooo"]),
  row([6, "oooAAAccccAccccccccccccccaccccaaaooo"]),
  row([7, "oaaoccccccAAccccccccccaaccccccoaao"]),
  row([6, "oAAaoccccccaaaaccccccaaaaccccccoaAAo"]), // 40
  row([6, "oAAaaccccccaaaaaaaaaaaaaaccccccaaAAo"]),
  row([5, "ofAAAaoccccoaaaaaaaaaaaaaaoccccoaAAAfo"]),
  row([6, "ooooo.oooo.oooooooooooooo.oooo.ooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 밤송이 고슴도치 — 최종형(burr_4). */
const BURR_4: readonly string[] = [
  EMPTY, // 0
  row([22, "oooo"]),
  row([21, "oAAAAo"]),
  row([20, "oAAAAAAo"]),
  row([20, "oAAAAAAo"]),
  row([15, "oooooAAAfAAAaooooo"]),
  row([6, "o"], [14, "oAAAAoAAAAAAaaoAAAAo"], [41, "o"]),
  row([5, "oro"], [13, "oAAAAAAAAAAAAaAAAAAAAo"], [40, "oro"]),
  row([6, "oroo..ofAAfAAAAAAAaaaAAAfAAAfo..ooro"]),
  row([6, "oRRRo.oAAAAAAaAAaaaaAAAAAAAaAo.oRRRo"]),
  row([7, "oRRtooAAAAAAaAAAAAAAAAAAAAaAootRRo"]), // 10
  row([7, "oRtttAAAAAAaaAaaaaaAAAAAAaaAttttRo"]),
  row([6, "ofottAAAbbaaabHHbbbbbbbaaabbAAAttofo"]),
  row([6, "ofAtoAAHHbBHHHHHHbbbbbbbBHHbBAAotAfo"]),
  row([4, "o..oAAAAbbbbBdHHHHHbbbbbbbbbbbBdAAAAo..o"]),
  row([3, "ofooooAAAbbbBBDHHHHbbbbbbbbbbbBBDAAAoooofo"]),
  row([4, "ofAAAAAAaBBddHHHHbbbbbbbbbBBBddaAAAAAAfo"]),
  row([5, "oAAAAAaAAdDooooobbbbbbooooodDAAaAAAAAo"]),
  row([3, "ooooAAAAAAbboowwwoobbbboowwwooddAaAAAAoooo"]),
  row([2, "offAAAAAaAAbbowLLwwoccccowLLwwoddAAaAAAAAffo"]),
  row([3, "ooAAAAAAAAbbowLeewoccccowLeewoddAAaAAAAAoo"]), // 20
  row([2, "ooooAAAaAAAbbowweeeoccccowweeeoddAAaaAAAoooo"]),
  row([1, "offAAAAAaAAAbbboweeoccccccoweeodddAAaaAAAAAffo"]),
  row([2, "ofAAAAAAAAAbbbcoooccccccccooocddDAaaaAAAAAfo"]),
  row([3, "ooAAAAAAAAAbbcccccccnncccccccdDAAaaaAAAAoo"]),
  row([1, "oooAAAAaAAAAABBccccccnnnnccccccdDAaaaaAAAAAooo"]),
  row([0, "offfAAAAAAAAAAABccccccccccccccccDAAaaaaAAAAAfffo"]),
  row([1, "oooAAAAaAAAAAAABccccccccccccccDAAaaaaaAAAAAooo"]),
  row([2, "oAAAAAaAAAAAAAAdcccmcmmcmcccDAAAaaaaaAAAAAAo"]),
  row([2, "oAAAAAoAAAAAAAAAccccmccmccccAAAaaaaaaoAAAAAo"]),
  row([2, "oAAAAaccAAAAAAAccccccccccccccAaaaaaaccAAAAao"]), // 30
  row([2, "oAAAaaccccAAAAccccccccccccccccaaaaccccAAAaao"]),
  row([3, "oaaacccccAAAccccccccccccccccccaaacccccaaao"]),
  row([4, "occccccccAAccccccccccccccccccaacccccccco"]),
  row([5, "occccccAAccccccccccccccccccccaacccccco"]),
  row([5, "occccccAAccccccccccccccccccccaacccccco"]),
  row([6, "ooccoooAccccccccccccccccccccaoooccoo"]),
  row([8, "oo"], [13, "occcccccccccccccccccco"], [38, "oo"]),
  row([14, "occcccccccccccccccco"]),
  row([14, "occcccccccccccccccco"]),
  row([15, "occcccccccccccccco"]), // 40
  row([16, "occcccccccccccco"]),
  row([17, "occcccccccccco"]),
  row([18, "oooccccccooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 구름 양 — 성장기(puff_2). */
const PUFF_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY, // 10
  EMPTY,
  EMPTY,
  row([21, "oooooo"]),
  row([19, "ooHbbbbboo"]),
  row([18, "oHHHHbbbbbBo"]),
  row([16, "oobHHHHbbbbbBBoo"]),
  row([14, "oobbHHHHbbbbbbBBbboo"]),
  row([13, "oHHHbHHHbbbbbbBBBdbbbo"]),
  row([12, "oHHHHbbbbbbbbbbBBBdbbbBo"]),
  row([11, "oHHHHbbbbbbbbbbBBBddbbbBBo"]), // 20
  row([10, "obHHHbbbbbbccccccBdddbbbBBdo"]),
  row([10, "obbbbbbooooocccccooooobBBBdo"]),
  row([10, "obbbbboowwwoocccoowwwooBBddo"]),
  row([10, "obbbbbowLLwwocccowLLwwoBBddo"]),
  row([9, "oHbbbbbowLeewocccowLeewoBddDbo"]),
  row([8, "oHHHBBBBowweeeocccowweeeoddDbbBo"]),
  row([7, "oHHHHbBBccoweeocccccoweeocdDbbbBBo"]),
  row([6, "obHHHbbbdppcooocccccccoooppDdbbbBBdo"]),
  row([6, "obbbbbbbbccccccccccccccccccddbbBBBdo"]),
  row([6, "obbbbbbbbbccccccccccccccccdddbBBBddo"]), // 30
  row([6, "obbbbbbbbbcccccmcmmcmcccccddDBBBBddo"]),
  row([6, "obbbbbbBbbbcccccmccmcccccdddDBBBddDo"]),
  row([7, "oBBBBBBbbbccccccccccccccddDBBdddDo"]),
  row([8, "oBBBBBBBBBBccccccccccddddDBdddDo"]),
  row([8, "obdddddBBBBBBccccccdddddDddddDdo"]),
  row([7, "obbbbddDbBBBBBBBBddddddDDdddDBBdDo"]),
  row([8, "obbbbbbbbdBBBddddddddDDddbBBBddo"]),
  row([8, "obbbbBBbbbdddddddddDDDddDBBBdddo"]),
  row([8, "oBBBBBBBbbbbbddddDDBddddBBBdddDo"]),
  row([9, "oBBBBddBBBBBBBBBBBddddDBddddDo"]), // 40
  row([10, "ooddddDBBBBBBBBdddddDddddDoo"]),
  row([12, "ooooooBBBBBddddddDoooooo"]),
  row([18, "oddddddddDDo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 구름 양 — 중간형(puff_3). */
const PUFF_3: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  row([23, "oo"]),
  row([20, "ooobbooo"]),
  row([19, "oHHHbbbbbo"]),
  row([18, "oHHHHbbbbbBo"]),
  row([15, "oooHHHHHbbbbbBBooo"]),
  row([13, "oobbbHHHHbbbbbbBBdbboo"]),
  row([12, "oHHHbbHHbbbbbbbbBBdbbbbo"]),
  row([7, "ooo.oHHHHbbbbbbbbbbbBBBdbbbbBo.oooo"]), // 10
  row([5, "ooAAAoHHHHbbbbbbbbbbbBBBddDbbbBBoAAAAoo"]),
  row([3, "ooAAAAAAHHHbbbbbbbbbbbBBBBddbbbbBBAAAAAAAoo"]),
  row([2, "oAAAAAAAAAbbbbbbbbbccccccBdddbbbBBAAAAAAAAAAo"]),
  row([1, "oaaaAAAAAAAAAbbbBbccccccccccdDbbBAAAAAAAAAAaaao"]),
  row([1, "oaaaAAooAAAAAAbbBccccccccccccbbBAAAAAAoooAAaaao"]),
  row([1, "oaaaoo.oHAAAAAABccccccccccccccBAAAAAAbo..ooaaao"]),
  row([1, "oaaao.oHHHBAAAABoooooccccoooooBAAAADbbBo..oaaao"]),
  row([1, "oaaaooHHHHbBAAAoowwwooccoowwwooAAADbbbBBo.oaaao"]),
  row([1, "oaaaobHHHbbbdddowLLwwoccowLLwwoddDbbbbBBdooaaao"]),
  row([1, "oaaaobbbbbbbbbdowLeewoccowLeewoDbbbbbBBBdooaaao"]), // 20
  row([1, "oaaaobbbbbbbbBBowweeeoccowweeeobbbbbBBBddooaaao"]),
  row([1, "oaaaabbbbbbbBBBcoweeoccccoweeocbbbbBBBBddoaaaao"]),
  row([1, "oaaaaabbbbbBBBBccoooccccccoooccbbbBBBBddDaaaaao"]),
  row([2, "oaaaaBBBaaaBddppccccccccccccppBBBaaaadDoaaaao"]),
  row([3, "oaaaaaaaaadddccccccccccccccccBBBaaaaaaaaaao"]),
  row([3, "oaaaaaacccccDccccccccccccccccdcccccaaaaaaao"]),
  row([4, "oaaaacccccccbccccmcmmcmccccbcccccccaaaaao"]),
  row([4, "obaaaacccccdbcccccmccmcccccHbcccccbaaaao"]),
  row([4, "obbbbbbBBBddHHccccccccccccBBbbbbbbBBBddo"]),
  row([4, "oBbbbBBBBddDHHHccccccccccbBBBbbbBBBBddDo"]), // 30
  row([5, "oBBBBBdddDHHHHHHccccccbbbBBBBBBBBdddDo"]),
  row([6, "oBBddddDbHHHHbbbbbbbbbbBBBBdBBddddDo"]),
  row([4, "ooHbbddDbbbbbbbbbbbbbbbbBBBBBdbbddDBdboo"]),
  row([3, "oHHbbbbbbbbbbbbbbbbbbbbbbBBBBddbbBBBddDbBo"]),
  row([2, "obHHHbbbbbbbbbbbbbbbbbbbbBBBBBddDBBBBddbbBdo"]),
  row([2, "oHHHbbbbbbbbbbbbbbHHHbbbbBBBBdddBBBBdddbbBBo"]),
  row([2, "obbbbBbbHHbbbbbbbHHHHbbbbbBBdddHHbbbddDbBBdo"]),
  row([1, "obbbbbbBHHHbbbBbbbHHHbbbbbbBdddHHHbbbBDbBBBdDo"]),
  row([2, "obbbbbHHHbbbbBBbbHHbbbbbbBBddHHHbbbbBBBBBddo"]),
  row([2, "obbbbBbbbbbbbBBBbbbbbbbbbBBddbbbbbbbBBBBdddo"]), // 40
  row([2, "oBBBBbbbbbbbBBdDbbbbbbbbBBBdbbbbbbbBBdDdddDo"]),
  row([3, "oBBBBbbbbbBBddBbbbbbbbBBBddDbbbbbBBdddddDo"]),
  row([4, "ooddbbbBBBdddobbbbbBBBBdddobbbBBBddddDoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 구름 양 — 최종형(puff_4). */
const PUFF_4: readonly string[] = [
  row([21, "oooooo"]), // 0
  row([19, "ooRRRRRRoo"]),
  row([18, "oRRrrrrrrRRo"]),
  row([17, "oRRrroooorrRRo"]),
  row([17, "oRrro"], [26, "orrRo"]),
  row([17, "oRro"], [27, "orRo"]),
  row([16, "oRro.oooooo.orRo"]),
  row([16, "oRrooHHbbbboorRo"]),
  row([16, "oRroHHHbbbbBorRo"]),
  row([14, "ooooRHHHHbbbbBBRoooo"]),
  row([12, "oobbbobHHHbbbbbBBdobbboo"]), // 10
  row([11, "oHHHbbbbbbbbbbbBBBdHHbbbbo"]),
  row([10, "oHHHbbbbbbbbccccBBddHbbbbbBo"]),
  row([9, "obHHHbbbbbbccccccccddHbbbbBBdo"]),
  row([9, "obbbbbbbbBccccccccccDbbbbbBBdo"]),
  row([9, "obbbbbbbBccccccccccccbbbbBBddo"]),
  row([7, "ooobbbbbbBoooooccccooooobbBBBddoo"]),
  row([5, "ooFFFBbbbBBoowwwooccoowwwooBBBddDFFoo"]),
  row([4, "oFFFFHHBBBBBowLLwwoccowLLwwoBdddDbBFFFo"]),
  row([3, "oFFFRbHHHBBddowLeewoccowLeewodddDbBBdFFFo"]),
  row([2, "oFFFRRbbbbbbddowweeeoccowweeeodDbbbBBdRFFFo"]), // 20
  row([1, "oFFFRRRbbbbbbbBcoweeoccccoweeocbbbbBBddRRFFFo"]),
  row([0, "oFFFRRUUbbbbbbBBccoooccccccoooccbbbBBBddURRFFFo"]),
  row([0, "oFFRRUUUBbbbBBBBppccccccccccccppbBBBBddDUURRFFo"]),
  row([0, "FFRRRUUUoBBBBBddccccccccccccccccBBBdddDUUURRRFFo"]),
  row([0, "FFRRUUUo.oBBddddccccccccccccccccBddddDooUUURRFFo"]),
  row([0, "FFRRUUUo..ooddDbHccccmcmmcmccccBdddDoo.oUUURRFFF"]),
  row([0, "FRRUUUo"], [12, "oooHHHccccmccmccccBBBooo"], [40, "oUUURRFF"]),
  row([0, "FRRUUUo"], [10, "ooboobHHHccccccccccBBBdooboo..oUUURRFF"]),
  row([0, "FRRUUo"], [9, "oHHbbBbbbbbccccccccBBBBdHHbbBo..oUURRFF"]),
  row([0, "oooUUo..obHbbbBdbbHHHHccccbbbbBBbHbbbBdo.oUUoooo"]), // 30
  row([3, "oo"], [8, "obbbbBBdbHHHHHHbbbbbbbBdbbbbBBdo..oo"]),
  row([8, "oBbbBBdDHHHHHHbbbbbbbbBBBbbBBdDo"]),
  row([7, "oHHBBddDHHHHHHHbbbbbbbbBBBBBddDbBo"]),
  row([6, "oHHHHbDbbHHHHHHbbbbbbbbbBBBdbDbbbBBo"]),
  row([5, "obHHHbbbbbHHHHbbbbbbbbbbBBBBdbbbbbBBdo"]),
  row([5, "obbbbbbbbbbbbbbbbbbbbbbBBBBBdbbbbBBBdo"]),
  row([5, "obbbbbbbbbbbbbbbHHbbbbbBBBBddbbbBBBddo"]),
  row([5, "obbbbbbbbbbbbbbHHHbbbbBBBBBddDbBbbbddo"]),
  row([5, "oHHHbbbBBbbbbbHHHHbbbbBBBBdddbHHHbbbBo"]),
  row([5, "oHHbbbbBBbbbbbHHHbbbbbBBdddddBHHbbbbBo"]), // 40
  row([4, "obbbbbbBBdbbbbbbbbbbbbBBBddddDbbbbbbBBdo"]),
  row([4, "obbbbbbBBdBbbbbbbbbbbbBBdddddDbbbbbbBBdo"]),
  row([4, "obbbbBBBddoBBBbbbbbbBBBBddddDobbbbBBBddo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 잎 개구리 — 성장기(leaf_2). */
const LEAF_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([20, "o"], [27, "o"]), // 10
  row([19, "oho"], [26, "oho"]),
  row([18, "ohhho..ohhho"]),
  row([18, "ohhFo..oFhho"]),
  row([17, "oFFFFFooFFFFFo"]),
  row([16, "oFFFFFFFFFFFFFo"]),
  row([17, "oFFFFFFFFFFFFo"]),
  row([18, "oFFFFFFFFFFo"]),
  row([19, "oFFFFFFFFo"]),
  row([20, "oFFffFFo"]),
  row([18, "oobbffffbboo"]), // 20
  row([16, "ooHHHHbffbbbbboo"]),
  row([15, "oHHHHHHbbbbbbbbbBo"]),
  row([14, "oHHHHHHHbbbbbbbbbBBo"]),
  row([13, "oHoooooHHbbbbbboooooBo"]),
  row([12, "oboowwwoobbbbbboowwwoodo"]),
  row([12, "oHowLLwwobbbbbbowLLwwoBo"]),
  row([11, "obHowLeewobbbbbbowLeewoBdo"]),
  row([11, "obbowweeeobbbbbbowweeeoddo"]),
  row([11, "obbboweeobbbbbbbboweeoBddo"]),
  row([11, "obppbooobbbbbbbbbBoooBppdo"]), // 30
  row([10, "obbbbbbbbbmmbbbbmmBBBBBdddDo"]),
  row([11, "obbbbbbbbccmmmmccBBBBddddo"]),
  row([11, "obbbbbbccccccccccccBBddddo"]),
  row([11, "obbbbbccccccccccccccddddDo"]),
  row([11, "oBbbbbccccccccccccccddddDo"]),
  row([12, "oBbbbccccccccccccccdddDo"], [42, "oo"]),
  row([11, "oHHbBBccccccccccccccdHHbBoooooobBo"]),
  row([10, "obbbbBdccccccccccccccbbbbBdbbbbbBBo"]),
  row([10, "obbbBdDccccccccccccccbbbBdDbbbbbBBdo"]),
  row([11, "oBBdDddccccccccccccDDBBdDbbbbBBBddo"]), // 40
  row([12, "ooooooddccccccccDDooobbbbbBBBBdoo"]),
  row([18, "oodddddDDDoo.oBBBBBBBBdoo"]),
  row([20, "oooooooo"], [32, "ooooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 잎 개구리 — 중간형(leaf_3). */
const LEAF_3: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  row([20, "oooooooo"]),
  row([16, "ooooFFFhFFhhooo"]),
  row([15, "oFFFFFFFhFFhhhhho"]),
  row([15, "oFFFFFFFhFFFhhhhho"]),
  row([14, "ofFFFFFFFhFFFhhhhhho"]),
  row([13, "offfFFFFFFhFFFhhhhhho"]),
  row([13, "offfFFFFFFhFFFFhhhhhho"]),
  row([12, "offffFFFFFFhFFFFhhhhhhho"]), // 10
  row([11, "offffffFFFFFhFFFFhhhhhhho"]),
  row([12, "ooooffFFFFFhFFFFhhhhooo"]),
  row([11, "oobbbHHHHHHbbbbbbbbBBbbboo"]),
  row([9, "ooHHHbHHHHHHbbbbbbbbbBBBdbbboo"]),
  row([8, "oHHHHbbHHHbbbbbbbbbbbBBBBddbbbBo"]),
  row([8, "oHHHHbbbbbbbbbbbbbbbBBBBdddbbbBo"]),
  row([7, "oHHHHooooobbbbbbbbbBBBBBooooobBBBo"]),
  row([7, "obHHoowwwoobbbbbBBBBBBBoowwwooBBBo"]),
  row([6, "obbbbowLLwwoBBBBBBBBBBddowLLwwoBBddo"]),
  row([6, "obbbbowLeewoBBBBBBBdddddowLeewoBBddo"]), // 20
  row([6, "obbbbowweeeoddddddddddDDowweeeoBddDo"]),
  row([7, "obbbboweeoBdddHbbbbbbbbboweeoBdddo"]),
  row([7, "obbbbBoooBdddDbbbbbbbbbbBoooBdddDo"]),
  row([8, "oBBBBBBBddddbbbbbbbbBBBBBBBddddo"]),
  row([8, "oBBBBBdddddDbbbbbbbbBBBBBdddddDo"]),
  row([8, "obbddddddDbbbbbbbbbbbbddddddDddo"]),
  row([8, "obbbbddDbbbbbbbbbbbbbbBBddDBdddo"]),
  row([8, "obppbbbbbbbbbbbbbbbbbBBBBBBppddo"]),
  row([8, "obbbbbbbbbbbbccccccBBBBBBBBddddo"]),
  row([8, "obbbbbbbmmccccccccccccmmBBdddddo"]), // 30
  row([6, "ooobbbbbbbccmmmmmmmmmmmmccddddddDooo"]),
  row([5, "obHbBbbbbbccccccccccccccccccddddDDbbbo"]),
  row([4, "oHHHbbBBbbbccccccccccccccccccdddDDbbbbBo"]),
  row([3, "oHHHHbbbBBBBccccccccccccccccccddDDHbbbbBBo"]),
  row([2, "obHHHbbbbbBBBBccccccccccccccccdDDDHbbbbbBBdo"]),
  row([2, "obbbbbbbbBbbBBBBccccccccccccddDDDdbbbbbBBBdo"]),
  row([2, "obbbbbbbbBbbbBdddddccccccddDDDBdddbbbbbBBddo"]),
  row([2, "obbbbbbBBbbbbddccddddddDDDDccdddddDbbBBBBddo"]),
  row([2, "oBbbbbBBBBbbbbccccccccccccccccddddbbBBBBddDo"]),
  row([3, "oBBBBBBddBbbbbccccccccccccccddddDBBBBdddDo"]), // 40
  row([3, "ooBBBddddDBBBBBccccccccccccdddDDBBBddddDoo"]),
  row([2, "obbbddddDDoooBBBBBBBccccdddddDDoooddddDDbbbo"]),
  row([1, "obBBBdooooo"], [15, "ooodddddddddDDDooo"], [36, "ooooobBBBdo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 잎 개구리 — 최종형(leaf_4). */
const LEAF_4: readonly string[] = [
  row([18, "oro.orro.oro"]), // 0
  row([18, "orrooRRoorro"]),
  row([15, "o..orrooRRoorro..o"]),
  row([14, "oroooRRRRRRRRRRoooro"]),
  row([15, "orrooRRRRRRRRoorro"]),
  row([15, "orrRRRRRRRRRRRRrro"]),
  row([16, "oRRRRRUUUURRRRRo"]),
  row([17, "oRRtRUUUURtRRo"]),
  row([18, "oRttUUUUttRo"]),
  row([14, "ooo..ottUUUUtto..ooo"]),
  row([12, "oobbbooottttttttooobbboo"]), // 10
  row([11, "oHHHbbbboottoottooHHHbbbbo"]),
  row([10, "oHHHHbbbbBooooooooHHHHbbbbBo"]),
  row([9, "obHHooooobBdbbbbbbbHHooooobBdo"]),
  row([8, "oobHoowwwooBdHbbbbbbHoowwwooBdoo"]),
  row([7, "oFfbbowLLwwoBdHHbbbbbbowLLwwoBdfFo"]),
  row([5, "ooFFfbbowLeewoddHbbbbbbbowLeewoddfFFoo"]),
  row([4, "oFFFFFbbowweeeoddbbbbbbbbowweeeoddFFFFFo"]),
  row([2, "ooFFFFFFBbboweeoddDbbbbbbBbboweeoddDFFFFFFo"]),
  row([1, "oFFFFFFFFFBBBoooddDbbbbbbbbBBBoooddDFFFFFFFFo"]),
  row([1, "oFFFFFFFFFfddddddDbbbbbbbbbBddddddDfFFFFFFFFFo"]), // 20
  row([1, "oFFFFFFFFFFbbddDbbbbbbbbbbBBBBddDdDFFFFFFFFFFo"]),
  row([1, "oFFFFFFFFFFppbbbbbbbccccccBBBBdddppFFFFFFFFFFo"]),
  row([1, "oFFFFFFFFFFFbbbbbccccccccccccdddddFFFFFFFFFFFo"]),
  row([1, "ohFFFFFFFFFFBbbbcmmccccccccmmcdddDFFFFFFFFFFho"]),
  row([0, "ohhFFFFFFFFFFhBBccccmmmmmmmmccccdDhFFFFFFFFFFhho"]),
  row([0, "ohhhFFFFFFFhhFfBccccccccccccccccDfFhhFFFFFFFhhho"]),
  row([0, "ohhhFFFFFhhFFFFfBccccccccccccccDfFFFFhhFFFFFhhho"]),
  row([0, "ohhhhFFhhFFFFFFffdccccccccccccDffFFFFFFhhFFhhhho"]),
  row([0, "ohhhhhhFFFFFFbbFfHHHdccccccDbbBfFbbFFFFFFhhhhhho"]),
  row([0, "hhhhhhFFFFFFHHbbHHHHccccccccbbBBHHbbFFFFFFhhhhho"]), // 30
  row([0, "ohhhhhFFFFFbHbbBdHHccccccccccBBbHbbBdFFFFFhhhhho"]),
  row([0, "ohhhhhhFFFFbbbbBdHHccccccccccBBbbbbBdFFFFhhhhhho"]),
  row([1, "ohhhhhFFFFbbbBdDbccccccccccccBbbbBdDFFFFhhhhho"]),
  row([1, "ohhhhhhFHHHBBddbbccccccccccccBBBBddbbBFhhhhhho"]),
  row([1, "ohhhhhhHHHHbdDbbbccccccccccccBdddDbbbBBhhhhho"]),
  row([2, "ohhhhhHHHbbbbbbbccccccccccccddddbbbbBBhhhhho"]),
  row([2, "ohhhhhbbbbbbbbbbccccccccccccdddDbbbbBBhhhhho"]),
  row([3, "ohhhbbbbbbbBbbbccccccccccccdddbbbbBBdDhhho"]),
  row([3, "ohhhobbbbbBBBBbccccccccccccddDbbbBBddohhho"]),
  row([4, "oooobbbBBBBdBBBccccccccccddDbbBBBBddoooo"]), // 40
  row([7, "oBBBBBdddDBBccccccccccdDBBBBBdddDo"]),
  row([6, "oooBBBdddDooddccccccccDDooBBBdddDooo"]),
  row([5, "obbBBoddDoo..oodddccdDDoo..ooddDbbbBBo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 장수풍뎅이 — 성장기(beetle_2). */
const BEETLE_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY, // 10
  row([23, "oo"]),
  row([22, "oAAo"]),
  row([22, "oAAo"]),
  row([21, "ooAAoo"]),
  row([18, "oooAAAaAAooo"]),
  row([17, "oAAAAAAAAAAAAo"]),
  row([16, "oAAAAAAAAAAAAAAo"]),
  row([15, "oAAAAAAAAAAAAAAAAo"]),
  row([14, "oAAAAAAAAAAAAAAAAAAo"]),
  row([13, "oAAAAoooAAAAAAoooAAAao"]), // 20
  row([13, "oAAAowLwoAAAAowLwoAAao"]),
  row([13, "oAAAoweeoAAAAoweeoAaao"]),
  row([13, "oAAAoweeoAAAAoweeoAaao"]),
  row([13, "oAAAAoooAAAAAAoooAaaao"]),
  row([13, "oppAAAAAAAAAAAAAAappao"]),
  row([13, "oAAAAAAAAAAAAAAAaaaaao"]),
  row([13, "oAAAAAAAAAmmAAAaaaaaao"]),
  row([14, "oAAAAAAmAAAAmaaaaaao"]),
  row([15, "oAAAAAAAAAaaaaaaao"]),
  row([14, "ooHAAAAAAaaaaaaaaBoo"]), // 30
  row([13, "oHHHHaaaaaaaaaaaabBBBo"]),
  row([12, "obHddddddaaaaaadddddBBdo"]),
  row([11, "obHHHHHHbbbbbbbbbbbBBBBBdo"]),
  row([11, "obbbHbbbbbbbbbbbbbbBBBBddo"]),
  row([11, "obbbbbbbbbbbbbbbbbBBBBBddo"]),
  row([10, "obddddddddddddddddddddddddDo"]),
  row([11, "obbbbbbbbbbbbbbBBBBBBddddo"]),
  row([11, "obbbbbbbbbbbbBBBBBBBdddddo"]),
  row([11, "oBbbbbbbbbBBBBBBBBddddddDo"]),
  row([12, "oBdddddddddddddddddddDDo"]), // 40
  row([13, "oBBBBBBBBBBBdddddddDDo"]),
  row([14, "ooBBBBBdddddddddDDoo"]),
  row([16, "ooddddddddddDDoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 장수풍뎅이 — 중간형(beetle_3). */
const BEETLE_3: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([13, "o"], [23, "oo"], [34, "o"]),
  row([12, "oAo"], [22, "oFFo"], [33, "oAo"]),
  row([13, "oAo"], [22, "oFFo"], [32, "oAo"]),
  row([13, "oAo"], [22, "oFFo"], [32, "oAo"]), // 10
  row([14, "oAo"], [21, "oFFFFo"], [31, "oAo"]),
  row([15, "oAo"], [21, "oFFFFo"], [30, "oAo"]),
  row([15, "oAo.oobhhhhboo.oAo"]),
  row([16, "oAoHHHhhhhbbboAo"]),
  row([16, "oHHHHHHbbbbbbBBo"]),
  row([15, "obHHHHHbbbbbbbBBdo"]),
  row([15, "oHHHHHbbbbbbbbBBBo"]),
  row([14, "obbHHooobbbbboooBBdo"]),
  row([14, "obbbowLwobbbowLwoddo"]),
  row([14, "obbboweeobbboweeoddo"]), // 20
  row([14, "obbboweeobbBoweeoddo"]),
  row([14, "obbbbooobbBBBoooddDo"]),
  row([13, "ooAbbbbbBBBBBBBdddDAoo"]),
  row([12, "oAAABBBBBBBBBBdddddDAAao"]),
  row([12, "oAAAABBBBBBmmddddDDAAAao"]),
  row([5, "o"], [12, "oAAAAAAdddddddddDAAAAaao"], [42, "o"]),
  row([4, "oaoo"], [12, "oAAAAAAAAddddDDAAAAAaaao"], [40, "ooao"]),
  row([3, "oaoaaoo.oHAAAAAAAAAAAAAAAAAaaaaaBo.ooaaoao"]),
  row([2, "oao.ooaaoHHAAAAAAAAAAAAAAAaaaaaaaBBoaaoo.oao"]),
  row([1, "oao"], [8, "oobHHHHAAAAAAAAAAAaaaaaaaBBBBdoo"], [44, "oao"]), // 30
  row([2, "o"], [9, "obbHHHHAAAAAAaaaaaaaaaaBBBBBdo"], [45, "o"]),
  row([8, "obbbbbbbBBBaaaaaaaaaabBBBBBBdddo"]),
  row([4, "ooo.obbbbbbbBBBBbbbbdbbbbBBBBBBBdddo.ooo"]),
  row([3, "oaaaoobbbbbbbbBBbbbbbdbbbBBBBBBBddddooaaao"]),
  row([2, "oaoooaabbbbbbbbbbbbbbbdbBBBBBBBBdddddaaoooao"]),
  row([1, "oao"], [7, "oobbbbbbbbbbbbbbbdBBBBBBBBdddddDoo"], [44, "oao"]),
  row([0, "oao"], [9, "obbbbbbbbbbbbBBdBBBBBBddddddDo"], [45, "oao"]),
  row([1, "o"], [9, "oBbbbbbbbbBBBBBdBBBBBddddddDDo"], [46, "o"]),
  row([9, "ooBBBBBBBBBBBBBdBBBdddddddDDoo"]),
  row([6, "oooaaaBBBBBBBBBBBBdBddddddddDDaaaooo"]), // 40
  row([5, "oaaaooooBBBBBBBBBBdddddddddDDDooooaaao"]),
  row([4, "oaooo"], [13, "oodddddddddddddddDDDoo"], [39, "oooao"]),
  row([3, "oao"], [15, "ooddddddddddDDDDoo"], [42, "oao"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 장수풍뎅이 — 최종형(beetle_4). */
const BEETLE_4: readonly string[] = [
  row([27, "o"]), // 0
  row([26, "ofoo"]),
  row([26, "offfo"]),
  row([25, "offffo"]),
  row([20, "o"], [25, "offfo"]),
  row([19, "oFo..offffo"]),
  row([19, "oFFo.oFFFo"]),
  row([19, "oFFFoFFFFo"]),
  row([20, "oFFFFFFo"]),
  row([20, "oFFFFFFo"]),
  row([20, "oFFFFFo"]), // 10
  row([21, "oFFFFo"]),
  row([21, "oFFFFo"]),
  row([20, "ooFFFFoo"]),
  row([18, "oobHhhhhbboo"]),
  row([17, "oHHHHhhhhhbbBo"]),
  row([16, "oHHHHhhhhhhbbBBo"]),
  row([15, "obHHHHhhhhhhbbBBdo"]),
  row([15, "obHHHbbbbbbbbBBBdo"]),
  row([14, "obbbooobbbbbboooBddo"]),
  row([14, "obbowLwobbbbowLwoddo"]), // 20
  row([7, "ooo"], [14, "obboweeobbbboweeoddo"], [38, "ooo"]),
  row([6, "obbboo..obboweeobbBBoweeodDo..ooHbbo"]),
  row([5, "oHbbbbboooobbooobBBBBBoooddooooHHHbbbo"]),
  row([4, "oHHbbbbbbBAABBBBBBBBBBBddddDAAHHHHHbbbbo"]),
  row([3, "oHHHbbbbbrAAAABBBBBBmmdddddDAAAArHHHbbbbbo"]),
  row([2, "oHHHbbbbrrAAAAAAdBBdddddddDDAAAAAarrbbbbbbBo"]),
  row([1, "oHHHHbbrrbbAAAAAAAAddddddDDAAAAAAaaHHrrbbbbBBo"]),
  row([1, "oHHHbrrbbbAAAAAAAAAAAAAAAAAAAAAAaaaabbbrrbbBBo"]),
  row([1, "oHbbrbbbbaaAAAAAAAAAAAAAAAAAAAAaaaaabbbbbrbBBo"]),
  row([1, "obbbbbbbbaaAAAAAAAAAAAAAAAAAAaaaaaaabbbbbbBBBo"]), // 30
  row([0, "obbbbbbbbaaaBAAAAAAAAAAAAAAAaaaaaaaaaabbbbbBBBdo"]),
  row([0, "obbbbbbbbaaBBBAAAAAAAAAAaaaaaaaaaabbaadbbbBBBBdo"]),
  row([0, "obbbbbbbaaaBBddooaaaaaaaaaaaaaaoobbbaaadbBBBBddo"]),
  row([0, "obbbbbbdaaBBBddo.oHHHaaaaaabbBo.obbbbaabdBBBBddo"]),
  row([0, "obbbbbdaaaBBdddooHHHHHbbbbbbbBBoobbbbaaaBdBBdddo"]),
  row([0, "obbbbdAAAABBddoobHddddddddddddBdobbbbbAAAAdBdddo"]),
  row([0, "BBbbdBAAAaBdddoobbbbbbbbbbbBBBBdoobbbBAAAaBdddDo"]),
  row([0, "oBBdBBAAAadddo.obbbbbbbbbbBBBBddo.oBBBAAAaddddDo"]),
  row([1, "oBBBBBBBdddo..obbddddddddddddddo.oBBBBBBddddDo"]),
  row([1, "oBBBBBdddddo..obbbbbbBBBBBBdddDo..oBBBdddddDo"]), // 40
  row([2, "oddddddddo"], [16, "oBBBBBBBBBddddDo"], [36, "odddddddDo"]),
  row([3, "oddddddo"], [17, "oddddddddddddo"], [36, "odddddDDo"]),
  row([4, "oooooo"], [18, "oodddddddDoo"], [37, "ooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 소라 게 — 성장기(conch_2). */
const CONCH_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([24, "oo"]),
  row([23, "offo"]),
  row([22, "offfo"]),
  row([21, "offfffo"]),
  row([21, "offfffo"]),
  row([20, "offffffFo"]), // 10
  row([19, "offfffFFFo"]),
  row([18, "offffffFFFho"]),
  row([17, "offffffffffho"]),
  row([16, "oFfffRRRRRRRRFo"]),
  row([16, "offRRRffffffRRRo"]),
  row([15, "offRRfffRRRRRfFRRo"]),
  row([14, "offRRffRRffffRRFFRRo"]),
  row([14, "offRffRRffffffRRFFRo"]),
  row([14, "offRfRRfRRRRRRFRRFho"]),
  row([14, "ofRRfRffRffffRFFRhho"]), // 20
  row([13, "offoooffRfffffFRooohho"]),
  row([14, "oowLwofffffFFFowLwoo"]),
  row([14, "ooweeoffffFFFFoweeoo"]),
  row([14, "ooweeoffFFFFFFoweeoo"]),
  row([14, "oFooofFFFFFFFhhoooho"]),
  row([15, "oBBFFFFFFFFhhhBBho"]),
  row([15, "oBBFFFFFFhhhhhBBo"]),
  row([15, "oBBHHHHbbbbbbbBBo"]),
  row([14, "ooBBHHHHbbbbbbbBBBoo"]),
  row([12, "ooHHBBHHHHbbbbbbbBBBBBo"]), // 30
  row([11, "oppHHHHHHHbbbbbbbbbbBBppo"]),
  row([11, "obHHHHHHbbbbbbbbbbbBBBBBdo"]),
  row([9, "ooobbbHbbbbbbmbbmbbbbBBBBddooo"]),
  row([7, "ooAAobbbbbbbbbccmmccbbBBBBBddoAAoo"]),
  row([6, "oAAAAAAbbbbbbccccccccccBBBBddAAAAAAo"]),
  row([6, "oAAAAAAbbbbbccccccccccccBBdddAAAAAAo"]),
  row([5, "oAoooAAAabbbccccccccccccccdddAoooAAAao"]),
  row([6, "oAAAAAabbbbccccccccccccccddddAAAAAao"]),
  row([6, "oAAAaaaBBBBccccccccccccccddDDAAAaaao"]),
  row([7, "ooaaoooBBBBccccccccccccddDDoooaaoo"]), // 40
  row([9, "oo"], [14, "ooBBBccccccccccdDDoo"], [37, "oo"]),
  row([16, "oodddccccccdDDoo"]),
  row([18, "oooooooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 소라 게 — 중간형(conch_3). */
const CONCH_3: readonly string[] = [
  row([25, "o"]), // 0
  row([24, "ofo"]),
  row([23, "offfo"]),
  row([22, "offffo"]),
  row([21, "offffffo"]),
  row([20, "offfffffo"]),
  row([19, "offfffffFFo"]),
  row([18, "offfffffFFFFo"]),
  row([17, "offfffffffFFho"]),
  row([16, "offffffRRRffffho"]),
  row([15, "oFfffRRRRffRRRRFoo"]), // 10
  row([14, "offfRRRffffffffRRRFo"]),
  row([14, "offRRffffffffffffRRo"]),
  row([13, "offRRfffRRRRRRRRffFRRo"]),
  row([12, "offfRfffRRffffffRRFFFRho"]),
  row([12, "offRfffRffffffffffRFFFRo"]),
  row([11, "offfRffRfffRRRRRRffFRFFRho"]),
  row([11, "offRfffRffRRffffRRFFRFFhho"]),
  row([11, "offfffRfffRffffffRFFFFhhho"]),
  row([11, "offffffffRRfffffFFFFFFhhho"]),
  row([11, "offfffoooffffffFFoooFhhhho"]), // 20
  row([11, "offffowLwoffffFFowLwohhhho"]),
  row([11, "offffoweeoffFFFFoweeohhhho"]),
  row([12, "offfoweeofFFFFFoweeohhho"]),
  row([12, "oFFfBoooFFFFFFFBooohhhho"]),
  row([13, "oFFBBFFFFFFFFFBBhhhhho"]),
  row([14, "oFBBFFFFFFFhhBBhhhho"]),
  row([14, "ohBBFFFFFhhhhBBhhhho"]),
  row([5, "ooooo"], [15, "oBBhhhhhhhhhBBhhoo"]),
  row([4, "oAAAAAo"], [15, "oBBhhhbbbbbbBBhoo"]),
  row([3, "oAAAAAAAoo.ooBBHHHHbbbbbBBbbBoooo"]), // 30
  row([2, "oAAAAAAAAppoHHHHHHHHbbbbbbbbbbBBppo"], [40, "o"]),
  row([1, "oAAAAAAAAAAaHHHHHHHHbbbbbbbbbbbBBBBo.ooAoo"]),
  row([1, "oAoooobbAAaaHHHHHHHbbmbbmbbbbbBBBBBdoAAAAAo"]),
  row([1, "oAAAAAbbbbaaHHHHbbbbbbmmbbbbbbBBBBBdAAAAAAao"]),
  row([2, "oAAAAAbbbbbbbbbbbccccccccccBBBBBBddAooAAAao"]),
  row([3, "oAAAAaabbbbbbbccccccccccccccBBBdddAAAAAaao"]),
  row([4, "oaaaaabbbbbbccccccccccccccccBdddddAAAaao"]),
  row([5, "oooooobbbbbccccccccccccccccdddddoooaoo"]),
  row([10, "oBbbbbccccccccccccccccdddDDo..o"]),
  row([11, "oBBBBBccccccccccccccdddDDo"]), // 40
  row([12, "ooBBBBBccccccccccdddDDoo"]),
  row([14, "oodddddddddddddDDDoo"]),
  row([16, "ooooodddDDDooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 소라 게 — 최종형(conch_4). */
const CONCH_4: readonly string[] = [
  row([23, "oooooo"]), // 0
  row([22, "orrUUUUo"]),
  row([21, "oRRRUUUUo"]),
  row([20, "oRRRRURoo"]),
  row([19, "oRRRRRRRRo"]),
  row([17, "ooRRRRRRRRRRoo"]),
  row([16, "ofttttttttttttFo"]),
  row([16, "offfffffffffFFFo"]),
  row([10, "o"], [16, "offfffffffffFFFo"], [37, "o"]),
  row([9, "oro"], [16, "offfffffffffFFho"], [36, "oro"]),
  row([8, "orrro"], [16, "offfffffffffFFho"], [35, "orrro"]), // 10
  row([8, "oRRRo"], [16, "offfffUUUUffFFho"], [35, "oRRRo"]),
  row([7, "oRRRRRo..offfffUUUUffFFho..oRRRRRo"]),
  row([6, "ottttttto.offfffUUUUffFFho.ottttttto"]),
  row([6, "ottttttto.offfffUUUURfFFho.ottttttto"]),
  row([6, "offffffFo.offfRRRfffRRRFho.offffffFo"]),
  row([6, "offffffFo.offRRffffffFRRho.offffffFo"]),
  row([4, "oooffffffFo.ofRRffffffFFFFRo.offffffFooo"]),
  row([3, "oAAAAAAfffFo.oRRfffRRRRRRFhRRooffffAAAAAAo"]),
  row([2, "oAAAAAAAAfFFo.oRfffRfffFFRRhhRooffUAAAAAAAAo"]),
  row([1, "oAAAAAAAAAaFFo.ooooRffffFFFoooo.offAAAAAAAAAao"]), // 20
  row([1, "oAAAAAAAAAaFFooowLwofffFFFowLwoooffAAAAAAAAAao"]),
  row([1, "oAooooAAAaaFhoooweeoffFFFFoweeoooffAooooAAAaao"]),
  row([1, "oAAAAAAAaaaFhoooweeofFFFFFoweeoooffAAAAAAAaaao"]),
  row([2, "oAAAAAaaaFFhooBoooFFFFFFhhoooo.offfAAAAAaaao"]),
  row([3, "oaaaaaaFFhhooBBFFFFFFFFhhBBho.offfFaaaaaao"]),
  row([4, "ooobbFFFhhooBBFFFFFFFhhhBBho.offFFbbhooo"]),
  row([6, "obbbFhhhooBBhFFFFFhhhhBBho.oFFFbbbho"]),
  row([6, "ohbbhhhhooBBhhFFhhhhhhBBho.ohFFbbhho"]),
  row([6, "ohbbbhhhooBBhhhbbbbbbhBBho.ohhbbbhho"]),
  row([6, "ohhbbhhhooBBHHHHbbbbbbBBbBoohhbbhhho"]), // 30
  row([7, "oobbbooHHBBHHHHbbbbbbBBbbBBobbbooo"]),
  row([9, "obppHHHHHHHHbbbbbbbbbbbBBBppo"]),
  row([9, "obbHHHHHHHbbbbbbbbbbbbbBBBbbo"]),
  row([9, "obbHHHHbbbbbbmbbmbbbbbBBBBBddo"]),
  row([9, "obbbbbbbbbccccmmccccBBBBBBBddo"]),
  row([8, "obbbbbbbbccccccccccccccBBBBdddDo"]),
  row([9, "obbbbbbccccccccccccccccBdddddo"]),
  row([9, "obbbbbbccccccccccccccccdddddDo"]),
  row([10, "oBbbbbccccccccccccccccddddDo"]),
  row([11, "oBBBBBccccccccccccccdddDDo"]), // 40
  row([12, "ooBBBBBccccccccccdddDDoo"]),
  row([14, "oodddddddddddddDDDoo"]),
  row([16, "ooooodddDDDooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 눈사람 — 성장기(snow_2). */
const SNOW_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([24, "o"]),
  row([23, "ogo"]),
  row([19, "o"], [23, "ogo..o"]),
  row([18, "ogoo.ogooogo"]), // 10
  row([19, "oggoogoggo"]),
  row([20, "ooggLgoo"]),
  row([20, "ooggggoo"]),
  row([19, "oggoogoggo"]),
  row([18, "ogoo.ogooogo"]),
  row([19, "o"], [23, "ogo..o"]),
  row([23, "ogo"]),
  row([20, "oooooooo"]),
  row([18, "oobbbbbbbboo"]),
  row([16, "ooHHHHbbbbbbbboo"]), // 20
  row([15, "obHHHHHbbbbbbbbbBo"]),
  row([14, "oHHHHHHHbbbbbbbbbBBo"]),
  row([13, "oHHHHHHHHbbbbbbbbbBBBo"]),
  row([2, "o"], [12, "obHHHHHHHbbbbbbbbbbBBBdo"], [45, "o"]),
  row([1, "oAo"], [12, "oHHHHHHHHbbbbbbbbbbBBBBo"], [44, "oAo"]),
  row([2, "oAo"], [11, "obHHHHHLeebbbbbbLeeBBBBBdo"], [43, "oAo"]),
  row([3, "oAoo"], [11, "obbHHHHeeebbbbbbeeeBBBBddo"], [41, "ooAo"]),
  row([4, "oAAo"], [11, "obbbbbbeeebbbbbbeeeBBBBddo"], [40, "oAAo"]),
  row([5, "ooAoo.obbbbbbbbbbbbbbbbbBBBBBddo.ooAoo"]),
  row([7, "oAAoobbbbbbbbbbuuuubbBBBBBdddooAAo"]), // 30
  row([8, "ooAAbppbbbbbbbbuuubBBBBBppddAAoo"]),
  row([10, "oobbbbbbbbbbbUUbBBBBBBddddoo"]),
  row([11, "obbbbbbbebbbbUBBBeBBdddddo"]),
  row([11, "obbbbbbbbebbBvBBeBBdddddDo"]),
  row([11, "oBbbbbbbbbBeBBeBBBddddddDo"]),
  row([12, "oBBbbBBBBBBBBBBBddddddDo"]),
  row([12, "oBBBBBBBBBBBBBBddddddDDo"]),
  row([13, "oBBBBBBBBBBBdddddddDDo"]),
  row([14, "oBBBBBBBBddddddddDDo"]),
  row([15, "odddddddddddddDDDo"]), // 40
  row([16, "ooddddddddddDDoo"]),
  row([18, "oodddddDDDoo"]),
  row([20, "oooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 눈사람 — 중간형(snow_3). */
const SNOW_3: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([22, "oooo"]),
  row([19, "ooobbbbooo"]), // 10
  row([17, "ooHHHbbbbbbboo"]),
  row([16, "oHHHHHHbbbbbbbBo"]),
  row([15, "oHHHHHHHbbbbbbbBBo"]),
  row([14, "oHHHHHHHbbbbbbbbBBBo"]),
  row([14, "oHHHHHHbbbbbbbbbBBBo"]),
  row([13, "obHHHHHbbbbbbbbbbBBBdo"]),
  row([13, "obHHHLeebbbbbbLeeBBBdo"]),
  row([12, "obbbbbeeebbbbbbeeeBBBddo"]),
  row([12, "obbbbbeeebbbbbbeeeBBdddo"]),
  row([12, "obbbbbbbbbbbbbbBBBBBdddo"]), // 20
  row([12, "obbbbbbbbbuuuuBBBBBddddo"]),
  row([12, "obppbbbbbbbuuuBBBBddppDo"]),
  row([2, "o"], [13, "obbbbbbbbbUUBBBBdddddo"], [45, "o"]),
  row([1, "oAo"], [13, "oBbbbbbbBBBUBBBdddddDo"], [44, "oAo"]),
  row([2, "oAo"], [14, "oBBBBeBBBBvBBdedddDo"], [43, "oAo"]),
  row([3, "oAo"], [14, "oBBBBBeBBBBddedddDDo"], [42, "oAo"]),
  row([4, "oAo"], [15, "oBBBfffeffefffdDDo"], [41, "oAo"]),
  row([5, "oAo"], [13, "oofffffffffffffffFFFoo"], [40, "oAAo"]),
  row([6, "oAo"], [12, "obffffffffffffffFFFFFhBo"], [39, "oAAo"]),
  row([7, "oAo.obHfffffffffffFFFFFFFFhBBo.oAAo"]), // 30
  row([7, "oAoobHHHFFFFFFFFFFFhhFFFFFBBBdooAo"]),
  row([8, "oAobHHHHHHbhhhhhhhhhFFFFFBBBdoAo"]),
  row([9, "obbbbbbbbbbbbbbbbbbFFFFFBBdddo"]),
  row([9, "obbbbbbbbbbbbbeebbbFFFFFBBdddo"]),
  row([9, "obbbbbbbbbbbbbeebbbhhhhhBddddo"]),
  row([9, "obbbbbbbbbbbbbbbbBBhhhhhdddddo"]),
  row([9, "obbbbbbbbbbbbbeeBBBhhhhhddddDo"]),
  row([10, "obbbbbbbbbbbBeeBBBBBBdddddDo"]),
  row([10, "oBBbbbbbBBBBBBBBBBBddddddDDo"]),
  row([11, "oBBBBBBBBBBBeeBBdddddddDDo"]), // 40
  row([12, "oBBBBBBBBBBeedddddddDDDo"]),
  row([13, "oodBBBBdddddddddddDDoo"]),
  row([15, "oodddddddddddDDDoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 눈사람 — 최종형(snow_4). */
const SNOW_4: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  row([23, "oo"], [44, "o"]),
  row([20, "oooLLooo"], [43, "ogo"]),
  row([19, "oLLoggoLLo"], [40, "o..ogo.o"]),
  row([17, "oooggoggoggooo"], [39, "ogo.ogoog"]),
  row([16, "oggoggoggoggoggo"], [40, "ogoogogo"]),
  row([16, "oggoggggggggoggo"], [41, "ogoggo"]),
  row([16, "oggggggggggggggo"], [42, "ogLo"]),
  row([15, "oggggggggggggggggo"], [41, "ogoggo"]),
  row([16, "ooHHHHHbbbbbbBoo"], [40, "ogoogogo"]), // 10
  row([16, "oHHHHHbbbbbbbBBo"], [39, "ogo.ogoog"]),
  row([15, "obHHHHbbbbbbbBBBdo"], [40, "o..ogo.o"]),
  row([15, "obbHLeebbbbLeeBBdo"], [43, "ogo"]),
  row([15, "obbbeeebbbbeeeBddo"], [43, "oAo"]),
  row([15, "obbbeeebbbbeeeBddo"], [43, "oAo"]),
  row([15, "obbbbbbbuuuBBBdddo"], [43, "oAo"]),
  row([15, "oppbbbbbuuBBBddppo"], [43, "oAo"]),
  row([15, "oBbbbbbBBUBBddddDo"], [43, "oAo"]),
  row([16, "oBBeBBBBvBddedDo"], [43, "oAo"]),
  row([16, "ooHHeHHbbbbebBoo"], [43, "oAo"]), // 20
  row([2, "o"], [15, "oHHHHHbebbebbbBBBo"], [43, "oAo"]),
  row([1, "oAo"], [14, "obbfffffffffffffFddo"], [43, "oAo"]),
  row([2, "oAo"], [13, "offffffffffffffFFFFhho"], [43, "oAo"]),
  row([3, "oAo"], [12, "oFffffffffffFFFFFFhhhho"], [43, "oAo"]),
  row([4, "oAoo"], [12, "oFFbHFFFFFFFhhhhhhhBdFFo"], [43, "oAo"]),
  row([5, "oAAo..oFFFbHHbbbbbbbbbbBBBBdFFFo"], [42, "ooAo"]),
  row([6, "ooAo.oFFbbbbbbbbbeebbbBBBBddFFo"], [40, "ooAAAo"]),
  row([8, "oAoFFFbbbbbbbbbeebbBBBBdddFFFoooAAooAo"]),
  row([9, "oAAFFbbbbbbbbbbbBBBBBddddFFFAAAoo.oAo"]),
  row([9, "oFFAFFbbbbbbbbeeBBBBddddFFAAFoo"], [43, "oAo"]), // 30
  row([9, "oFFFAFbbbbbbBBeeBBBddddDFFFFFo"], [43, "oAo"]),
  row([8, "oFFFFFFHBBBBBBBBBBdddddDBFFFFFFo"], [43, "oAo"]),
  row([8, "oFFFFbHHHBBBBBBeedddddDBBBdFFFFo"], [43, "oAo"]),
  row([7, "oFFFFbHHHHHdddddeedddDDbBBBBdFFFFo..oAo"]),
  row([7, "oFFFFbHHHHHbbddddddDDbbBBBBBdFFFFo..oAo"]),
  row([6, "oFFFFbbbbbbbbbbbbbbbbbbBBBBBdddFFFFo.oAo"]),
  row([6, "oFFFFbbbbbbbbbbbbbbbbBBBBBBddddFFFFo..o"]),
  row([5, "oFFFFFbbbbbbbbbbbbbbBBBBBBBdddddFFFFFo"]),
  row([5, "ohhhhhhbbbbbbbbbbbBBBBBBBBdddddhhhhhho"]),
  row([4, "ohhhhhhhBBbbbbBBBBBBBBBBddddddDDhhhhhhho"]), // 40
  row([3, "ohhhhhhhhhBBBBBBBBBBBBBdddddddDDhhhhhhhho"]),
  row([4, "oohhhhhhhhhBBBBBBBdddddddddDDhhhhhhhhho"]),
  row([6, "ohhhhhhhhhhhdddddddddDDDhhhhhhhhhhho"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 박쥐 — 성장기(bat_2). */
const BAT_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  row([10, "o"], [37, "o"]),
  row([9, "obo"], [36, "oBo"]),
  row([9, "obHo"], [35, "oBBo"]),
  row([9, "oHHo"], [35, "oBBo"]),
  row([9, "oHHHo"], [34, "obBBo"]),
  row([9, "oHHHbo"], [33, "obbBBo"]),
  row([10, "oHbbo"], [33, "obbBo"]), // 10
  row([10, "obbbbo"], [32, "obbBBo"]),
  row([10, "obbbbbo"], [31, "obbbBBo"]),
  row([10, "obbrbbo"], [31, "obbRBBo"]),
  row([10, "obbrrbBo"], [30, "obbrRBBo"]),
  row([10, "obbrrBBBo"], [29, "obbbrRBdo"]),
  row([10, "obbrrrBBo"], [29, "obbrRRBdo"]),
  row([11, "obrrRRddoooooooooobbrrRtdo"]),
  row([11, "oBBRRttddHHbbbbbbBBrRRRBdo"]),
  row([11, "oBBRRtddDHHHbbbbbBBBRRtddo"]),
  row([11, "oBBtdddDHHHHbbbbbbBBBdtddo"]), // 20
  row([11, "oddddHHHHHHbbbbbbbbBddddDo"]),
  row([11, "oddbHHHHHHbbbbbbbbbBBBdDDo"]),
  row([12, "oobHooooobbbbbboooooBdoo"]),
  row([13, "oboowwwoobbbboowwwoodo"]),
  row([12, "obbowLLwwobbbbowLLwwoddo"]),
  row([12, "obbowLeewobbbbowLeewoddo"]),
  row([12, "obbowweeeobbbbowweeeoddo"]),
  row([12, "obbboweeobbbbbBoweeodddo"]),
  row([12, "obppbooobbbbBBBBoooppdDo"]),
  row([13, "obbbbbbbbmBBmBBBdddddo"]), // 30
  row([13, "oBbbbbbbBBmmBBBdddddDo"]),
  row([13, "oBBBBBBwBBBBBwdddddDDo"]),
  row([14, "oBBBBBwBBBBdwddddDDo"]),
  row([5, "oooo"], [15, "oBBBBBBBdddddddDDo"], [39, "oooo"]),
  row([4, "oAAAAoooo"], [16, "oddddddddddddDDo..oooooAAAAo"]),
  row([4, "oAAAAAAAAo..occddddddddDDcco.oAAAAAAAAAo"]),
  row([4, "oAAAAAAAAAoocccccccccccccccCooAAAAAAAAo"]),
  row([5, "oAAAAAAAAooccccccccccccccCCooAAAAAAAAo"]),
  row([5, "oAAAAAAAaoocccccccccccccCCCooAAAAAAAAo"]),
  row([5, "oAAAAAAaaooccccccccccccCCCCooAAAAAAAo"]), // 40
  row([6, "oAAAAaaao.occcccccccCCCCCo.oAAAAAAao"]),
  row([6, "oAAaaaaao..occcccCCCCCCCo.oAaAAAaaao"]),
  row([7, "ooooooo"], [18, "ooCCCCCCCCoo"], [33, "oooooooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 박쥐 — 중간형(bat_3). */
const BAT_3: readonly string[] = [
  EMPTY, // 0
  row([9, "o"], [38, "o"]),
  row([8, "obo"], [37, "oBo"]),
  row([8, "obHo"], [36, "oBBo"]),
  row([8, "oHHo"], [36, "oBBo"]),
  row([8, "oHHHo"], [35, "obBBo"]),
  row([8, "oHHHbo"], [34, "obbBBo"]),
  row([9, "oHbbbo"], [33, "obbbBo"]),
  row([9, "obbbbo"], [33, "obbBBo"]),
  row([9, "obbrbbo"], [32, "obbRBBo"]),
  row([9, "obbrbbbo"], [31, "obbbRBBo"]), // 10
  row([9, "obbrrbBBo"], [30, "obbbrRBBo"]),
  row([9, "obbrrrBBo"], [30, "obbrrRBdo"]),
  row([10, "obbrrRBBo"], [29, "obbrrRBBo"]),
  row([1, "o"], [10, "obbrrRBddoooooooooobbbrRRBdo"], [46, "o"]),
  row([0, "oao"], [10, "oBBRRRtddDHHbbbbbbBBBrRRtddo"], [45, "oao"]),
  row([0, "oAao"], [10, "oBBRRttddDHHHbbbbbBBBRRRtddo"], [44, "oaAo"]),
  row([0, "oAAao"], [10, "oBBtddddHHHHHbbbbbbbBBBdtddo"], [43, "oaAAo"]),
  row([0, "oAAAao"], [10, "oBddddHHHHHHbbbbbbbbbBddddDo"], [42, "oaAAAo"]),
  row([0, "oAAAAao"], [10, "odddHHHHHHHbbbbbbbbbBBBBdDDo"], [41, "oaAAAo"]),
  row([1, "oAAAAao"], [11, "oobHHooooobbbbbboooooBBdoo..ooaAAAAo"]), // 20
  row([1, "oAAAAAao"], [12, "obboowwwoobbbboowwwooBdo..oAaAAAAAo"]),
  row([1, "oAAAAAAao..obbowLLwwobbbbowLLwwoddo..oaAAAAAAo"]),
  row([1, "oAAAAAAAao.obbowLeewobbbbowLeewoddo.oaAAAAAAAo"]),
  row([1, "oAAAAAAAAaobbbowweeeobbbbowweeeoddDoaAAAAAAAo"]),
  row([1, "oAAAAAAAAAaobbboweeobbbbbBoweeodddoaAAAAAAAAAo"]),
  row([1, "oAAAAAAAAAAabppbooobbbbBBBBooodppdaAAAAAAAAAAo"]),
  row([1, "oAAAAAAAAAAAbbbbbbbbbmBBmBBBBddddDAAAAAAAAAAAo"]),
  row([1, "oAAAAAAAAAAABbbbbbbBBBmmBBBBdddddDAAAAAAAAAAAo"]),
  row([0, "oAAAAAAAAAAAaaBBBBBBwBBBBBwddddddDAAAAAAAAAAAaao"]),
  row([0, "oAAAAAAAAAAAaaoBBBBBwBBBBdwdddddDAAAAAAAAAAAAaao"]), // 30
  row([0, "oAAAAAAAAAAaaaaoBBBBBBBdddddddDDoaaaaAAAAAAAAaao"]),
  row([0, "oAAooaaaaaaaaao.oddddddddddddDDooAAAAaaaaaaooaao"]),
  row([0, "oaaaaoAAAAAaaaaooHHddddddddDDBBooaAAAAAAAAoaaaao"]),
  row([1, "oooooAAAAaaaaoobHHHHccccccbbBBdoAaAAAAAAAooooo"]),
  row([5, "oAAAaaaaaoobHHHccccccccBBBdoAAaAAAAAAo"]),
  row([5, "oAAaaaaaaoobbbcccccccccCBBdoAAAaAAAAao"]),
  row([5, "oAaaaoaaaobbbbcccccccccCBddDAAAaoAAaao"]),
  row([5, "oaaaoaoaaoobbbcccccccccCdddoAaooaoaaao"]),
  row([5, "oaaoao.oaoobbbccccccccCCdddoAo..oaoaao"]),
  row([5, "oaoao"], [13, "o.oBBbcccccccCCCddDoo"], [38, "oaoao"]), // 40
  row([6, "oao"], [16, "oBBBccccCCCCdDDo"], [39, "oao"]),
  row([7, "o"], [17, "ooBBCCCCCCdDoo"], [40, "o"]),
  row([19, "ooddddDDoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 박쥐 — 최종형(bat_4). */
const BAT_4: readonly string[] = [
  EMPTY, // 0
  row([9, "o"], [38, "o"]),
  row([8, "obo"], [37, "oBo"]),
  row([8, "oHHo"], [36, "oBBo"]),
  row([8, "oHHHo"], [35, "obBBo"]),
  row([9, "oHHbo"], [34, "obbBo"]),
  row([9, "obbbbo"], [33, "obbbBo"]),
  row([9, "obbrbbo"], [32, "obbRBBo"]),
  row([9, "obbrrbbo"], [31, "obbrRBBo"]),
  row([9, "obbrrrBBo..oooooooo..obbrrRBBo"]),
  row([10, "obbrrrBBoobbbbbbbboobbrrRBBo"]), // 10
  row([10, "obbrrRRddHHHHbbbbbbbbrrRRBBo"]),
  row([10, "oBBRRRtddDHHHbbbbbBbbrRRRBdo"]),
  row([10, "oBBRRdddHHHHbbbbbbbbBBBttddo"]),
  row([10, "oBBBddHHHHHHbbbbbbbbBBBddddo"]),
  row([11, "oddbHooooobbbbbboooooBdddo"]),
  row([12, "ooboowwwoobbbboowwwoodoo"]),
  row([12, "obbowLLwwobbbbowLLwwoddo"]),
  row([12, "obbowLeewobbbbowLeewoddo"]),
  row([12, "obbowweeeobbbbowweeeoddo"]),
  row([12, "obbboweeobbbbbBoweeodddo"]), // 20
  row([12, "obbbbooobbbbBBBBooodddDo"]),
  row([13, "obbbbbbbbmBBmBBBdddddo"]),
  row([13, "oBbbbbbBBBmmBBBdddddDo"]),
  row([13, "oABBBBBwBBBBBwdddddDo"]),
  row([13, "oAABBBBwBBBBdwddddDAAo"]),
  row([12, "oAAccBBBwBddddwdddDccAAo"]),
  row([11, "oAAccccddddddddddDDccccAAo"]),
  row([10, "oAAAccccccdddddDDDccccccAAAo"]),
  row([9, "osAAAAccccccccccccccccccAAAAso"]),
  row([8, "osssAAAAAccccccccccccccAAAAAssso"]), // 30
  row([8, "oAsAAAAAcbbHccccccccBBdAAAAAAsAAo"]),
  row([7, "oAAAAAAAAcbbbccccccccBBdcAAAAAAAAo"]),
  row([7, "oAAAAAAAAcbbbccccccccBddcAAAAAAAAAo"]),
  row([6, "oAAAAAAAAccbbbcccccccCBddcAAAAAAAAao"]),
  row([6, "oAAAAAAAAccbbbcccccccCddDccAAAAAaaaao"]),
  row([5, "oAsAAAAAAAcccbbccccccCCddcccAAAAaaasao"]),
  row([5, "osssAAAAAccccBBcccccCCCdDcccAAaaaasssao"]),
  row([4, "oAAsAAAAAAcccccBBcccCCCdDcccccaaaaaasaao"]),
  row([3, "osAAAAAAAAAcccccdBCcCCCCDDcccccaaaaaaaaaso"]),
  row([2, "osssAAAAAAAAAAAAAAodCCCCDaaaaaaaaaaaaaaassso"]), // 40
  row([3, "osAooooAAAAAAAAAo.ooooooooaaaaaaaaaoooaasao"]),
  row([2, "oAoo"], [10, "ooaaaaaoo"], [29, "ooaaaaaoo"], [41, "ooaao"]),
  row([3, "o"], [12, "ooaoo"], [31, "ooaoo"], [43, "oo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 이불 유령 — 성장기(ghost_2). */
const GHOST_2: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY, // 10
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([20, "oooooooo"]),
  row([18, "ooHHbbbbbboo"]),
  row([17, "oHHHHbbbbbbbbo"]),
  row([16, "oHHHHHHbbbbbbbBo"]),
  row([15, "oHHHHHHbbbbbbbbbBo"]),
  row([14, "oHHHHHHHbbbbbbbbbBBo"]), // 20
  row([13, "obHHHHHHHbbbbbbbbBBBdo"]),
  row([13, "oHHooooobbbbbboooooBBo"]),
  row([12, "obHoowwwoobbbboowwwooBdo"]),
  row([12, "obHowLLwwobbbbowLLwwoBdo"]),
  row([12, "obbowLeewobbbbowLeewoBdo"]),
  row([12, "obbowweeeobbbbowweeeoddo"]),
  row([12, "obbboweeobbbbbboweeoBddo"]),
  row([12, "obppbooobbbbbbbboooppddo"]),
  row([12, "obbbbbbbbbbbbbbBBBBBdddo"]),
  row([12, "obbbbbbbbbbmmbBBBBBBdddo"]), // 30
  row([12, "obbbbbbbbbmbbmBBBBBddddo"]),
  row([12, "obbbbbbbbbbmmBBBBBBddddo"]),
  row([12, "obbbbbbbbbbBBBBBBBddddDo"]),
  row([12, "oBbbbbbbbBBBBBBBBdddddDo"]),
  row([12, "oBBbbbbBBBBBBBBBdddddDDo"]),
  row([12, "oBBBBBBBBBBBBBBddddddDDo"]),
  row([12, "oBBBBBBBBBBBBBddddddDDDo"]),
  row([12, "oBBBBBBBBBBBdddddddDDDDo"]),
  row([12, "oBBdBBBBBBBdddddddDDDDDo"]),
  row([12, "oBddddddoddddddodDDDDDDo"]), // 40
  row([13, "oddddddoddddddoDDDDDDo"]),
  row([14, "oddddo.oddddo.oDDDDo"]),
  row([15, "oooo"], [22, "oooo"], [29, "oooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 이불 유령 — 중간형(ghost_3). */
const GHOST_3: readonly string[] = [
  EMPTY, // 0
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  EMPTY,
  row([19, "o"], [23, "oo..oo"]),
  row([18, "oHooobboobbo"]),
  row([19, "obBHbbbbbo"]),
  row([20, "odbbbbbo"]),
  row([20, "obbbbBdo"]), // 10
  row([19, "oobbbBBdoo"]),
  row([17, "ooHbBBBddDbboo"]),
  row([15, "ooHHHHHbdDbbbbbboo"]),
  row([14, "oHHHHHHHbbbbbbbbbbBo"]),
  row([13, "oHHHHHHHHbbbbbbbbbbBBo"]),
  row([12, "oHHHHHHHHHbbbbbbbbbbBBBo"]),
  row([1, "oooo"], [11, "obHHHHHHHHHbbbbbbbbbbBBBBo"], [43, "oooo"]),
  row([0, "oHHbBo"], [11, "oHHHHHHHHHbbbbbbbbbbbBBBBo"], [42, "oHHbBo"]),
  row([0, "oHbbBo"], [10, "obHHHHHHHHbbbbbbbbbbbbBBBBdo"], [42, "oHbbBo"]),
  row([0, "bbbbBdo"], [10, "obHHHooooobbbbbbbboooooBBBdo"], [41, "obbbbBd"]), // 20
  row([0, "obBBdo"], [9, "obbHHoowwwoobbbbbboowwwooBBddo"], [42, "obBBdo"]),
  row([0, "odddDHo..obbHHowLLwwobbbbbbowLLwwoBBddo..obdddDo"]),
  row([1, "oHHHbbo.obbbbowLeewobbbbbbowLeewoBBddo.obbbBBo"]),
  row([2, "oHbbbboobbbbowweeeobbbbbbowweeeoBBddoobbbbBo"]),
  row([2, "obbbbboobbbbboweeobbbbbbbboweeoBBdddoobbbBBo"]),
  row([3, "obbbbBobbbbbbooobbbbbbbbbBoooBBBdddobbbbBo"]),
  row([4, "obbBBBbbbppbbbbbbbbbbbbbBBBBppddddbbbbBo"]),
  row([4, "obBBBddbbbbbbbbbbbbbbbbBBBBBBBdddbbbbBBo"]),
  row([5, "oBBdddbbbbbbbbbbbbmmbBBBBBBBdddBBBBBBo"]),
  row([5, "oBdddbbbbbbbbbbbbmbbmBBBBBBBdddddBBBBo"]), // 30
  row([6, "oddobbbbbbbbbbbbbmmBBBBBBBdddddDoBdo"]),
  row([7, "ooobbbbbbbbbbbbBBBBBBBBBddddddDooo"]),
  row([9, "oBbbbbbbbbbBBBBBBBBBBddddddDDo"]),
  row([9, "oBBBbbbbbBBBBBBBBBBBdddddddDDo"]),
  row([9, "oBBBBBBBBBBBBBBBBBBdddddddDDDo"]),
  row([9, "oBBBBBBBBBBBBBBBBBdddddddDDDDo"]),
  row([9, "oBBBBBBBBBBBBBBBddddddddDDDDDo"]),
  row([9, "oBBBBBBBBBBBBBdddddddddDDDDDDo"]),
  row([9, "oBBdddBBBBBBddddddddddDDDDDDDo"]),
  row([9, "oBdddddddddddddddddddDDDDDDDDo"]), // 40
  row([10, "odddddoodddddoodddDDooDDDDDo"]),
  row([11, "odddo..odddo..oDDDo..oDDDo"]),
  row([12, "ooo"], [19, "ooo"], [26, "ooo"], [33, "ooo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

/** 이불 유령 — 최종형(ghost_4). */
const GHOST_4: readonly string[] = [
  EMPTY, // 0
  row([22, "ooo"]),
  row([20, "ooRRRooooo"]),
  row([19, "orRRRRRRRRRoo"]),
  row([18, "orrRRRRsRRRRRRo"]),
  row([16, "oorrrRRRsssRRRRRRoo"]),
  row([15, "orrrrrrRRRsRRRRRRRRRo"]),
  row([15, "orrrrrrRRRRRRRRRRRRRRo"]),
  row([15, "orrrrrrRRRRRRRRRRRRRRtoo"]),
  row([15, "orrrrrrRRRRRRRRRRRRRRttto"]),
  row([14, "orrrrrrrRRRRRRRRRRRRRRttttoo"]), // 10
  row([14, "orrrrbHHbbbbbbbooRRRRRtttttto"]),
  row([14, "orrrHHHHHbbbbbbBoooRRRtttttttoo"]),
  row([13, "orrrHHHHHHbbbbbbbBo.ooRtttttUUUUo"]),
  row([14, "orbHHHHHHbbbbbbbBBo..ootttUUUUUUo"]),
  row([14, "obHHHHHHHbbbbbbbBBdo"], [37, "ootUUUUUUo"]),
  row([14, "obHHHHHHbbbbbbbbBBdo"], [39, "oUUUUUUo"]),
  row([14, "obHooooobbbboooooBBo"], [40, "oUUUUo"]),
  row([13, "obHoowwwoobboowwwooBdo..o"], [41, "oooo"]),
  row([13, "obHowLLwwobbowLLwwoBdo.ofo"]),
  row([13, "obHowLeewobbowLeewoBdo.oFo"]), // 20
  row([13, "obbowweeeobbowweeeoBdooFFFo"]),
  row([13, "obbboweeobbbboweeoBBdooFFFo"]),
  row([13, "obppbooobbbbbboooppddo.oho"]),
  row([13, "obbbbbbbbbbbbbbBBBBddooBBBo"]),
  row([13, "obbbbbbbbbmmbbBBBBBddooBBBo"]),
  row([13, "obbbbbbbbmbbmbbbbbBBdooBBBo"]),
  row([13, "obHHHHHHHbmmbbbbbbbbdooBBBo"]),
  row([13, "oHHHHHHHHbbbbbbbbbbbbooBBBo"]),
  row([13, "oHHHHHHHbbbbbbbbbbbbbobbbBdo"]),
  row([12, "oHHHHHHHbbbbbbbbbbbbbBBbbbBdo"]), // 30
  row([12, "oHHHHHbbbbbbbbbbbbbbbBbbBddo"]),
  row([11, "oHHHbbbbbbbbbbbbbbbbbBbbbbBo"]),
  row([11, "obbbbbbbbbbbbbbbbbbbBBBbbBo"]),
  row([10, "obbbbbbbbbbbbbbbbbbBBBBBBBBo"]),
  row([10, "obbbbbbbbbbbbbbbbbBBBBBBBBdo"]),
  row([10, "obbbbbbbbbbbbbbBBBBBBBBBdddo"]),
  row([9, "obbbbbbbbbbbbbBBBBBBBBBBdddddo"]),
  row([9, "obbbbbbbbbBBBBBBBBBBBBdddddddo"]),
  row([8, "oBBBBBBBBBBBBBBBBBBBBddddddddDDo"]),
  row([7, "ooBBBBBBBBBBBBBBBBBdddddddddDDDDooo"]), // 40
  row([5, "oobbbddBBBbbbBBBBdbbbdddddbbbDDDDDbbboo"]),
  row([4, "oHHbbbbBdHHbbbbBdHHbbbbBdHHbbbbBDHHbbbbBo"]),
  row([3, "obbbbbbBBbbbbbbBBbbbbbbBBbbbbbbBBbbbbbbBBdo"]),
  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다
];

export const LINEAGE_ART: Record<string, LineageArt> = {
  ember: {
    fur: "b", pad: "y",
    forms: [
      { pal: { body: ["#ff9468", "#f2643c", "#c23b22"], belly: ["#fff3d9", "#ffe1ad", "#e8bd7e"], a1: ["#fff6c0", "#ffc93f", "#f08a2e"], a2: ["#fffaf0", "#efe0b8", "#b89a62"], eye: "#2b2440" }, body: EMBER_2 },
      { pal: { body: ["#ff9468", "#f2643c", "#c23b22"], belly: ["#fff3d9", "#ffe1ad", "#e8bd7e"], a1: ["#fff6c0", "#ffc93f", "#f08a2e"], a2: ["#fffaf0", "#efe0b8", "#b89a62"], eye: "#2b2440" }, body: EMBER_3 },
      { pal: { body: ["#ff9468", "#f2643c", "#c23b22"], belly: ["#fff3d9", "#ffe1ad", "#e8bd7e"], a1: ["#fff6c0", "#ffc93f", "#f08a2e"], a2: ["#fffaf0", "#efe0b8", "#b89a62"], eye: "#2b2440" }, body: EMBER_4 },
    ],
  },
  volt: {
    fur: "q", pad: "Q",
    forms: [
      { pal: { body: ["#aebdff", "#7388f3", "#4656c6"], belly: ["#ffffff", "#fffaf0", "#cdd6ff"], a1: ["#fffbd0", "#ffe14a", "#e8a317"], beak: ["#ffd9a0", "#ffb347", "#e08a1e"], eye: "#2b2440" }, body: VOLT_2 },
      { pal: { body: ["#aebdff", "#7388f3", "#4656c6"], belly: ["#ffffff", "#fffaf0", "#cdd6ff"], a1: ["#fffbd0", "#ffe14a", "#e8a317"], beak: ["#ffd9a0", "#ffb347", "#e08a1e"], eye: "#2b2440" }, body: VOLT_3 },
      { pal: { body: ["#aebdff", "#7388f3", "#4656c6"], belly: ["#ffffff", "#fffaf0", "#cdd6ff"], a1: ["#fffbd0", "#ffe14a", "#e8a317"], beak: ["#ffd9a0", "#ffb347", "#e08a1e"], eye: "#2b2440" }, body: VOLT_4 },
    ],
  },
  burr: {
    fur: "c", pad: "C",
    forms: [
      { pal: { body: ["#e0a56a", "#b06f3e", "#703f20"], belly: ["#fff6e0", "#ffe6b8", "#ecc890"], a2: ["#b6f0a0", "#6fcf5a", "#3d9433"], eye: "#2b2440" }, body: BURR_2 },
      { pal: { body: ["#dcb78e", "#bb8c5e", "#8a5f3a"], belly: ["#fff6e0", "#ffe6b8", "#ecc890"], mark: ["#a47446", "#6f4829", "#43291a"], a1: ["#ffffff", "#fff6e0", "#e8d9bd"], a2: ["#b6f0a0", "#6fcf5a", "#3d9433"], eye: "#2b2440" }, body: BURR_3 },
      { pal: { body: ["#dcb78e", "#bb8c5e", "#8a5f3a"], belly: ["#fff6e0", "#ffe6b8", "#ecc890"], mark: ["#a47446", "#6f4829", "#43291a"], a1: ["#ffffff", "#fff6e0", "#e8d9bd"], a2: ["#b6f0a0", "#6fcf5a", "#3d9433"], eye: "#2b2440" }, body: BURR_4 },
    ],
  },
  puff: {
    fur: "b", pad: "A",
    forms: [
      { pal: { body: ["#ffffff", "#f6f3ff", "#c4bcee"], belly: ["#ffe9dc", "#ffd0b4", "#e8a688"], mark: ["#ece4ff", "#b9a6f0", "#8a72d4"], a1: ["#ffc6dc", "#ff8fbb", "#e0558f"], a2: ["#fff2a8", "#ffd34f", "#e8a317"], a3: ["#c4f0ff", "#7fd8f0", "#46b6dd"], eye: "#2b2440" }, body: PUFF_2 },
      { pal: { body: ["#ffffff", "#f6f3ff", "#c4bcee"], belly: ["#ffe9dc", "#ffd0b4", "#e8a688"], mark: ["#ece4ff", "#b9a6f0", "#8a72d4"], a1: ["#ffc6dc", "#ff8fbb", "#e0558f"], a2: ["#fff2a8", "#ffd34f", "#e8a317"], a3: ["#c4f0ff", "#7fd8f0", "#46b6dd"], eye: "#2b2440" }, body: PUFF_3 },
      { pal: { body: ["#ffffff", "#f6f3ff", "#c4bcee"], belly: ["#ffe9dc", "#ffd0b4", "#e8a688"], mark: ["#ece4ff", "#b9a6f0", "#8a72d4"], a1: ["#ffc6dc", "#ff8fbb", "#e0558f"], a2: ["#fff2a8", "#ffd34f", "#e8a317"], a3: ["#c4f0ff", "#7fd8f0", "#46b6dd"], eye: "#2b2440" }, body: PUFF_4 },
    ],
  },
  leaf: {
    fur: "b", pad: "y",
    forms: [
      { pal: { body: ["#b2f28f", "#5fc84a", "#2f7f36"], belly: ["#fffbd0", "#fff0a0", "#e8cf6a"], mark: ["#7fd96a", "#3f9a3c", "#256a2a"], a1: ["#9be87a", "#3d9433", "#1f6a28"], a2: ["#ffd0e2", "#ff7fae", "#d94a85"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: LEAF_2 },
      { pal: { body: ["#b2f28f", "#5fc84a", "#2f7f36"], belly: ["#fffbd0", "#fff0a0", "#e8cf6a"], mark: ["#7fd96a", "#3f9a3c", "#256a2a"], a1: ["#9be87a", "#3d9433", "#1f6a28"], a2: ["#ffd0e2", "#ff7fae", "#d94a85"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: LEAF_3 },
      { pal: { body: ["#b2f28f", "#5fc84a", "#2f7f36"], belly: ["#fffbd0", "#fff0a0", "#e8cf6a"], mark: ["#7fd96a", "#3f9a3c", "#256a2a"], a1: ["#9be87a", "#3d9433", "#1f6a28"], a2: ["#ffd0e2", "#ff7fae", "#d94a85"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: LEAF_4 },
    ],
  },
  beetle: {
    fur: "A", pad: "a",
    forms: [
      { pal: { body: ["#fffaf0", "#f6e8cc", "#cdb98e"], belly: ["#fffaf0", "#f6e8cc", "#cdb98e"], mark: ["#f6bf78", "#d98a3c", "#97501f"], eye: "#2b2440" }, body: BEETLE_2 },
      { pal: { body: ["#eaa45e", "#c26a2e", "#7a3a18"], belly: ["#ffe1ad", "#f0c080", "#c89850"], mark: ["#a8602c", "#6e3418", "#41200e"], a1: ["#9a8a80", "#5a4c44", "#302824"], a2: ["#ffe0a8", "#ffb347", "#e08a1e"], eye: "#2b2440" }, body: BEETLE_3 },
      { pal: { body: ["#eaa45e", "#c26a2e", "#7a3a18"], belly: ["#ffe1ad", "#f0c080", "#c89850"], mark: ["#a8602c", "#6e3418", "#41200e"], a1: ["#9a8a80", "#5a4c44", "#302824"], a2: ["#ffe0a8", "#ffb347", "#e08a1e"], eye: "#2b2440" }, body: BEETLE_4 },
    ],
  },
  conch: {
    fur: "B", pad: "d",
    forms: [
      { pal: { body: ["#ffc9b0", "#ff9272", "#d85a3c"], belly: ["#fff1e0", "#ffdcc0", "#e8b08a"], mark: ["#ff9a7a", "#e0603f", "#a63a22"], a1: ["#fffaf0", "#f3e3cf", "#cdb394"], a2: ["#e6dcff", "#b18cf5", "#8259cf"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: CONCH_2 },
      { pal: { body: ["#ffc9b0", "#ff9272", "#d85a3c"], belly: ["#fff1e0", "#ffdcc0", "#e8b08a"], mark: ["#ff9a7a", "#e0603f", "#a63a22"], a1: ["#fffaf0", "#f3e3cf", "#cdb394"], a2: ["#e6dcff", "#b18cf5", "#8259cf"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: CONCH_3 },
      { pal: { body: ["#ffc9b0", "#ff9272", "#d85a3c"], belly: ["#fff1e0", "#ffdcc0", "#e8b08a"], mark: ["#ff9a7a", "#e0603f", "#a63a22"], a1: ["#fffaf0", "#f3e3cf", "#cdb394"], a2: ["#e6dcff", "#b18cf5", "#8259cf"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: CONCH_4 },
    ],
  },
  snow: {
    fur: "b", pad: "d",
    forms: [
      { pal: { body: ["#ffffff", "#f3f7ff", "#bccdee"], belly: ["#ffffff", "#f3f7ff", "#bccdee"], mark: ["#c99a6e", "#8a5f3a", "#5a3a22"], a1: ["#ffc4b8", "#ff6a5c", "#c23b3b"], a2: ["#6b7288", "#434860", "#272b3d"], a3: ["#ffd9a0", "#ff9a3c", "#d96a1e"], eye: "#2b2440" }, body: SNOW_2 },
      { pal: { body: ["#ffffff", "#f3f7ff", "#bccdee"], belly: ["#ffffff", "#f3f7ff", "#bccdee"], mark: ["#c99a6e", "#8a5f3a", "#5a3a22"], a1: ["#ffc4b8", "#ff6a5c", "#c23b3b"], a2: ["#6b7288", "#434860", "#272b3d"], a3: ["#ffd9a0", "#ff9a3c", "#d96a1e"], eye: "#2b2440" }, body: SNOW_3 },
      { pal: { body: ["#ffffff", "#f3f7ff", "#bccdee"], belly: ["#ffffff", "#f3f7ff", "#bccdee"], mark: ["#c99a6e", "#8a5f3a", "#5a3a22"], a1: ["#ffc4b8", "#ff6a5c", "#c23b3b"], a2: ["#6b7288", "#434860", "#272b3d"], a3: ["#ffd9a0", "#ff9a3c", "#d96a1e"], eye: "#2b2440" }, body: SNOW_4 },
    ],
  },
  bat: {
    fur: "B", pad: "d",
    forms: [
      { pal: { body: ["#c9a8ff", "#7a52d6", "#44268f"], belly: ["#f4eaff", "#dccbff", "#a98fe4"], mark: ["#9a72ec", "#5e3cb0", "#34206e"], a1: ["#fff6a8", "#ffd34f", "#e8a317"], a2: ["#ffd0e2", "#ff8fb8", "#d94a85"], eye: "#2b2440" }, body: BAT_2 },
      { pal: { body: ["#c9a8ff", "#7a52d6", "#44268f"], belly: ["#f4eaff", "#dccbff", "#a98fe4"], mark: ["#9a72ec", "#5e3cb0", "#34206e"], a1: ["#fff6a8", "#ffd34f", "#e8a317"], a2: ["#ffd0e2", "#ff8fb8", "#d94a85"], eye: "#2b2440" }, body: BAT_3 },
      { pal: { body: ["#c9a8ff", "#7a52d6", "#44268f"], belly: ["#f4eaff", "#dccbff", "#a98fe4"], mark: ["#9a72ec", "#5e3cb0", "#34206e"], a1: ["#fff6a8", "#ffd34f", "#e8a317"], a2: ["#ffd0e2", "#ff8fb8", "#d94a85"], eye: "#2b2440" }, body: BAT_4 },
    ],
  },
  ghost: {
    fur: "b", pad: "d",
    forms: [
      { pal: { body: ["#ffffff", "#f6f2ff", "#c9bff2"], belly: ["#ffffff", "#f6f2ff", "#c9bff2"], a1: ["#fff6a8", "#ffd34f", "#f08a2e"], a2: ["#a5b0ff", "#6672e0", "#3f49b0"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: GHOST_2 },
      { pal: { body: ["#ffffff", "#f6f2ff", "#c9bff2"], belly: ["#ffffff", "#f6f2ff", "#c9bff2"], a1: ["#fff6a8", "#ffd34f", "#f08a2e"], a2: ["#a5b0ff", "#6672e0", "#3f49b0"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: GHOST_3 },
      { pal: { body: ["#ffffff", "#f6f2ff", "#c9bff2"], belly: ["#ffffff", "#f6f2ff", "#c9bff2"], a1: ["#fff6a8", "#ffd34f", "#f08a2e"], a2: ["#a5b0ff", "#6672e0", "#3f49b0"], a3: ["#fff6a8", "#ffd34f", "#e8a317"], eye: "#2b2440" }, body: GHOST_4 },
    ],
  },
};


/* ── 수면 — 웅크린 몸(CURL, 종 공통)에 계보마다 머리 위 표식 하나 ─────────────────
 * 자는 모습은 모든 폼이 같은 웅크린 덩어리라(기존 SLEEP_EARS 와 같은 방식) 귀·볏 같은 머리 위 5행만 계보 것을 얹는다.
 * ⚠ 쓰는 글자는 그 폼 팔레트에 **정의된 것만** — 없는 글자는 투명하게 사라진다(lineage.test 가 잡는다).
 *   그래서 강조 램프(f F h …)가 없는 굼벵이는 마킹(A a)을 쓴다. */
const top5 = (...rows: string[]): string[] => [...Array<string>(5 - rows.length).fill(EMPTY), ...rows];
const SLEEP_TOP: Record<string, readonly string[]> = {
  ember: top5(row([23, "o"]), row([22, "ofo"]), row([21, "oFFfo"]), row([21, "oFFFo"]), row([22, "ohho"])),
  volt: top5(row([24, "oo"]), row([23, "oFfo"]), row([22, "ofFo"]), row([23, "oFFo"]), row([22, "ohho"])),
  burr: top5(row([17, "o"], [23, "o"], [29, "o"]), row([16, "oAo"], [22, "oAAo"], [28, "oAo"]), row([15, "oAAo"], [21, "oAAAAo"], [27, "oAAo"]), row([14, "oAAAAAAAAAAAAAAAAo"])),
  puff: top5(row([17, "ooo"], [22, "oooo"], [28, "ooo"]), row([16, "obbbo"], [21, "obbbbbo"], [27, "obbbo"]), row([15, "obbbbbbbbbbbbbbbbo"])),
  leaf: top5(row([19, "oo"], [27, "oo"]), row([18, "ofFo"], [26, "oFfo"]), row([19, "ohFo"], [25, "oFho"]), row([21, "oho"], [24, "oho"])),
  beetle: top5(row([24, "o"]), row([23, "oAo"]), row([23, "oAo"]), row([22, "oAAo"]), row([22, "oaao"])),
  conch: top5(row([24, "oo"]), row([22, "offFo"]), row([21, "oRfFFo"]), row([20, "oRRfFFFo"]), row([19, "orRRFFFFho"])),
  snow: top5(row([24, "g"]), row([22, "g"], [24, "L"], [26, "g"]), row([23, "ggg"]), row([22, "g"], [24, "g"], [26, "g"]), row([24, "g"])),
  bat: top5(row([14, "o"], [31, "o"]), row([13, "obo"], [30, "odo"]), row([13, "obio"], [29, "oido"]), row([13, "obbio"], [28, "oiddo"]), row([14, "obbbo"], [28, "odddo"])),
  ghost: top5(row([22, "o"], [26, "o"]), row([21, "obo"], [25, "obo"]), row([22, "obbbo"]), row([22, "obbbo"]), row([22, "ooooo"])),
};

/** 계보 폼의 걷기 프레임(6장) — 계보에 없는 폼이면 null. 몸은 정지, 다리(44~47행)만 공용 걸음이 움직인다. */
export function lineageFrames(form: string): Sprite[] | null {
  const hit = LINEAGE_OF_FORM[form];
  if (!hit) return null;
  const art = LINEAGE_ART[hit.lineage.key];
  const f = art.forms[hit.stage - 2];
  return bodyFrames(f.body, art.fur, art.pad)(lineagePalette(f.pal));
}

/** 계보 폼의 수면 스프라이트 — 계보에 없는 폼이면 null. */
export function lineageSleep(form: string): Sprite | null {
  const hit = LINEAGE_OF_FORM[form];
  if (!hit) return null;
  const f = LINEAGE_ART[hit.lineage.key].forms[hit.stage - 2];
  return { w: 48, h: 48, pal: lineagePalette(f.pal), rows: bottomAlign([...SLEEP_TOP[hit.lineage.key], ...CURL]) };
}
