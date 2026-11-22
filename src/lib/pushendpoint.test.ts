// 이 기기의 구독 기억 · 바뀌면 옛 행 지우기 · 홈 화면 앱 여부 기록(2026-11-22, lib/push)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/lib/push.ts", "utf8").replace(/\r\n/g, "\n");

test("켜기 · 부팅 재동기화가 이 기기 endpoint 를 기억하고, 바뀌면 옛 행을 지운다", () => {
  const remember = src.slice(src.indexOf("async function rememberEndpoint"), src.indexOf("export function pushDisplayMode"));
  assert.match(remember, /if \(!prev \|\| prev === endpoint\) return;/);
  assert.match(remember, /\.from\("push_subscriptions"\)\.delete\(\)\.eq\("endpoint", prev\)/);
  const enable = src.slice(src.indexOf("export async function enablePush"), src.indexOf("async function saveSubscription"));
  assert.ok(enable.indexOf("await rememberEndpoint(sub.endpoint)") < enable.indexOf('logDebug("push_enabled"'), "저장이 끝난 뒤 기억한다");
  assert.match(enable, /mode: pushDisplayMode\(\)/, "홈 화면 앱인지 사파리 탭인지 기록");
  const resync = src.slice(src.indexOf("export async function resyncPushSubscription"), src.indexOf("export async function disablePushOnThisDevice"));
  assert.match(resync, /if \(!err\) await rememberEndpoint\(sub\.endpoint\);/);
  const off = src.slice(src.indexOf("export async function disablePushOnThisDevice"));
  assert.match(off, /localStorage\.removeItem\(ENDPOINT_KEY\)/, "끄면 기억도 지운다");
});
