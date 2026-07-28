// 홈 월드 하늘 팔레트 회귀 lock.
// [2026-07-28 v2] 사용자 "낮/밤 2테마라 단조롭고 허접" → 8단계 시간대 + 대기 원근 + 광원 궤도.
// 이 테스트가 막는 회귀: 시간대 축소(2~4단계 회귀), 팔레트 필드 누락(렌더 깨짐),
// 광원 궤도가 지평선 아래/화면 밖으로 나가는 것, 대기 원근(먼 언덕이 더 물듦) 역전.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kstHourFloatOf,
  kstHourOf,
  lightPos,
  mixHex,
  moonPhase,
  type SkyPhase,
  skyLook,
  skyPhaseOf,
} from "./scenetime.ts";

const PHASES: SkyPhase[] = [
  "night",
  "blueHour",
  "sunrise",
  "morning",
  "day",
  "golden",
  "sunset",
  "twilight",
];

test("시간대 판정 — 8단계 경계값 [회귀 lock: 2테마로 축소 금지]", () => {
  assert.equal(skyPhaseOf(0), "night");
  assert.equal(skyPhaseOf(3.9), "night");
  assert.equal(skyPhaseOf(4), "blueHour");
  assert.equal(skyPhaseOf(5.4), "blueHour");
  assert.equal(skyPhaseOf(5.5), "sunrise");
  assert.equal(skyPhaseOf(6.9), "sunrise");
  assert.equal(skyPhaseOf(7), "morning");
  assert.equal(skyPhaseOf(9.9), "morning");
  assert.equal(skyPhaseOf(10), "day");
  assert.equal(skyPhaseOf(14.9), "day");
  assert.equal(skyPhaseOf(15), "golden");
  assert.equal(skyPhaseOf(17.4), "golden");
  assert.equal(skyPhaseOf(17.5), "sunset");
  assert.equal(skyPhaseOf(18.9), "sunset");
  assert.equal(skyPhaseOf(19), "twilight");
  assert.equal(skyPhaseOf(20.9), "twilight");
  assert.equal(skyPhaseOf(21), "night");
  // 24시간 전 구간이 빠짐없이 매핑되고, 8단계가 모두 실제로 등장
  const seen = new Set<SkyPhase>();
  for (let h = 0; h < 24; h += 0.25) seen.add(skyPhaseOf(h));
  assert.equal(seen.size, 8, "8단계가 모두 하루 중에 등장해야(단조로움 회귀 차단)");
});

test("KST 시각 — UTC 자정 = KST 9시, 분 단위 소수 시각", () => {
  assert.equal(kstHourOf(Date.UTC(2026, 6, 27, 0, 0, 0)), 9);
  assert.equal(kstHourOf(Date.UTC(2026, 6, 27, 15, 0, 0)), 0);
  assert.equal(kstHourFloatOf(Date.UTC(2026, 6, 27, 8, 30, 0)), 17.5); // 광원 궤도용
});

test("하늘 팔레트 — 전 시간대×계절에서 모든 색 유효 + 대기 원근", () => {
  for (const p of PHASES)
    for (const se of ["spring", "summer", "autumn", "winter"] as const) {
      const l = skyLook(p, se);
      for (const c of [l.top, l.upper, l.mid, l.lower, l.bottom, l.haze, l.hillFar, l.hillMid, l.hillNear, l.light, l.cloudLit, l.cloudShade])
        assert.match(c, /^#[0-9a-f]{6}$/i, `${p}/${se} 색 형식`);
      assert.ok(l.starOpacity >= 0 && l.starOpacity <= 1, "별 밝기 0~1");
      assert.ok(l.label.length > 0, "시간대 이름");
      assert.equal(l.night, p === "night");
      // 대기 원근: 먼 언덕이 근경보다 조명색에 더 많이 물든다 → 두 색이 달라야 함
      assert.notEqual(l.hillFar, l.hillNear, `${p}/${se} 원경≠근경(깊이감)`);
    }
  assert.equal(skyLook("night", "spring").onDark, true);
  assert.equal(skyLook("sunset", "spring").onDark, true);
  assert.equal(skyLook("twilight", "spring").onDark, true);
  assert.equal(skyLook("day", "spring").onDark, false);
  // 별은 밤이 가장 밝고, 낮엔 0
  assert.equal(skyLook("day", "spring").starOpacity, 0);
  assert.ok(skyLook("night", "spring").starOpacity > skyLook("twilight", "spring").starOpacity);
  // 달은 밤/여명/땅거미에만
  assert.equal(skyLook("night", "spring").moon, true);
  assert.equal(skyLook("day", "spring").moon, false);
});

test("색 혼합 — 경계/중간값", () => {
  assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
  assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mixHex("#000000", "#ffffff", 2), "#ffffff", "범위 밖은 클램프");
});

test("광원 궤도 — 화면 안 + UI 충돌 회피(타이포/월드 소품)", () => {
  for (let h = 0; h < 24; h += 0.25) {
    const { x, y } = lightPos(h);
    assert.ok(x >= 0.05 && x <= 0.95, `h=${h} x 화면 안`);
    assert.ok(y >= 0.05 && y <= 0.47, `h=${h} y — 좌우 WorldProp(bottom 34%) 위`);
    // ⚠ 핵심 계약: 중앙 타이포 대역(x 0.28~0.72)에는 D-day(top 17%) 위로만 진입
    if (x > 0.28 && x < 0.72) assert.ok(y < 0.15, `h=${h} 중앙 진입 시 타이포 위(y=${y.toFixed(2)})`);
  }
  const noon = lightPos(11.75);
  const rise = lightPos(5.5);
  const set = lightPos(17.99); // ⚠ 18.0 은 달 궤도 시작점(x=0.1) — 해의 서쪽 끝은 직전 시각
  assert.ok(noon.y < rise.y && noon.y < set.y, "정오가 가장 높음");
  assert.ok(rise.x < noon.x && noon.x < set.x, "해는 동 → 서로 이동");
  // 달도 같은 방향(동→서)으로 밤을 가로지른다
  assert.ok(lightPos(18.5).x < lightPos(23).x && lightPos(23).x < lightPos(4).x, "달도 동 → 서");
});

test("달 위상 — 0~1 순환(실제 주기)", () => {
  const p = moonPhase(Date.UTC(2026, 6, 28));
  assert.ok(p >= 0 && p < 1);
  const SYN = 29.530588853 * 86400_000;
  const p2 = moonPhase(Date.UTC(2026, 6, 28) + SYN);
  assert.ok(Math.abs(p - p2) < 1e-6, "1 삭망월 뒤 같은 위상");
});
