/* 보글보글 엔진 회귀 잠금.
 *
 * 사용자 요구의 핵심이 **"스테이지 별로 난이도가 올라가야해"** 였다. 그건 느낌이 아니라
 * 측정 가능한 성질이다 — 그래서 여기서 숫자로 못 박는다. 밸런스를 만지다 실수로
 * 난이도가 평평해지거나 뒤집히면 이 파일이 먼저 운다.
 *
 * ⚠ 물리는 순수 함수라 **입력만 같으면 결과가 같다**. 그래서 "실제로 클리어 가능한가"
 *   같은 것도 테스트가 가능하다(아래 자동 플레이).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BUB_R,
  CLEAR_MS,
  EXTEND_LETTERS,
  HURRY_MS,
  ITEM1_MS,
  ITEM2_MS,
  SKEL_MS,
  SPECIAL_EVERY_MS,
  COLS,
  H,
  MON_H,
  MON_KINDS,
  MON_W,
  ROWS,
  START_LIVES,
  TILE,
  W,
  bubbleRange,
  captureMs,
  chaseChance,
  clearBonus,
  createStage,
  dropValue,
  emptyRecord,
  heroSpeed,
  isBossStage,
  jumperFrom,
  kindFor,
  layoutFor,
  mergeRecord,
  monsterCount,
  monsterSpeed,
  nextStage,
  reloadMs,
  shortestDx,
  solidAt,
  step,
  type BubbleState,
  type Input,
} from "./bubble.ts";

const NO: Input = { left: false, right: false, jump: false, fire: false };
const run = (s: BubbleState, input: Input, n: number, atk = 8, lv = 5): BubbleState => {
  let cur = s;
  for (let i = 0; i < n; i++) cur = step(cur, input, atk, lv).state;
  return cur;
};

// ── 난이도 곡선 ───────────────────────────────────────────────────────────

test("스테이지가 오르면 몬스터가 늘어난다(단조 증가)", () => {
  let prev = 0;
  for (let st = 1; st <= 40; st++) {
    const n = monsterCount(st);
    assert.ok(n >= prev, `스테이지 ${st}: ${prev} → ${n} 로 줄었다`);
    prev = n;
  }
  assert.equal(monsterCount(1), 2, "1스테이지는 2마리로 시작한다");
  assert.ok(monsterCount(20) > monsterCount(1), "20스테이지가 1스테이지보다 많아야 한다");
  assert.equal(monsterCount(99), 8, "상한이 있어야 화면이 안 터진다");
});

test("스테이지가 오르면 몬스터가 빨라진다(단조 증가·상한 있음)", () => {
  let prev = 0;
  for (let st = 1; st <= 60; st++) {
    const v = monsterSpeed(st);
    assert.ok(v >= prev, `스테이지 ${st}: 속도가 ${prev} → ${v} 로 줄었다`);
    prev = v;
  }
  assert.equal(monsterSpeed(1), 1);
  assert.ok(monsterSpeed(10) > monsterSpeed(1) * 1.3, "10스테이지쯤엔 체감될 만큼 빨라야 한다");
  assert.ok(prev <= 2.2, "속도 상한이 없으면 반응 자체가 불가능해진다");
});

test("스테이지가 오르면 가둬 둘 시간이 짧아진다(단조 감소·하한 있음)", () => {
  let prev = Infinity;
  for (let st = 1; st <= 60; st++) {
    const ms = captureMs(st);
    assert.ok(ms <= prev, `스테이지 ${st}: 가둠 시간이 ${prev} → ${ms} 로 늘었다`);
    prev = ms;
  }
  assert.ok(captureMs(1) >= 5000, "초반엔 여유가 있어야 조작을 배운다");
  assert.ok(prev >= 2000, "하한이 없으면 가두자마자 풀려 게임이 성립하지 않는다");
});

test("추격 확률은 초반 0 이고 이후 단조 증가한다", () => {
  assert.equal(chaseChance(1), 0, "1스테이지부터 쫓아오면 배울 틈이 없다");
  assert.equal(chaseChance(5), 0);
  let prev = -1;
  for (let st = 1; st <= 40; st++) {
    const c = chaseChance(st);
    assert.ok(c >= prev, `스테이지 ${st} 에서 추격 확률이 줄었다`);
    prev = c;
  }
  assert.ok(chaseChance(20) > 0.2, "후반엔 실제로 쫓아와야 한다");
  assert.ok(prev < 1, "확률이 1 이면 도망이 불가능해진다");
});

test("난이도 축 넷이 서로 다른 스테이지에서 움직인다", () => {
  /* 한 축만 올리면 금세 질린다. 20스테이지 구간에서 네 축이 **모두** 변해야 한다. */
  const axes = [
    ["몬스터 수", monsterCount(1) !== monsterCount(20)],
    ["몬스터 속도", monsterSpeed(1) !== monsterSpeed(20)],
    ["가둠 시간", captureMs(1) !== captureMs(20)],
    ["추격", chaseChance(1) !== chaseChance(20)],
  ] as const;
  for (const [name, moved] of axes) assert.ok(moved, `${name} 축이 20스테이지 동안 안 움직였다`);
  assert.ok(jumperFrom > 1, "점프 몬스터가 1스테이지부터 나오면 난이도 계단이 사라진다");
});

