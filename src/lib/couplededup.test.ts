// getMyCouple 중복 왕복 lock. [배포본 실측 2026-09-08]
//
// 부팅에 같은 질의(`couples?select=*,couple_members(*)&limit=1`)가 여러 번 나간다.
// 호출부가 넷인데(page.tsx 의 시작일 확인·커플 구독, CoupleSync 의 둘) 서로를 모른 채
// 각자 useEffect 에서 쏘기 때문이다. 무료 티어에서 공짜가 아니고 모바일에선 왕복 300~400ms.
//
// 잠그는 것: **합류는 하되 캐시는 하지 않는다.**
//   결과를 들고 있으면 그 순간부터 '상대가 바꿨는데 내 화면만 옛날'이 생긴다 —
//   이 앱은 실시간 구독이 다시 부르는 걸 전제로 만들어져 있어서 특히 위험하다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "couple.ts"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("getMyCouple 은 진행 중인 요청에 합류시킨다", () => {
  assert.match(code, /let couplePending: Promise<CoupleState \| null> \| null = null;/);
  const fn = code.match(/export async function getMyCouple\(\)[^{]*\{([\s\S]*?)\n\}/);
  assert.ok(fn, "getMyCouple 본문을 못 찾음");
  assert.match(fn![1], /if \(couplePending\) return couplePending;/);
  assert.match(fn![1], /couplePending = fetchMyCouple\(\);/);
});

test("요청이 끝나면 반드시 비운다 — 안 그러면 영구 캐시가 된다", () => {
  const fn = code.match(/export async function getMyCouple\(\)[^{]*\{([\s\S]*?)\n\}/);
  // finally 로 비워야 한다. 성공 경로에서만 비우면 **한 번 실패한 뒤 영영 그 실패를 돌려준다.**
  assert.match(fn![1], /finally\s*\{[^}]*couplePending = null;[^}]*\}/);
});

test("결과를 들고 있지 않는다 (시간 기반 캐시 금지)", () => {
  // 값을 저장하거나 TTL 을 비교하기 시작하면 실시간 갱신이 조용히 죽는다.
  assert.equal(/coupleCache|coupleCachedAt|CACHE_MS|coupleTtl/i.test(code), false,
    "getMyCouple 주변에 결과 캐시로 보이는 이름이 생겼다 — 실시간 갱신이 죽는다");
  const fn = code.match(/export async function getMyCouple\(\)[^{]*\{([\s\S]*?)\n\}/);
  assert.equal(/Date\.now\(\)|performance\.now\(\)/.test(fn![1]), false,
    "getMyCouple 이 시간을 본다 — 합류 지점이 아니라 캐시가 됐다");
});

test("실제 질의는 fetchMyCouple 이 하고, 그건 안 감싼다", () => {
  const inner = code.match(/async function fetchMyCouple\(\)[^{]*\{([\s\S]*?)\n\}/);
  assert.ok(inner, "fetchMyCouple 을 못 찾음");
  assert.match(inner![1], /from\("couples"\)/);
  assert.equal(/couplePending/.test(inner![1]), false, "fetchMyCouple 안에서 합류 상태를 만지면 재진입에 꼬인다");
});
