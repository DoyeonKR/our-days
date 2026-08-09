// 쿡 프리셋 회귀 lock. [2026-08-09]
//
// 멘트를 갈아끼울 때(사용자 요청) 실수하기 쉬운 두 가지를 잠근다.
//
// 1. `kind` 는 **DB(pokes.kind) 에 저장된 값**이다. 지난 쿡의 이모지를 `pokeEmoji(kind)` 로
//    되찾으므로, 멘트를 고치면서 kind 까지 바꾸면 **옛 기록의 이모지가 전부 💌 로 떨어진다**.
//    바뀐 티도 안 나고 에러도 없다 — 그래서 여기서 막는다.
// 2. 프리셋은 **둘 다 보내는 말**이다. 한쪽 이름을 박으면 상대가 보낼 때 자기가 자기 이름으로
//    말하는 꼴이 된다.
//
// ⚠ couple.ts 는 `@/` 별칭을 쓰므로 CI 의 `node --test` 로는 못 불러온다(channels.test.ts 와 같은 사정).
//    그래서 값이 아니라 **소스를 훑는다**.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "couple.ts"), "utf8");
const block = /export const POKE_KINDS[\s\S]*?\n\];/.exec(src)?.[0] ?? "";

type Preset = { kind: string; label: string; message: string };
const presets: Preset[] = [...block.matchAll(/\{\s*kind:\s*"([^"]+)",[^}]*?label:\s*"([^"]*)",\s*message:\s*"([^"]*)"/g)].map(
  (m) => ({ kind: m[1], label: m[2], message: m[3] }),
);

test("쿡 프리셋 — kind 는 DB 에 저장된 값이라 고정이다 [회귀 lock]", () => {
  assert.ok(block, "POKE_KINDS 배열을 못 찾았다");
  // schema.sql 의 pokes.kind 주석·기존 저장분과 짝. 추가는 자유지만 **기존 kind 는 못 지운다**.
  const KEEP = ["poke", "miss", "meal", "love", "kiss", "night", "yaru"];
  const kinds = presets.map((p) => p.kind);
  assert.equal(new Set(kinds).size, kinds.length, `kind 중복: ${kinds.join(", ")}`);
  for (const k of KEEP) {
    assert.ok(kinds.includes(k), `kind "${k}" 가 사라졌다 — 그 kind 로 저장된 옛 쿡이 💌 로 떨어진다`);
  }
});

test("쿡 프리셋 — 라벨·메시지가 비어 있지 않다", () => {
  assert.ok(presets.length >= 7, `프리셋 파싱 실패(${presets.length}개) — 형식이 바뀌었나`);
  for (const p of presets) {
    assert.ok(p.label.trim(), `${p.kind}: 라벨이 비었다(버튼에 아무것도 안 보인다)`);
    assert.ok(p.message.trim(), `${p.kind}: 메시지가 비었다(빈 쿡이 날아간다)`);
    // 라벨은 가로로 나열되는 버튼 — 길면 줄바꿈되어 프리셋 줄이 세로로 자란다.
    assert.ok(p.label.length <= 10, `${p.kind}: 라벨이 너무 길다(${p.label.length}자) — "${p.label}"`);
  }
});

test("쿡 프리셋 — 메시지에 한쪽 이름을 박지 않는다 [회귀 lock]", () => {
  // 둘 다 보내는 말이라, 이름이 박히면 상대가 보낼 때 자기 이름으로 자길 말하게 된다.
  for (const p of presets) {
    assert.ok(
      !p.message.includes("김도연"),
      `${p.kind}: 프리셋 메시지에 이름이 박혔다 — "${p.message}"`,
    );
  }
});
