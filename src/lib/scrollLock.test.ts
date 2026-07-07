// scrollLock.ts 회귀 lock — 오버레이가 뜬 동안 body 스크롤을 잠그는 참조카운트 로직.
// 앞 뷰가 있는데 뒤 페이지가 스크롤되는 블리드를 막는다. document/window 전역을 모킹.
import { test } from "node:test";
import assert from "node:assert/strict";

type Style = Record<string, string>;
const g = globalThis as unknown as {
  window?: { scrollY: number; scrollTo(x: number, y: number): void };
  document?: { body: { style: Style } };
};

let scrolledTo: [number, number] | null = null;
function installDom(scrollY = 0): Style {
  // 실제 CSSStyleDeclaration 은 미설정 속성에 "" 를 준다(undefined 아님) — 충실히 재현.
  const style: Style = {
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    overflow: "",
  };
  g.document = { body: { style } };
  g.window = {
    scrollY,
    scrollTo(x, y) {
      scrolledTo = [x, y];
    },
  };
  return style;
}
function uninstallDom(): void {
  delete g.document;
  delete g.window;
}

// 모듈 로드 순서상 SSR 케이스를 먼저: document 없을 때 no-op(throw 안 함).
test("SSR 안전 — document 없으면 no-op, 카운트 미변화", async () => {
  uninstallDom();
  const { lockBodyScroll, activeScrollLocks } = await import("./scrollLock.ts");
  assert.equal(activeScrollLocks(), 0);
  const release = lockBodyScroll(); // document 없음 → no-op
  assert.equal(activeScrollLocks(), 0);
  release(); // throw 안 함
});

test("첫 잠금 — body 고정 + scrollY 보존", async () => {
  const style = installDom(240);
  const { lockBodyScroll, activeScrollLocks } = await import("./scrollLock.ts");
  const release = lockBodyScroll();
  assert.equal(activeScrollLocks(), 1);
  assert.equal(style.position, "fixed");
  assert.equal(style.top, "-240px"); // 현재 스크롤만큼 위로
  assert.equal(style.width, "100%");
  assert.equal(style.overflow, "hidden");
  release();
  assert.equal(activeScrollLocks(), 0);
  assert.equal(style.position, ""); // 복원
  assert.deepEqual(scrolledTo, [0, 240]); // 원위치로 스크롤 복원
});

test("중첩 오버레이 — 안쪽이 닫혀도 바깥 열려 있으면 잠금 유지 [회귀 lock]", async () => {
  const style = installDom(100);
  scrolledTo = null;
  const { lockBodyScroll, activeScrollLocks } = await import("./scrollLock.ts");
  const releaseOuter = lockBodyScroll(); // 시트 열림
  assert.equal(style.position, "fixed");
  assert.equal(style.top, "-100px");
  const releaseInner = lockBodyScroll(); // 그 위에 확인 다이얼로그
  assert.equal(activeScrollLocks(), 2);

  releaseInner(); // 안쪽만 닫힘
  assert.equal(activeScrollLocks(), 1);
  assert.equal(style.position, "fixed"); // ⚠ 아직 잠겨 있어야 함(바깥 열림)
  assert.equal(scrolledTo, null); // 아직 복원 안 함

  releaseOuter(); // 바깥도 닫힘 → 이제 해제
  assert.equal(activeScrollLocks(), 0);
  assert.equal(style.position, "");
  assert.deepEqual(scrolledTo, [0, 100]); // 최초 scrollY 로 복원
});

test("첫 잠금 이후의 scrollY 변화는 무시(최초 위치 보존)", async () => {
  const style = installDom(50);
  scrolledTo = null;
  const { lockBodyScroll } = await import("./scrollLock.ts");
  const r1 = lockBodyScroll(); // scrollY=50 저장
  assert.equal(style.top, "-50px");
  g.window!.scrollY = 999; // 두 번째 잠금 시점엔 값이 달라도
  const r2 = lockBodyScroll();
  assert.equal(style.top, "-50px"); // 최초값 유지(재적용 안 함)
  r2();
  r1();
  assert.deepEqual(scrolledTo, [0, 50]); // 최초 50 으로 복원
});

test("OVERLAY_SELECTOR — fixed inset-0 관용 + 장식(pointer-events-none) 제외 [회귀 lock]", async () => {
  const { OVERLAY_SELECTOR } = await import("./scrollLock.ts");
  // 전 오버레이가 쓰는 관용
  assert.ok(OVERLAY_SELECTOR.includes(".fixed.inset-0"));
  // ⚠ 항상 떠 있는 네온 베젤(.app-frame)·승리 꽃가루는 pointer-events-none →
  //   제외하지 않으면 스크롤이 영구 잠김. 이 exclusion 을 지운 회귀를 막는다.
  assert.ok(OVERLAY_SELECTOR.includes(":not(.pointer-events-none)"));
});

test("release 멱등 — 두 번 호출해도 카운트 한 번만 감소", async () => {
  installDom(0);
  const { lockBodyScroll, activeScrollLocks } = await import("./scrollLock.ts");
  const a = lockBodyScroll();
  const b = lockBodyScroll();
  assert.equal(activeScrollLocks(), 2);
  a();
  a(); // 같은 release 재호출 → 무시
  assert.equal(activeScrollLocks(), 1); // 1 감소만
  b();
  assert.equal(activeScrollLocks(), 0);
  uninstallDom();
});