test("보상도 스테이지를 따라 오른다(어려워지기만 하면 할 이유가 없다)", () => {
  assert.ok(clearBonus(10) > clearBonus(1));
  assert.ok(dropValue(10, 1) > dropValue(1, 1));
  assert.ok(dropValue(5, 3) > dropValue(5, 1) * 2, "연쇄로 터뜨릴 이유가 있어야 한다");
});

test("10스테이지마다 보스", () => {
  assert.ok(isBossStage(10) && isBossStage(20));
  assert.ok(!isBossStage(9) && !isBossStage(11));
  const boss = createStage(10, 7);
  assert.ok(boss.mons.some((m) => m.tough > 1), "보스 판엔 한 방에 안 갇히는 놈이 있어야 한다");
  assert.ok(createStage(9, 7).mons.every((m) => m.tough === 1), "일반 판엔 없어야 한다");
});

// ── 배치 ──────────────────────────────────────────────────────────────────

test("배치는 규격이 맞고 바닥이 있다", () => {
  for (let st = 1; st <= 12; st++) {
    const rows = layoutFor(st);
    assert.equal(rows.length, ROWS, `스테이지 ${st} 행 수`);
    for (const r of rows) assert.equal(r.length, COLS, `스테이지 ${st} 열 수`);
    assert.ok(
      [...rows[ROWS - 1]].every((c) => c === "#"),
      `스테이지 ${st}: 맨 아래가 뚫려 있으면 히어로가 무한히 떨어진다`,
    );
  }
});

test("배치는 4스테이지마다 좌우가 뒤집혀 8종처럼 보인다", () => {
  assert.deepEqual(layoutFor(1), layoutFor(9), "8스테이지 주기");
  assert.notDeepEqual(layoutFor(1), layoutFor(5), "5스테이지는 1의 거울이라 달라야 한다");
  assert.deepEqual(
    layoutFor(5),
    layoutFor(1).map((r) => [...r].reverse().join("")),
  );
});

test("몬스터는 발판 위에만, 히어로 시작점에서 떨어져 생긴다", () => {
  for (let st = 1; st <= 16; st++) {
    const s = createStage(st, st * 13);
    assert.equal(s.mons.length, monsterCount(st), `스테이지 ${st} 마릿수`);
    const rows = layoutFor(st);
    for (const m of s.mons) {
      const footRow = Math.floor((m.y + MON_H / 2 + 1) / TILE);
      const col = Math.floor(m.x / TILE);
      assert.ok(solidAt(rows, col, footRow), `스테이지 ${st}: 몬스터가 허공에 있다`);
      const d = Math.hypot(m.x - 16, m.y - (H - 8 - 6.5));
      assert.ok(d >= 40, `스테이지 ${st}: 시작하자마자 닿을 거리에 몬스터가 있다`);
    }
  }
});

test("같은 시드면 같은 판이 나온다(제보 재현 가능)", () => {
  const a = createStage(7, 42);
  const b = createStage(7, 42);
  assert.deepEqual(a.mons, b.mons);
  assert.notDeepEqual(createStage(7, 42).mons, createStage(7, 43).mons);
});

// ── 무기 연동 ─────────────────────────────────────────────────────────────

test("무기가 좋을수록 거품이 멀리 가고 빨리 나간다", () => {
  assert.ok(bubbleRange(30) > bubbleRange(0), "사거리");
  assert.ok(reloadMs(30) < reloadMs(0), "재장전");
  // 상·하한 — 무기를 다 모아도 화면 전체를 덮거나 무한 연사가 되면 안 된다
  assert.ok(bubbleRange(999) <= W, "사거리가 화면을 넘으면 조준이 무의미해진다");
  assert.ok(reloadMs(999) >= 120, "연사 상한이 없으면 거품으로 화면이 덮인다");
  assert.ok(heroSpeed(1) === 1 && heroSpeed(50) > 1 && heroSpeed(999) <= 1.3);
});

