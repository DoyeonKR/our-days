// 모험 폰 조작 다듬기(2026-11-09) lock — 두 번째 손가락 · 떠 있는 막대 · 알림 자리 · 필드 이어 걷기 · 대전 뒤로 가기 · 상대 큰 기술 ·
// 구운 바닥 · 입자 박자 · 상성 딱지 · 알약 자리 · 자동 멈춤 · 글자 크기 · 길게 누르기 · 공 '지금!' · 첫 필드 안내 · 홈 화면 안내 · 미니맵 걷기. README §14.6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIELD_COACH_KEY, RING_NOW, STICK_R, holdRepeat, keptField, minFont, pickMarker, planWalk, resumeField, ringNow, stepWalk, stickVec, wantsA2hsTip,
} from "./advmobile.ts";
import { ringAim } from "./arena.ts";
import { REGIONS } from "./adventure.ts";
import { REACH, newField, stepField } from "./adventurefield.ts";

const root = join(import.meta.dirname, "..");
const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const BATTLE = code("components/adventure/BattleView.tsx");
const FIELD = code("components/adventure/FieldView.tsx");
const TAB = code("components/adventure/AdventureTab.tsx");
const rule = (sel: string) => {
  const i = css.indexOf(sel + " {");
  assert.ok(i >= 0, sel);
  return css.slice(i, css.indexOf("}", i));
};

