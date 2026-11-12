// 위에서 본 몸 윤곽(2026-11-12) — 방추형으로 고친다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PEDUNCLE, fusiformWidth, topViewWidths, tubeRings } from "./topview.ts";

/** 가짜 모델: 고리 R=17 × 41 개(x 2 → -2, 주둥이부터) + 판 정점. 옆 폭은 '구슬'처럼 출렁이고 꼬리가 다시 부풀며, 가운데 고리는 등지느러미 혹만큼 솟았다 */
function fake() {
  const P: number[] = [], fin: number[] = [];
  const R = 17, rows = 41;
  for (let r = 0; r < rows; r++) {
    const s = r / (rows - 1), x = 2 - 4 * s, u = 1 - s;
    const body = Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.5;
    const flare = u < 0.15 ? (0.15 - u) * 2 : 0; // 꼬리가 다시 부푼다
    const side = (body + flare) * 0.4 * (1 + 0.1 * Math.sin(r * 1.7)) + 0.01; // 구슬
    const hump = r >= 18 && r <= 22 ? 0.35 : 0; // 등지느러미 혹
    for (let j = 0; j < R; j++) {
      const th = (j / (R - 1)) * Math.PI * 2, half = body + flare + 0.02;
      const y = Math.cos(th) > 0 ? Math.cos(th) * (half + hump) : Math.cos(th) * half;
      P.push(x, y, Math.sin(th) * side); fin.push(0);
    }
  }
  for (let i = 0; i < 40; i++) { P.push(1.5 - i * 0.08, 0.1, 0.004); fin.push(0); } // 판
  return { P: new Float32Array(P), fin: new Float32Array(fin), R, rows };
}

test("튜브 고리를 찾는다 · 고리가 없으면 손대지 않는다", () => {
  const { P, R, rows } = fake();
  assert.deepEqual(tubeRings(P, 4), { R, count: rows });
  const rnd = new Float32Array(300).map((_, i) => Math.sin(i * 12.9898) * 2);
  assert.equal(topViewWidths(rnd, new Float32Array(100)), null);
});

test("방추형 목표 — 주둥이 0 · 가장 넓은 곳 1 · 꼬리자루 PEDUNCLE · 꼬리 쪽은 더 얇다", () => {
  assert.equal(fusiformWidth(1, 0.68, 0.25), 0);
  assert.equal(fusiformWidth(0.68, 0.68, 0.25), 1);
  assert.ok(Math.abs(fusiformWidth(0.25, 0.68, 0.25) - PEDUNCLE) < 1e-9);
  assert.ok(fusiformWidth(0.05, 0.68, 0.25) < PEDUNCLE);
});

test("고친 뒤 — 몸 가운데 폭이 매끈하게(구슬 없음) · 꼬리가 다시 부풀지 않는다 · 등지느러미 혹은 얇아진다 · 옆모습(x, y)은 그대로", () => {
  const { P, fin, R, rows } = fake();
  const out = topViewWidths(P, fin);
  assert.ok(out);
  const width = (r: number) => { let m = 0; for (let j = 0; j < R; j++) m = Math.max(m, Math.abs(out.z[r * R + j])); return m; };
  const w = Array.from({ length: rows }, (_, r) => width(r)); // 주둥이(0) → 꼬리(40)
  const before = Array.from({ length: rows }, (_, r) => { let m = 0; for (let j = 0; j < R; j++) m = Math.max(m, Math.abs(P[(r * R + j) * 3 + 2])); return m; });
  // 출렁임(넓어졌다 좁아졌다 바뀌는 횟수) — 구슬 모양이 줄었다
  const turns = (v: number[]) => { const tol = Math.max(...v) * 0.01; let n = 0, dir = 0; for (let r = 1; r < v.length; r++) { const d = v[r] - v[r - 1]; if (Math.abs(d) < tol) continue; const sg = Math.sign(d); if (dir && sg !== dir) n++; dir = sg; } return n; };
  assert.ok(turns(w) < turns(before) / 2, `출렁임 ${turns(before)} → ${turns(w)}`);
  const peak = w.indexOf(Math.max(...w));
  assert.ok(peak >= 10 && peak <= 22, `가장 넓은 곳은 몸 앞쪽 (${peak})`);
  // 꼬리가 다시 부풀지 않는다 — 꼬리 끝 넷은 꼬리자루보다 넓지 않다
  const ped = Math.min(...w.slice(28, 36));
  for (let r = 37; r < rows; r++) assert.ok(w[r] <= ped + 1e-6, `꼬리 ${r}`);
  // 혹 꼭대기 근처 정점은 거의 판처럼 얇다
  let humpZ = 0; for (let j = 0; j < R; j++) { const i = 20 * R + j; if (P[i * 3 + 1] > 0.8) humpZ = Math.max(humpZ, Math.abs(out.z[i])); }
  assert.ok(humpZ < 0.03, `등지느러미 혹 ${humpZ}`);
  for (let i = 0; i < P.length / 3; i++) assert.ok(Number.isFinite(out.z[i]));
});

