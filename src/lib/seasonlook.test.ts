// 계절이 **눈에 보이는지** 수치로 감시한다.
//
// 실측 배경(2026-08-04): 계절은 hillFar/Mid/Near 에만 걸렸고 그 색차마저 조명색에 씻겨
// 봄↔여름 최대 채널 Δ17/255(밤엔 Δ5)였다. 4계절인데 눈으로는 '초록/금/설백' 3톤.
// 색을 넣었다는 사실이 아니라 **차이의 크기**를 잠가야 회귀를 잡는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { skyLook, type SkyPhase } from "./scenetime.ts";
import type { Season } from "./island.ts";

const PHASES: SkyPhase[] = [
  "night", "blueHour", "sunrise", "morning", "day", "golden", "sunset", "twilight",
];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** 두 색의 최대 채널 차(0~255) — 사람 눈의 '다르다' 판정에 가장 가까운 싼 지표. */
const maxDelta = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
};

test("★ 봄과 여름 언덕이 실제로 다르다 — 모든 시간대에서", () => {
  for (const p of PHASES) {
    const d = maxDelta(skyLook(p, "spring").hillNear, skyLook(p, "summer").hillNear);
    assert.ok(d >= 24, `${p}: 봄↔여름 언덕 Δ${d} — 예전 Δ17 수준으로 되돌아갔다`);
  }
});

test("네 계절의 언덕이 서로 구별된다 — 어느 두 계절도 뭉치지 않는다", () => {
  for (const p of PHASES) {
    for (let i = 0; i < SEASONS.length; i++) {
      for (let j = i + 1; j < SEASONS.length; j++) {
        const d = maxDelta(skyLook(p, SEASONS[i]).hillNear, skyLook(p, SEASONS[j]).hillNear);
        assert.ok(d >= 20, `${p}: ${SEASONS[i]}↔${SEASONS[j]} Δ${d}`);
      }
    }
  }
});

test("나무가 계절을 말한다 — 숲 색이 계절마다 확실히 다르다", () => {
  for (const p of PHASES) {
    for (let i = 0; i < SEASONS.length; i++) {
      for (let j = i + 1; j < SEASONS.length; j++) {
        const d = maxDelta(skyLook(p, SEASONS[i]).tree, skyLook(p, SEASONS[j]).tree);
        assert.ok(d >= 18, `${p}: 나무 ${SEASONS[i]}↔${SEASONS[j]} Δ${d}`);
      }
    }
  }
});

test("계절이 하늘 아래쪽에도 걸린다 — 언덕에만 걸면 하늘은 사철 같다", () => {
  for (const p of PHASES) {
    const d = maxDelta(skyLook(p, "spring").bottom, skyLook(p, "winter").bottom);
    assert.ok(d >= 6, `${p}: 하늘 하단 봄↔겨울 Δ${d}`);
  }
});

test("하늘 위쪽은 계절 무관 — 시간대 정체성과 헤더 대비가 흔들리면 안 된다", () => {
  for (const p of PHASES) {
    const base = skyLook(p, "spring");
    for (const se of SEASONS) {
      const l = skyLook(p, se);
      assert.equal(l.top, base.top, `${p}/${se}: top 이 계절마다 달라졌다`);
      assert.equal(l.upper, base.upper, `${p}/${se}: upper 이 계절마다 달라졌다`);
      assert.equal(l.headerDark, base.headerDark, `${p}/${se}: 헤더 대비 판정이 흔들린다`);
    }
  }
});

test("눈은 겨울에만", () => {
  for (const p of PHASES) {
    assert.equal(skyLook(p, "winter").snow, true, p);
    for (const se of ["spring", "summer", "autumn"] as const) {
      assert.equal(skyLook(p, se).snow, false, `${p}/${se}`);
    }
  }
});

test("★ 시간대별 후광색이 서로 다르다 [2026-08-04 버그 fix]", () => {
  // 예전엔 glow 가 rgba 문자열이라 렌더의 #-체크에 걸려 8단계 전부 같은 상수 폴백으로
  // 떨어졌다 — 노을/블루아워의 정체성이 광원에서 통째로 사라진 상태였다.
  const glows = PHASES.map((p) => skyLook(p, "spring").glow);
  for (const g of glows) assert.match(g, /^#[0-9a-f]{6}$/i, `glow 는 hex 여야 한다: ${g}`);
  assert.ok(new Set(glows).size >= 6, `후광색 종류 ${new Set(glows).size} — 시간대가 뭉쳤다`);
  // 특징적인 두 시간대는 확실히 갈려야 한다
  assert.ok(maxDelta(skyLook("sunset", "spring").glow, skyLook("day", "spring").glow) >= 60);
});

test("팔레트 캐시가 같은 조합에 같은 객체를 준다 — 매번 새 객체면 캔버스가 재굽기를 반복한다", () => {
  assert.strictEqual(skyLook("day", "spring"), skyLook("day", "spring"));
  assert.notStrictEqual(skyLook("day", "spring"), skyLook("day", "winter"));
});
