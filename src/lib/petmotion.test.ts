import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PET_TAPS_FOR_HUG,
  SPEECH,
  YARD_MAX_X,
  YARD_MIN_X,
  motionFor,
  nextX,
  pettingAfterTap,
  speechFor,
  tapParticle,
  vibeOf,
} from "./petmotion.ts";

const stats = (o: Partial<Record<string, number>> = {}) => ({
  hunger: 80,
  happy: 50,
  energy: 80,
  clean: 80,
  health: 100,
  ...o,
}) as { hunger: number; happy: number; energy: number; clean: number; health: number };

test("vibeOf — 우선순위(아픔>졸림>배고픔>슬픔>행복>보통)", () => {
  assert.equal(vibeOf(stats(), true), "sick"); // 아픔이 최우선
  assert.equal(vibeOf(stats({ energy: 10, hunger: 10, happy: 10 }), false), "sleepy");
  assert.equal(vibeOf(stats({ hunger: 10, happy: 10 }), false), "hungry");
  assert.equal(vibeOf(stats({ happy: 10 }), false), "sad");
  assert.equal(vibeOf(stats({ happy: 85 }), false), "happy");
  assert.equal(vibeOf(stats(), false), "ok");
});

test("motionFor — 기분별 거동이 의미대로", () => {
  const happy = motionFor("happy");
  const sleepy = motionFor("sleepy");
  const sick = motionFor("sick");
  assert.ok(happy.walkMs < sleepy.walkMs); // 행복할수록 빠릿
  assert.ok(happy.hopChance > sleepy.hopChance);
  assert.equal(sleepy.wander, false); // 졸리면 안 돌아다님
  assert.equal(sick.jitter, true); // 아프면 떨림
  assert.equal(sick.emote, "💦");
  assert.equal(sleepy.emote, "💤");
  // 모든 기분에 유효한 파라미터
  for (const v of ["sick", "sleepy", "hungry", "sad", "happy", "ok"] as const) {
    const m = motionFor(v);
    assert.ok(m.walkMs > 0 && m.bobMs > 0 && m.pauseMin > 0 && m.pauseMax >= m.pauseMin);
    assert.ok(m.hopChance >= 0 && m.hopChance <= 1);
  }
});

test("speechFor — 기분 풀 안에서 결정적으로 선택", () => {
  for (const v of ["sick", "sleepy", "hungry", "sad", "happy", "ok"] as const) {
    assert.ok(SPEECH[v].length > 0);
    assert.ok(SPEECH[v].includes(speechFor(v, 0)));
    assert.ok(SPEECH[v].includes(speechFor(v, 0.99)));
    assert.equal(speechFor(v, 0), SPEECH[v][0]);
    // 경계값(1)도 범위 밖으로 안 나감
    assert.ok(SPEECH[v].includes(speechFor(v, 1)));
  }
});

test("nextX — 무대 안, 최소 이동거리 보장", () => {
  for (const r of [0, 0.25, 0.5, 0.75, 1]) {
    for (const cur of [YARD_MIN_X, 30, 50, 70, YARD_MAX_X]) {
      const x = nextX(cur, r);
      assert.ok(x >= YARD_MIN_X && x <= YARD_MAX_X, `범위: ${x}`);
    }
  }
  // 같은 자리 근처가 나와도 최소 간격만큼 밀어냄(제자리 걸음 방지)
  const x = nextX(50, 0.5); // r=0.5 → 정확히 50 근처
  assert.ok(Math.abs(x - 50) >= 17.9, `간격: ${x}`);
});

test("쓰다듬기 게이지 — N번째에 full + 리셋", () => {
  let count = 0;
  for (let i = 1; i < PET_TAPS_FOR_HUG; i++) {
    const r = pettingAfterTap(count);
    assert.equal(r.full, false);
    count = r.count;
    assert.equal(count, i);
  }
  const last = pettingAfterTap(count);
  assert.equal(last.full, true);
  assert.equal(last.count, 0); // 리셋
});

test("tapParticle — 기분별 이모지", () => {
  assert.equal(tapParticle("sick"), "💦");
  assert.equal(tapParticle("sleepy"), "💤");
  assert.equal(tapParticle("hungry"), "🍖");
  assert.ok(tapParticle("happy").length > 0);
});