test("수조가 쓰는 곳 — 받을 때 한 번 · 방추형이 아닌 몸은 빼고 · 법선 · 그림 자리도 함께", () => {
  const glb = readFileSync(join(process.cwd(), "src/lib/aqua3d/glb.ts"), "utf8");
  assert.match(glb, /prepareFishSource\(scene, key\)/);
  assert.match(glb, /if \(fusiform\(key\)\) scene\.traverse/);
  assert.match(glb, /flounder\|ray\|manta\|jelly\|starfish\|octopus\|squid\|kraken\|eel/);
  assert.match(glb, /nor\.setXYZ\(i, nx \/ l, ny \/ l, nz \/ l\)/);
  assert.match(glb, /uvA\.setY\(i, out\.v\[i\]\)/);
  assert.match(glb, /g\.userData\.aquaTop = true/, "같은 형상은 한 번만");
});

test("등의 그림 · 테두리 띠(2026-11-12) — 윗반쪽을 각도에 고르게 펴서 찍는다(줄무늬 · 번진 결 없음) · 판의 테두리 띠는 튜브 안으로 접는다", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/aqua3d/topview.ts"), "utf8");
  assert.match(src, /const f = 1 - Math\.acos\(Math\.min\(1, c\)\) \/ \(Math\.PI \/ 2\)/, "각도에 고르게");
  assert.match(src, /const lo = ycR \+ 0\.55 \* halfR, yIn = Math\.max\(lo,/, "고리 위쪽 55% 아래는 안 찍는다");
  assert.match(src, /if \(yi > hiY && yi - hiY < rim\) \{ y\[i\] = hiY - tuck;/, "테두리 띠는 튜브 안으로");
  const glb = readFileSync(join(process.cwd(), "src/lib/aqua3d/glb.ts"), "utf8");
  assert.match(glb, /if \(dy\) pos\.setY\(i, pos\.getY\(i\) \+ dy \/ s\);/);
});

test("그림의 빛 띠를 피한다(2026-11-12 백상아리 흰 무늬) — 등 보통 밝기보다 확 밝은 고리만 아래로 옮긴다 · 밝기를 모르면 그대로", () => {
  // 고리 41 × 17 튜브 하나 — 그림 v 는 y 에 곧게. 가운데(고리 20)의 등 높이 줄만 아주 밝다
  const P: number[] = [], UV: number[] = [], R = 17, rows = 41;
  for (let r = 0; r < rows; r++) for (let j = 0; j < R; j++) {
    const th = (j / (R - 1)) * Math.PI * 2, x = 2 - 4 * (r / (rows - 1)), half = 0.5;
    const y = Math.cos(th) * half, z = Math.sin(th) * 0.2;
    P.push(x, y, z); UV.push((x + 2) / 4, 0.5 - y * 0.5);
  }
  const fin = new Float32Array(rows * R);
  const vTop = (out: ReturnType<typeof topViewWidths>, r: number) => out!.v![r * R]; // j=0 = 꼭대기
  const bright = (u: number, v: number) => (u > 0.48 && u < 0.52 && v < 0.4 ? 0.95 : 0.4); // 가운데 고리 근처 등 위쪽만 빛 띠
  const plain = topViewWidths(new Float32Array(P), fin, new Float32Array(UV))!;
  const fixed = topViewWidths(new Float32Array(P), fin, new Float32Array(UV), bright)!;
  assert.ok(vTop(fixed, 20) > vTop(plain, 20), `빛 띠 고리는 아래를 찍는다 ${vTop(plain, 20)} → ${vTop(fixed, 20)}`);
  assert.equal(vTop(fixed, 5), vTop(plain, 5), "보통 고리는 그대로(고리마다 높이가 달라져 줄이 생기지 않게)");
  assert.ok(bright(UV[20 * R * 2], vTop(fixed, 20)) < 0.6, "옮긴 자리는 보통 밝기");
});
