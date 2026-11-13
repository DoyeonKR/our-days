/* 낚시 네 방식 그림 다듬기(2026-11-13) [사용자: "메인게임 루어/심해/뜰채/기본 리뷰하고 개선해 … 심해의 릴 돌리는 릴의 이미지가 너무 퀄리티가 낮아"]
 * 심해 다이얼 · 낚싯대 릴 크랭크 · 추 · 수심계 · 루어 · 뜰채 조준 · 들어올리기 · 막대들. 그리기는 가짜 캔버스로 돌려 NaN 이 없는지, 화면은 소스로 잠근다. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RODS, SPOTS } from "./fishing.ts";
import { FishFx, landingPoint, type FxCanvas } from "./fishingfx.ts";
import { appCss } from "./cssfiles.ts";

const root = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/** 주석을 지운 소스 — 설명문이 먼저 잡히지 않게(README §10.5) */
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** 그리기 호출의 숫자 인자가 전부 유한한지 본다 · 켠 섞기 모드도 모은다 */
function fakeCanvas() {
  const calls = { n: 0, bad: [] as string[] };
  const grad = { addColorStop() {} };
  // 상태 값은 진짜 캔버스처럼 기억한다(globalAlpha *= … 가 숫자로 계산되게). save/restore 는 흉내 내지 않는다 — 값이 유한한지만 본다
  const props = new Map<string, unknown>([["globalAlpha", 1], ["lineWidth", 1], ["lineDashOffset", 0]]);
  const ctx = new Proxy({}, {
    get(_t, name: string) {
      if (props.has(name)) return props.get(name);
      return (...args: unknown[]) => {
        calls.n += 1;
        for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) calls.bad.push(`${name}(${args.join(",")})`);
        return name.startsWith("create") ? grad : undefined;
      };
    },
    set(_t, name: string, value: unknown) {
      if (typeof value === "number" && !Number.isFinite(value)) calls.bad.push(`${String(name)}=${value}`);
      if (typeof value === "number") props.set(name, value);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const canvas: FxCanvas = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, calls };
}
const run = (fx: FishFx, ms: number) => { for (let t = 0; t < ms; t += 16) fx.frame(16); };

for (const reduced of [false, true]) {
  test(`네 방식을 끝까지 돌려도 잘못된 값이 없다 — 릴 크랭크 · 추 · 수심계 · 루어 · 조준 · 들어올리기${reduced ? " (움직임 줄이기)" : ""}`, () => {
    for (const spot of [SPOTS[0], SPOTS[SPOTS.length - 1]]) {
      const { canvas, calls } = fakeCanvas();
      const fx = new FishFx(canvas, null, reduced);
      fx.resize(375, 520, 3);
      fx.set({ spot: spot.key, rod: RODS[2].key, phase: "ready" });
      // 낚싯대 그림이 있을 때의 크랭크(찌 힘겨루기 · 루어)
      fx.useRodSprite(RODS[2].key, { src: {} as CanvasImageSource, w: 300, h: 560, reelX: -30, reelK: 0.3 });
      fx.set({ method: "float", phase: "wait" });
      fx.cast(landingPoint(0.6, 0.3), 1500, 0.5, 3, 0.7, 1);
      run(fx, 1000);
      fx.set({ phase: "fight", tension: 0.95, dist: 0.6, holding: true });
      run(fx, 600);
      fx.set({ holding: false, tension: 0.3 });
      run(fx, 300);
      fx.reset();
      // 루어
      fx.set({ method: "lure", phase: "ready" });
      run(fx, 100);
      fx.set({ phase: "lure", beat: 0.5 });
      fx.cast(landingPoint(1, 0.2), 1500, 0.4, 3, 1);
      run(fx, 900);
      fx.twitch("great");
      run(fx, 300);
      fx.strike();
      fx.set({ phase: "fight", rodX: 0.7, fishX: -0.6, tension: 0.5 });
      run(fx, 400);
      fx.reset();
      // 심해 — 멈춤(0) · 느림 · 빠름(줄 빛 점) · 다시 멈춤
      fx.set({ method: "deep", phase: "ready" });
      run(fx, 100);
      fx.set({ phase: "wait" });
      fx.cast(landingPoint(0.5, 0.3), 1200, 0.5, 5, 0.5);
      run(fx, 900);
      for (const spin of [0, 0.8, 2.4, 0]) {
        fx.set({ phase: "fight", dist: spin === 0 ? 1.1 : 0.5, tension: 0.4, spin });
        run(fx, 300);
      }
      fx.reset();
      // 뜰채 — 조준(건질 수 있는 물고기 위 · 아닌 곳 · 잘못된 값) → 내리치기 → 들어올리기(몸부림) → 끝
      fx.set({ method: "scoop", phase: "aim" });
      fx.setShoal([{ id: 0, x: 0.4, y: 0.6, h: 1, z: 0.9, reach: true, size: 0.5, grade: 6, junk: false }, { id: 1, x: 0.7, y: 0.7, h: 2, z: 0.2, reach: false, size: 0.3, grade: 1, junk: false }]);
      fx.aim({ x: 0.4, y: 0.6, r: 0.1 });
      run(fx, 100);
      fx.aim({ x: 0.7, y: 0.7, r: 0.1 });
      run(fx, 100);
      fx.aim({ x: Number.NaN, y: 0.5, r: 0.1 });
      run(fx, 50);
      fx.aim({ x: 0.4, y: 0.6, r: 0.1 });
      fx.plunge(0.4, 0.6, 0.1, 0.34);
      run(fx, 340);
      fx.netLand(true, 6);
      run(fx, 300);
      fx.set({ phase: "lift" });
      fx.liftStart(6);
      for (let i = 0; i < 12; i++) {
        fx.liftSet(i / 12, Math.sin(i) * 0.9, i % 3 === 0);
        run(fx, 80);
      }
      fx.liftEnd(true);
      run(fx, 700);
      assert.ok(calls.n > 1000, "실제로 그렸다");
      assert.deepEqual(calls.bad.slice(0, 3), [], `${spot.key}${reduced ? " reduced" : ""}`);
    }
  });
}

test("릴 크랭크 — 더하기 섞기(lighter) 흰 줄 대신 보통 섞기 원판 · 팔 · 손잡이, 그라디언트는 캐시", () => {
  const fx = strip(read("src/lib/fishingfx.ts"));
  const art = fx.slice(fx.indexOf("private drawRodArt("), fx.indexOf("private drawRod("));
  assert.ok(art.includes("this.drawCrank("), "그림 낚싯대 위에 크랭크");
  assert.doesNotMatch(art, /lighter/, "프로펠러 같던 더하기 섞기 줄");
  assert.match(art, /private drawCrank\([^)]*\)[\s\S]*this\.grad\(c, `crank:\$\{reel\}`/);
  assert.match(art, /R \* 1\.25/, "손잡이는 1.25R");
  assert.match(art, /3 \* u, 0, 6\.29/, "손잡이 r = 3u");
  assert.match(art, /2\.6 \* u/, "팔 2.6u");
});

test("추 · 줄 · 미끼 빛 — 1.6배 · 납 그라디언트 · 놋쇠 고리 · 줄 그라디언트 캐시 · 돌릴 때만 빛 점 · 밝은 심지", () => {
  const fx = strip(read("src/lib/fishingfx.ts"));
  const sk = fx.slice(fx.indexOf("private drawSinker("), fx.indexOf("private drawLine("));
  assert.match(sk, /s0 \* 1\.6/);
  assert.match(sk, /this\.grad\(c, "sinker"/);
  assert.match(sk, /#d4a843/);
  assert.match(sk, /this\.grad\(c, `sinkline:\$\{dq\}`/, "줄 그라디언트는 길이 단계마다 한 번");
  assert.doesNotMatch(sk, /const g = c\.createLinearGradient\(b\.x/, "프레임마다 새로 만들던 그라디언트");
  assert.match(sk, /v\.spin > 0\.05 && !this\.reduced/, "멈추면 · 움직임 줄이기면 빛 점 없음");
  assert.match(sk, /this\.grad\(c, "deepcore"/);
  assert.match(sk, /2\.5 \* s/);
});

test("수심계 — 굵은 막대 · 물고기 표시 · 0m · 12px 이상 · 바다눈은 동그라미", () => {
  const fx = strip(read("src/lib/fishingfx.ts"));
  const dp = fx.slice(fx.indexOf("private drawDeep("), fx.indexOf("private drawShoal("));
  assert.match(dp, /lineWidth = 8 \* u/);
  assert.match(dp, /this\.fishPath\(c, 14 \* u/);
  assert.match(dp, /"0m"/);
  assert.match(dp, /Math\.max\(12, Math\.round\(12 \* u\)\)/);
  assert.match(dp, /MICRO_FONT/);
  assert.doesNotMatch(dp, /fillRect\(fx, fy/, "네모 바다눈");
  const css = appCss();
  assert.match(fx, /MICRO_FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo"/);
  assert.ok(css.length > 0);
  const game = strip(read("src/components/FishingGame.tsx"));
  assert.match(game, /method !== "deep" && <div className="fish-dist"/, "심해는 위 수심 막대를 숨긴다(두 번 보이던 것)");
});

test("루어 — 등 · 배 그라디언트는 크기와 무관한 키 하나, 잠수판 · 세발 바늘, 사탕 줄무늬 없음", () => {
  const fx = strip(read("src/lib/fishingfx.ts"));
  const lb = fx.slice(fx.indexOf("private lureBody("), fx.indexOf("private drawBobber("));
  assert.match(lb, /this\.grad\(c, "lure:v2"/);
  assert.doesNotMatch(lb, /`lure:\$\{s/, "크기마다 다른 키(프레임마다 새 그라디언트)");
  assert.match(lb, /#0e7490/);
  assert.match(lb, /#f8fafc/);
  assert.doesNotMatch(lb, /#f59e0b/, "주황 사탕 띠");
  assert.match(lb, /for \(const k of \[-1, 0, 1\]\)/, "바늘 셋");
  assert.match(lb, /#cbd5e1/);
  assert.match(lb, /rgba\(186,230,253,\.45\)/, "반투명 잠수판");
});

test("심해 다이얼 — 바늘은 스풀 위, 그라디언트 id 는 useId, CSS filter 없음, 손가락마다 화면을 다시 그리지 않는다", () => {
  const dial = strip(read("src/components/DeepDial.tsx"));
  const game = strip(read("src/components/FishingGame.tsx"));
  assert.match(dial, /useId\(\)/);
  const rotG = dial.indexOf("<g ref={rot}>"), needle = dial.indexOf('className="fish-dial-needle"'), spool = dial.indexOf("url(#${g(\"spool\")})");
  assert.ok(spool > 0 && rotG > spool && needle > rotG, "바늘을 스풀 · 도는 묶음 다음에 그린다");
  assert.match(dial, /r="36" fill=\{`url\(#\$\{g\("spool"\)\}\)`\}/, "스풀 r=36 금속 그라디언트");
  assert.match(dial, /r="12" fill=\{`url\(#\$\{g\("knob"\)\}\)`\}/, "손잡이 r=12");
  assert.match(dial, /#fef08a/);
  assert.match(dial, /spin > 1\.5 &&/, "빨리 돌 때 잔상");
  assert.match(dial, /setAttribute\("transform"/, "각도는 SVG 속성으로 바로");
  assert.doesNotMatch(game, /setDial\(|\[dial, /, "dial state 로 손가락마다 다시 그리지 않는다");
  assert.match(game, /dialRef\.current = ang \+ Math\.PI \/ 2/, "첫 움직임에 손잡이가 손가락 밑으로");
  assert.match(game, /Math\.hypot\(dx, dy\) < 14/, "14px 데드존 그대로");
  assert.match(game, /const DIAL_Y = 0\.7;/);
  const css = appCss();
  const dialCss = css.split("\n").filter((l) => l.startsWith(".fish-dial") || l.includes(".fish-dial"));
  assert.ok(dialCss.some((l) => /^\.fish-dial \{[^}]*top: 70%; width: 52%/.test(l)), "52% · top 70%");
  for (const l of dialCss) assert.doesNotMatch(l, /filter|drop-shadow/, l.slice(0, 60));
  assert.doesNotMatch(css, /\.fish-dial-knob \{[^}]*fill:/, "공 그라디언트를 CSS fill 이 덮지 않게");
  assert.match(css, /\.fish-dial\.is-warn \.fish-dial-rim \{ animation: fish-dial-warn \.25s ease-in-out infinite alternate; \}/);
  assert.match(css, /\.fish-dial\.is-dive \.fish-dial-track \{ stroke: rgba\(225,29,46,\.6\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^\n]*\.fish-dial\.is-warn \.fish-dial-rim \{ animation: none; stroke: #fbbf24; \}[^\n]*\.fish-dial-ghost \{ display: none; \}/);
});

test("뜰채 — 누르는 동안 그물 크기 조준 원, 떼면 내리치기(취소는 안 친다) · 남은 기회는 뜰채 아이콘 · 들어올리기 그물 표시와 화살표", () => {
  const game = strip(read("src/components/FishingGame.tsx"));
  assert.match(game, /fx\?\.aim\(\{ x, y, r: netRadius\(fs\.net\) \}\)/);
  assert.match(game, /if \(!cancel\) netDown\(at\.x, at\.y\)/);
  assert.match(game, /onPointerCancel=\{\(e\) => fingerUp\(e\.pointerId, true\)\}/);
  assert.match(game, /<em>기회<\/em>/);
  assert.match(game, /<NetMark \/>/);
  assert.match(game, /fish-lift-arrow is-l \$\{liftS\.tilt > 0\.15 \? "is-on" : ""\}/, "오른쪽으로 기울면 왼쪽으로 끈다");
  const fx = strip(read("src/lib/fishingfx.ts"));
  assert.match(fx, /lerp\(1\.15, 1,/, "내리치는 동안 1.15r → 1r");
  assert.match(fx, /\(r \* this\.H\) \/ 1\.25/, "판정과 같은 타원(세로 1.25)");
  const net = fx.slice(fx.indexOf("private netPic("), fx.indexOf("private drawDrops("));
  assert.ok(net.indexOf("if (inner)") > net.indexOf("drawImage"), "그물 속 물고기는 그물 그림 위에");
});

test("루어 막대 — 물고기는 물고기 모양(내 루어 아이콘이 아니다) · 내 낚싯대는 화살표 알약 · 안전한 절반", () => {
  const game = strip(read("src/components/FishingGame.tsx"));
  const sway = game.slice(game.indexOf('className={`fish-sway ${swayOk'), game.indexOf('className={`fish-sway fish-lift'));
  assert.match(sway, /<FishMark \/>/);
  assert.doesNotMatch(sway, /MethodIcon k="lure"/);
  assert.match(sway, /fish-sway-safe/);
  assert.match(sway, /fish-lure-rod/);
  assert.doesNotMatch(sway, /[◀▶]/, "글자 화살표 대신 SVG");
  const css = appCss();
  assert.match(css, /\.fish-sway-safe \{[^}]*background: rgba\(74,222,128,\.18\)/);
});

test("막대 · 안내 — 거리 글자 테두리 · 22px, 장력 18px 부드러운 경계 · 쐐기, 큰 안내 15/24", () => {
  const css = appCss();
  assert.match(css, /\.fish-dist \{[^}]*height: 22px/);
  const em = css.split("\n").find((l) => l.startsWith(".fish-dist em {")) ?? "";
  assert.equal(em.match(/line-height/g)?.length, 1, "줄 높이를 한 번만");
  assert.match(em, /-webkit-text-stroke: 3px rgba\(2,16,28,\.8\); paint-order: stroke fill/);
  assert.match(css, /\.fish-tension span \{[^}]*width: 18px[^}]*calc\(38% - 1px\)/);
  assert.match(css, /\.fish-tension b::after \{[^}]*border-right: 10px solid #fff/);
  assert.match(css, /\.fish-hint\.is-loud \{[^}]*font-size: 15px; font-family: var\(--font-body\); line-height: 24px;[^}]*background: |\.fish-hint\.is-loud \{[^}]*background: #e11d2e; font-size: 15px/);
  assert.doesNotMatch(css, /\.fish-hint\.is-loud \{[^}]*17px/);
});

test("이모지 · 폰에서 무거운 효과 — 낚시 화면 · 주인 UI 에 👑 💤 없음, 캔버스에 shadowBlur · filter 없음", () => {
  for (const f of ["src/components/FishingGame.tsx", "src/components/DeepDial.tsx", "src/components/BossRaidGame.tsx", "src/components/FishingPanels.tsx"]) {
    assert.doesNotMatch(strip(read(f)), /[👑💤]/u, f);
  }
  const fx = strip(read("src/lib/fishingfx.ts"));
  assert.doesNotMatch(fx, /shadowBlur|\.filter\s*=/);
  assert.match(read("src/components/FishingIcons.tsx"), /export function CrownIcon/);
});
