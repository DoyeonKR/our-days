// 꾸미기 풍경 v2(도트 배경) lock. [2026-09-24]
// [사용자: "꾸미기 풍경 그래픽이야 너무 허접해 좀 퀄리티좀 올려야해"]
// 예전 풍경은 SVG 타원 셋 + 벡터 구름이었다(도트 장식이 벡터 팬케이크 위의 스티커). 지금은 배경 전체를
// 도트로 굽는다(lib/islandscape). 여기서 잠그는 것 — 값이 아니라 **관계**:
//   장식 칸이 전부 잔디 위인가 · 하늘/바다/잔디가 제자리인가 · 밤은 낮보다 어두운가 · 별은 밤에만 ·
//   계절이 확실히 다른가 · 질감이 있는가(평평한 한 색 금지) · 결정적인가(Math.random 금지).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PET_SPOT,
  SCAPE_H,
  SCAPE_HORIZON,
  SCAPE_W,
  type Buf,
  inLawn,
  lawnHalfAt,
  lightK,
  lightPosOf,
  litPalette,
  onBeach,
  paintIslandscape,
  scapeRows,
} from "./islandscape.ts";
import { skyLook, type SkyPhase } from "./scenetime.ts";

const px = (b: Buf, x: number, y: number) => {
  const i = (y * b.w + x) * 4;
  return [b.data[i], b.data[i + 1], b.data[i + 2]] as const;
};
const lum = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const paint = (phase: SkyPhase, season: "spring" | "summer" | "autumn" | "winter") =>
  paintIslandscape(skyLook(phase, season), phase, season);
/** 잔디 가운데 영역의 평균색 */
function lawnMean(b: Buf) {
  const acc = [0, 0, 0];
  let n = 0;
  for (let y = 120; y < 170; y += 2) for (let x = 90; x < 250; x += 2) {
    if (!inLawn(x, y)) continue;
    const c = px(b, x, y);
    acc[0] += c[0];
    acc[1] += c[1];
    acc[2] += c[2];
    n++;
  }
  return acc.map((v) => v / n);
}

test("장식 칸은 전부 잔디 위 — 줄 수(4·5·6)가 바뀌어도, 가장자리에서 12도트 안쪽", () => {
  for (const rows of [4, 5, 6]) {
    const table = scapeRows(rows);
    assert.equal(table.length, rows);
    for (const [y, half] of table) {
      for (let col = 0; col < 6; col++) {
        const x = 170 + (col / 5 - 0.5) * 2 * half;
        assert.ok(inLawn(Math.round(x), y), `rows=${rows} (${col}, y=${y}) 가 잔디 밖`);
        assert.ok(half + 12 <= lawnHalfAt(y), `rows=${rows} y=${y}: 가장자리 여유가 없다`);
      }
    }
    // 기본 4줄도 잔디 앞쪽까지 편다 — 예전엔 뒤에만 몰려 앞 절반이 텅 비었다
    assert.ok(table[rows - 1][0] >= 175, `rows=${rows}: 앞줄이 너무 뒤(${table[rows - 1][0]})`);
  }
});

test("펫은 앞 해변(모래) 위에 선다 — 잔디 밖, 바다 아님", () => {
  assert.ok(onBeach(PET_SPOT.x, PET_SPOT.y - 1), "펫 발밑이 모래가 아니다");
});

test("하늘 · 바다 · 잔디가 제자리 — 한낮 봄", () => {
  const b = paint("day", "spring");
  assert.equal(b.w, SCAPE_W);
  assert.equal(b.h, SCAPE_H);
  const sky = px(b, 170, 6);
  assert.ok(sky[2] > sky[0] && sky[2] > 150, `하늘 위쪽이 파랗지 않다: ${sky}`);
  const sea = px(b, 6, SCAPE_H - 4);
  assert.ok(sea[2] > sea[0] + 40, `바다가 파랗지 않다: ${sea}`);
  const [r, g, bl] = lawnMean(b);
  assert.ok(g > r && g > bl, `봄 잔디가 초록이 아니다: ${[r, g, bl].map(Math.round)}`);
  // 수평선 위아래가 다르다(하늘 → 바다)
  assert.notDeepEqual(px(b, 20, SCAPE_HORIZON - 12), px(b, 20, SCAPE_HORIZON + 12));
});

