import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emailValidationMessage,
  newPasswordValidationMessage,
  normalizeEmail,
  passwordResetRedirect,
} from "./authPolicy.ts";

test("인증 입력: 이메일을 정규화하고 흔한 형식 오류를 먼저 안내한다", () => {
  assert.equal(normalizeEmail("  Me@Example.COM "), "me@example.com");
  assert.equal(emailValidationMessage("me@example.com"), null);
  assert.match(emailValidationMessage("me@localhost") ?? "", /형식/);
  assert.match(emailValidationMessage(" ") ?? "", /입력/);
});

test("새 비밀번호: 8자 이상 영문·숫자 조합을 요구한다", () => {
  assert.match(newPasswordValidationMessage("abc123") ?? "", /8자/);
  assert.match(newPasswordValidationMessage("abcdefgh") ?? "", /영문과 숫자/);
  assert.equal(newPasswordValidationMessage("abcd1234"), null);
});

test("비밀번호 재설정 redirect는 GitHub Pages basePath와 trailing slash를 보존한다", () => {
  assert.equal(
    passwordResetRedirect("https://doyeonkr.github.io/", "/our-days/"),
    "https://doyeonkr.github.io/our-days/reset-password/",
  );
  assert.equal(
    passwordResetRedirect("http://localhost:3000", ""),
    "http://localhost:3000/reset-password/",
  );
});
