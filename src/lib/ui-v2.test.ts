import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectionIndex } from "./selection.ts";
import { selectBuckets } from "./bucket.ts";

test("radio keyboard arrows wrap; Home/End work; unrelated keys remain native", () => {
  assert.equal(selectionIndex("ArrowLeft", 0, 4), 3);
  assert.equal(selectionIndex("ArrowRight", 3, 4), 0);
  assert.equal(selectionIndex("ArrowDown", 0, 4), 1);
  assert.equal(selectionIndex("ArrowUp", 1, 4), 0);
  assert.equal(selectionIndex("Home", 3, 4), 0);
  assert.equal(selectionIndex("End", 0, 4), 3);
  for (const key of ["Enter", "Tab", " ", "Escape"]) assert.equal(selectionIndex(key, 0, 4), null);
  assert.equal(selectionIndex("ArrowRight", 0, 0), null);
});
const rows = [
  { title: "바다 여행", done: true, created_at: "2026-10-17" },
  { title: "제주 여행", done: false, created_at: "2026-10-16" },
  { title: "ＣＡＦＥ 데이트", done: false, created_at: "2026-10-18" },
];
test("bucket search is normalized, immutable, and respects completed filters", () => {
  const snapshot = JSON.stringify(rows);
  assert.deepEqual(selectBuckets(rows, "all", " 여행 ").map((x) => x.title), ["제주 여행", "바다 여행"]);
  assert.equal(selectBuckets(rows, "done", "여행").length, 1);
  assert.equal(selectBuckets(rows, "todo", "cafe")[0].title, "ＣＡＦＥ 데이트");
  assert.deepEqual(selectBuckets(rows, "all", "none"), []);
  assert.deepEqual(selectBuckets([], "all", ""), []);
  assert.equal(JSON.stringify(rows), snapshot);
});
test("UI v2 keeps one keyboard stop per group and an explicit navigation landmark", () => {
  const segmented = readFileSync(new URL("../components/SegmentedControl.tsx", import.meta.url), "utf8");
  assert.match(segmented, /tabIndex=\{index === idx \? 0 : -1\}/);
  assert.match(segmented, /selectionIndex\(event.key/);
  const nav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
  assert.match(nav, /aria-label="주 메뉴"/);
});
test("bucket mutations are synchronously guarded, IME safe, and only roll back the affected row", () => {
  const source = readFileSync(new URL("../components/BucketList.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(busyRef.current\) return false/);
  assert.match(source, /busyRef.current = true/);
  assert.match(source, /request === revision && !busyRef.current/);
  assert.match(source, /e.nativeEvent.isComposing \|\| e.keyCode === 229/);
  assert.match(source, /cur.some\(\(x\) => x.id === b.id\) \? cur : \[\.\.\.cur, b\]/);
  assert.ok(!source.includes("setItems(prev);"));
});
test("failed loads stay distinct from empty data; topmost dialogs contain keyboard focus", () => {
  const game = readFileSync(new URL("../components/GameArcade.tsx", import.meta.url), "utf8");
  assert.match(game, /if \(current !== request.current\) return/);
  assert.match(game, /setLoadError/);
  assert.match(game, /<StatePanel kind="error"/);
  assert.ok(!game.includes("loadIsland(coupleId).catch(() => null)"));
  const focus = readFileSync(new URL("./useDialogFocus.ts", import.meta.url), "utf8");
  assert.match(focus, /stack.at\(-1\) !== dialog/);
  assert.match(focus, /event.key === "Tab"/);
  assert.match(focus, /previous\?\.isConnected/);
  const confirm = readFileSync(new URL("../components/ConfirmHost.tsx", import.meta.url), "utf8");
  assert.match(confirm, /z-\[90\]/);
  assert.match(confirm, /data-dialog-initial/);
  assert.ok(!confirm.includes("\n            autoFocus"), "focus must be captured before moving it into the dialog");
});

test("bucket APIs confirm a returned row instead of silently succeeding without a connection", () => {
  const source = readFileSync(new URL("./couple.ts", import.meta.url), "utf8");
  for (const name of ["addBucket", "setBucketDone", "deleteBucket"]) {
    const start = source.indexOf(`export async function ${name}(`);
    const end = source.indexOf("\n}", start);
    const body = source.slice(start, end);
    assert.match(body, /if \(!sb\) throw new Error/);
    assert.match(body, /select\("id"\)/);
    assert.match(body, /if \(!data\) throw new Error/);
  }
});

test("photo grid renders in bounded batches but the viewer keeps the entire album", () => {
  const source = readFileSync(new URL("../components/PhotoAlbum.tsx", import.meta.url), "utf8");
  assert.match(source, /useState\(36\)/);
  assert.match(source, /photos.slice\(0, visibleCount\).map/);
  assert.match(source, /setVisibleCount\(\(n\) => n \+ 36\)/);
  assert.match(source, /photos.findIndex\(\(p\) => p.id === viewerId\)/);
  assert.match(source, /loadError && photos.length === 0 \? null/);
  assert.match(source, /<StatePanel kind="error" title="사진을 불러오지 못했어요"/);
});
