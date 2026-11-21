// 진동(2026-11-21) [사용자: "왜 ios 에서는 진동이 안울리지??!" → "한번 해볼래"]
// 아이폰 사파리(홈 화면 앱 · 다른 브라우저도 같은 엔진)엔 navigator.vibrate 가 없다 — 애플이 넣은 적이 없다. 그래서 진동 요청이 조용히 무시됐다.
// 우회: iOS 18 부터 사파리의 스위치 입력칸(<input type="checkbox" switch>)을 켜고 끄면 시스템이 짧은 '톡' 햅틱을 낸다.
//   보이지 않는 스위치를 잠깐 만들어 그 라벨을 눌러 준다. 세기 · 길이는 못 고른다(늘 같은 한 번).
//   ⚠ 사용자가 화면을 누른 그 순간(사용자 동작 안)에만 울린다 — 입질처럼 저절로 일어나는 때는 아이폰에선 조용할 수 있다.
//   ⚠ iOS 17 이하 · 애플이 막으면 아무 일도 없다(오류도 없다). 안드로이드 · 데스크톱은 예전처럼 navigator.vibrate 그대로.
//   스위치는 문서 head 에 잠깐 붙였다 바로 뗀다(화면 · 스크린리더에 안 나온다). 클릭 사건이 문서까지 올라가지만 이 앱엔 문서 전체 클릭 리스너가 없다(haptic.test).

/** 진동 — 숫자(ms) 하나 또는 패턴. 안드로이드는 그대로, 아이폰은 '톡'(패턴의 울림이 셋 이상이면 한 번 더) */
export function haptic(pattern: number | readonly number[]): void {
  if (typeof navigator === "undefined" || typeof document === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern as number | number[]);
      return;
    }
    tick();
    const pulses = typeof pattern === "number" ? 1 : Math.ceil(pattern.length / 2);
    if (pulses >= 3) setTimeout(tick, 140);
  } catch {
    /* 진동이 없는 기기 */
  }
}

function tick(): void {
  try {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* 스위치 햅틱이 없는 브라우저 */
  }
}