test("무기 공격력이 실제 거품 사거리에 반영된다", () => {
  const fire: Input = { ...NO, fire: true };
  const weak = step(createStage(1, 5), fire, 0, 1).state.bubs[0];
  const strong = step(createStage(1, 5), fire, 30, 1).state.bubs[0];
  assert.ok(strong.dash > weak.dash, "좋은 무기를 껴도 거품이 똑같으면 살 이유가 없다");
});

// ── 물리 ──────────────────────────────────────────────────────────────────

test("히어로는 바닥에 서 있고 가만두면 안 움직인다", () => {
  const s = run(createStage(1, 1), NO, 30);
  assert.ok(s.hero.onGround, "바닥에 못 서면 계속 떨어진다");
  assert.equal(s.hero.vy, 0);
});

test("점프하면 올라갔다가 다시 내려온다", () => {
  const s0 = run(createStage(1, 1), NO, 10);
  const y0 = s0.hero.y;
  const up = run(s0, { ...NO, jump: true }, 12);
  assert.ok(up.hero.y < y0 - 8, "점프가 안 먹는다");
  const down = run(up, NO, 90);
  assert.ok(down.hero.onGround, "다시 착지해야 한다");
});

test("화면 좌우는 이어져 있다(구석에 몰리지 않는다)", () => {
  const s = run(createStage(1, 1), { ...NO, left: true }, 400);
  assert.ok(s.hero.x >= 0 && s.hero.x < W, `x=${s.hero.x} 가 무대를 벗어났다`);
  assert.equal(shortestDx(2, W - 2), 4, "끝과 끝은 4px 거리다");
});

test("떨어지면 위에서 나온다", () => {
  const s0 = createStage(1, 1);
  const falling = { ...s0, hero: { ...s0.hero, y: H - 2, vy: 4, onGround: false } };
  const s = run(falling, NO, 6);
  assert.ok(s.hero.y < H / 2, "아래로 빠지면 위에서 나와야 한다");
});

// ── 거품과 사냥 ───────────────────────────────────────────────────────────

test("거품은 앞으로 뻗다가 멈추고 위로 뜬다", () => {
  let s = step(createStage(1, 1), { ...NO, fire: true }, 8, 1).state;
  const x0 = s.bubs[0].x;
  s = run(s, NO, 20);
  assert.ok(shortestDx(s.bubs[0].x, x0) > 10, "앞으로 안 나간다");
  const yMid = s.bubs[0].y;
  s = run(s, NO, 60);
  assert.ok(s.bubs[0].y < yMid, "다 뻗은 뒤엔 위로 떠야 한다");
});

test("재장전 중에는 거품이 안 나간다", () => {
  const fire: Input = { ...NO, fire: true };
  let s = step(createStage(1, 1), fire, 0, 1).state;
  assert.equal(s.bubs.length, 1);
  s = step(s, fire, 0, 1).state;
  assert.equal(s.bubs.length, 1, "매 프레임 발사되면 화면이 거품으로 덮인다");
});

test("거품에 닿은 몬스터는 갇히고, 그 상태로는 히어로를 못 죽인다", () => {
  const s0 = createStage(1, 1);
  const m = s0.mons[0];
  // 몬스터 바로 옆에 거품을 놓고 한 프레임
  const s1: BubbleState = {
    ...s0,
    bubs: [{ id: 900, x: m.x, y: m.y, vx: 0, dash: 0, life: 9000, hold: null }],
  };
  const s2 = step(s1, NO, 8, 1).state;
  assert.equal(s2.mons[0].st, "bubbled", "닿았는데 안 갇혔다");
  assert.equal(s2.bubs[0].hold, m.id);
});

test("갇힌 몬스터는 시간이 다 되면 화가 나서 풀려난다", () => {
  const s0 = createStage(1, 1);
  const m = s0.mons[0];
  let s: BubbleState = {
    ...s0,
    bubs: [{ id: 900, x: m.x, y: m.y, vx: 0, dash: 0, life: 999_999, hold: null }],
  };
  s = step(s, NO, 8, 1).state;
  assert.equal(s.mons[0].st, "bubbled");
  s = run(s, NO, Math.ceil(captureMs(1) / (1000 / 60)) + 4);
  assert.equal(s.mons[0].st, "free", "영원히 갇혀 있으면 긴장이 사라진다");
  assert.ok(s.mons[0].angry, "풀려난 놈은 더 사나워야 한다");
});

