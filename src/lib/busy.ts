/* 오래 걸리는 작업(올리기 · 내보내기) 표시 — 2026-11-09 앱 뼈대 점검.
 *
 * 왜: 새 버전 자동 새로고침(UpdateChip)은 입력 중 · 창(dialog) 열림만 보고 5분마다 · 앱 복귀마다 location.reload() 했다.
 * 사진첩 여러 장 올리기는 창 없이 진행 막대만 띄우므로, 올리는 도중에 새로고침이 끼어들어 나머지 장이 끊겼다.
 * 이제 그런 작업은 beginBusy() 로 '바쁨'을 걸고, 끝나면 돌려받은 함수를 부른다.
 *  · canReloadNow 는 isBusy() 동안 저절로 새로고침하지 않는다(칩만 띄운다).
 *  · 웹(브라우저 · PWA)에서는 바쁜 동안만 '페이지를 떠날까요?' 확인을 건다. 네이티브 앱(Capacitor)은 그 창이 없으니 걸지 않는다.
 *
 * 다른 파일을 불러오지 않는다 — node --test 에서 그대로 돌려 셈을 확인한다. */

let count = 0;
let unloadArmed = false;

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (count <= 0) return;
  e.preventDefault();
  // 옛 브라우저는 returnValue 가 있어야 확인창을 띄운다
  e.returnValue = "";
}

function isNativeApp(): boolean {
  const cap = (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

function sync() {
  if (typeof document !== "undefined") {
    // 다른 곳(진단 · 테스트)에서도 볼 수 있게 문서에 표시
    if (count > 0) document.documentElement.dataset.busy = String(count);
    else delete document.documentElement.dataset.busy;
  }
  if (typeof window === "undefined" || isNativeApp()) return;
  // 바쁠 때만 건다 — 늘 걸어 두면 bfcache(뒤로 가기 즉시 복원)를 막는다
  if (count > 0 && !unloadArmed) {
    window.addEventListener("beforeunload", onBeforeUnload);
    unloadArmed = true;
  } else if (count <= 0 && unloadArmed) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    unloadArmed = false;
  }
}

/** 바쁨 시작 — 돌려받은 함수를 finally 에서 꼭 부른다. 두 번 불러도 한 번만 센다. */
export function beginBusy(): () => void {
  count += 1;
  sync();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    count = Math.max(0, count - 1);
    sync();
  };
}

/** 올리기 · 내보내기가 진행 중인가 — 자동 새로고침을 미룰지 판단한다. */
export function isBusy(): boolean {
  return count > 0;
}
