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

// ── 문구 로테이션 [2026-09-07, 사용자: "쿡찌르기 기능의 멘트도 좀 업데이트해줘 지겹다 이제"]
//
// 문구를 갈아도 **하나면 며칠 뒤 또 지겨워진다**. 버튼마다 후보를 여러 개 두고
// `pokeMessage(kind)` 가 매번 골라 보낸다. `message` 는 폴백 겸 대표 문구로 남는다
// (위 파서가 그 필드를 읽으므로 형식도 그대로 유지된다).
const variantBlocks = [...block.matchAll(/kind:\s*"([^"]+)"[\s\S]*?variants:\s*\[([\s\S]*?)\]/g)].map((m) => ({
  kind: m[1],
  variants: [...m[2].matchAll(/"([^"]*)"/g)].map((v) => v[1]),
}));

test("쿡 프리셋 — 버튼마다 문구 후보가 여러 개다", () => {
  assert.equal(variantBlocks.length, presets.length, "variants 가 없는 프리셋이 있다");
  for (const v of variantBlocks) {
    assert.ok(v.variants.length >= 3, `${v.kind}: 후보가 ${v.variants.length}개뿐이다`);
    for (const t of v.variants) assert.ok(t.trim(), `${v.kind}: 빈 후보가 있다`);
    const pool = [presets.find((p) => p.kind === v.kind)?.message ?? "", ...v.variants];
    assert.equal(new Set(pool).size, pool.length, `${v.kind}: 같은 문구가 두 번 들어 있다`);
    // 대표 문구와 같은 규칙 — 둘 다 보내는 말이라 한쪽 이름을 박으면 안 된다.
    for (const t of v.variants) assert.ok(!t.includes("김도연"), `${v.kind}: 후보에 이름이 박혔다 — "${t}"`);
  }
});

test("쿡 프리셋 — 실제로 나가는 건 pokeMessage(kind) 다", () => {
  // 컴포넌트가 p.message 를 그대로 보내면 로테이션이 죽은 코드가 된다.
  assert.match(src, /export function pokeMessage\(kind: string\): string/);
  const ui = readFileSync(join(import.meta.dirname, "..", "components", "CoupleSync.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  assert.equal(
    /handlePoke\(\s*\w+\.kind,\s*\w+\.message\s*\)/.test(ui),
    false,
    "프리셋 문구를 message 로 직접 보내는 곳이 남아 있다 — pokeMessage(kind) 를 써야 한다",
  );
});
