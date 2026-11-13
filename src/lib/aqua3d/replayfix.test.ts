// 잡아먹힌 물고기 다시 보기 다듬기(2026-11-13) — 여러 마리 동시 사냥 · 다시 보기 중 카드 · 다시 보기 중 실제 사냥 · 임시 사냥꾼 · 그만 보기 · 그때 모습
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEAL_END_EVENT, TEMP_HUNTER_ID, TEMP_LINGER, eatenCardWaits, huntPlan, mealEndEvent, mealEndOf, replayHunter, tempHunterGone } from "./hunt.ts";

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const read = (p: string) => strip(readFileSync(join(process.cwd(), p), "utf8"));

test("장면 끝 알림은 소식 번호 · 다시 보기인지를 싣는다 — 번호 없는 알림은 아무 카드도 풀지 않는다", () => {
  const e = mealEndEvent({ n: 42, replay: false });
  assert.equal(e.type, MEAL_END_EVENT);
  assert.deepEqual(mealEndOf(e), { n: 42, replay: false });
  assert.deepEqual(mealEndOf(mealEndEvent({ n: 7, replay: true })), { n: 7, replay: true });
  assert.equal(mealEndOf(new Event(MEAL_END_EVENT)), null, "옛 알림(내용 없음)");
  assert.equal(mealEndOf(new CustomEvent(MEAL_END_EVENT, { detail: { n: "3" } })), null);
});

test("여러 마리가 한꺼번에 먹혔다 — 가장 새 것 하나만 장면으로, 나머지는 장면 없이 바로 카드", () => {
  const news = [{ n: 5, ate: {} }, { n: 6, ate: {} }, { n: 7 }];
  assert.deepEqual(huntPlan(news, 0), { play: news[1], skip: [5] });
  assert.deepEqual(huntPlan(news, 5), { play: news[1], skip: [] }, "이미 본 번호는 건너뛴다");
  assert.deepEqual(huntPlan(news, 6), { play: null, skip: [] });
  const shuffled = [{ n: 9, ate: {} }, { n: 3, ate: {} }, { n: 8, ate: {} }];
  assert.equal(huntPlan(shuffled, 0).play?.n, 9, "순서가 섞여도 가장 큰 번호");
  assert.deepEqual(huntPlan(shuffled, 0).skip.sort(), [3, 8]);
});

test("카드는 제 번호의 장면 끝만 기다린다 — 그려지지 않을 장면 · 자람 카드는 바로, 끝 알림이 먼저 와도 놓치지 않는다", () => {
  const unseen = [5, 6];
  assert.equal(eatenCardWaits(5, unseen, []), false, "그려지지 않는 오래된 사냥");
  assert.equal(eatenCardWaits(6, unseen, []), true, "지금 그리는 사냥");
  assert.equal(eatenCardWaits(6, unseen, [6]), false, "카드가 붙기 전에 끝났다");
  assert.equal(eatenCardWaits(6, unseen, [5]), true, "다른 번호의 끝은 풀지 않는다");
  assert.equal(eatenCardWaits(9, [], []), false, "자람 · 알 카드");
});

test("다시 보기 사냥꾼은 소식에 적힌 그때 모습 — 같은 모습으로 남아 있으면 그대로, 자랐거나 떠났으면 임시로", () => {
  const key = (f: { family: string; stage: number; species?: string }) => `${f.family}:${f.stage}:${f.species ?? ""}`;
  const item = { id: 3, family: "shark", stage: 1 as const, species: "tiger" };
  assert.deepEqual(replayHunter(item, [{ id: 3, family: "shark", stage: 1, species: "tiger" }], -800001, key), { id: 3, temp: null });
  const grown = replayHunter(item, [{ id: 3, family: "shark", stage: 2, species: "tiger" }], -800002, key);
  assert.deepEqual(grown, { id: -800002, temp: { id: -800002, family: "shark", stage: 1, species: "tiger" } }, "다 자란 몸이 아니라 그때 몸");
  assert.equal(replayHunter(item, [], -800003, key).temp?.stage, 1, "떠난 사냥꾼");
  assert.equal(replayHunter({ id: 1, family: "pike", stage: 0 }, [], -800004, key).temp?.species, undefined);
  assert.ok(-800002 <= TEMP_HUNTER_ID);
});

