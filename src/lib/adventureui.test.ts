// 모험 화면 리뷰(2026-11-09) lock — 그림 캐시 · 배터리 · 멈춤 · 저장 시점 · 대전 결과 · 첫 로드 · 접근성 · 대화 상자 · 가로 화면. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SpriteLRU, sizeBucket } from "./spritecache.ts";
import { DRAW_MS, FREEZE_AFTER_MS, frameGate, frozenDraw } from "./advframe.ts";
import { heroAsset } from "./heroassets.ts";

const root = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const BATTLE = "components/adventure/BattleView.tsx";
const FIELD = "components/adventure/FieldView.tsx";
const TAB = "components/adventure/AdventureTab.tsx";
const DUEL = "components/adventure/DuelPanel.tsx";

test("그림 캐시 — 한 종을 여러 크기로 번갈아 그려도 크기 단마다 한 번만 굽는다(예전엔 프레임마다 원화를 다시 줄였다)", () => {
  let made = 0;
  const lru = new SpriteLRU<string>(8, (sp, b) => (made++, `${sp}@${b}`));
  // 필드 한 프레임: 수풀(84 × 1.25 × 3) · 동료 · 나(× 1.1) · 트레이너 펫(56) · 대장(150) — 같은 종
  for (let frame = 0; frame < 120; frame++) for (const t of [315, 315, 347, 210, 563]) lru.get("leaf_2", t + (frame % 3));
  assert.equal(made, 3, "256 · 512 · 1024 세 단만"); // 210 → 256, 315 · 347 → 512, 563 → 1024
  assert.equal(sizeBucket(1), 32);
  assert.equal(sizeBucket(256), 256);
  assert.equal(sizeBucket(257), 512);
  assert.equal(sizeBucket(5000), 1024);
});

test("그림 캐시 — 상한을 넘으면 가장 오래 안 쓴 것부터 버리고 정리하며, 아직 못 받은 그림은 기억하지 않는다", () => {
  const dropped: string[] = [];
  let ready = false;
  const lru = new SpriteLRU<string>(3, (sp, b) => (sp === "late" && !ready ? null : `${sp}@${b}`), (v) => dropped.push(v));
  for (const sp of ["a", "b", "c"]) lru.get(sp, 100);
  lru.get("a", 100); // a 를 최근으로
  lru.get("d", 100);
  assert.deepEqual(dropped, ["b@128"]);
  assert.equal(lru.size, 3);
  assert.equal(lru.get("late", 100), null);
  ready = true;
  assert.equal(lru.get("late", 100), "late@128", "그림이 오면 그때 굽는다");
  lru.clear();
  assert.equal(lru.size, 0);
});

test("그림 파일 — 캔버스는 384px(-md)를 받고, 그보다 크게 그릴 때만 원화. 화면엔 옛 spriteOf 캐시가 없다", () => {
  const src = code("lib/advsprite.ts");
  assert.match(src, /heroAsset\(species, full \? 256 : 128\)/);
  assert.match(heroAsset("ember_2", 128), /ember_2-md\.webp/);
  assert.doesNotMatch(heroAsset("ember_2", 256), /-md/);
  assert.match(src, /bucket > MD_PX/);
  for (const f of [BATTLE, FIELD]) {
    const s = code(f);
    assert.match(s, /from "@\/lib\/advsprite"/, f);
    assert.doesNotMatch(s, /heroAsset\(species, 192\)|const sharp = new Map/, f);
  }
});

test("필드 — 대장 관문 · 샘 · 안내판 · 상자도 화면 밖이면 그리지 않는다", () => {
  const s = code(FIELD);
  assert.match(s, /if \(vis\(map\.gate\.x, map\.gate\.y - 80, 260\)\) items\.push/);
  assert.match(s, /if \(vis\(map\.spring\.x, map\.spring\.y, 140\)\) items\.push/);
  assert.match(s, /if \(vis\(map\.guide\.x, map\.guide\.y, 100\)\) items\.push/);
  assert.match(s, /if \(!vis\(ch\.x, ch\.y, 80\)\) return;/);
});

