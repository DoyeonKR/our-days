/* 입력창이 옆 버튼을 화면 밖으로 밀어내지 않게 잠근다.
 *
 * [사용자 리포트 2026-08-07 "삼성브라우저에서 보내 버튼이 오른쪽으로 튀어나가서 보이지않아"]
 *
 * 원인은 브라우저 버그가 아니라 **flex 규격 그대로**다.
 *   · flex 아이템의 기본 min-width 는 `auto` — 즉 **내용의 최소 폭 밑으로는 안 줄어든다**.
 *   · <input> 은 size 속성 기본값이 20 이라 내재 최소 폭이 대략 20글자다.
 *   · 그래서 `flex-1` 을 줘도 그 아래로 절대 안 내려가고, 남은 폭이 모자라면
 *     **형제(보내기 버튼)를 컨테이너 밖으로 밀어낸다.**
 * 삼성 인터넷에서 먼저 터진 건 기본 폰트가 커서 그 최소 폭이 더 넓기 때문이지,
 * 다른 브라우저가 안전한 게 아니다(폭만 좁으면 어디서든 난다).
 *
 * 게다가 html 에 overflow-x:clip 이 걸려 있어(overflowguard.test.ts) 가로 스크롤로도
 * 못 따라간다 — 밀려난 버튼은 **잘리는 게 아니라 아예 사라진다**. 그래서 더 늦게 발견됐다.
 *
 * 고치는 법은 한 단어: `min-w-0`. flex 아이템이 실제로 줄어들 수 있게 된다.
 */
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SRC = join(process.cwd(), "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

/** 여는 태그 하나를 통째로 집는다.
 *  ⚠ 끝을 `>` 로 잡으면 onChange={(e) => …} 의 화살표에서 끊긴다 — `/>` 로 잡아야 한다. */
const TAG = /<(input|textarea)\b[\s\S]*?\/>/g;
const CLASS = /className="([^"]*)"/;

/** 그 위치를 감싸고 있는 <div> 의 className.
 *
 * ⚠ "바로 앞의 <div>" 로 찾으면 안 된다 — 이미 </div> 로 닫힌 형제를 부모로 착각한다.
 *   (처음에 그렇게 짰다가 w-full 입력창 6개가 전부 오탐으로 걸렸다.)
 *   여닫는 걸 세서 **실제로 열려 있는** 가장 안쪽 div 를 집는다. */
function enclosingDivClass(src: string, at: number): string {
  const stack: string[] = [];
  for (const m of src.slice(0, at).matchAll(/<div\b([^>]*)>|<\/div>/g)) {
    if (m[0] === "</div>") stack.pop();
    // 자기 자신을 닫는 <div ... /> 는 자식을 갖지 않으니 쌓지 않는다
    else if (!m[1].trimEnd().endsWith("/")) stack.push(CLASS.exec(m[1])?.[1] ?? "");
  }
  return stack.at(-1) ?? "";
}

test("flex 로 늘어나는 입력창에는 min-w-0 이 있다", () => {
  const bad: string[] = [];
  for (const p of tsxFiles(SRC)) {
    const src = readFileSync(p, "utf8");
    for (const m of src.matchAll(TAG)) {
      const cls = CLASS.exec(m[0])?.[1] ?? "";
      // flex-1/grow = flex 자식이 확실하다. w-full 은 flex 안이면 똑같이 위험하다.
      if (!/\b(flex-1|grow|w-full)\b/.test(cls)) continue;
      if (/\bmin-w-0\b/.test(cls)) continue;
      // 블록 문맥의 w-full 은 안전하다 — flex 가로줄 안에 있는 것만 문제 삼는다.
      const before = src.slice(0, m.index);
      const parentCls = enclosingDivClass(src, m.index);
      const inFlexRow = /\bflex\b/.test(parentCls) && !/\bflex-col\b/.test(parentCls);
      if (/\bw-full\b/.test(cls) && !/\b(flex-1|grow)\b/.test(cls) && !inFlexRow) continue;
      const line = before.split("\n").length;
      bad.push(`${p.replace(SRC, "src")}:${line} <${m[1]}> ${cls.slice(0, 60)}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    "flex 안에서 늘어나는 입력창에 min-w-0 이 없다. 기본 min-width:auto 때문에 " +
      "입력창이 20글자 폭 아래로 안 줄어들고, 옆 버튼을 화면 밖으로 밀어낸다:\n" +
      bad.join("\n"),
  );
});

test("보내기 버튼은 줄어들지 않는다(shrink-0)", () => {
  // 입력창이 못 줄어들 때 대신 찌그러지는 건 옆 버튼이다. 원형 아이콘 버튼이
  // 타원으로 눌리면 그것도 깨진 화면이다 — 폭을 고정으로 못 박아 둔다.
  const src = readFileSync(join(SRC, "components", "CoupleSync.tsx"), "utf8");
  const btn = /aria-label="보내기"[\s\S]{0,400}?className="([^"]*)"/.exec(src);
  assert.ok(btn, "보내기 버튼을 못 찾았다");
  assert.match(btn[1], /\bshrink-0\b/, "보내기 버튼에 shrink-0 이 없다");
});
