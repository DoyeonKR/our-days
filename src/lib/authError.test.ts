// authErrorMessage 회귀 lock: Supabase 영문 에러가 한국어로 매핑되고, 원문(영문)이
// 사용자에게 그대로 새어나가지 않음을 보장한다. [회귀 lock 2026-07-01]
import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "./authError.ts";

test("authErrorMessage: 대표 Supabase 에러 → 한국어", () => {
  assert.equal(authErrorMessage("Invalid login credentials"), "이메일 또는 비밀번호가 올바르지 않아요.");
  assert.equal(authErrorMessage("User already registered"), "이미 가입된 이메일이에요. 로그인해 주세요.");
  assert.equal(authErrorMessage("Password should be at least 6 characters."), "비밀번호는 6자 이상이어야 해요.");
  assert.equal(authErrorMessage("Unable to validate email address: invalid format"), "이메일 형식이 올바르지 않아요.");
  assert.equal(authErrorMessage("Failed to fetch"), "네트워크 연결을 확인해 주세요.");
  assert.equal(
    authErrorMessage("For security purposes, you can only request this after 55 seconds"),
    "요청이 많아요. 잠시 후 다시 시도해 주세요.",
  );
});

test("authErrorMessage: 미지의 에러는 일반 한국어 안내 (영문 원문 미노출) [회귀 lock]", () => {
  const out = authErrorMessage("some totally unexpected backend error XYZ");
  assert.equal(out, "문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
  // 영문 원문 조각이 사용자 메시지에 새어나가면 안 됨
  assert.ok(!/[a-zA-Z]{4,}/.test(out), "한국어 메시지에 영문 원문이 노출됨");
});

test("authErrorMessage: 빈/널 입력도 안전하게 일반 안내", () => {
  assert.equal(authErrorMessage(""), "문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
  // @ts-expect-error 런타임 방어 확인
  assert.equal(authErrorMessage(undefined), "문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
});