test("배터리 — 120Hz 에서 초당 60장 · 60Hz 는 한 장도 안 거른다 · 멈춘 화면은 연출 뒤 그리지 않는다", () => {
  const run = (hz: number, ms: number) => {
    let acc = 0;
    let n = 0;
    for (let t = 0; t < ms; t += 1000 / hz) {
      const g = frameGate(acc, 1000 / hz + (Math.round(t) % 2 ? 0.08 : -0.08));
      acc = g.acc;
      if (g.draw) n++;
    }
    return n;
  };
  assert.ok(Math.abs(run(120, 1000) - 60) <= 1, `120Hz → ${run(120, 1000)}`);
  assert.ok(run(60, 1000) >= 59, `60Hz → ${run(60, 1000)}`);
  assert.ok(run(90, 1000) <= 61);
  assert.ok(DRAW_MS > 16 && DRAW_MS < 17);
  assert.equal(frozenDraw(0, false), true);
  assert.equal(frozenDraw(FREEZE_AFTER_MS + 1, false), false);
  assert.equal(frozenDraw(FREEZE_AFTER_MS + 1, true), true, "크기가 바뀌어 지워졌으면 한 장은 다시");
  const b = code(BATTLE);
  assert.match(b, /frameGate\(drawAcc, ms\)/);
  assert.match(b, /const frozen = paused\.current \|\| a\.b\.needSwap/);
  assert.match(b, /c\.width = c\.height = 0;\s*fc\.width = fc\.height = 0;/, "나올 때 큰 캔버스를 돌려준다");
  const f = code(FIELD);
  assert.match(f, /frameGate\(drawAcc, ms\)/);
  assert.match(f, /c\.width = c\.height = 0;/);
});