test("히어로가 거품을 터뜨리면 몬스터가 죽고 열매가 떨어진다", () => {
  const s0 = createStage(1, 1);
  const m = s0.mons[0];
  // 먼저 멀리서 가둔다(히어로가 겹쳐 있으면 가두는 프레임에 바로 터져 중간을 못 본다)
  let s: BubbleState = {
    ...s0,
    hero: { ...s0.hero, x: (m.x + W / 2) % W, y: m.y, inv: 9999 },
    bubs: [{ id: 900, x: m.x, y: m.y, vx: 0, dash: 0, life: 9000, hold: null }],
  };
  s = step(s, NO, 8, 1).state;
  assert.equal(s.mons[0].st, "bubbled");
  // 이제 히어로를 거품 위로 옮기면 터진다
  s = { ...s, hero: { ...s.hero, x: s.bubs[0].x, y: s.bubs[0].y } };
  const r = step(s, NO, 8, 1);
  assert.equal(r.state.mons[0].st, "dead");
  assert.ok(r.fx.pops > 0);
  // 열매는 떨어지거나(멀리서 터뜨림) 그 자리에서 바로 먹힌다(붙어서 터뜨림) — 둘 다 보상이다
  assert.ok(
    r.state.drops.length > 0 || r.state.coins > s.coins,
    "잡았는데 아무것도 안 나오면 잡을 맛이 없다",
  );
  assert.ok(r.state.score > 0);
});

test("거품이 수명으로 사라져도 갇힌 몬스터는 반드시 풀려난다", () => {
  /* 실제로 났던 버그. 거품 수명이 가둠 시간보다 먼저 끝나면 몬스터가 "bubbled" 인 채로
     주인 거품 없이 남아, **죽지도 풀려나지도 않아 스테이지가 영영 안 깨졌다.**
     자동 플레이 테스트가 90초를 돌고도 못 깨서 잡혔다. */
  const s0 = createStage(1, 1);
  const m = s0.mons[0];
  let s: BubbleState = {
    ...s0,
    hero: { ...s0.hero, x: (m.x + W / 2) % W, inv: 9999 },
    bubs: [{ id: 900, x: m.x, y: m.y, vx: 0, dash: 0, life: 200, hold: null }],
  };
  s = step(s, NO, 8, 1).state;
  assert.equal(s.mons[0].st, "bubbled", "우선 갇혀야 한다");
  s = run(s, NO, 30); // 거품 수명(200ms)만 지나가게 — 가둠 시간(6초)은 아직 남았다
  assert.equal(s.bubs.length, 0, "거품은 사라졌어야 한다");
  assert.equal(s.mons[0].st, "free", "주인 없는 거품에 갇힌 채로 남으면 스테이지를 못 깬다");
});

test("거품이 무한정 쌓이지 않는다(천장 도배 방지)", () => {
  let s = createStage(1, 1);
  for (let i = 0; i < 1200; i++) s = step(s, { ...NO, fire: true }, 30, 1).state;
  assert.ok(s.bubs.length <= 14, `거품 ${s.bubs.length}개 — 화면이 안 보이고 프레임도 떨어진다`);
});

test("모두 잡으면 클리어되고 보너스가 붙는다", () => {
  const s0 = createStage(3, 5);
  const dead = { ...s0, mons: s0.mons.map((m) => ({ ...m, st: "dead" as const })) };
  const r = step(dead, NO, 8, 1);
  assert.equal(r.state.phase, "clear");
  assert.ok(r.fx.cleared);
  assert.equal(r.state.coins, s0.coins + clearBonus(3));
  // 클리어 뒤엔 물리가 멈춘다(연출만)
  const after = run(r.state, { ...NO, right: true }, 30);
  assert.equal(after.hero.x, r.state.hero.x, "클리어 연출 중엔 조작이 먹으면 안 된다");
  assert.ok(CLEAR_MS > 0);
});

test("몬스터에 닿으면 목숨이 줄고, 다 잃으면 끝난다", () => {
  const s0 = createStage(1, 1);
  const m = s0.mons[0];
  const hit: BubbleState = { ...s0, hero: { ...s0.hero, x: m.x, y: m.y, inv: 0 } };
  const r = step(hit, NO, 8, 1);
  assert.equal(r.state.lives, START_LIVES - 1);
  assert.equal(r.state.phase, "dead");
  assert.ok(r.fx.hurt);

  const last: BubbleState = { ...hit, lives: 1 };
  let s = step(last, NO, 8, 1).state;
  assert.equal(s.lives, 0);
  s = run(s, NO, 70); // 연출이 끝나기를 기다린다
  assert.equal(s.phase, "over");
});

