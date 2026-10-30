// 알림 차단 안내 lock. [2026-10-30 UX 점검 — 크롬·PC 사용자에게도 삼성 인터넷 메뉴 경로가 길게 떴다]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blockedPushBrowser } from "./pushhelp.ts";

test("브라우저별로 한 가지 안내만", () => {
  assert.equal(blockedPushBrowser("Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36"), "samsung");
  assert.equal(blockedPushBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), "ios");
  assert.equal(blockedPushBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"), "other");
  assert.equal(blockedPushBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"), "other");
});

test("설정 화면이 브라우저에 따라 안내를 가른다 [소스 스캔]", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "components", "PushSettings.tsx"), "utf8");
  assert.match(src, /blockedPushBrowser\(navigator\.userAgent\)/);
  assert.match(src, /browser === "samsung" \?/);
});
