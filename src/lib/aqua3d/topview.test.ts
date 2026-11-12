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

test("가슴지느러미(2026-11-12 가시처럼 보임) — 세로로 선 부채를 눕히고 꼬리 쪽으로 젖혀 위에서 보면 앞뒤로 펼친 잎", () => {
  // 고리 41 × 17 튜브 + 오른쪽(+z) 가운데에 세로로 선 부채 가장자리 6 정점(지느러미 뼈) — 원래 앞뒤 폭은 몸길이의 1%
  const P: number[] = [], fin: number[] = [], R = 17, rows = 41;
  for (let r = 0; r < rows; r++) for (let j = 0; j < R; j++) {
    const th = (j / (R - 1)) * Math.PI * 2, x = 2 - 4 * (r / (rows - 1)), half = 0.5 * Math.sin(Math.PI * (0.05 + 0.9 * (r / (rows - 1))));
    P.push(x, Math.cos(th) * half, Math.sin(th) * half * 0.6); fin.push(0);
  }
  const arc: number[] = [];
  for (let a = 0; a < 6; a++) { const t = (a / 5) * Math.PI; arc.push(P.length / 3); P.push(-0.05 + Math.sin(t) * 0.02, -0.1 - (1 - Math.cos(t)) * 0.17, 0.3 + Math.sin(t) * 0.12); fin.push(0.5 + 0.4 * Math.sin(t)); }
  const out = topViewWidths(new Float32Array(P), new Float32Array(fin))!;
  const span = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  const before = span(arc.map((i) => P[i * 3])), after = span(arc.map((i) => out.x[i]));
  assert.ok(after > before * 4, `위에서 본 앞뒤 폭 ${before.toFixed(3)} → ${after.toFixed(3)}`);
  assert.ok(Math.max(...arc.map((i) => out.x[i])) < -0.02, "꼬리 쪽(−x)으로 젖혀졌다");
  assert.ok(arc.every((i) => out.z[i] > 0), "제 옆(+z) 그대로");
  assert.ok(span(arc.map((i) => out.y[i])) < span(arc.map((i) => P[i * 3 + 1])), "세로 높이는 줄었다(눕혔다)");
});

test("등 · 뒷 · 꼬리지느러미 두께(2026-11-12) — 붙은 쪽이 도톰하고 끝으로 얇아진다(위에서 머리카락 같은 실이 아니게)", () => {
  // 튜브(x −1.5 ~ 2) + 튜브 뒤 꼬리지느러미 판 정점(x −1.6 ~ −2, 두께 0.004) · 튜브 위 등지느러미 판 정점
  const P: number[] = [], fin: number[] = [], R = 17, rows = 41;
  for (let r = 0; r < rows; r++) for (let j = 0; j < R; j++) {
    const th = (j / (R - 1)) * Math.PI * 2, x = 2 - 3.5 * (r / (rows - 1)), half = 0.05 + 0.45 * Math.sin(Math.PI * (r / (rows - 1)));
    P.push(x, Math.cos(th) * half, Math.sin(th) * half * 0.6); fin.push(0);
  }
  const tail: number[] = [], dorsal: number[] = [];
  for (let a = 0; a < 5; a++) { tail.push(P.length / 3); P.push(-1.6 - a * 0.1, 0, 0.004); fin.push(0); }
  for (let a = 0; a < 4; a++) { dorsal.push(P.length / 3); P.push(0.2, 0.75 + a * 0.08, 0.004); fin.push(0); }
  const out = topViewWidths(new Float32Array(P), new Float32Array(fin))!;
  const tz = tail.map((i) => out.z[i]), dz = dorsal.map((i) => out.z[i]);
  assert.ok(tz[0] > 0.02, `꼬리 뿌리는 도톰하다 ${tz[0]}`);
  for (let k = 1; k < tz.length; k++) assert.ok(tz[k] <= tz[k - 1] + 1e-9, "꼬리 끝으로 얇아진다");
  assert.ok(dz[0] > dz[dz.length - 1], "등지느러미도 끝으로 얇아진다");
  assert.ok(Math.min(...tz, ...dz) > 0.004, "어디도 원래 실(0.004)보다 얇지 않다");
});
