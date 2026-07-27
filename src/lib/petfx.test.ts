import { test } from "node:test";
import assert from "node:assert/strict";
import { PET_ACTION_KINDS, petFx } from "./petfx.ts";

test("petFx — 모든 액션에 유효한 연출 스펙", () => {
  for (const k of PET_ACTION_KINDS) {
    const fx = petFx(k);
    assert.ok(fx.ms >= 600 && fx.ms <= 4000, `${k} 길이 ${fx.ms}`);
    assert.ok(fx.props.length >= 1 && fx.props.length <= 6, `${k} 소품 수`);
    for (const p of fx.props) {
      assert.ok(p.emoji.length > 0);
      assert.ok(Math.abs(p.x) <= 60 && Math.abs(p.y) <= 60, `${k} 소품 범위`);
      assert.ok(["fx-pop", "fx-rise", "fx-drop", "fx-bubble"].includes(p.anim));
      if (p.delay != null) assert.ok(p.delay >= 0 && p.delay < fx.ms, `${k} 딜레이 < 길이`);
    }
  }
});

test("petFx — 재우기만 무대 딤 + 몸 애니 없음(포즈는 asleep 담당)", () => {
  assert.equal(petFx("rest").dim, true);
  assert.equal(petFx("rest").body, null);
  for (const k of PET_ACTION_KINDS.filter((x) => x !== "rest")) {
    assert.ok(petFx(k).body, `${k} 는 몸 애니 필요`);
    assert.ok(!petFx(k).dim, `${k} 는 딤 없음`);
  }
});

test("petFx — 씻기기엔 거품, 먹기엔 밥, 깨우기엔 알람(의미 결합 lock)", () => {
  assert.ok(petFx("clean").props.some((p) => p.emoji === "🫧"));
  assert.ok(petFx("feed").props.some((p) => p.emoji === "🍚"));
  assert.ok(petFx("wake").props.some((p) => p.emoji === "⏰"));
  assert.ok(petFx("rest").props.some((p) => p.emoji === "💤"));
});