test("부활 직후엔 무적이라 즉사 반복이 안 생긴다", () => {
  const s = createStage(1, 1);
  assert.ok(s.hero.inv > 0, "시작하자마자 몬스터가 겹쳐 있으면 그대로 죽는다");
});

test("다음 스테이지로 넘어가면 목숨·점수·하트는 이어진다", () => {
  const s0 = { ...createStage(4, 9), lives: 2, score: 500, coins: 77 };
  const n = nextStage(s0, 9);
  assert.equal(n.stage, 5);
  assert.equal(n.lives, 2);
  assert.equal(n.score, 500);
  assert.equal(n.coins, 77);
  assert.equal(n.phase, "play");
});

// ── 실제로 할 수 있는 게임인가 ────────────────────────────────────────────

/** 아주 단순한 봇 — 같은 높이의 대상 쪽으로 걷고, 막히면 방향을 바꾸고, 주기적으로 뛰며 계속 쏜다.
 *  사람이 하면 이보다 훨씬 잘한다. 목적은 실력 재기가 아니라 **판이 깰 수 있는가**를 보는 것. */
function autoPlay(stage: number, seed: number): BubbleState {
  let s = createStage(stage, seed);
  let dir = 1;
  let stuck = 0;
  let lastX = s.hero.x;
  // ⚠ "phase === play" 로 돌면 한 번 죽는 순간 루프가 끝난다(부활 연출도 play 가 아니다).
  //    끝나는 건 클리어나 게임오버뿐이다.
  for (let i = 0; i < 60 * 120 && s.phase !== "clear" && s.phase !== "over"; i++) {
    const near = s.mons
      .filter((m) => m.st !== "dead" && Math.abs(m.y - s.hero.y) < 20)
      .sort((a, b) => Math.abs(shortestDx(a.x, s.hero.x)) - Math.abs(shortestDx(b.x, s.hero.x)))[0];
    if (near) dir = shortestDx(near.x, s.hero.x) > 0 ? 1 : -1;
    stuck = Math.abs(s.hero.x - lastX) < 0.2 ? stuck + 1 : 0;
    if (stuck > 30) {
      dir *= -1;
      stuck = 0;
    }
    lastX = s.hero.x;
    s = step(s, { left: dir < 0, right: dir > 0, jump: i % 34 < 3, fire: true }, 8, 5).state;
    if (s.phase === "dead") s = { ...s, lives: START_LIVES }; // 봇 실력은 논점이 아니다
  }
  return s;
}

test("자동 플레이로 대부분의 판을 실제로 깰 수 있다", () => {
  /* 규칙이 아무리 그럴듯해도 **닿을 수 없는 몬스터**가 있으면 게임이 아니다.
     시드 하나로 판정하면 우연에 휘둘리니 여러 판을 쓸어서 비율로 본다.

     이 테스트가 실제로 세 개의 문제를 잡았다:
       1. 거품 수명이 끝나면 갇힌 몬스터가 영영 갇힌 채로 남았다(클리어 불가).
       2. 가둔 거품이 천장까지 떠올라 아래층에서는 손도 못 댔다(가둬도 소용이 없었다).
       3. 바닥에서 첫 발판까지가 48px 인데 점프 최고 높이가 45px 이라 못 올라갔다. */
  for (const stage of [1, 3, 6]) {
    let ok = 0;
    for (let seed = 1; seed <= 12; seed++) if (autoPlay(stage, seed).phase === "clear") ok += 1;
    assert.ok(
      ok >= 10,
      `스테이지 ${stage}: 12판 중 ${ok}판만 깼다 — 닿을 수 없는 배치이거나 가둠/터뜨림이 깨졌다`,
    );
  }
});

