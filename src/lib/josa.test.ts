// 조사 도우미 lock — "달 를" · "튤립이(가)" 재발 방지. [2026-09-24]
import { test } from "node:test";
import assert from "node:assert/strict";
import { josa } from "./josa.ts";

test("받침 있으면 이·을·은·과·으로, 없으면 가·를·는·와·로", () => {
  assert.equal(josa("달", "을/를"), "달을");
  assert.equal(josa("바다", "을/를"), "바다를");
  assert.equal(josa("튤립", "이/가"), "튤립이");
  assert.equal(josa("나비", "이/가"), "나비가");
  assert.equal(josa("정자", "은/는"), "정자는");
  assert.equal(josa("벌통", "과/와"), "벌통과");
  assert.equal(josa("분수대", "과/와"), "분수대와");
  assert.equal(josa("모래", "으로/로"), "모래로");
  assert.equal(josa("정원", "으로/로"), "정원으로");
  assert.equal(josa("젖소", "이에요/예요"), "젖소예요");
});

test("ㄹ 받침 + 으로 → 로 (물로 · 길로)", () => {
  assert.equal(josa("물", "으로/로"), "물로");
  assert.equal(josa("달", "으로/로"), "달로");
});

test("숫자는 읽는 소리로 — 1(일)·3(삼)은 받침, 2(이)·4(사)는 없음", () => {
  assert.equal(josa("1", "이/가"), "1이");
  assert.equal(josa("2", "이/가"), "2가");
  assert.equal(josa("3", "을/를"), "3을");
  assert.equal(josa("4", "을/를"), "4를");
});

test("한글이 아니면 받침 없는 쪽", () => {
  assert.equal(josa("GPS", "을/를"), "GPS를");
  assert.equal(josa("", "이/가"), "가");
});

test("★ 꾸미기 화면에 괄호 조사가 되살아나지 않는다", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const read = (p: string) =>
    readFileSync(join(import.meta.dirname, "..", p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const game = read("components/IslandGame.tsx");
  const decor = game.slice(game.indexOf('tab === "decor"'), game.indexOf('tab === "more"'));
  assert.doesNotMatch(decor, /이\(가\)|을\(를\)/, "꾸미기 화면에 '이(가)'·'을(를)' 괄호 조사가 있다");
  assert.doesNotMatch(decor, /<\/b>\{" "\}\s*를 사서/, "'달 를 사서' — 이름 뒤에 조사를 띄워 고정했다");
});
