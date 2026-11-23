// 낚시 · 수조 리뷰(2026-11-23) [사용자: "낚시 수조 리뷰해" → "Fix all"] — 수조 쪽 고친 것을 잠근다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { addFish, aquaOf, keepInNet, netKeyOf, sellNet, netToTank, syncAqua } from "./aquarium.ts";
import { createIsland, type IslandState } from "./island.ts";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const H = 3_600_000;

function netState() {
  let st = { ...createIsland("x", null, 0), coins: 0 } as IslandState;
  const t0 = 1_800_000_000_000;
  st = addFish(st, "guppy", 0, undefined, t0);
  const mk = (family: string, value: number) => ({ family, stage: 2 as const, difficulty: 1, value });
  for (const [fam, v, h] of [["guppy", 11, 0], ["koi", 2222, 1], ["arowana", 9999, 2]] as const) {
    const r = keepInNet(st, mk(fam, v), t0 + h * H);
    assert.ok(r.ok);
    st = r.state;
  }
  return { st, t0 };
}

test("대기 그물 버튼은 칸 번호가 아니라 그 물고기 — 그 사이 한 마리가 팔려 순서가 밀려도 고른 물고기가 팔린다", () => {
  const { st, t0 } = netState();
  // 화면은 23.9시간 뒤에 그려졌고(구피 · 비단잉어 · 아로와나), 사용자가 24.1시간 뒤에 비단잉어를 팔았다 — 구피는 그 사이 기한이 지나 팔렸다
  const shown = syncAqua(st, t0 + 23.9 * H).a.net!;
  const koi = shown.find((n) => n.family === "koi")!;
  const r = sellNet(st, netKeyOf(koi), t0 + 24.1 * H);
  assert.ok(r.ok);
  assert.deepEqual(aquaOf(r.state).net!.map((n) => n.family), ["arowana"], "비단잉어가 팔리고 아로와나는 남는다");
  // 수조로 옮기기도 같은 열쇠
  const moved = netToTank(st, netKeyOf(shown.find((n) => n.family === "arowana")!), t0 + 24.1 * H);
  if (moved.ok) assert.ok(!aquaOf(moved.state).net!.some((n) => n.family === "arowana"));
  // 이미 없는 물고기
  assert.equal(sellNet(st, "nope@1#1", t0).ok, false);
});

test("수조 저장은 저장 표식으로 — 응답만 잃은 저장을 다시 하지 않는다(하트 두 번 · 단계 두 번 막기)", () => {
  const src = read("src/components/AquariumGame.tsx");
  const act = src.slice(src.indexOf("const act = useCallback"), src.indexOf("const act = useCallback") + 2600);
  assert.ok(act.includes("const mark = newSaveMark();"), "한 번 누를 때 표식 하나");
  assert.ok(act.includes("if (attempt > 0 && landed && hasSaveMark(r.state, mark))"), "다시 읽은 상태에 표식이 있으면 그 저장은 들어갔다");
  assert.ok(act.includes("await saveIsland(coupleId, r.version, res.ok ? res.state : synced.state, mark)"), "그 표식으로 저장");
  assert.ok(src.includes("sellNet(st, netKeyOf(n), t)") && src.includes("netToTank(st, netKeyOf(n), t)"), "그물 버튼은 열쇠로");
});

test("잡아먹힌 카드의 다시 보기는 24시간 안만 · 고른 물고기 카드는 수조 바로 아래", () => {
  const src = read("src/components/AquariumGame.tsx");
  assert.match(src, /onReplay=\{typeof news\[0\]\.at === "number" && \(now \|\| gameNow\(\)\) - news\[0\]\.at < EATEN_REPLAY_MS/);
  const stageEnd = src.indexOf("people={[myName, partnerName]} onPhoto={setPhotoOpen} />");
  const card = src.indexOf("<FishCard key={sel.id}"), meters = src.indexOf('<div className="aqua-meters">');
  assert.ok(stageEnd > 0 && card > stageEnd && card < meters, "수조 다음, 게이지 앞");
});

test("3D — 보기 메뉴는 낮은 수조 칸 안에서 스크롤 · 자동 복구는 최근 10분만 센다 · 깊은 수조 안개 · 가린 장식 흐리기는 묶음도 · 해변 가까이 보기 · 엑스레이 훑기", () => {
  const css = read("src/styles/games.css"), a3d = read("src/components/Aquarium3D.tsx"), scene = read("src/lib/aqua3d/scene.ts");
  assert.match(css, /\.aqua-view-menu \{ max-height: calc\(100% - 66px\); overflow-y: auto;/);
  assert.ok(a3d.includes("if (Date.now() - recoveredAt.current > RECOVER_WINDOW_MS) recovered.current = 0;"));
  assert.match(scene, /scene\.fog\.far=dist\+9\+3\*Math\.max\(0,deep-1\)/);
  assert.ok(scene.includes("if(!ud.fadeOrig){batchesDirty=true;"), "흐리기 시작하면 묶음을 다시 — 흐린 부품은 묶음에서 빠진다");
  assert.ok(scene.includes("delete ud.fadeOrig;delete ud.fadeMat;batchesDirty=true;"), "되돌리면 다시 묶는다");
  assert.ok(scene.includes("focusLen=closeD*.55/3.4;"), "해변은 가까이 보기 거리로");
  assert.ok(scene.includes("if(!xrayAll&&ud.xrayOn===on&&ud.xrayN===n)continue;"), "바뀐 몸만(1초에 한 번은 모두)");
});
