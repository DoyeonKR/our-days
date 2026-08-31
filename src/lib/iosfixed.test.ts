// iOS(WebKit) 에서 하단 고정층이 스크롤과 함께 떠오르던 것 lock.
//
// [사용자 리포트 2026-08-31 · 사파리]
//   "하단 네비게이션바가 스크롤하면 위로 올라가는 버그"
//
// 화면 녹화(720×1571, 2.8초)를 프레임 단위로 계측해서 나온 값 — 다시 의심이 들면 이 숫자를
// 먼저 읽어라. 눈으로만 보면 '스크롤 잔상' 으로 오해하기 쉬운 증상이다.
//
//   구간            베젤 세로테두리        높이     문서 스크롤
//   t=0.0~0.7    y 133..1486          1354     0        ← 정상
//   t=0.8        y  59..1411          1353     -75px    ← 딱 스크롤만큼 올라감
//   t=1.0~1.9    y   0.. 932(잘림)     1354     -554px   ← 그 자리에 **멈춰 있음**
//   t=2.4~2.8    y 133..1486          1354     0        ← 맨 위로 되돌리자 복구
//
// 읽는 법 두 가지가 결정적이다.
//  1) **높이가 안 변한다**(1354 고정) → 패딩이 늘어난 게 아니라 통째로 밀린 것이다.
//  2) 밀린 양이 **문서 스크롤량과 1:1**(t=0.8 에서 콘텐츠 -75 / 베젤 -75, 오차 9)이고,
//     스크롤 0 에서만 제자리다 → `position: fixed` 의 컨테이닝 블록이 뷰포트가 아니라
//     **문서**라는 뜻. iOS 에서 fixed 가 사실상 absolute 로 동작하고 있었다.
//
// 원인은 둘이고 서로 독립이다(둘 다 같은 녹화에 찍혔다).
//  A. 루트(html/body)의 `overflow-x: clip` → **뷰포트로 전파**되어 WebKit 이 fixed 레이어를
//     뷰포트 고정으로 잡지 못한다. 위 표의 큰 밀림(최대 554px ≈ 300pt)이 이것.
//  B. ViewportFit 의 --vv-bottom 보정 → t=2.1 프레임에서 베젤 **위변은 제자리인데 아래변만**
//     264px(≈144 CSS px) 올라갔다. 높이가 준 것이므로 패딩(=이 변수)이 범인이다.
//     이 보정은 원래 삼성 인터넷(하단 주소창) 처방이라 WebKit 에선 근거가 없다.
//
// 모달·시트가 멀쩡했던 이유도 여기서 설명된다 — scrollLock 이 오버레이가 열리는 동안
// body 를 fixed 로 묶어 문서 스크롤을 0 으로 만든다. 스크롤이 0 이면 A 는 드러나지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
const navSrc = readFileSync(join(SRC, "components/BottomNav.tsx"), "utf8");
/** ⚠ 주석을 먼저 지운다 — 이 저장소는 '왜' 를 주석에 길게 쓴다(README §10.5). */
const fit = readFileSync(join(SRC, "components/ViewportFit.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

/** iOS WebKit 만 참인 표식. 데스크톱 사파리·크롬엔 없다. */
const IOS_AT = "@supports (-webkit-touch-callout: none)";

test("★ iOS 에서는 루트 가로 클립을 되돌린다 — fixed 가 문서에 붙는다", () => {
  const i = css.indexOf(IOS_AT);
  assert.ok(i >= 0, `${IOS_AT} 블록이 없다 — iOS 에서 GNB 가 스크롤과 함께 떠오른다`);
  // 블록 본문(중첩 규칙 하나 + 닫는 괄호 두 개)만 본다.
  const body = css.slice(i, css.indexOf("\n}", css.indexOf("\n  }", i)));
  assert.ok(/overflow-x:\s*visible/.test(body), "iOS 예외가 가로 클립을 되돌리지 않는다");
});

test("★ iOS 예외는 html 과 body 를 **함께** 푼다 (루트→body 전파 때문)", () => {
  // 규격상 루트가 visible 이면 body 의 overflow 가 대신 뷰포트로 전파된다.
  // html 만 되돌리면 뷰포트는 여전히 clip 이라 증상이 그대로다 — 한쪽만 고치면 조용히 재발.
  const i = css.indexOf(IOS_AT);
  const sel = css.slice(i, css.indexOf("overflow-x: visible", i));
  for (const tag of ["html", "body"]) {
    assert.ok(
      new RegExp(`(^|,|\\s)${tag}\\s*(,|\\{|$)`, "m").test(sel),
      `iOS 예외가 ${tag} 를 안 푼다 — 남은 쪽 값이 뷰포트로 전파돼 증상이 그대로다`,
    );
  }
});

test("★ 가로 방어선을 걷은 대신 하단 고정바는 스스로 폭을 조인다", () => {
  // iOS 에선 루트 클립이 없으므로, fixed 가 문서 폭으로 눕는 엔진에 대한 방어는
  // 이 클램프 하나뿐이다(원래 삼성 인터넷 증상의 **직접** 수정이기도 하다).
  for (const [name, src] of [
    ["GNB", navSrc],
    ["네온 베젤", css],
  ] as const) {
    assert.ok(
      /min\(28rem,\s*var\(--vv-w/.test(src),
      `${name} 에 실제 보이는 폭(--vv-w) 클램프가 없다 — iOS 에서 마지막 탭이 밀려난다`,
    );
  }
});

test("★ ViewportFit 은 iOS 에서 --vv-bottom 보정을 끈다", () => {
  assert.ok(/isIOS/.test(fit), "ViewportFit 이 iOS 를 구분하지 않는다 — GNB 가 근거 없이 떠오른다");
  assert.ok(/--vv-bottom/.test(fit), "--vv-bottom 을 여전히 설정해야 한다(크로미움용)");
  // 폭 측정은 iOS 에서도 계속 필요하다 — 위 클램프의 입력값이다.
  assert.ok(/--vv-w/.test(fit), "iOS 에서도 --vv-w 는 계속 재야 한다");
});

test("★ 크로미움용 툴바 보정은 살아 있다 (삼성 인터넷 하단 주소창)", () => {
  // [사용자 리포트 2026-08-05] 를 되돌리지 않았는지 — 게이트를 iOS 로만 좁혔는지 본다.
  assert.ok(/visualViewport/.test(fit), "실제 보이는 영역은 visualViewport 로 재야 한다");
  assert.ok(
    /clientHeight/.test(fit),
    "가려진 픽셀 계산(레이아웃 뷰포트 − 시각 뷰포트)이 사라졌다",
  );
});
