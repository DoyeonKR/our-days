import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = read("../app/globals.css");

test("게임 화면 글자는 픽셀 격자(12 · 15px)에 앉는다 — 13 · 14 · 11px 은 도트가 번져 흐리다", () => {
  for (const line of css.split("\n")) {
    if (!/^\.(aqua|fish)-[^{]*\{/.test(line)) continue;
    for (const m of line.matchAll(/font-size:\s*([0-9.]+)px/g)) {
      const px = parseFloat(m[1]);
      if (px > 16) continue;
      assert.ok(px === 12 || px === 15, `${px}px: ${line.slice(0, 70)}`);
      assert.match(line, px === 12 ? /font-family: var\(--font-micro\)/ : /font-family: var\(--font-body\)/, line.slice(0, 70));
    }
  }
});

test("크기 기록 — 칸이 고정된 표, 나 분홍 · 상대 파랑, 더 큰 쪽만 칠한다", () => {
  const p = read("../components/FishingPanels.tsx");
  assert.match(css, /\.fish-size-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) 76px 76px/);
  assert.match(css, /\.fish-size-row > \.is-me\.is-win \{ background: #ffa6cb/);
  assert.match(css, /\.fish-size-row > \.is-partner\.is-win \{ background: #93cdff/);
  assert.match(p, /mine === other \? null : mine > other \? "me" : "partner"/, "같으면 아무도 안 칠한다");
});

test("브이로그 — 이모지 반응 없음, 댓글 입력은 상대 영상에만", () => {
  const t = read("../components/TodayLog.tsx");
  assert.doesNotMatch(t, /LOG_REACTIONS|setLogReaction|vlog-react|log\.emoji/);
  assert.equal(t.match(/<CommentThread/g)?.length, 2);
  const mine = t.slice(t.indexOf("<CommentThread"), t.indexOf("/>", t.indexOf("<CommentThread")));
  assert.match(mine, /myLog\.id/);
  assert.match(mine, /showInput=\{false\}/, "내 영상에는 입력창이 없다");
  assert.match(t, /myLog && comments\.some\(/, "받은 댓글이 없으면 내 영상 칸은 아예 안 그린다");
});
