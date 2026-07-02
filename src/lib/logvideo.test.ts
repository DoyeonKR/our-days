// 영상 로그 코덱 선택 회귀 lock. [2026-07-02]
import { test } from "node:test";
import assert from "node:assert/strict";
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
  // 구형 Chrome 류: webm 만 지원
  assert.equal(
    pickVideoMime((m) => m.startsWith("video/webm")),
    "video/webm;codecs=vp8,opus",
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