test("장면이 끝난 임시 사냥꾼은 카메라가 물러난 뒤에 빠진다 — 최대 1.5초, 시계가 서 있으면 바로", () => {
  assert.equal(TEMP_LINGER, 1.5);
  assert.equal(tempHunterGone(0, 1, 1, false), false, "카메라가 아직 코앞");
  assert.equal(tempHunterGone(0.4, 0.6, 0, false), false);
  assert.equal(tempHunterGone(0.4, 0.02, 0.1, false), true, "카메라가 물러났다");
  assert.equal(tempHunterGone(TEMP_LINGER, 1, 1, false), true, "상한");
  assert.equal(tempHunterGone(0, 1, 1, true), true, "움직임 줄이기 · 멈춘 그리기");
});

test("수조 — 장면 정리는 한 곳(finishMeal) · 다시 보기 끝에 안 본 사냥을 바로 연다 · 임시 사냥꾼은 장면이 열릴 때까지 숨고 물러난 뒤 빠진다", () => {
  const scene = read("src/lib/aqua3d/scene.ts");
  assert.doesNotMatch(scene, /const endMeal=/, "정리가 draw 안에 갇혀 있지 않다");
  assert.doesNotMatch(scene, /new Event\(MEAL_END_EVENT\)/, "내용 없는 끝 알림은 없다");
  assert.match(scene, /recheck=true;if\(!quiet\)\{window\.dispatchEvent\(mealEndEvent\(\{n:m\.n,replay:m\.kind!=="real"\}\)\);\}/, "조용히 끝내도 다시 본다(이어 연 다시 보기가 실패해도 밀린 실제 사냥이 열린다)");
  assert.match(scene, /if\(recheck&&!meal\)\{recheck=false;if\(huntNews\(\)\)retopo\(true\);\}/, "끝나자마자 장면 동안 들어온 안 본 사냥");
  assert.match(scene, /if\(!meal\)\{if\(openNext\)\{const o=openNext;openNext=null;if\(openMeal\(o\.item,o\.ghostId,o\.kind\)\)topologyChanged=true;\}else if\(huntNews\(\)\)topologyChanged=true;\}/);
  assert.match(scene, /if\(item\.id<=TEMP_HUNTER_ID\)pm\.root\.visible=false;/, "모델을 기다리는 동안 임시 몸을 안 보인다");
  assert.match(scene, /if\(meal\.predId<=TEMP_HUNTER_ID&&!pred\.root\.visible\)\{pred\.root\.visible=true;batchesDirty=true;\}/, "장면이 열릴 때 보인다(자라는 중인 진짜 사냥꾼의 숨긴 새 몸은 안 건드린다)");
  assert.match(scene, /const visibility=m===mealGhost\?1-mealGone:meal&&meal\.t0<0&&meal\.predId<=TEMP_HUNTER_ID&&m\.root\.userData\.id===meal\.predId\?0:1;/, "숨은 동안 그림자도 없다(자라는 물고기 그림자는 그대로)");
  assert.match(scene, /if\(pred\.root\.visible&&!quiet&&!reduced\.matches\)leaving\.push\(\{id:m\.predId,t:0\}\);else\{dropFish\(pred\);swimmers\.delete\(m\.predId\);\}/);
  assert.match(scene, /if\(tempHunterGone\(L\.t,povK,mealK,dt===0\|\|reduced\.matches\)\)\{leaving\.splice\(r,1\);dropSwimmer\(L\.id\);\}/);
  assert.match(scene, /closingNotice\?\.\(\);/, "장면 도중에 닫혀도 끝났다고 알린다");
});

