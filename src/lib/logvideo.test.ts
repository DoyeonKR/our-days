// 영상 로그 코덱 선택 회귀 lock. [2026-07-02]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync as readMirrorSrc } from "node:fs";
import {
  LOG_VIDEO_MS,
  extForMime,
  pickVideoMime,
} from "./logvideo.ts";

test("pickVideoMime: mp4 우선(크로스 재생 호환), 아니면 webm, 없으면 null [회귀 lock]", () => {
  // iOS Safari 류: mp4 만 지원
  assert.equal(
    pickVideoMime((m) => m.startsWith("video/mp4")),
    "video/mp4;codecs=avc1",
  );
  // 구형 Chrome 류: webm 만 지원 (무음 녹화 — 오디오 코덱 미포함)
  assert.equal(
    pickVideoMime((m) => m.startsWith("video/webm")),
    "video/webm;codecs=vp8",
  );
  // codecs 지정은 거부, 컨테이너만 지원하는 브라우저
  assert.equal(pickVideoMime((m) => m === "video/mp4"), "video/mp4");
  // MediaRecorder 미지원 → null(파일 폴백)
  assert.equal(pickVideoMime(() => false), null);
  // isTypeSupported 가 throw 해도 안전
  assert.equal(
    pickVideoMime(() => {
      throw new Error("x");
    }),
    null,
  );
});

test("extForMime + 상수", () => {
  assert.equal(extForMime("video/mp4;codecs=avc1"), "mp4");
  assert.equal(extForMime("video/webm;codecs=vp8,opus"), "webm");
  assert.equal(LOG_VIDEO_MS, 3000); // '3초 브이로그' 정체성 lock
});

test("전면 카메라는 거울처럼 — 찍는 화면과 저장 영상이 같은 방향이고, 재생 때 따로 뒤집지 않는다 [사용자: 브이로그 좌우반전]", () => {
  const src = readMirrorSrc(new URL("../components/LogCapture.tsx", import.meta.url), "utf8");
  assert.ok(!/\.draw\([^)]*,false,/.test(src), "카메라 프레임을 거울 없이 그리는 자리가 남았다");
  assert.ok((src.match(/mirrorRef\.current,/g) ?? []).length >= 3, "미리보기 · 녹화 프레임이 같은 값을 써야 한다");
  assert.match(src, /mirrorRef\.current=facing==="user"/);
  assert.match(src, /const mirrored = false;/);
});