test("바닥에서 한 번 뛰어 첫 발판에 올라설 수 있다", () => {
  /* 층은 3·7·11·15행 + 바닥 21행. 가장 먼 구간이 바닥 → 15행 = 6타일(48px)인데
     점프 최고 높이가 45px 이라 **사실상 못 올라갔다**. 아래층에 갇히면 판이 안 끝난다.
     높이를 숫자로 재는 대신 목적을 직접 잠근다 — 뛰어서 실제로 그 발판에 서는가. */
  const rows = layoutFor(1);
  // 15행에 발판이 있는 칸을 찾아 그 바로 아래 바닥에 선다
  const col = [...Array(COLS).keys()].find((c) => solidAt(rows, c, 14));
  assert.ok(col !== undefined, "1스테이지 14행에 발판이 없다");
  const s0 = createStage(1, 1);
  let s: BubbleState = {
    ...s0,
    hero: { ...s0.hero, x: col! * TILE + TILE / 2, y: H - TILE - 6.5, vy: 0, onGround: true },
  };
  s = step(s, { ...NO, jump: true }, 8, 1).state;
  let top = s.hero.y;
  for (let i = 0; i < 90; i++) {
    s = step(s, NO, 8, 1).state;
    top = Math.min(top, s.hero.y);
    if (s.hero.onGround && s.hero.y < H - TILE * 3) break;
  }
  assert.ok(s.hero.onGround, "90프레임 안에 어디에도 못 섰다");
  assert.ok(
    s.hero.y < H - TILE * 4,
    `한 번 뛰어도 바닥에 남는다(y=${s.hero.y.toFixed(1)}) — 위층 몬스터에 영영 못 닿는다`,
  );
});

test("몬스터는 발판 밖으로 걸어 나가지 않는다", () => {
  let s = createStage(2, 11);
  for (let i = 0; i < 600; i++) s = step(s, NO, 8, 5).state;
  const rows = layoutFor(2);
  const grounded = s.mons.filter((m) => m.st === "free" && m.onGround);
  assert.ok(grounded.length > 0, "표본이 없으면 판정이 무의미하다");
  for (const m of grounded) {
    const footRow = Math.floor((m.y + MON_H / 2 + 1) / 8);
    const col = Math.floor(m.x / 8);
    assert.ok(
      solidAt(rows, col, footRow) || solidAt(rows, (col + 1) % COLS, footRow) || solidAt(rows, (col - 1 + COLS) % COLS, footRow),
      "발판 위에 서 있어야 한다",
    );
  }
});

test("무대 밖으로 나가는 것은 아무것도 없다", () => {
  let s = createStage(6, 17);
  for (let i = 0; i < 900; i++) {
    s = step(s, { left: i % 90 < 30, right: i % 90 >= 60, jump: i % 23 === 0, fire: i % 11 === 0 }, 12, 8).state;
    for (const e of [s.hero, ...s.mons]) {
      assert.ok(e.x >= 0 && e.x < W, `x=${e.x} 이탈 (프레임 ${i})`);
      assert.ok(e.y > -20 && e.y < H + 20, `y=${e.y} 이탈 (프레임 ${i})`);
    }
    assert.ok(s.bubs.length < 40, "거품이 무한히 쌓이면 프레임이 죽는다");
  }
});

test("거품 반지름·몬스터 크기가 타일보다 작지 않다(닿는 느낌)", () => {
  assert.ok(BUB_R * 2 >= 8, "거품이 타일보다 작으면 조준이 불가능하다");
  assert.ok(MON_W <= 16 && MON_H <= 16, "히트박스가 스프라이트보다 크면 억울하게 죽는다");
});

// ── 종류/기록 ─────────────────────────────────────────────────────────────

test("스테이지가 오르면 몬스터 종류가 늘어난다", () => {
  const kinds = (st: number) => new Set(Array.from({ length: 8 }, (_, i) => kindFor(st, i)));
  assert.ok(kinds(15).size >= kinds(1).size, "후반에 종류가 줄면 단조로워진다");
  for (let st = 1; st <= 30; st++)
    for (let i = 0; i < 8; i++)
      assert.ok(MON_KINDS.includes(kindFor(st, i)), `스테이지 ${st}: 없는 몬스터 종류`);
});

test("기록은 줄어들지 않는다", () => {
  const r0 = emptyRecord();
  const r1 = mergeRecord(r0, { ...createStage(7, 1), score: 900 });
  assert.equal(r1.best, 7);
  assert.equal(r1.score, 900);
  const r2 = mergeRecord(r1, { ...createStage(2, 1), score: 10 });
  assert.equal(r2.best, 7, "낮은 기록으로 덮이면 안 된다");
  assert.equal(r2.score, 900);
  assert.ok(r2.clears >= r1.clears, "누적은 줄지 않는다");
});

// ── 원작 장치들 ───────────────────────────────────────────────────────────
/* 여기부터는 "보글보글인가"를 재는 테스트다. 가두고 터뜨리는 것만 있으면
   거품 게임이지 보글보글은 아니다 — 원작을 굴리는 건 시간 압박과 특수 거품이다. */

/** 지정 시간까지 아무것도 안 하고 흘려보낸다(시계에만 의존하는 장치를 재려고). */
const idle = (s: BubbleState, ms: number): BubbleState =>
  run(s, NO, Math.ceil(ms / (1000 / 60)));

