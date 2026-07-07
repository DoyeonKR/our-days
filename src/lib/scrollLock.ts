"use client";

/**
 * body 스크롤 락 — 앞에 오버레이(모달/시트/풀스크린 뷰)가 떠 있을 때 뒤 페이지가
 * 스와이프/스크롤로 움직이지 않게 잠근다.
 *
 * 왜 필요한가: 이 앱은 document(body) 스크롤이고 오버레이는 전부 `fixed inset-0`.
 * iOS/모바일에선 fixed 오버레이 위를 드래그해도 뒤의 body 가 스크롤된다(스크롤 블리드).
 * `overscroll-behavior: none`(globals.css)은 '스크롤 체이닝'만 막을 뿐 이 케이스는 못 막음.
 * 확실한 크로스브라우저 해법은 오버레이가 열린 동안 body 를 `position: fixed` 로 고정하고
 * 닫힐 때 원위치로 스크롤 복원하는 것.
 *
 * ⚠ 참조 카운트: 오버레이는 중첩될 수 있다(예: 시트 위에 확인 다이얼로그 ConfirmHost).
 * 각자 lock/unlock 하면 안쪽이 닫힐 때 바깥이 아직 열려 있는데도 풀려버린다 → 카운터로
 * "하나라도 열려 있으면 잠금 유지". 첫 lock 때만 scrollY 저장, 마지막 unlock 때만 복원.
 *
 * 구동은 `ScrollLockManager`(앱 루트 1회 마운트)가 DOM 의 오버레이 유무를 감지해
 * lockBodyScroll() 을 부른다 — 오버레이 컴포넌트마다 훅을 심을 필요 없음.
 */

let lockCount = 0;
let savedScrollY = 0;
let saved: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

function applyLock(): void {
  const body = document.body;
  savedScrollY = window.scrollY;
  saved = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  // body 를 뷰포트에 고정 + 현재 스크롤 위치만큼 위로 올려 화면이 튀지 않게.
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

function releaseLock(): void {
  const body = document.body;
  if (saved) {
    body.style.position = saved.position;
    body.style.top = saved.top;
    body.style.left = saved.left;
    body.style.right = saved.right;
    body.style.width = saved.width;
    body.style.overflow = saved.overflow;
    saved = null;
  }
  // 고정 해제 후 원래 스크롤 위치로 되돌림(fixed 동안 0 으로 보였던 것을 복원).
  window.scrollTo(0, savedScrollY);
}

/**
 * body 스크롤을 잠그고, 잠금을 해제하는 함수를 돌려준다(멱등 — 여러 번 호출해도 1회만 해제).
 * 참조 카운트로 첫 잠금 때만 실제 적용, 마지막 해제 때만 실제 복원.
 * SSR/정적 빌드 안전(document 없으면 no-op).
 */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) applyLock();
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
}

/** 테스트/디버그용 — 현재 활성 잠금 수. */
export function activeScrollLocks(): number {
  return lockCount;
}

/**
 * 풀스크린 오버레이 감지용 CSS 선택자.
 * 앱 전체가 `fixed inset-0` 관용을 쓴다. `pointer-events-none`(네온 베젤 .app-frame,
 * 승리 꽃가루 등 비인터랙션 장식)은 스크롤 락 대상이 아니므로 제외.
 */
export const OVERLAY_SELECTOR = ".fixed.inset-0:not(.pointer-events-none)";
