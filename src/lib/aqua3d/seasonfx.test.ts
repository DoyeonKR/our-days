// 계절 수조 행사의 3D 그림 lock (2026-11-13) — 셰이더는 ASCII · 점 한 묶음 · 움직임 줄이기 · three 는 수조와 함께만 · 한정 장식 빛깔은 나눠 쓴다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as T from "three";
import { GLOW_FRAG, GLOW_VERT, SURFACE_COUNT, SURFACE_FRAG, SURFACE_VERT, decorTints, makeDecorGlow, makeSurfaceFx, tintChunk } from "./seasonfx.ts";
import { AQUA_EVENTS } from "../aquaevent.ts";

const SRC = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

test("셰이더 원문은 ASCII 만 — GLSL ES 는 주석 속 한글도 오류로 보는 기기가 있다", () => {
  for (const [name, src] of Object.entries({ SURFACE_VERT, SURFACE_FRAG, GLOW_VERT, GLOW_FRAG, ...Object.fromEntries(AQUA_EVENTS.map((e) => [`tint:${e.key}`, tintChunk(e.key)])) }))
    assert.match(src, /^[\x00-\x7f]*$/, name);
});

test("물 위 그림 — 종류마다 점 한 묶음(그리기 한 번) · 누를 수 없음 · 자리는 알 번호로만(같은 입력 = 같은 자리) · 공기 자리는 비킨다", () => {
  const box = { halfX: 4.5, halfZ: 2.6, bottom: -2, top: 4 };
  for (const kind of ["petal", "rain", "leaf", "frost"] as const) {
    const a = makeSurfaceFx(kind, box), b = makeSurfaceFx(kind, box);
    assert.ok(a.points instanceof T.Points);
    assert.equal(a.points.geometry.getAttribute("position").count, SURFACE_COUNT[kind]);
    assert.ok(SURFACE_COUNT[kind] <= 200, "GPU 가볍게");
    assert.deepEqual([...(a.points.geometry.getAttribute("position").array as Float32Array)], [...(b.points.geometry.getAttribute("position").array as Float32Array)]);
    assert.equal((a.points.material as T.ShaderMaterial).defines.KIND !== undefined, true);
    const hits: T.Intersection[] = [];
    a.points.raycast(new T.Raycaster(), hits);
    assert.equal(hits.length, 0);
    a.dispose(); b.dispose();
  }
  const dome = makeSurfaceFx("petal", box, (x, z) => Math.hypot(x, z) < 1.5);
  const pos = dome.points.geometry.getAttribute("position");
  let inside = 0;
  for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i), pos.getZ(i)) < 1.5) inside++;
  assert.ok(inside <= 2, `돔 둘레 안 ${inside}`);
});

test("명절 장식 빛 — 놓인 장식 수만큼만 그린다(상한 32)", () => {
  const g = makeDecorGlow([0xff0000, 0x00ff00]);
  assert.equal(g.points.geometry.drawRange.count, 0);
  g.setSpots([[0, 0, 0, 2], [1, 0, 1, 2]]);
  assert.equal(g.points.geometry.drawRange.count, 2);
  g.setSpots(Array.from({ length: 50 }, () => [0, 0, 0, 1] as const));
  assert.equal(g.points.geometry.drawRange.count, 32);
  g.dispose();
});

test("한정 장식 빛깔 — (원본 재질, 행사)마다 한 번 복제해 나눠 쓴다 · 거품(aquaKeep)은 안 칠한다 · 떼어 낼 때 안 지운다", () => {
  const reg = decorTints();
  const mat = new T.MeshStandardMaterial({ color: 0x88aa66 });
  const mk = () => { const r = new T.Group(); r.add(new T.Mesh(new T.BoxGeometry(), mat)); const b = new T.Mesh(new T.BoxGeometry(), mat); b.userData.aquaKeep = true; r.add(b); return r; };
  const a = mk(), b = mk();
  reg.apply(a, "autumn"); reg.apply(b, "autumn"); reg.apply(mk(), null);
  const ma = (a.children[0] as T.Mesh).material as T.Material, mb = (b.children[0] as T.Mesh).material as T.Material;
  assert.notEqual(ma, mat);
  assert.equal(ma, mb, "같은 행사 · 같은 재질은 하나");
  assert.equal((a.children[1] as T.Mesh).material, mat, "거품은 그대로");
  assert.match(String(ma.userData.aquaMorph), /^tint:autumn$/, "release 가 지우지 않는 표");
  assert.equal(reg.size, 1);
  reg.apply(mk(), "xmas");
  assert.equal(reg.size, 2);
  reg.dispose();
  assert.equal(reg.size, 0);
});

test("수조 연결 — scene 만 seasonfx 를 부른다(three 는 수조와 함께) · 빗방울은 움직임 줄이기면 숨긴다 · 엔진 · 화면은 three 를 안 부른다", () => {
  const scene = strip(read("lib/aqua3d/scene.ts"));
  assert.match(scene, /from "\.\/seasonfx\.ts"/);
  assert.match(scene, /seasonLayer\.points\.visible=!\(seasonLayer\.kind==="rain"&&reduced\.matches\)/);
  assert.match(scene, /tintReg\.apply\(inner,d\.tint\)/, "GLB 로 갈아 끼운 몸에도 빛깔");
  assert.match(scene, /m\.tint!==tint/, "빛깔이 바뀌면 장식을 다시 짓는다");
  assert.match(scene, /morphs\.dispose\(\);tintReg\.dispose\(\);/);
  for (const f of ["lib/aquaevent.ts", "lib/aquaeventclaim.ts", "components/AquariumGame.tsx"]) {
    const src = strip(read(f));
    assert.doesNotMatch(src, /from ["'](three|@\/lib\/aqua3d\/seasonfx|\.\/aqua3d\/seasonfx\.ts)["']/, f);
  }
  // 달력 모듈은 가볍게 — 런타임 import 는 kst 하나
  const imports = [...strip(read("lib/aquaevent.ts")).matchAll(/^\s*import\s+(?!type)[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./kst.ts"]);
});
