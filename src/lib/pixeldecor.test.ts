// 데코 픽셀 아트 lock.
// [2026-08-03] "그래픽이 있는 모든 곳 픽셀로" 의 마지막 조각 — 데코 22종.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateSprite } from "./pixel.ts";
import { ALL_DECOR_SPRITES, decorSprite } from "./pixeldecor.ts";
import { DECORS } from "./island.ts";

test("모든 데코 스프라이트가 포맷 정합", () => {
  const errs: string[] = [];
  for (const [k, s] of Object.entries(ALL_DECOR_SPRITES)) errs.push(...validateSprite(s, k));
  assert.deepEqual(errs, [], errs.join("\n"));
});

test("엔진의 데코 키 22종이 전부 고유 아트를 가진다(튤립 폴백 금지)", () => {
  const tulip = decorSprite("tulip").rows.join("");
  const missing = DECORS.filter((d) => d.key !== "tulip" && decorSprite(d.key).rows.join("") === tulip).map((d) => d.key);
  assert.deepEqual(missing, [], `아트 없는 데코:\n${missing.join("\n")}`);
});

test("실루엣이 서로 다르다(색만 바꾼 복붙 금지)", () => {
  const shapes = new Set(DECORS.map((d) => decorSprite(d.key).rows.join("")));
  assert.equal(shapes.size, DECORS.length, `데코 ${DECORS.length}종 중 실루엣은 ${shapes.size}종뿐`);
});

test("바닥 정렬 — 마지막 행에 잉크가 닿아 있다(섬에서 떠 보이지 않게)", () => {
  const floating = DECORS.filter((d) => {
    const rows = decorSprite(d.key).rows;
    return !/[^.]/.test(rows[rows.length - 1]);
  }).map((d) => d.key);
  assert.deepEqual(floating, [], `바닥이 비어 떠 보이는 데코:\n${floating.join("\n")}`);
});

test("아트 진입점 일원화 — 컴포넌트가 decorArt/cropArt 를 직접 부르지 않는다", () => {
  // 픽셀/일러스트 분기를 각 자리에서 되풀이하면 한 곳만 빠뜨려도 화면마다 그림이 달라진다.
  // 허용: 진입점 컴포넌트(PetIcon/CropIcon/DecorIcon)와 씬(IslandScene) 내부.
  const ALLOW = new Set(["PetIcon.tsx", "CropIcon.tsx", "DecorIcon.tsx", "IslandScene.tsx", "EvoCinematic.tsx"]);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "art") walk(p);
        continue;
      }
      if (!p.endsWith(".tsx") || ALLOW.has(name)) continue;
      const src = readFileSync(p, "utf8");
      for (const fn of ["decorArt(", "cropArt(", "productArt("]) {
        if (src.includes(fn)) offenders.push(`${name}: ${fn}`);
      }
    }
  };
  walk(join(import.meta.dirname, "..", "components"));
  assert.deepEqual(offenders, [], `아트 함수 직접 호출:\n${offenders.join("\n")}`);
});