test("밤은 낮보다 어둡다 — 섬(잔디)까지 같은 조명", () => {
  const day = lum(lawnMean(paint("day", "summer")));
  const night = lum(lawnMean(paint("night", "summer")));
  assert.ok(night < day * 0.7, `밤 잔디(${night.toFixed(0)})가 낮(${day.toFixed(0)})만큼 밝다`);
  // 장식·펫에 입히는 조명도 같은 방향
  const pal = { a: "#ffffff" };
  assert.ok(lum(hex(litPalette(pal, skyLook("night", "summer")).a)) < lum(hex(litPalette(pal, skyLook("day", "summer")).a)));
  assert.ok(lightK(skyLook("day", "summer")) < 0.1, "한낮 조명이 장식을 물들인다");
});
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test("별은 밤에만 — 한낮 하늘엔 없다", () => {
  const count = (b: Buf, avoid: { x: number; y: number }) => {
    let n = 0;
    for (let y = 2; y < SCAPE_HORIZON - 14; y++) for (let x = 1; x < SCAPE_W - 1; x++) {
      if (Math.abs(x - avoid.x) < 22 && Math.abs(y - avoid.y) < 22) continue;
      // 별 = 둘레(상하좌우)보다 확연히 밝은 **외딴 한 점**. 층운·구름 가장자리는 가로로 이어져서 안 걸린다
      const c = px(b, x, y);
      const L = lum(c);
      const around = [px(b, x - 1, y), px(b, x + 1, y), px(b, x, y - 1), px(b, x, y + 1)].map(lum);
      if (c[0] > 150 && around.every((v) => L > v + 30)) n++;
    }
    return n;
  };
  assert.ok(count(paint("night", "winter"), lightPosOf("night")) >= 15, "밤하늘에 별이 없다");
  assert.equal(count(paint("day", "winter"), lightPosOf("day")), 0, "한낮에 별이 떴다");
});

test("계절이 확실히 다르다 — 잔디 평균색 차이(Δ≥20)", () => {
  const seasons = ["spring", "summer", "autumn", "winter"] as const;
  const means = seasons.map((s) => lawnMean(paint("day", s)));
  for (let i = 0; i < seasons.length; i++) for (let j = i + 1; j < seasons.length; j++) {
    const d = Math.max(...means[i].map((v, k) => Math.abs(v - means[j][k])));
    assert.ok(d >= 20, `${seasons[i]}↔${seasons[j]} 잔디가 같아 보인다(Δ${d.toFixed(0)})`);
  }
});

test("질감이 있다 — 잔디는 한 색 판이 아니다(예전 SVG 타원은 톤 3개가 전부였다)", () => {
  const b = paint("day", "summer");
  const colors = new Set<string>();
  for (let y = 110; y < 190; y++) for (let x = 60; x < 280; x++) if (inLawn(x, y)) colors.add(px(b, x, y).join(","));
  assert.ok(colors.size >= 6, `잔디 색이 ${colors.size}개뿐`);
});

test("결정적 — 같은 시간대·계절이면 같은 그림(두 사람이 같은 섬을 본다), Math.random 금지", () => {
  const a = paint("golden", "autumn");
  const b = paint("golden", "autumn");
  assert.deepEqual(a.data, b.data);
  const src = readFileSync(join(import.meta.dirname, "islandscape.ts"), "utf8").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/Math\.random\s*\(/.test(src), "Math.random 이 들어왔다");
});

test("씬은 굽힌 배경을 쓴다 — 벡터 타원 섬으로 되돌아가지 않는다", () => {
  const scene = readFileSync(join(import.meta.dirname, "..", "components", "island", "IslandScene.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.match(scene, /bufUrl\(`scape:\$\{key\}`, \(\) => paintIslandscape\(/, "배경을 굽지 않는다");
  assert.ok(!/<ellipse[^>]*SAND\./.test(scene) && !/GRASS_TONE/.test(scene), "옛 벡터 섬(모래·잔디 타원)이 돌아왔다");
  // 장식·펫에도 섬의 조명을 입힌다
  assert.ok((scene.match(/litPalette\(/g) ?? []).length >= 2, "장식·펫이 조명을 안 받는다(스티커처럼 뜬다)");
  // 펫은 누르기를 안 받는다 — 앞줄 장식 위에 서 있다
  assert.ok(scene.includes('${PET_SPOT.y - 44})`} pointerEvents="none"'), "펫이 앞줄 장식 누르기를 가로챈다");
});
