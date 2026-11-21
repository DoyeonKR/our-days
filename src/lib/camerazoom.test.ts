// 카메라 최소 줌 · 사진 고르기는 갤러리부터 (2026-11-06)
// [사용자: "카메라가 기본으로 줌 되있는 것 같아 최소줌으로 해주고 이미지 올릴때 기본을 갤러리에서 먼저 찾을 수 있게 해줘"]
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAMERA_FORMATS, cameraConstraints, isFullSensor, openWideCamera, widestZoom, zoomOutFully } from "./camerazoom.ts";

const root = join(import.meta.dirname, "../..");
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("최소 줌 — 범위의 맨 아래로, 이미 최소거나 범위를 모르면 아무것도 안 한다", () => {
  assert.equal(widestZoom({ zoom: { min: 0.6, max: 10 } }, 1), 0.6, "초광각이 있으면 1배보다 넓게");
  assert.equal(widestZoom({ zoom: { min: 1, max: 8 } }, 2), 1, "당겨진 채 열렸으면 1배로");
  assert.equal(widestZoom({ zoom: { min: 1, max: 8 } }, 1), null);
  assert.equal(widestZoom({}, 2), null, "줌 범위를 모르는 브라우저");
  assert.equal(widestZoom(undefined, undefined), null);
  assert.equal(widestZoom({ zoom: { min: Number.NaN } }, 2), null);
  assert.equal(widestZoom({ zoom: { min: 1 } }, undefined), 1, "지금 값을 몰라도 최소로 맞춘다");
});

test("트랙에 최소 줌을 건다 · 실패해도 던지지 않는다", async () => {
  const applied: unknown[] = [];
  const track = {
    getCapabilities: () => ({ zoom: { min: 0.5, max: 5 } }),
    getSettings: () => ({ zoom: 1 }),
    applyConstraints: async (c: unknown) => { applied.push(c); },
  };
  assert.equal(await zoomOutFully({ getVideoTracks: () => [track] }), 0.5);
  assert.deepEqual(applied, [{ advanced: [{ zoom: 0.5 }] }]);
  const failing = { ...track, applyConstraints: async () => { throw new Error("OverconstrainedError"); } };
  assert.equal(await zoomOutFully({ getVideoTracks: () => [failing] }), null);
  assert.equal(await zoomOutFully({ getVideoTracks: () => [{}] }), null, "getCapabilities 가 없는 옛 브라우저");
  assert.equal(await zoomOutFully(null), null);
});

test("3초 로그 카메라 — 줌 범위를 묻고, 열리자마자 가장 넓게", () => {
  const cap = code("src/components/LogCapture.tsx");
  // 2026-11-21 — 3:4 세로를 청하면 16:9 모드로 잘려 당겨 보였다. 센서 비율(4:3)을 청하는 openWideCamera 로
  assert.match(cap, /openWideCamera\(\(c\) => navigator\.mediaDevices\.getUserMedia\(c\), facing\)/);
  assert.doesNotMatch(cap, /aspectRatio: \{ ideal: 3 \/ 4 \}/, "3:4 세로를 직접 청하지 않는다");
  assert.match(cap, /streamRef\.current = stream;\s+void zoomOutFully\(stream\)\.then\(/);
  assert.match(cap, /logDebug\("cam_zoom", \{ applied, \.\.\.zoomInfo\(stream\), w: camW, h: camH, tried: camTried \}\)/);
});

test("센서 그대로(4:3) — 16:9 로 오면 한 번 더 청하고, 앞의 카메라는 닫고 연다", async () => {
  assert.ok(isFullSensor(1280, 960) && isFullSensor(960, 1280) && isFullSensor(640, 480));
  assert.ok(!isFullSensor(1280, 720) && !isFullSensor(720, 1280) && !isFullSensor(null, 1));
  for (const f of CAMERA_FORMATS) assert.ok(isFullSensor(f.width, f.height), "청하는 모양은 모두 4:3");
  const c = cameraConstraints("user", CAMERA_FORMATS[0]) as Record<string, unknown>;
  assert.equal(c.resizeMode, "none", "크롬이 잘라 맞추지 않게");
  const fake = (w: number, h: number, log: string[]) => ({ getTracks: () => [{ stop: () => log.push(`stop ${w}x${h}`) }], getVideoTracks: () => [{ getSettings: () => ({ width: w, height: h }) }] }) as unknown as MediaStream;
  const log: string[] = [];
  const sizes = [[1280, 720], [640, 480]];
  let i = 0;
  const got = await openWideCamera(async () => { const [w, h] = sizes[i++]; log.push(`open ${w}x${h}`); return fake(w, h, log); }, "user");
  assert.deepEqual(log, ["open 1280x720", "stop 1280x720", "open 640x480"]);
  assert.deepEqual([got.tried, got.w, got.h], [2, 640, 480]);
  const log2: string[] = [];
  const once = await openWideCamera(async () => fake(960, 1280, log2), "user");
  assert.equal(once.tried, 1, "4:3 이면 한 번에 끝");
  await assert.rejects(openWideCamera(async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); }, "user"));
});

test("사진 입력은 image/* 하나 — 확장자 · 다른 형식을 섞으면 브라우저가 사진 선택기 대신 파일 앱을 연다", () => {
  for (const f of ["src/components/PhotoAlbum.tsx", "src/components/DecoBook.tsx"]) {
    // 원문 그대로 읽는다 — 주석 지우기 정규식은 "image/*" 의 "/*" 를 주석 시작으로 먹는다
    const src = readFileSync(join(root, f), "utf8");
    assert.match(src, /accept="image\/\*"/, f);
    assert.doesNotMatch(src, /accept="image\/\*,|accept="[^"]*\.(heic|heif|jpg|png)/i, f);
    assert.doesNotMatch(src, /type="file"[^>]*accept="image\/\*"[^>]*capture=/, `${f} — capture 를 붙이면 갤러리 없이 카메라만 열린다`);
  }
});
