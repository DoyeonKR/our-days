// 카메라 최소 줌 · 사진 고르기는 갤러리부터 (2026-11-06)
// [사용자: "카메라가 기본으로 줌 되있는 것 같아 최소줌으로 해주고 이미지 올릴때 기본을 갤러리에서 먼저 찾을 수 있게 해줘"]
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { widestZoom, zoomOutFully } from "./camerazoom.ts";

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
  assert.match(cap, /aspectRatio: \{ ideal: 3 \/ 4 \}, zoom: true \}/);
  assert.match(cap, /streamRef\.current = stream;\s+void zoomOutFully\(stream\)\.then\(/);
  assert.match(cap, /logDebug\("cam_zoom", \{ applied, \.\.\.zoomInfo\(stream\) \}\)/);
});

test("안드로이드 앱 — 사진 · 영상만 고를 땐 사진 선택기(갤러리)부터, 촬영 · 다른 파일은 원래 길", () => {
  const java = code("android/app/src/main/java/com/doyeonkr/ourdays/MainActivity.java");
  assert.match(java, /class GalleryFirstChromeClient extends BridgeWebChromeClient/);
  assert.match(java, /new ActivityResultContracts\.PickVisualMedia\(\)/);
  assert.match(java, /new ActivityResultContracts\.PickMultipleVisualMedia\(/);
  assert.match(java, /params\.isCaptureEnabled\(\) \? null : mediaTypeOf\(params\.getAcceptTypes\(\)\)/, "촬영(capture)은 카메라 길 그대로");
  assert.match(java, /if \(type == null\) return super\.onShowFileChooser/);
  assert.match(java, /else return null;/, "사진 · 영상이 아닌 형식이 섞이면 파일 앱");
  assert.match(java, /MODE_OPEN_MULTIPLE\) pickMany\.launch/);
  // 결과 받기 등록은 화면 시작 전(onCreate, super 보다 먼저)
  const onCreate = java.slice(java.indexOf("public void onCreate"), java.indexOf("private void deliver"));
  assert.ok(onCreate.indexOf("registerForActivityResult") < onCreate.indexOf("super.onCreate"));
  assert.match(code("android/app/build.gradle"), /androidx\.activity:activity:\$androidxActivityVersion/);
  // 웹의 사진 입력은 image/* 하나 — 확장자를 섞으면 크롬 · 웹뷰가 사진 선택기 대신 파일 앱을 연다
  for (const f of ["src/components/PhotoAlbum.tsx", "src/components/DecoBook.tsx"]) assert.doesNotMatch(code(f), /accept="image\/\*,|accept="[^"]*\.(heic|heif|jpg|png)/i, f);
});
