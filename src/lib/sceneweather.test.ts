// 홈 히어로 실시간 날씨 회귀 lock. [사용자 요청 2026-08-11 "실시간 날씨 반영 + 애니메이션"]
//
// 매핑(sceneweather.ts)이 판단의 전부다 — 화면은 HeroWx 플래그를 그릴 뿐이다.
// 여기서 잠그는 계약 셋:
//  1. 실제 날씨가 **이긴다**(섬 게임 날씨는 폴백일 뿐).
//  2. 폴백은 예전 동작 그대로다(겨울 비=눈보라 · wind 2배속 · 무지개) — 폴백이 변하면 회귀다.
//  3. 하늘 그라데이션(skyLook)은 건드리지 않는다 — 96조합 대비 lock 이 걸린 축이라,
//     날씨는 전부 얹는 것으로만 표현한다(소스 스캔으로 강제).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { heroWxOf } from "./sceneweather.ts";

test("실제 날씨 → 연출 매핑 — 요청의 핵심 셋(흐림·비·천둥)이 정확하다", () => {
  // "흐리면 흐리고" — 구름 최대 + 강수 없음
  const cloud = heroWxOf("cloud", "clear", false);
  assert.equal(cloud.overcast, 2);
  assert.equal(cloud.precip, "none");
  // "비오면 비오고"
  const rain = heroWxOf("rain", "clear", false);
  assert.equal(rain.precip, "rain");
  assert.ok(rain.overcast >= 1, "비인데 하늘이 맑으면 거짓말이다");
  // "천둥이면 천둥치고" — 번개 + 비 + 빠른 구름
  const th = heroWxOf("thunder", "clear", false);
  assert.equal(th.thunder, true);
  assert.equal(th.precip, "rain", "천둥엔 비가 같이 온다 — 마른 번개만 치면 어색하다");
  assert.equal(th.windMul, 2);
  // 눈은 계절 무관 — 3월에 눈 오면 눈이 온다
  assert.equal(heroWxOf("snow", "clear", false).snow, true);
  // 이슬비는 비보다 약하다(입자 절반은 화면 몫, 여기선 종류만)
  assert.equal(heroWxOf("drizzle", "clear", false).precip, "drizzle");
  assert.equal(heroWxOf("fog", "clear", false).fog, true);
  assert.equal(heroWxOf("sun", "clear", false).overcast, 0);
});

test("실제 날씨가 섬 게임 날씨를 이긴다 [회귀 lock]", () => {
  // 섬은 비인데 실제 하늘이 맑으면 — 맑다. 실시간이라는 말의 뜻이다.
  const wx = heroWxOf("sun", "rain", true);
  assert.equal(wx.precip, "none");
  assert.equal(wx.snow, false);
  // 섬이 wind 여도 실제가 sun 이면 구름은 평속
  assert.equal(heroWxOf("sun", "wind", false).windMul, 1);
});

test("폴백(실데이터 없음)은 예전 동작 그대로 [회귀 lock]", () => {
  // 오프라인 첫 화면이 예전과 달라 보이면 그건 폴백이 아니라 회귀다.
  assert.deepEqual(heroWxOf(null, "clear", false), {
    precip: "none", snow: false, overcast: 0, fog: false, thunder: false, windMul: 1, rainbow: false,
  });
  assert.equal(heroWxOf(null, "rain", false).precip, "rain");
  assert.equal(heroWxOf(null, "rain", true).snow, true, "겨울 비=눈보라 규칙 유지");
  assert.equal(heroWxOf(null, "wind", false).windMul, 2);
  assert.equal(heroWxOf(null, "rainbow", false).rainbow, true);
});

test("무지개(게임 선물)는 실제 하늘이 맑을 때만 얹는다", () => {
  assert.equal(heroWxOf("sun", "rainbow", false).rainbow, true);
  assert.equal(heroWxOf("partly", "rainbow", false).rainbow, true);
  // 실제로 비가 오는데 무지개가 뜨면 실시간이 아니라 장식이다
  assert.equal(heroWxOf("rain", "rainbow", false).rainbow, false);
  assert.equal(heroWxOf("cloud", "rainbow", false).rainbow, false);
});

test("★ 화면 계약 — 하늘색은 안 건드리고, 번개는 은은하고, reduced-motion 에서 죽는다", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "components", "HomeWorld.tsx"), "utf8");
  // 배선: 실데이터 → 매핑 → 연출
  assert.ok(src.includes("useForecast"), "실제 날씨를 안 읽는다");
  assert.ok(src.includes("heroWxOf"), "매핑(단일 소스)을 우회했다");
  // 하늘 그라데이션은 skyLook 그대로 — 날씨로 하늘색을 덧칠하기 시작하면
  // worldui 의 96조합 대비 lock 이 **테스트만 통과하는 거짓 초록**이 된다.
  assert.ok(src.includes("skyLook(phase, season)"), "하늘색이 skyLook 계약을 벗어났다");
  assert.ok(!/skyLook\([^)]*wx/.test(src), "skyLook 에 날씨가 흘러들었다 — 하늘색 축 오염");
  // 번개 플래시 상한 — 키프레임의 최대 불투명도 ≤ 0.3 (광과민 안전선)
  const flash = /@keyframes hw-flash-a[\s\S]*?\n\s*\}/.exec(src)?.[0] ?? "";
  assert.ok(flash, "번개 키프레임이 없다");
  const peaks = [...flash.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(peaks.length >= 2, "번개 깜빡임 단계가 없다");
  assert.ok(Math.max(...peaks) <= 0.3, `번개 최대 불투명도 ${Math.max(...peaks)} > 0.3 — 화면을 때린다`);
  assert.ok(!/rotate\s*\(/.test(flash), "번개가 회전한다(?)");
  // reduced-motion: 번개는 숨기고(멈춘 플래시는 뿌연 막), 안개 띠는 정지만
  const rm = /prefers-reduced-motion[\s\S]*?\n\s*\}\s*\n\s*`/.exec(src)?.[0] ?? "";
  assert.ok(/\.hw-thunder\s*\{\s*animation:\s*none;\s*opacity:\s*0/.test(rm), "reduced-motion 에서 번개가 안 죽는다");
  assert.ok(rm.includes(".hw-fogband"), "reduced-motion 에서 안개 띠가 계속 흐른다");
});
