// 우리 섬 아트 계약 회귀 lock. [2026-07-22]
// 사용자: "알이나 나머지 아이콘들을 그냥 이모지로 퉁치지 말고 정말 게임답게" + "꾸미기도 성의 없음".
// → 엔티티(펫/작물/가공품/데코) 전부에 자체 SVG 아트를 만들었다. 이 테스트가 막는 회귀:
//   (1) 엔진에 엔티티를 추가했는데 아트를 안 만들어 '빈 칸'이 되는 것,
//   (2) key 오타로 아트가 조용히 fallback 되는 것,
//   (3) 외부 이미지/랜덤 도입(오프라인 PWA·purity 위반),
//   (4) 이모지로 되돌아가는 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CROPS, DECORS, PET_FORMS, PRODUCTS } from "../../../lib/island.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, f), "utf8");
const pets = read("pets.tsx");
const crops = read("crops.tsx");
const decor = read("decor.tsx");
const parts = read("parts.tsx");
const scene = readFileSync(join(here, "../IslandScene.tsx"), "utf8");
const all = [pets, crops, decor, parts, scene];

test("아트 커버리지 — 엔진의 모든 엔티티 key 에 아트가 존재 [회귀 lock]", () => {
  // 펫 22종: PET_ART 매핑에 key 가 문자열로 등장해야 함
  for (const key of Object.keys(PET_FORMS)) {
    assert.ok(
      new RegExp(`\\b${key}\\s*:`).test(pets),
      `펫 '${key}' 아트 누락 — PET_ART 에 매핑 필요`,
    );
  }
  // 작물 8종
  for (const c of CROPS) {
    assert.ok(new RegExp(`\\b${c.key}\\b`).test(crops), `작물 '${c.key}' 아트 누락`);
  }
  // 가공품 6종
  for (const p of PRODUCTS) {
    assert.ok(new RegExp(`\\b${p.key}\\b`).test(crops), `가공품 '${p.key}' 아트 누락`);
  }
  // 데코 22종
  for (const d of DECORS) {
    assert.ok(new RegExp(`\\b${d.key}\\s*:`).test(decor), `데코 '${d.key}' 아트 누락`);
  }
});

test("아트 규칙 — 외부 이미지·랜덤 금지(오프라인 PWA·purity) [회귀 lock]", () => {
  for (const src of all) {
    assert.ok(!/<img\b/i.test(src), "외부 <img> 금지 — inline SVG 만");
    assert.ok(!/<image\b/i.test(src), "<image href> 금지 — 외부 리소스");
    assert.ok(!/https?:\/\/[^\s"')]+\.(png|jpe?g|gif|webp|svg)/i.test(src), "외부 이미지 URL 금지");
    assert.ok(!/Math\.random\s*\(/.test(src), "Math.random 금지 — react purity(렌더 중 랜덤)");
  }
});

test("아트 파운데이션 계약 — 공용 파츠/팔레트 사용 [회귀 lock]", () => {
  // parts.tsx 가 단일 기준을 제공
  for (const sym of ["GROUND_Y", "PAL", "INK", "export function Art", "GroundShadow", "Eyes"]) {
    assert.ok(parts.includes(sym), `parts.tsx 에 ${sym} 필요`);
  }
  // viewBox 는 Art 컨테이너가 고정 — 아트 파일이 제각각 <svg viewBox> 를 직접 열지 않아야 톤이 유지됨
  assert.ok(parts.includes('viewBox="0 0 100 100"'), "Art 는 100x100 viewBox 고정");
  // 각 아트 파일은 parts 를 import 해서 팔레트/파츠를 공유해야 함(제각각 색 금지)
  for (const [name, src] of [["pets", pets], ["crops", crops], ["decor", decor]] as const) {
    assert.ok(/from\s+["']\.\/parts["']/.test(src), `${name}.tsx 는 ./parts 를 import 해야 함`);
    assert.ok(src.includes("PAL"), `${name}.tsx 는 공용 팔레트 PAL 사용`);
  }
});

test("섬 씬 — 격자 UI 가 아니라 풍경(하늘·바다·섬) + 원근 배치 [회귀 lock]", () => {
  // 옛 구현(검은 네모 격자)으로 되돌아가는 회귀 차단
  for (const kw of ["하늘", "바다", "slotPos", "DECOR_COLS", "petArt", "decorArt"]) {
    assert.ok(scene.includes(kw), `IslandScene 에 '${kw}' 필요`);
  }
  // 행마다 스케일/반너비가 달라야 '원근'(평면 격자 아님)
  assert.ok(/ROWS[\s\S]{0,240}0\.7[0-9]/.test(scene), "행별 원근 스케일 테이블 필요");
  // 계절 4종 + 시간대(밤) 반영
  for (const s of ["spring", "summer", "autumn", "winter", "night"]) {
    assert.ok(scene.includes(s), `씬에 ${s} 반영 필요`);
  }
  // 애니메이션은 CSS 로(랜덤/타이머 없이) + 접근성 존중
  assert.ok(scene.includes("prefers-reduced-motion"), "모션 최소화 존중");
});

test("IslandGame — 게임 엔티티를 이모지 대신 아트로 렌더 [회귀 lock]", () => {
  const game = readFileSync(join(here, "../../IslandGame.tsx"), "utf8");
  // 아트 컴포넌트를 실제로 쓰고 있어야 함
  for (const sym of ["petArt", "IslandScene"]) {
    assert.ok(game.includes(sym), `IslandGame 이 ${sym} 를 사용해야 함`);
  }
  // 펫 메인 표시가 이모지 한 글자로 되돌아가지 않게
  assert.ok(
    !/text-6xl[^>]*>\{pf\.emoji\}/.test(game),
    "펫 메인 표시를 이모지(text-6xl {pf.emoji})로 되돌리지 말 것",
  );
  // 꾸미기 격자(검은 네모 + 이모지)로 회귀 금지
  assert.ok(
    !/\{it \? decorDef\(it\.key\)\.emoji : ""\}/.test(game),
    "꾸미기를 이모지 격자로 되돌리지 말 것 — IslandScene 사용",
  );
});