test("쓰러져 다음 생물을 고르는 동안엔 뒤로 가기 · Esc · Ⅱ 가 멈추지 않는다(멈춤 창이 고르기 창 밑에 깔렸다)", () => {
  const s = code(BATTLE);
  assert.match(s, /else if \(!hudRef\.current\.needSwap\) setPausedView/);
  assert.match(s, /k === "Escape" && !online && !hudRef\.current\.needSwap/);
  assert.match(s, /disabled=\{!!hud\.over \|\| hud\.needSwap\} aria-label="일시정지"/);
  assert.match(s, /\{pausedView && !hud\.over && !hud\.needSwap && \(/);
});

test("포기는 지금 가방을 넘긴다 — 쓴 약이 되살아나지 않게", () => {
  const s = code(BATTLE);
  const give = s.slice(s.indexOf("async function giveUp"), s.indexOf("const a = arenaRef.current!;\n  const foeType"));
  assert.match(give, /onEndRef\.current\(ar\.b, ar\.bag \?\? startBag\)/);
  assert.doesNotMatch(give, /onEndRef\.current\(ar\.b, startBag\)/);
});

test("진행 저장은 판이 끝난 그 틱에(축하 1.5초 뒤가 아니라) · 앱이 닫히면 남은 저장을 바로 보낸다", () => {
  const b = code(BATTLE);
  const at = b.indexOf("if (a.b.over && !ended.current)");
  const settle = b.indexOf("onSettleRef.current?.(a.b, a.bag ?? startBag)");
  const wait = b.indexOf("setTimeout(res, 1500)");
  assert.ok(at > 0 && settle > at && settle < wait, "onSettle 이 연출 대기보다 먼저");
  const t = code(TAB);
  assert.match(t, /onSettle=\{settle\} onEnd=\{endBattle\}/);
  assert.match(t, /if \(settled\.current\?\.b === b\) return settled\.current\.out;/, "한 판에 한 번만 정산");
  assert.match(t, /addEventListener\("pagehide", flush\)/);
  assert.match(t, /addEventListener\("online", flush\)/);
  assert.match(t, /visibilityState === "hidden"\) flush\(\)/);
  assert.match(t, /store\.flushAdventure/);
});

test("오늘(임무 · 상자)은 KST 하루 훅으로 — 탭을 켜 둔 채 자정을 넘기면 바뀐다", () => {
  const t = code(TAB);
  assert.match(t, /const today = useDayTick\(\);/);
  assert.doesNotMatch(t, /useState\(\(\) => kstDate/);
});

test("대전 결과는 서버가 정한 것만 — 못 보냈으면 '결과를 보내지 못했어요'와 다시 보내기, 앱의 판으로 승리를 띄우지 않는다", () => {
  const d = code(DUEL);
  assert.match(d, /결과를 보내지 못했어요/);
  assert.match(d, /다시 보내기/);
  assert.match(d, /const x = await duelFinish\(r\.match, r\.log\)/);
  assert.doesNotMatch(d, /b\.over === "win" \? "win"/, "앱의 판 결과로 승패를 만들지 않는다");
  assert.match(d, /if \(o\.result\) setResult\(\{ status: "ok"/);
  assert.match(d, /연습 상대와의 판은 점수가 움직이지 않아요/);
  assert.match(d, /랭킹에서 빠지기/);
});

test("첫 로드 — 모험 탭은 전투 엔진 · 연출 · BattleView 를 정적으로 부르지 않는다(전투를 시작할 때 받는다)", () => {
  const heavy = /from\s+"@\/(components\/adventure\/BattleView|lib\/arena|lib\/battlefx)"/;
  for (const f of [TAB, "components/adventure/advui.tsx", "components/adventure/MonArt.tsx"]) {
    const s = code(f).split("\n").filter((l) => /^\s*import\b|^\s*\} from /.test(l)).join("\n");
    assert.doesNotMatch(s.replace(/import type [^;]+;/g, ""), heavy, f);
  }
  assert.match(code(TAB), /dynamic\(\(\) => import\("@\/components\/adventure\/BattleView"\)/);
  assert.match(code(TAB), /import\("@\/lib\/arena"\)/, "기술 모양은 기술 고르기 창을 열 때");
});

test("실시간 버튼 — 기술 · 회피 · 각성 · 조사는 손가락(pointerdown)과 키보드 · 보조기기(click detail 0) 둘 다, 두 번 나가지 않게", () => {
  const ui = code("components/adventure/advui.tsx");
  assert.match(ui, /onPointerDown: \(e[^)]*\) => \{\s*e\.preventDefault\(\);\s*fire\(\);/);
  assert.match(ui, /onClick: \(e[^)]*\) => \{\s*if \(e\.detail === 0\) fire\(\);/);
  const b = code(BATTLE);
  assert.match(b, /\{\.\.\.pressProps\(\(\) => queue\(\{ dir: 0, skill: i \}\)\)\}/);
  assert.match(b, /\{\.\.\.pressProps\(\(\) => queue\(\{ dir: 0, awaken: true \}, 8\)\)\}/);
  assert.match(b, /\{\.\.\.pressProps\(\(\) => queue\(\{ dir: 0, dodge: true \}, 3\)\)\}/);
  assert.match(code(FIELD), /className="adv-field-act"[^>]*\{\.\.\.pressProps\(act\)\}/);
  assert.doesNotMatch(b + code(FIELD), /onPointerDown=\{\(e\) => \{ e\.preventDefault\(\); (queue|act)/);
});

test("대화 상자 — 결과 · 기술 고르기 · 진화 · 대전 결과가 뒤로 가기와 포커스를 갖고, 진화 장면은 스크롤 잠금이 알아본다", () => {
  const t = code(TAB);
  for (const name of ["function ResultDialog", "function EvoScene", "function MoveEditor"]) {
    const body = t.slice(t.indexOf(name), t.indexOf("\n}\n", t.indexOf(name)));
    assert.match(body, /useBackClose\(/, name);
    assert.match(body, /useDialogFocus\(true, /, name);
  }
  assert.match(t, /className="adv-evo fixed inset-0"/, "ScrollLockManager 는 .fixed.inset-0 을 찾는다");
  const d = code(DUEL);
  const res = d.slice(d.indexOf("function DuelResult"));
  assert.match(res, /useBackClose\(onClose\)/);
  assert.match(res, /useDialogFocus\(true, onClose\)/);
});

test("버튼 칸 — 팀 얼굴은 늘 셋 이상(도구는 공 · 가방 · 멈춤, 모자라면 다음 줄) · 가로 화면은 버튼을 양옆 모서리로", () => {
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.adv-rt-row \{ display: flex; flex-wrap: wrap;/);
  assert.match(css, /\.adv-rt-team \{[^}]*min-width: 138px;/, "42px 얼굴 셋 + 6px 간격 둘");
  assert.match(css, /\.adv-rt-chip \{[^}]*width: 42px;/);
  const land = css.slice(css.indexOf("@media (orientation: landscape) and (max-height: 560px)"));
  assert.ok(land.length > 100, "가로 화면 규칙");
  assert.match(land, /\.adv-rt-ctl \{[^}]*background: none;/);
  assert.match(land, /\.adv-rt-row \{ position: absolute;/);
  const b = code(BATTLE);
  assert.match(b, /const landscape = r\.width > r\.height && r\.height < 560;/, "CSS 와 같은 조건으로 카메라 칸을 잰다");
  assert.doesNotMatch(b, /aria-label="공 종류 바꾸기"/, "공 고르기 · 약 · 도망은 가방 안으로");
  assert.match(b, /가방 — 공 고르기 · 약 · 도망/);
});
