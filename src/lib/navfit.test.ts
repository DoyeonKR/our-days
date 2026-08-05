// GNB × 네온 베젤 기하 lock.
// [사용자 리포트 2026-08-05 "가끔씩 메인화면에서 gnb 가 짤려 게임쪽이 안나와"]
//
// 원인(브라우저 실측 375×812): .app-frame 은 z-60 · 3px 네온 테두리 · 26px 라운드로
// **GNB(z-20) 위에** 그려진다. 베젤 안쪽 경계가 x 8~367 · 아래 805 인데 탭은 x 4~371 ·
// 아래 806 까지 뻗어 있어서, 맨 오른쪽 '게임' 탭이 오른쪽 변 + 아래 변 + 모서리 곡선
// 세 방향에서 덮였다(0 0 22px 글로우까지 안쪽으로 번진다).
//
// 잠그는 것: **GNB 여백 ≥ 베젤 인셋**. 두 값이 서로 다른 파일에 있어 한쪽만 고치면
// 조용히 재발한다 — 베젤을 건드리면 이 테스트가 GNB 도 같이 보라고 알려준다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
const navSrc = readFileSync(join(SRC, "components/BottomNav.tsx"), "utf8");
/** ⚠ 주석에도 `z-60`·`whitespace-nowrap` 같은 말이 나온다(왜 그렇게 했는지 적어 뒀으니까).
 *  전체 소스를 정규식으로 훑으면 주석이 먼저 잡힌다 — 실제로 그렇게 오검출했다.
 *  그래서 **className 문자열 안**만 본다. */
const nav = (navSrc.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []).join("\n");

/** .app-frame 규칙 블록 하나를 통째로 꺼낸다. */
function rule(sel: string): string {
  const i = css.indexOf(sel + " {");
  assert.ok(i >= 0, `${sel} 규칙이 없다`);
  return css.slice(i, css.indexOf("}", i));
}

const frame = rule(".app-frame");
const bezel = rule(".app-frame::before");

/** 베젤 테두리 두께(px). */
const borderPx = Number(/border:\s*(\d+)px/.exec(bezel)?.[1]);
/** .app-frame 의 padding: <top> <side> <bottom> — 좌우와 아래의 상수 부분. */
const padSide = Number(/padding:[^;]*?\n\s*[^\n]*\n\s*(\d+)px/.exec(frame)?.[1]);
const padBottomConst = Number(/inset-bottom\)\s*\+\s*(\d+)px\)/.exec(frame)?.[1]);

test("베젤 수치를 읽을 수 있다 (형식이 바뀌면 이 테스트부터 고쳐라)", () => {
  for (const [k, v] of Object.entries({ borderPx, padSide, padBottomConst })) {
    assert.ok(Number.isFinite(v) && v > 0, `${k} 를 globals.css 에서 못 읽었다 (${v})`);
  }
});

test("★ GNB 좌우 여백이 베젤 안쪽보다 넓다 — 첫/마지막 탭이 네온선에 안 물린다", () => {
  const need = padSide + borderPx; // 화면 끝에서 베젤 안쪽 면까지
  const m = /className="flex overflow-hidden px-([\d.]+)/.exec(nav);
  assert.ok(m, "탭 줄의 px-* 를 못 찾았다");
  const havePx = Number(m![1]) * 4; // tailwind spacing = 4px
  assert.ok(havePx >= need, `GNB 좌우 ${havePx}px < 베젤 인셋 ${need}px — 양끝 탭(홈·게임)이 덮인다`);
});

test("★ GNB 아래 여백이 베젤 아래보다 넓다 — 라벨이 네온선 위로 올라온다", () => {
  const need = padBottomConst + borderPx;
  // ⚠ 메시지에 Tailwind **클래스처럼 생긴 문자열**을 쓰지 마라. Tailwind 는 src 전체를
  //   훑어 임의값 클래스를 만들어내는데, 테스트 문자열이 잡히면 유효하지 않은 CSS 가 생성돼
  //   globals.css 파싱이 통째로 실패한다(2026-08-05 실제로 앱 스타일이 전부 죽었다).
  const m = /pb-\[calc\(env\(safe-area-inset-bottom\)\+(\d+)px\)\]/.exec(nav);
  assert.ok(m, "GNB 아래 여백이 safe-area 단독이다 — 베젤 두께만큼 더해야 네온선에 안 물린다");
  assert.ok(Number(m![1]) >= need, `GNB 아래 ${m![1]}px < 베젤 인셋 ${need}px`);
});

test("★ 베젤이 GNB 위에 그려진다는 전제가 유지된다", () => {
  // 이 전제가 깨지면(GNB 를 베젤 위로 올리면) 위 두 여백은 필요 없어진다.
  // 그땐 이 테스트가 실패하면서 '여백 계산을 다시 하라'고 알려주는 게 맞다.
  const frameZ = Number(/z-index:\s*(\d+)/.exec(frame)?.[1]);
  const navZ = Number(/\bz-(\d+)\b/.exec(nav)?.[1]);
  assert.ok(frameZ > navZ, `베젤 z=${frameZ} 가 GNB z=${navZ} 보다 위여야 이 여백 계산이 성립한다`);
});

test("★ 탭이 좁은 기기에서 줄어들 수 있다 (min-width:auto 넘침 방지)", () => {
  // flex 아이템 기본 min-width 는 auto 라, nowrap 라벨보다 좁아지지 못하고 오른쪽으로 넘친다.
  // 라벨 폭은 --font-prose(시스템 서체)라 기기마다 다르므로 구조로 막아야 한다.
  assert.ok(/min-w-0/.test(nav), "탭 버튼에 min-w-0 이 있어야 6칸이 좁은 화면에서 줄어든다");
  assert.ok(!/whitespace-nowrap/.test(nav), "nowrap 라벨은 줄어들지 못해 마지막 칸을 밀어낸다");
});