test("특수 거품이 주기적으로 흘러들어온다", () => {
  const s = idle(createStage(1, 4), SPECIAL_EVERY_MS + 500);
  assert.ok(s.specials.length > 0, "특수 거품이 하나도 안 나온다");
  const kinds = new Set<string>();
  let cur = createStage(1, 4);
  for (let i = 0; i < 60 * 60; i++) {
    cur = step(cur, NO, 8, 1).state;
    for (const sp of cur.specials) kinds.add(sp.kind);
  }
  assert.equal(kinds.size, 3, `번개·불·물 셋이 다 나와야 한다(나온 것: ${[...kinds].join(",")})`);
});

test("특수 거품을 터뜨리면 효과가 나가고 몬스터가 죽는다", () => {
  /* ⚠ 1스테이지(2마리)로 재면 효과가 둘 다 잡아 **그 프레임에 클리어**되고,
     클리어가 남은 효과를 치워서 "효과가 안 나갔다"로 오판한다. 몬스터가 많은 판에서 잰다. */
  for (const kind of ["lightning", "fire", "water"] as const) {
    const s0 = createStage(9, 4);
    const m = s0.mons[0];
    // 히어로를 특수 거품 위에 올려 둔다
    let s: BubbleState = {
      ...s0,
      hero: { ...s0.hero, x: m.x, y: m.y - 2, inv: 9999 },
      specials: [{ id: 900, kind, x: m.x, y: m.y - 2, vx: 0, life: 9000 }],
    };
    const r = step(s, NO, 8, 1);
    assert.equal(r.fx.special, kind, `${kind}: 닿았는데 안 터졌다`);
    assert.equal(r.state.specials.length, 0, `${kind}: 터진 거품이 안 사라졌다`);
    assert.ok(r.state.blasts.length > 0, `${kind}: 효과가 안 나갔다`);
    // 효과가 몬스터를 실제로 잡는가
    s = r.state;
    for (let i = 0; i < 90 && s.mons[0].st !== "dead"; i++) s = step(s, NO, 8, 1).state;
    assert.equal(s.mons[0].st, "dead", `${kind}: 효과가 몬스터를 못 잡는다`);
  }
});

test("아이템이 7초·12초에 하나씩 뜬다", () => {
  let s = idle(createStage(1, 6), ITEM1_MS - 500);
  assert.equal(s.items.length, 0, "7초 전에 벌써 떴다");
  s = idle(s, 1200);
  assert.equal(s.itemsOut, 1, "점수 아이템이 안 떴다");
  assert.equal(s.items[0].kind, "gem", "첫 번째는 점수 아이템이다");
  s = idle(s, ITEM2_MS - ITEM1_MS + 400);
  assert.equal(s.itemsOut, 2, "특수 아이템이 안 떴다");
  assert.ok(ITEM1_MS < ITEM2_MS, "점수템이 특수템보다 먼저다");
});

test("사탕은 연사, 신발은 이동속도, 등불은 화면 정리", () => {
  const base = createStage(2, 6);
  const at = { x: base.hero.x, y: base.hero.y };
  const give = (kind: "candy" | "shoes" | "lantern") =>
    step({ ...base, items: [{ id: 900, kind, x: at.x, y: at.y, vy: 0, life: 9000 }] }, NO, 8, 1);

  const candy = give("candy");
  assert.equal(candy.fx.item, "candy");
  assert.ok(candy.state.boost.rapid > 0, "사탕을 먹어도 연사가 안 붙는다");

  const shoes = give("shoes");
  assert.ok(shoes.state.boost.speed > 0, "신발을 먹어도 안 빨라진다");

  const lantern = give("lantern");
  assert.ok(
    lantern.state.mons.every((m) => m.st === "dead"),
    "등불을 먹었는데 몬스터가 남아 있다",
  );
});

test("사탕을 먹으면 실제로 거품이 더 자주 나간다", () => {
  const fire: Input = { ...NO, fire: true };
  const count = (rapid: boolean) => {
    let s: BubbleState = { ...createStage(1, 6), boost: { rapid: rapid ? 9000 : 0, speed: 0 } };
    let fired = 0;
    for (let i = 0; i < 120; i++) {
      const before = s.bubs.length;
      s = step(s, fire, 8, 1).state;
      if (s.bubs.length > before) fired += 1;
    }
    return fired;
  };
  assert.ok(count(true) > count(false), "연사 강화가 실제 발사 횟수에 안 나타난다");
});

