// 낚시 ↔ 3D 수조 경계 lock. [사용자 2026-11-02 "딱 수조와 물고기에 대한 3D 엔진으로 변경이야 다른건 2D 형태로"]
// 3D 는 수조 안쪽뿐이다. 낚시는 2D 로 남고, 낚시를 여는 것만으로 three 를 받으면 안 되고, 낚시 카드의 2D 물고기 그림이 사라지면 안 된다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FAMILIES, fishArtKey } from "./aquarium.ts";
import { FISH_IMAGE_KEYS, TANK_IMAGE_KEYS } from "./aquaimages.ts";
import { FishFx, type FxCanvas } from "./fishingfx.ts";

const root = process.cwd();
const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** 정적 import 만 따라간다 — import type 과 import() 는 번들에 안 묶인다 */
function reach(entry: string) {
  const seen = new Set<string>(), bare = new Set<string>(), todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of code(f).matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+"([^"]+)"/gm)) {
      const spec = m[1];
      const base = spec.startsWith("@/") ? join(root, "src", spec.slice(2)) : spec.startsWith(".") ? join(dirname(f), spec) : null;
      if (!base) { bare.add(spec); continue; }
      const hit = [base, base + ".ts", base + ".tsx"].find((p) => existsSync(p) && /\.tsx?$/.test(p));
      if (hit) todo.push(hit);
    }
  }
  return { seen, bare };
}

test("게임 탭 · 낚시를 여는 것만으로 3D 엔진을 받지 않는다 — 수조를 열 때 지연 로드", () => {
  for (const entry of ["src/components/GameArcade.tsx", "src/components/FishingGame.tsx"]) {
    const { seen, bare } = reach(join(root, entry));
    assert.ok(!bare.has("three"), `${entry} 가 three 를 정적으로 싣는다`);
    assert.ok(![...seen].some((f) => /aqua3d[\\/](scene|models|decor)/.test(f)), `${entry} → 3D 장면`);
  }
  const fx = code(join(root, "src/lib/fishingfx.ts"));
  assert.doesNotMatch(fx, /from "three"|WebGL/, "낚시 연출은 2D 캔버스");
});

test("낚시로 잡히는 모든 형태에 2D 그림이 있다 — 결과 카드 · 게임 카드가 쓴다(수조가 3D 가 돼도 지우지 않는다)", () => {
  let n = 0;
  for (const f of FAMILIES) {
    const forms = [{ family: f.key, stage: 0 as const }, { family: f.key, stage: 1 as const }, ...f.finals.map((x) => ({ family: f.key, stage: 2 as const, species: x.key }))];
    for (const c of forms) {
      const key = fishArtKey(c);
      n++;
      assert.ok(FISH_IMAGE_KEYS.has(key), key);
      assert.ok(existsSync(join(root, "public/aqua/fish", `${key}.webp`)), key);
    }
  }
  assert.equal(n, 411);
  for (const k of TANK_IMAGE_KEYS) assert.ok(existsSync(join(root, "public/aqua/tank", `${k}.webp`)), `게임 카드 배경 ${k}`);
  assert.ok(code(join(root, "src/components/FishingGame.tsx")).includes("<FishArt"));
});

test("수조가 위에 열리면 낚시터는 그리기를 멈춘다 · 돌아오면 멈춘 시간을 몰아서 돌리지 않는다", () => {
  const g = globalThis as unknown as { requestAnimationFrame: (f: unknown) => number; cancelAnimationFrame: (n: number) => void };
  const saved = [g.requestAnimationFrame, g.cancelAnimationFrame];
  let asked = 0, cancelled = 0;
  g.requestAnimationFrame = () => ++asked;
  g.cancelAnimationFrame = () => { cancelled++; };
  try {
    const canvas: FxCanvas = { width: 0, height: 0, getContext: () => null };
    const fx = new FishFx(canvas);
    fx.resume();
    assert.equal(asked, 0, "멈춘 적 없으면 아무것도 안 한다");
    fx.pause();
    assert.equal(cancelled, 1);
    fx.resume();
    assert.equal(asked, 1);
    fx.resume();
    assert.equal(asked, 1, "두 번 돌리지 않는다");
  } finally {
    [g.requestAnimationFrame, g.cancelAnimationFrame] = saved as [typeof g.requestAnimationFrame, typeof g.cancelAnimationFrame];
  }
  const src = code(join(root, "src/components/FishingGame.tsx"));
  assert.match(src, /fx\.pause\(\)/);
  assert.match(src, /fx\.resume\(\)/);
});

test("판이 돌아가는 동안 탭 · 수조로 못 나간다 — 나가면 힘겨루기가 안 보이는 채로 진행돼 놓친다", () => {
  const src = code(join(root, "src/components/FishingGame.tsx"));
  assert.match(src, /disabled=\{playing\} onClick=\{\(\) => \{ setTab\(k\)/);
  assert.match(src, /disabled=\{playing\} onClick=\{\(\) => setTankOpen\(true\)\}/);
  assert.ok(src.includes("수조에서 보기"), "담은 뒤 바로 보러 갈 수 있다");
});

test("그림 문서 — 전부 2D 라고 적혀 있다 · 공통 문장(물 없음)과 어긋나는 설명이 없다 · 낚싯대 규칙이 있다", () => {
  const doc = readFileSync(join(root, "design/FISHING-ART.md"), "utf8");
  assert.ok(doc.includes("전부 2D"));
  assert.ok(doc.includes("FX_ROD_ART"));
  assert.doesNotMatch(doc, /dripping|pouring|soggy|plain string/);
});
