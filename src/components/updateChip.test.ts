// 새 버전 감지(UpdateChip) 회귀 lock. [2026-07-28]
// 사용자 리포트 "배포된 거 맞아? 화면 동일한데": 배포가 라이브 반영돼도 백그라운드 재개 PWA 는
// 재탐색을 안 하고, Pages CDN 은 문서를 최대 10분 캐시 → 새 버전이 기기에 안 보였다.
// 계약: 빌드가 version.json(sha)을 심고, 앱은 포그라운드 복귀마다 no-store+캐시버스터로 비교,
// 다르면 '탭해서 적용' 칩. 이 배선이 끊기면 같은 혼란이 재발한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

test("빌드가 version.json 을 심는다", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.ok(pkg.scripts.build.includes("write-version"), "build 스크립트에 write-version 포함");
  const script = readFileSync(join(root, "scripts/write-version.mjs"), "utf8");
  assert.ok(script.includes("GITHUB_SHA"), "CI 커밋 sha 사용");
  assert.ok(script.includes("version.json"), "out/version.json 기록");
  const cfg = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.ok(cfg.includes("NEXT_PUBLIC_APP_VERSION"), "빌드에 내 버전 주입");
});

test("UpdateChip — no-store + 캐시버스터 + 포그라운드 복귀 감지 + 레이아웃 마운트", () => {
  const chip = readFileSync(join(here, "UpdateChip.tsx"), "utf8");
  assert.ok(chip.includes('cache: "no-store"'), "브라우저 HTTP 캐시 우회");
  assert.ok(chip.includes("?t=${Date.now()}"), "CDN 엣지 캐시(max-age=600)까지 우회하는 버스터");
  assert.ok(chip.includes("visibilitychange"), "백그라운드 복귀 시 감지(핵심 시나리오)");
  assert.ok(chip.includes("location.reload"), "탭 한 번으로 적용");
  assert.ok(chip.includes('MINE === "dev"'), "로컬 빌드는 감지 비활성(오탐 방지)");
  const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
  assert.ok(layout.includes("<UpdateChip />"), "layout 에 전역 마운트");
});