test("다시 보기 — 내 다시 보기는 바꿔 틀고(바쁨 아님) · 못 열면 임시 사냥꾼을 남기지 않고 · 그만 볼 수 있다", () => {
  const scene = read("src/lib/aqua3d/scene.ts");
  assert.match(scene, /if\(meal&&meal\.kind==="real"\)return "busy";/, "바쁨은 실제 사냥 장면일 때만");
  assert.match(scene, /if\(meal\)finishMeal\(true\);/, "내 다시 보기는 조용히 끝내고 새로");
  assert.match(scene, /if\(pick\.temp\)dropSwimmer\(pick\.id\);if\(!active\)draw\(0\);\s*return "missing";/, "임시 사냥꾼이 새지 않는다");
  assert.match(scene, /stopReplay\(\):boolean\{if\(disposed\|\|!meal\|\|meal\.kind==="real"\)return false;finishMeal\(\);if\(!active\)draw\(0\);return true;\}/);
  assert.match(scene, /stopReplay: \(\) => boolean/);
  assert.match(scene, /if\(!meal\)\{dropSwimmer\(pid\);/, "개발 장면도");
});

test("화면 — 요청은 수조가 준비될 때까지 들고 · 다시 보기 동안 카드 줄을 멈추고 · 그만 보기 · 안내는 수조 위에 잠깐", () => {
  const tank = read("src/components/Aquarium3D.tsx");
  assert.doesNotMatch(tank, /useRef\(replaySignal\?\.k\)/, "다시 붙을 때 요청을 삼키지 않는다");
  assert.match(tank, /if \(!ready \|\| !tank\) return;/, "컨트롤러가 없으면 기다린다('못 불러왔다'가 아니다)");
  assert.match(tank, /if \(error\) \{ replaySeen\.current = replaySignal\.k; onReplay\?\.\("error"\); return; \}/, "수조를 못 열면 묶이지 않는다");
  assert.match(tank, /<CloseButton onClose=\{\(\) => \{ if \(!controller\.current\?\.stopReplay\(\)\) onReplay\?\.\("stopped"\); \}\} label="그만 보기"/);
  assert.match(tank, /\{replayNote && <p className="aqua-replay-note" role="status">\{replayNote\}<\/p>\}/);
  assert.match(tank, /mealSeen: Math\.max\(storedMealSeen\(\), mealSeenRef\.current\)/, "새로 지을 때 그때 본 번호(연결 복구 뒤 같은 사냥을 또 안 그린다)");
  assert.match(tank, /mealSeenRef\.current = Math\.max\(mealSeenRef\.current, n\)/);
  assert.doesNotMatch(tank, /const \[mealSeen\] = useState/);
  const game = read("src/components/AquariumGame.tsx");
  assert.match(game, /\{news\[0\] && !replaying && <GrownCard key=\{news\[0\]\.n\} g=\{news\[0\]\} waits=\{tab === "tank" && eatenCardWaits\(news\[0\]\.n, news\.filter\(\(x\) => x\.ate\)\.map\(\(x\) => x\.n\), mealDone\)\}/);
  assert.match(game, /if \(d\.replay\) setReplaying\(false\);\s*else setMealDone/, "다시 보기 끝은 카드를 풀지 않고 줄만 다시 연다");
  const start = game.slice(game.indexOf("const startReplay"), game.indexOf("const onReplay"));
  for (const s of ['setTab("tank")', "setEditing(false)", "setReplaying(true)", "showStage()"]) assert.ok(start.includes(s), s);
  assert.match(game, /setReplay\(null\);\s*if \(res === "ok"\) \{ setReplaying\(true\); return; \}\s*setReplaying\(false\);/);
  assert.match(game, /setTimeout\(\(\) => setReplaying\(false\), \(MEAL_LONGEST \+ MEAL_WAIT_MAX \+ TEMP_LINGER\) \* 1000/, "끝 알림을 못 들어도 풀린다");
  assert.match(game, /setTimeout\(\(\) => setReplayNote\(null\), 4000\)/);
  assert.match(game, /if \(k !== tab\) \{ setReplay\(null\); setReplaying\(false\); \}/, "탭을 옮기면 수조가 닫힌다");
  assert.doesNotMatch(game, /className="aqua-note" role="status">\{replayNote\}/, "안내는 목록 밑이 아니라 수조 위");
  // 이모지 없음 — 새로 넣은 글자(수조 화면 · 다시 보기 결과 안내)
  const notes = game.slice(game.indexOf("const onReplay"), game.indexOf("const onEnd"));
  assert.doesNotMatch(tank + notes, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
});
