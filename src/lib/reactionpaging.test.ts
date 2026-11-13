// 일기 반응이 저장 안 되고 푸시만 계속 가던 것(2026-11-13) [사용자: "반응 누르면 푸쉬는 가고 그 반응이 저장이 안대 계속 푸쉬가가"]
// 원인: listReactions 가 한 번에 받아 PostgREST 1000행 상한에서 잘렸다(반응 1,088개) — 잘린 반응은 화면에 없어서 다시 누르면
// 서버는 409(이미 있음)를 주는데 화면은 푸시를 보냈다. 목록은 쪽으로 끝까지 받고, 푸시는 새로 저장된 반응에만.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const code = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const fnBody = (src: string, name: string) => {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, name);
  return src.slice(i, src.indexOf("\nexport ", i + 10));
};

test("일기 반응 · 댓글 목록은 1000행에서 잘리지 않게 쪽으로 끝까지 받는다", () => {
  const src = code("src/lib/couple.ts");
  for (const name of ["listReactions", "listComments"]) {
    const f = fnBody(src, name);
    assert.match(f, /fetchAllPages\(/, `${name}: fetchAllPages`);
    assert.match(f, /\.range\(from, to\)/, `${name}: range`);
    assert.match(f, /\.order\("id"\)/, `${name}: 쪽 경계가 흔들리지 않게 id 로 끝 순서`);
  }
});

test("반응 푸시는 이번에 새로 저장된 반응(row)일 때만 — 이미 있던 반응(409)엔 안 보낸다", () => {
  const src = code("src/components/DecoBook.tsx");
  const i = src.indexOf("async function toggleReaction(");
  const f = src.slice(i, src.indexOf("async function submitComment(", i));
  assert.match(f, /if \(row && entry && entry\.created_by !== uid\) \{\s*sendEventPush\(/);
});
