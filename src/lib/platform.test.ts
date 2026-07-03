// platform.ts 회귀 lock — navigator/window 전역을 모킹해 감지 로직을 잠근다.
// 특히 iPadOS(Mac 위장 + 터치) 판별이 실수 나기 쉬워 케이스로 고정.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isIOS, isStandalone } from "./platform.ts";

const g = globalThis as unknown as {
  navigator?: { userAgent?: string; platform?: string; maxTouchPoints?: number; standalone?: boolean };
  window?: { matchMedia?: (q: string) => { matches: boolean } };
};

function setNav(n: { userAgent?: string; platform?: string; maxTouchPoints?: number; standalone?: boolean }) {
  g.navigator = { userAgent: "", platform: "", ...n };
}
function clearGlobals() {
  delete g.navigator;
  delete g.window;
}

test("isIOS: navigator 없으면 false (SSR)", () => {
  clearGlobals();
  assert.equal(isIOS(), false);
});

test("isIOS: 아이폰 UA → true", () => {
  try {
    setNav({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" });
    assert.equal(isIOS(), true);
  } finally {
    clearGlobals();
  }
});

test("isIOS: 아이패드(구형 UA) → true", () => {
  try {
    setNav({ userAgent: "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)" });
    assert.equal(isIOS(), true);
  } finally {
    clearGlobals();
  }
});

test("isIOS: iPadOS 가 Mac 위장(MacIntel + 터치>1) → true", () => {
  try {
    setNav({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 5 });
    assert.equal(isIOS(), true);
  } finally {
    clearGlobals();
  }
});

test("isIOS: 진짜 Mac(MacIntel + 터치 없음) → false", () => {
  try {
    setNav({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel", maxTouchPoints: 0 });
    assert.equal(isIOS(), false);
    setNav({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", platform: "MacIntel" });
    assert.equal(isIOS(), false);
  } finally {
    clearGlobals();
  }
});

test("isIOS: 안드로이드 → false", () => {
  try {
    setNav({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)", platform: "Linux armv8l", maxTouchPoints: 5 });
    assert.equal(isIOS(), false);
  } finally {
    clearGlobals();
  }
});

test("isStandalone: window 없으면 false (SSR)", () => {
  clearGlobals();
  assert.equal(isStandalone(), false);
});

test("isStandalone: display-mode standalone 매치 → true", () => {
  try {
    setNav({});
    g.window = { matchMedia: (q) => ({ matches: q.includes("standalone") }) };
    assert.equal(isStandalone(), true);
  } finally {
    clearGlobals();
  }
});

test("isStandalone: navigator.standalone === true → true (iOS Safari)", () => {
  try {
    setNav({ standalone: true });
    g.window = { matchMedia: () => ({ matches: false }) };
    assert.equal(isStandalone(), true);
  } finally {
    clearGlobals();
  }
});

test("isStandalone: 일반 브라우저 탭 → false", () => {
  try {
    setNav({ standalone: false });
    g.window = { matchMedia: () => ({ matches: false }) };
    assert.equal(isStandalone(), false);
  } finally {
    clearGlobals();
  }
});
