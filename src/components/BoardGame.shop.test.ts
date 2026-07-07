// 부루마블 말 상점 카탈로그 회귀 lock. [2026-07-07]
// 사용자: "말 상점 포인트를 높여줘(너무 저렴함) + 더 퀄리티 높은/비싼 말 추가". 가격을 대폭 상향하고
// 프리미엄 말·등급(tier)을 추가했다. ⚠ 무료 기본말(🚗🐰, cost 0)은 game_profile.owned 기본값
// ["🚗","🐰"] 과 반드시 일치해야 하며(안 그러면 기본 보유/선택 불일치), 옛 저가로 되돌아가면 안 된다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "BoardGame.tsx"), "utf8");

test("말 상점: 무료 기본말(🚗🐰) 유지 + 프리미엄 고가 말 + 등급 [회귀 lock]", () => {
  // 무료 기본 보유(game_profile.owned 기본값 ["🚗","🐰"])와 일치 — 유료화하면 기본 보유 깨짐
  assert.match(src, /\{ e: "🚗", cost: 0,/, "🚗 는 무료(cost 0) 기본말");
  assert.match(src, /\{ e: "🐰", cost: 0,/, "🐰 는 무료(cost 0) 기본말");
  // 옛 저가(👑 200P 등) 부활 금지 — 프리미엄으로 상향
  assert.ok(!/\{ e: "👑", cost: 200[,\s]/.test(src), "옛 저가 왕관(200P) 부활 금지");
  // 1000P 이상 레전드 프리미엄 말 존재(비싼 말 요구)
  assert.ok(/cost: (1[0-9]{3}|[2-9][0-9]{3})/.test(src), "1000P 이상 프리미엄 말 존재");
  // 신규 고급 말 + 등급(tier) 체계
  for (const e of ["💎", "🐉", "🦁", "🤖", "🦉"]) {
    assert.ok(src.includes(`"${e}"`), `프리미엄/신규 말 ${e} 존재`);
  }
  assert.ok(src.includes("tier:") && src.includes("legend"), "등급(tier) 체계 존재");
});