test("두 번째 손가락 — 공 · 팀 얼굴 · 다음 생물 고르기 · 가방은 누르는 순간(pressProps), click 은 남지 않는다", () => {
  assert.match(BATTLE, /className=\{`tap adv-rt-chip[^\n]*\n[^\n]*\n\s*\{\.\.\.pressProps\(\(\) => queue\(\{ dir: 0, swap: i \}, 2\)\)\}/);
  assert.match(BATTLE, /adv-rt-ball[^\n]*\{\.\.\.pressProps\(\(\) => queue\(\{ dir: 0, ball \}, 2\)\)\}/);
  assert.match(BATTLE, /className="tap adv-swap" \{\.\.\.pressProps\(\(\) => queue\(\{ dir: 0, swap: i \}, 2\)\)\}/);
  assert.match(BATTLE, /\{\.\.\.pressProps\(\(\) => setItemsOpen\(\(o\) => !o\)\)\}/);
  assert.doesNotMatch(BATTLE, /onClick=\{\(\) => (queue|setItemsOpen)\(/, "전투 버튼에 click 만 받는 곳이 남지 않게");
  assert.doesNotMatch(BATTLE, /touchAction: "pan-x"/);
  assert.doesNotMatch(rule(".adv-rt-team"), /pan-x|overflow-x: auto/, "팀 칸은 옆으로 넘기지 않는다");
  assert.match(BATTLE, /className="adv-rt-team" style=\{\{ flexBasis:/, "얼굴이 많으면 칸을 넓혀 도구가 다음 줄로");
});

test("떠 있는 막대 — 누른 자리가 가운데, 반지름 밖은 테두리에서 멈추고 dead zone 은 그대로", () => {
  assert.deepEqual(stickVec(200, 300, 200, 300), { kx: 0, ky: 0, dir: 0 }, "누른 순간엔 움직이지 않는다(예전엔 원의 가운데라 튀었다)");
  assert.equal(stickVec(200, 300, 205, 302).dir, 0, "dead zone 안");
  assert.equal(stickVec(200, 300, 300, 300).dir, 3, "오른쪽");
  assert.equal(stickVec(200, 300, 200, 100).dir, 1, "위");
  assert.equal(stickVec(200, 300, 100, 400).dir, 6, "왼쪽 아래");
  const far = stickVec(0, 0, 300, 400);
  assert.ok(Math.abs(Math.hypot(far.kx, far.ky) - STICK_R) < 1e-9, "손잡이는 테두리에서 멈춘다");
  const stick = BATTLE.slice(BATTLE.indexOf("export function Stick"), BATTLE.indexOf("function HpCard"));
  assert.match(stick, /origin\.current = \{ x: e\.clientX, y: e\.clientY, id: e\.pointerId \}/);
  assert.doesNotMatch(stick, /getBoundingClientRect/, "원의 가운데를 기준으로 삼지 않는다");
  assert.match(stick, /stickVec\(o\.x, o\.y, e\.clientX, e\.clientY\)/);
  assert.match(stick, /className="adv-rt-stickzone"/);
  assert.match(stick, /if \(origin\.current\) return;/, "두 번째 손가락은 막대를 옮기지 않는다");
  assert.match(rule(".adv-rt-stickzone"), /position: fixed; left: 0; bottom: 0;/);
  assert.match(rule(".adv-rt-stick"), /pointer-events: none/, "제자리 그림은 표시만");
  assert.match(css, /\.adv-rt-row, \.adv-rt-skills \{ position: relative; z-index: 1; \}/, "다른 버튼은 막대 칸 위");
  assert.match(rule(".adv-field-act"), /position: relative; z-index: 1;/);
  assert.match(rule(".adv-field-talk"), /z-index: 3;/);
  assert.match(FIELD, /<Stick onDir=/, "필드도 같은 막대");
  assert.match(BATTLE, /k\.has\("ArrowRight"\)/, "화살표 키는 그대로");
});

test("알림 띠 — 손가락을 막지 않고, 필드 · 전투가 열려 있으면 위쪽에", () => {
  assert.match(rule(".adv-toast"), /pointer-events: none/);
  assert.match(rule(".adv-toast.is-top"), /top: calc\(var\(--game-safe-top, env\(safe-area-inset-top\)\) \+ \d+px\); bottom: auto;/);
  assert.match(TAB, /className=\{`adv-toast\$\{field \|\| battle \? " is-top" : ""\}`\}/);
});

test("필드 이어 걷기 — 지역마다 걷던 필드를 기억하고(날이 바뀌면 비운다), 다시 들어오면 그 자리에서 잠깐 무적", () => {
  const keep = { day: "", m: new Map<string, { n: number }>() };
  assert.equal(keptField(keep, "2026-11-09", "meadow"), undefined);
  keep.m.set("meadow", { n: 1 });
  assert.deepEqual(keptField(keep, "2026-11-09", "meadow"), { n: 1 });
  assert.equal(keptField(keep, "2026-11-10", "meadow"), undefined, "자정을 넘기면 새 필드");
  const s = newField(REGIONS[0], 3);
  for (let i = 0; i < 40; i++) stepField(s, REGIONS[0], 1, false);
  const at = { x: s.x, y: s.y };
  s.safe = 0;
  s.px = -1;
  const back = resumeField(s);
  assert.equal(back, s, "같은 판(수풀의 생물 · 서 있던 자리 그대로)");
  assert.deepEqual({ x: back.x, y: back.y }, at);
  assert.equal(back.px, back.x);
  assert.ok(back.safe >= 45);
  assert.match(FIELD, /const old = keep && day \? keptField\(keep, day, region\.key\) : undefined;/);
  assert.match(FIELD, /resumeField\(old\) : newField\(region/);
  assert.match(FIELD, /keep\.m\.set\(region\.key, state\)/);
  assert.match(TAB, /keep=\{fieldKeep\}\s*day=\{today\}/);
  assert.doesNotMatch(TAB, /from "@\/lib\/advmobile"/, "모험 탭은 엔진을 정적으로 부르지 않는다(advmobile 은 lib/arena 를 부른다)");
});

test("대전 뒤로 가기 — 기권 창을 열지 않고 안내만, 확인 뒤엔 끝난 판인지 다시 본다", () => {
  const back = BATTLE.slice(BATTLE.indexOf("useBackClose(() => {"), BATTLE.indexOf("}, !hud.over);"));
  assert.match(back, /if \(online\) toast\("기권은 기권 버튼으로"\)/);
  assert.doesNotMatch(back, /forfeit/);
  const ff = BATTLE.slice(BATTLE.indexOf("async function forfeit"), BATTLE.indexOf("async function giveUp"));
  assert.match(ff, /await confirmDialog[\s\S]*?\)\) return;\s*if \(ended\.current\) return;\s*ended\.current = true;/);
});

test("상대 큰 기술 · 각성은 화면을 어둡게 하지 않는다 — 큰 띠는 내 것만, 상대는 머리 위 이름표", () => {
  const sets = BATTLE.match(/feel\.current\.ult = /g) ?? [];
  assert.equal(sets.length, 2);
  assert.match(BATTLE, /if \(mv\.power >= 90 && !still && e\.side === 0\) feel\.current\.ult = /);
  assert.match(BATTLE, /if \(e\.side === 0\) feel\.current\.ult = \{ name: "각성!"/);
  assert.match(BATTLE, /const foeBig = e\.side === 1 && mv\.power >= 90;/);
  assert.match(BATTLE, /else addFloat\(e\.x, e\.y - 30, `\$\{SPECIES\[activeOf\(a\.b, e\.side\)\.mon\.species\]\.name\} 각성!`/);
});

test("구운 바닥 — 땅 · 꾸밈 · 바위는 크기가 바뀔 때만 굽고 프레임마다 붙이기만 한다 · 입자 캔버스도 60장 · 상한", () => {
  const draw = BATTLE.slice(BATTLE.indexOf("const draw = (alpha: number, now: number)"), BATTLE.indexOf("let raf = 0;"));
  assert.match(draw, /if \(!bgK\) bake\(\);\s*if \(bg\) ctx\.drawImage\(bg,/);
  assert.doesNotMatch(draw, /createLinearGradient\(0, 0, 0, ARENA_H\)|for \(const d of deco\)/, "땅 그라데이션 · 꾸밈은 draw 에 없다");
  assert.match(draw, /drawMap\(ctx, a, still \? 0 : now, !bg\)/);
  assert.match(BATTLE, /drawGround\(g, stage\.ground, deco\);\s*drawRocks\(g, a\);/);
  assert.match(BATTLE, /bgK = 0;/, "크기가 바뀌면 다시 굽는다");
  assert.match(BATTLE, /if \(bg\) bg\.width = bg\.height = 0;/, "나올 때 메모리를 돌려준다");
  const map = BATTLE.slice(BATTLE.indexOf("function drawMap("), BATTLE.indexOf("const wrap ="));
  assert.doesNotMatch(map, /\[\.\.\.a\.map\.rocks\]\.sort/, "바위 복사 · 정렬은 굽기에서 한 번");
  assert.match(map, /if \(rocks\) drawRocks\(ctx, a\);/);
  const fx = code("lib/battlefx.ts");
  assert.match(fx, /const gate = frameGate\(this\.drawAcc, now - this\.prev\);/);
  assert.match(fx, /if \(!gate\.draw\) \{\s*this\.raf = requestAnimationFrame\(this\.tick\);\s*return;/);
  assert.match(fx, /if \(this\.ps\.length >= FX_MAX_PARTICLES\) return;/);
  assert.match(fx, /if \(this\.beams\.length < FX_MAX_BEAMS\) this\.beams\.push/);
  assert.doesNotMatch(BATTLE + FIELD + fx, /shadowBlur|\.filter\s*=/);
});

test("상성 — 줄 끝 글자 대신 테두리 색 + 모서리 딱지(320px 말줄임에 안 잘린다)", () => {
  assert.doesNotMatch(BATTLE, /" · 굉장"|" · 별로"/);
  assert.match(BATTLE, /const effCls = eff > 1 \? "is-good" : eff < 1 \? "is-bad" : "";/);
  assert.match(BATTLE, /\{effCls && <i className=\{`adv-rt-eff \$\{effCls\}`\} aria-hidden>/);
  assert.match(BATTLE, /— 효과 굉장/, "보조기기엔 이름표로");
  assert.match(rule(".adv-rt-skill.is-good"), /border-color/);
  assert.match(rule(".adv-rt-eff"), /position: absolute; right: 0; top: 0;/);
});

test("'도망치는 중 · 보내는 중' 알약은 잰 버튼 칸 높이 위 · 앱을 내리면 멈춤 창", () => {
  assert.match(css, /\.adv-rt-channel, \.adv-rt-sending \{[^}]*bottom: calc\(var\(--adv-ctl-h, \d+px\) \+ 8px\);/);
  assert.doesNotMatch(css, /bottom: 196px/);
  assert.match(BATTLE, /style\.setProperty\("--adv-ctl-h"/);
  const vis = BATTLE.slice(BATTLE.indexOf('document.addEventListener("visibilitychange", hide)') - 500, BATTLE.indexOf('document.addEventListener("visibilitychange", hide)'));
  assert.match(vis, /document\.visibilityState !== "hidden" \|\| online \|\| ended\.current/);
  assert.match(vis, /if \(hudRef\.current\.needSwap \|\| hudRef\.current\.over\) return;/, "고르기 창이 먼저");
  assert.match(vis, /setPausedView\(\(v\) => v \?\? "pause"\)/, "첫 안내는 그대로 둔다");
});

test("캔버스 글자 — 배율로 나눠 화면에서 12px(떠오르는 숫자 16px) 밑으로 안 내려간다 · 머리 위 체력바 6px", () => {
  assert.equal(minFont(12, 1), 12);
  assert.equal(minFont(12, 0.78), 12 / 0.78);
  assert.equal(minFont(30, 0.6, 20), 1 / 0.03, "큰 글자는 그대로(30 × 0.6 = 18 < 20 이면 키운다)");
  assert.ok(Math.abs(minFont(21, 0.61, 16) * 0.61 - 16) < 1e-9);
  assert.equal(minFont(21, 1.2, 16), 21, "넓은 화면은 그대로");
  assert.match(FIELD, /const size = minFont\(size0, scale\);/);
  assert.match(FIELD, /minFont\(13, scale\)/, "안내판");
  assert.match(BATTLE, /minFont\(fl\.big \? 30 : 21, s, fl\.big \? 20 : 16\)/);
  assert.match(BATTLE, /const bh = minFont\(6, s, 6\);/);
});

test("길게 누르기 — 대기가 끝나는 틱에 다시, 다른 입력 · 시전 · 고르기 중엔 안 넣는다 · 대기 중에 누르면 흔들기(회전 없음)", () => {
  assert.equal(holdRepeat(null, [0, 0, 0, 0], false, false), false);
  assert.equal(holdRepeat(1, [0, 0, 0, 0], false, false), true);
  assert.equal(holdRepeat(1, [0, 3, 0, 0], false, false), false, "재사용 대기 중");
  assert.equal(holdRepeat(1, [0, 0, 0, 0], true, false), false, "시전 · 다음 생물 고르기 중");
  assert.equal(holdRepeat(1, [0, 0, 0, 0], false, true), false, "이미 줄에 있다");
  assert.match(BATTLE, /const busy = a\.b\.needSwap \|\| !!a\.b\.over \|\|/, "멈춘 틱에 대전 기록이 쌓이지 않게");
  assert.match(BATTLE, /if \(holdRepeat\(q\.held, u0\.cd, busy, !!q\.queue\)\) q\.queue = \{ a: \{ dir: 0, skill: q\.held! \}, ttl: 6 \};/);
  const ps = BATTLE.slice(BATTLE.indexOf("function pressSkill"), BATTLE.indexOf("async function forfeit"));
  assert.match(ps, /input\.current\.held = i;/);
  assert.match(ps, /cd \?\? 0\) > 0\) setNope/);
  assert.match(ps, /queue\(\{ dir: 0, skill: i \}\);/, "대기 중에 눌러도 줄에는 넣는다(6틱 안에 풀리면 나간다)");
  assert.match(BATTLE, /input\.current\.held = null;\s*setPausedView/, "앱을 내리면 누름도 놓는다");
  for (const k of ["adv-rt-nope0", "adv-rt-nope1", "adv-rt-now"]) {
    const i = css.indexOf(`@keyframes ${k} {`);
    assert.ok(i > 0, k);
    assert.doesNotMatch(css.slice(i, css.indexOf("}\n", i)), /rotate\s*\(/, k);
  }
});

test("공 '지금!' — 캔버스 고리와 같은 ringAim · 같은 문턱, 확률도 그 고리 값으로", () => {
  let now = 0;
  for (let t = 0; t < 40; t++) if (ringNow(ringAim(t))) now++;
  assert.ok(now >= 8 && now <= 12, `한 바퀴 40틱 중 ${now}틱`);
  assert.equal(RING_NOW, 0.75);
  assert.match(BATTLE, /strokeStyle = aim > 0\.75 \?/, "캔버스 고리가 금색이 되는 문턱과 같다");
  assert.match(BATTLE, /aim: ringAim\(a\.tick\),/);
  assert.match(BATTLE, /catchChance\(activeOf\(a\.b, 1\), ball, hud\.aim\)/);
  assert.doesNotMatch(BATTLE, /catchChance\(activeOf\(a\.b, 1\), ball, 1\)/, "늘 가장 작은 고리 값이던 것");
  assert.match(BATTLE, /ringNow\(hud\.aim\) \? "지금!"/);
});

test("첫 필드 안내 — 한 번(저장소가 막혀도 안 터진다) · 안내 중엔 필드가 멈춘다", () => {
  assert.equal(FIELD_COACH_KEY, "ourdays:adv:fieldcoach:v1");
  assert.match(FIELD, /localStorage\.getItem\(FIELD_COACH_KEY\)/);
  assert.match(FIELD, /localStorage\.setItem\(FIELD_COACH_KEY, "1"\)/);
  assert.match(FIELD, /if \(document\.visibilityState === "visible" && !live\.current\.coach\) acc \+= dt;/, "안내 중엔 걸음 · 생물이 멈춘다(그림은 그린다)");
  const card = FIELD.slice(FIELD.indexOf('aria-label="필드 안내"'));
  for (const w of ["왼쪽 아래", "조사", "★", "!", "미니맵"]) assert.ok(card.includes(w), w);
});

test("아이폰 사파리 탭에서만 첫 전투에 '홈 화면에 추가' 안내 한 번", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  assert.equal(wantsA2hsTip({ ua: iphone, standalone: false, seen: false }), true);
  assert.equal(wantsA2hsTip({ ua: iphone, standalone: true, seen: false }), false, "홈 화면 앱");
  assert.equal(wantsA2hsTip({ ua: iphone, standalone: false, seen: true }), false, "이미 봤다");
  assert.equal(wantsA2hsTip({ ua: iphone, seen: false }), false, "standalone 을 모르는 브라우저(아이폰 크롬 등)");
  assert.equal(wantsA2hsTip({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5, standalone: false, seen: false }), true, "아이패드");
  assert.equal(wantsA2hsTip({ ua: "Mozilla/5.0 (Linux; Android 14)", standalone: false, seen: false }), false);
  assert.match(BATTLE, /wantsA2hsTip\(\{[^}]*standalone: nav\.standalone/);
  assert.match(BATTLE, /&& onceFlag\(A2HS_KEY\)/);
});

test("미니맵 걷기 — 모든 지역에서 시작점 · 샘 · 관문에서 관문 · 샘 · 상자 · 트레이너까지 길을 따라 닿는다(바위는 비켜 걷는다)", () => {
  for (const r of REGIONS) {
    const s = newField(r, 7);
    const m = s.map;
    const marks = [m.gate, m.spring, ...m.chests, ...m.trainers];
    for (const to of marks) for (const from of [m.start, m.spring, m.gate]) {
      s.x = s.px = from.x;
      s.y = s.py = from.y;
      const w = planWalk(m.path, { x: s.x, y: s.y }, to);
      let n = 0;
      for (; n < 2000; n++) {
        const d = stepWalk(w, s);
        if (d == null) break;
        stepField(s, r, d, false);
      }
      assert.ok(n < 2000, `${r.key} 끝나지 않는다`);
      assert.ok(Math.hypot(s.x - to.x, s.y - to.y) <= REACH, `${r.key} (${Math.round(to.x)},${Math.round(to.y)}) 에 못 닿았다`);
    }
  }
});

test("미니맵 걷기 — 막히면 끝내 멈추고, 막대를 건드리면 바로 끝 · 누른 자리에 가장 가까운 표시", () => {
  const w = planWalk([], { x: 0, y: 0 }, { x: 500, y: 0 });
  let n = 0;
  while (stepWalk(w, { x: 0, y: 0 }) != null && n < 1000) n++;
  assert.ok(n < 400, `제자리에 갇히면 ${n}틱 뒤 멈춘다`);
  assert.deepEqual(pickMarker([{ x: 0, y: 0 }, { x: 100, y: 0 }], { x: 80, y: 5 }, 50), { x: 100, y: 0 });
  assert.equal(pickMarker([{ x: 0, y: 0 }], { x: 300, y: 0 }, 50), null, "멀면 아무것도");
  assert.match(FIELD, /const auto = dir \? null : stepWalk\(walk\.current, state\);/, "막대 · 화살표가 먼저");
  assert.match(FIELD, /wipe\.current = \{ t0: performance\.now\(\), m: met \};\s*walk\.current = null;/, "만나면 멈춘다");
  assert.match(FIELD, /className="adv-field-map"/);
});
