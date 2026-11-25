// 혼자하기 — 가입 없이 시작하기 (2026-11-25, lib/guest)
// 잠그는 것: 익명 계정은 로그인 화면의 버튼으로만 생긴다 · 가입은 같은 계정에 붙인다 · 커플 연결은 가입 뒤에만.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guestUpgradeError } from "./guest.ts";

const src = (p: string) =>
  readFileSync(new URL(`../../${p}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

function fnBody(s: string, head: string): string {
  const i = s.indexOf(head);
  assert.ok(i >= 0, `${head} 없음`);
  let depth = 0;
  for (let j = s.indexOf("{", i + head.length); j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return s.slice(i, j + 1);
  }
  throw new Error("짝 없음");
}

test("익명 로그인은 startGuest 한 곳 — 세션이 풀렸을 때 몰래 만드는 길은 없다", () => {
  const files = [
    "src/lib/couple.ts",
    "src/lib/session.ts",
    "src/app/page.tsx",
    "src/components/CoupleSync.tsx",
    "src/components/AccountSection.tsx",
    "src/components/GuestSignup.tsx",
  ];
  for (const f of files) assert.doesNotMatch(src(f), /signInAnonymously/, f);
  const auth = src("src/lib/auth.ts");
  assert.equal(auth.match(/signInAnonymously/g)?.length, 1);
  assert.match(fnBody(auth, "export async function startGuest("), /signInAnonymously\(\)[\s\S]*markGuest\(\)/);
  // 부르는 곳은 로그인 화면의 버튼뿐
  assert.match(src("src/components/AuthGate.tsx"), /await startGuest\(\);\s*await startSoloSpace\(/);
});

test("가입은 같은 계정에 이메일 → 비밀번호 순으로 붙이고, 끝나면 익명이 풀렸는지 본다", () => {
  const auth = src("src/lib/auth.ts");
  const up = fnBody(auth, "export async function upgradeGuest(");
  const iEmail = up.indexOf("updateUser({ email: target })");
  const iPw = up.indexOf("updateUser({ password })");
  assert.ok(iEmail > 0 && iPw > iEmail, "이메일을 먼저 붙인다");
  assert.match(up, /refreshSession\(\)/);
  assert.match(up, /after\.user\.is_anonymous/);
  assert.match(up, /clearGuestMark\(\)/);
  assert.doesNotMatch(up, /signUp\(/, "다시 눌렀을 때 새 빈 계정이 생기면 안 된다");
  assert.match(fnBody(auth, "export async function signUpEmail("), /is_anonymous\) \{\s*await upgradeGuest\(/);
});

test("부팅은 익명 세션도 들여보내고 guest 를 표시한다", () => {
  const page = src("src/app/page.tsx");
  assert.match(page, /setAuthed\(!!\(info && \(info\.isAnonymous \|\| info\.email\)\)\);\s*setGuest\(!!info\?\.isAnonymous\);/);
  assert.match(page, /guestLost=\{sessionLost && hadGuest\(\)\}/);
  assert.match(page, /<CoupleSync[\s\S]*?guest=\{guest\}/);
});

test("커플 연결은 가입 뒤에만 — 만들기 · 합류 · 재연결 · 초대코드 카드", () => {
  const cs = src("src/components/CoupleSync.tsx");
  const unpaired = cs.slice(cs.indexOf('{phase === "unpaired" && ('), cs.indexOf('{phase === "paired" && couple && ('));
  assert.match(unpaired, /\{guest && <GuestSignup reason="connect" \/>\}/);
  for (const m of ["menu", "create", "join"]) assert.match(unpaired, new RegExp(`\\{!guest && mode === "${m}" && \\(`));
  assert.match(cs, /\{waiting && guest && <GuestSignup reason="connect" \/>\}\s*\{waiting && !guest && \(/);
  assert.match(fnBody(cs, "const handleJoin = () =>"), /if \(guest\) return/);
  assert.match(fnBody(cs, "const handleReconnect = async () =>"), /if \(guest\) return/);
});

test("계정 칸 — 가입 카드 · 내보내기 · 경고 붙은 나가기, 비밀번호가 필요한 것은 숨긴다", () => {
  const a = src("src/components/AccountSection.tsx");
  assert.match(a, /isGuest \? \(\s*<div className="space-y-2">\s*<GuestSignup reason="account" \/>/);
  assert.match(a, /가입하지 않고 나갈까요/);
  // 비밀번호 변경 · 계정 삭제 칸은 loggedIn(이메일 계정)에만
  assert.match(a, /\{loggedIn && mode === "password" && \(/);
  assert.match(a, /\{loggedIn && mode === "delete" && \(/);
});

test("이미 가입된 이메일 — '로그인해 주세요' 대신 기록이 안 옮겨진다고 말한다", () => {
  assert.match(guestUpgradeError("이미 가입된 이메일이에요. 로그인해 주세요."), /다른 이메일로 가입.*옮겨지지 않아요/);
  assert.equal(guestUpgradeError("네트워크 연결을 확인해 주세요."), "네트워크 연결을 확인해 주세요.");
});