test("HURRY 뒤에 해골이 나오고, 가둘 수 없고, 벽을 통과해 쫓아온다", () => {
  let s = idle(createStage(1, 6), SKEL_MS + 600);
  assert.ok(s.skel.on, "해골이 안 나왔다");
  assert.ok(HURRY_MS < SKEL_MS, "경고가 해골보다 먼저 떠야 한다(예고 없는 죽음 금지)");

  // 해골은 몬스터 목록에 없다 = 거품에 안 갇히고 클리어 조건에도 안 걸린다
  assert.equal(s.mons.some((m) => (m.kind as string) === "skel"), false);

  // 히어로 쪽으로 가까워진다
  const d0 = Math.hypot(shortestDx(s.skel.x, s.hero.x), s.skel.y - s.hero.y);
  s = run({ ...s, hero: { ...s.hero, inv: 99_999 } }, NO, 120);
  const d1 = Math.hypot(shortestDx(s.skel.x, s.hero.x), s.skel.y - s.hero.y);
  assert.ok(d1 < d0, `해골이 안 쫓아온다(${d0.toFixed(1)} → ${d1.toFixed(1)})`);
});

test("해골에 닿으면 목숨이 줄고, 부활하면 멀리 밀려난다", () => {
  const s0 = idle(createStage(1, 6), SKEL_MS + 600);
  const hit: BubbleState = {
    ...s0,
    hero: { ...s0.hero, inv: 0 },
    skel: { on: true, x: s0.hero.x, y: s0.hero.y },
  };
  const r = step(hit, NO, 8, 1);
  assert.equal(r.state.lives, s0.lives - 1, "해골에 닿아도 안 죽는다");
  const revived = run(r.state, NO, 70);
  assert.ok(
    Math.abs(shortestDx(revived.skel.x, revived.hero.x)) > 30,
    "부활 자리에 해골이 그대로 있으면 무적이 끝나는 순간 또 죽는다",
  );
});

test("EXTEND — 여섯 글자를 다 모으면 목숨이 는다", () => {
  const s0 = createStage(1, 6);
  // 다섯 개는 이미 모았고 마지막 하나가 히어로 위에 있다
  const s: BubbleState = {
    ...s0,
    extend: [true, true, true, true, true, false],
    letters: [{ id: 900, idx: 5, x: s0.hero.x, y: s0.hero.y, vy: 0, life: 9000 }],
  };
  const r = step(s, NO, 8, 1);
  assert.equal(r.state.lives, s0.lives + 1, "다 모았는데 목숨이 안 는다");
  assert.ok(r.fx.extended);
  assert.deepEqual(r.state.extend, [false, false, false, false, false, false], "모으면 초기화된다");
  assert.equal(EXTEND_LETTERS.join(""), "EXTEND");
});

test("EXTEND 는 판이 넘어가도 유지되고, 강화·해골은 초기화된다", () => {
  const s: BubbleState = {
    ...createStage(3, 6),
    extend: [true, false, true, false, false, false],
    boost: { rapid: 5000, speed: 5000 },
    skel: { on: true, x: 10, y: 10 },
    stageMs: 40_000,
    itemsOut: 2,
  };
  const n = nextStage(s, 6);
  assert.deepEqual(n.extend, [true, false, true, false, false, false], "EXTEND 는 이어져야 한다");
  assert.deepEqual(n.boost, { rapid: 0, speed: 0 }, "강화가 이어지면 후반이 무한 강화가 된다");
  assert.equal(n.skel.on, false, "새 판이 시작하자마자 쫓기면 안 된다");
  assert.equal(n.stageMs, 0);
  assert.equal(n.itemsOut, 0);
});

test("몬스터를 잡다 보면 EXTEND 글자가 실제로 나온다", () => {
  // 확률이라 여러 판을 돌려 본다. 한 판도 안 나오면 통로가 막힌 것이다.
  let seen = false;
  for (let seed = 1; seed <= 8 && !seen; seed++) {
    let s = createStage(1, seed);
    let dir = 1;
    for (let i = 0; i < 60 * 60 && !seen; i++) {
      s = step(s, { left: dir < 0, right: dir > 0, jump: i % 34 < 3, fire: true }, 8, 5).state;
      if (i % 200 === 0) dir *= -1;
      if (s.letters.length > 0 || s.extend.some(Boolean)) seen = true;
      if (s.phase === "clear") s = nextStage(s, seed);
    }
  }
  assert.ok(seen, "8판을 돌려도 EXTEND 글자가 한 번도 안 나왔다");
});
