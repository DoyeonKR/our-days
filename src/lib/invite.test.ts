import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInviteUrl, inviteCodeFromHref, inviteExpiryText, normalizeInviteCode } from "./invite.ts";

test("초대 링크: GitHub Pages 경로를 유지하고 코드 외 쿼리/해시는 제거한다", () => {
  assert.equal(
    buildInviteUrl("https://doyeonkr.github.io/our-days/?pokeReply=love#x", " ab2cde "),
    "https://doyeonkr.github.io/our-days/?invite=AB2CDE",
  );
  assert.equal(inviteCodeFromHref("https://x.test/our-days/?invite=ab2cde"), "AB2CDE");
  assert.equal(inviteCodeFromHref("https://x.test/?invite=x"), null);
  assert.equal(normalizeInviteCode("o1-aB2_cdE"), "AB2CDE");
});

test("초대 만료: 만료 여부와 남은 일수를 사용자 문구로 계산한다", () => {
  const now = Date.parse("2026-08-25T00:00:00Z");
  assert.equal(inviteExpiryText("2026-08-27T00:00:00Z", now), "2일 뒤 만료");
  assert.equal(inviteExpiryText("2026-08-24T00:00:00Z", now), "만료됨");
});

test("초대 링크로 앱을 열면 함께 탭의 합류 화면까지 자동 진입한다", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /inviteCodeFromHref\(window\.location\.href\)/);
  assert.match(page, /setView\("together"\)/);
});
