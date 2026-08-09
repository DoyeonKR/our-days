/* 사냥 몬스터 도트 회귀 잠금. */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pixelAt } from "./pixel.ts";
import { monsterSprite } from "./pixelmonster.ts";
test("몬스터가 32×32 판을 실제로 채운다", () => {
  /* [사용자 요청 2026-08-09] 판은 32×32 인데 **실제로 그려진 건 15×11** 이었다 —
     손으로 11줄만 찍고 mk() 가 하단 정렬하니 판의 1/9 만 쓴 셈이다.
     ⚠ 2배 확대는 해상도가 아니다(도트가 굵어질 뿐). 그림을 판에 맞게 다시 그려야 한다. */
  for (const k of ["slime", "bat", "mush", "ghost", "golem", "dragon"]) {
    const s = monsterSprite(k);
    let ink = 0, minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++)
        if (pixelAt(s, x, y)) {
          ink++;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    assert.ok(w >= 18, `${k}: 실제 폭 ${w} — 판(32)을 너무 안 쓴다`);
    assert.ok(h >= 14, `${k}: 실제 높이 ${h} — 판(32)을 너무 안 쓴다`);
    assert.ok(ink >= 220, `${k}: 잉크 ${ink}칸 — 크기만 키우고 속이 비었다`);
  }
});
