// 펫 계보 lock. [2026-10-04 펫 개편 → 2026-10-17 돌봄 묶음 개편 — docs/PET-LINEAGES.md]
//
// 여기서 잠그는 건 값이 아니라 **성질**이다:
//  1. 표가 서로 어긋나지 않는다(묶음은 겹치지 않고 · 한 우물 5 + 투톱 10 + 삼총사 10 + 만능 5 = 30 · 폼 키 · 이름 · 이모지).
//  2. 분기는 **아기 → 성장기 한 곳**이고, 자주 해 준 돌봄 묶음(near)이 후보를 정한다 — 딱 맞는 계보가 먼저, 아니면 **못 만난 후보를 번갈아**.
//     고루 키우는 사람은 서른 생에 서른 계보를 한 번씩 만난다(못 만난 것 우선이 아닌 단순 돌림은 반복이 끼어 서른이 안 채워진다).
//  3. 계보 안은 막다른 길 없는 일직선이고 신화로 이어진다.
//  4. **진화마다 몸 구조가 바뀐다** — 크기만 달라지는 그림은 실루엣 비교에서 걸린다
//     [사용자: "진화해도 크기만 달라지지 모습이 바뀌지가 않아"].
//  5. 계보 폼 전부가 도트 계약(걷기 6프레임 · 앵커 · 장비 겹침 · 얼굴 창 · 정의된 글자)을 진다 — 기존 가드 테스트는
//     폼 목록을 직접 적어 두어 새 폼이 안 훑이므로, 여기서 **레지스트리를 순회**한다.
//  6. 그림이 아직 없는 계보는 임시 그림(PLACEHOLDER)으로 돌고, 진짜 그림과 겹치지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CARE_NAME,
  CARE_ORDER,
  FAMILY_NAME,
  LINEAGES,
  LINEAGE_CLASS,
  LINEAGE_FORM_KEYS,
  LINEAGE_OF_FORM,
  type Lineage,
  lineageLabel,
  lineagePool,
  pickLineage,
} from "./lineages.ts";
import {
  ACHIEVEMENTS,
  CARE_ACTS,
  GEARS,
  PET_FORMS,
  type CareAct,
  achievementViews,
  careStyle,
  careStyleInfo,
  createIsland,
  evolutionPreview,
  nextEvolution,
  seenLineagesOf,
} from "./island.ts";
import { petSprites, sleepSprite } from "./pixelart.ts";
import { LINEAGE_ART, PLACEHOLDER } from "./pixellineage.ts";
import { gearAnchors, pixelAt, validateSprite, type Sprite } from "./pixel.ts";
import { gearSprite } from "./pixelgear.ts";
import { GAIT_FRAMES } from "./pixelpet48.ts";

const T = Date.UTC(2026, 9, 4, 3, 0, 0);

/** 아기 → 성장기 대상. 돌림은 섬 시드 + 생 번호 — 여기선 seed 를 고정해 lives 만 돌린다. seen = 이미 만난 계보 키. */
const root = (
  care: Partial<Record<CareAct, number>> | undefined,
  lives: number,
  seed = 12345,
  seen: ReadonlySet<string> = new Set(),
): string => String(nextEvolution("hatchling", 50, 1, 0, 0, care, { seed, lives, seenLineages: seen }));

const FLAT = { play: 6, hug: 6, feed: 6, clean: 6, rest: 6 };
const sizeOf = (n: number) => LINEAGES.filter((l) => l.acts.length === n);

// ── 1. 표 ───────────────────────────────────────────────────────

test("★ 계보 표 — 돌봄 묶음이 겹치지 않고 한 우물 5 · 투톱 10 · 삼총사 10 · 만능 5 = 30", () => {
  assert.equal(LINEAGES.length, 30);
  assert.deepEqual([1, 2, 3, 4].map((n) => sizeOf(n).length), [5, 10, 10, 5]);
  assert.deepEqual([...CARE_ORDER], [...CARE_ACTS], "묶음 정렬 순서가 엔진의 동점 순서와 같아야 한다");
  const sets = new Set<string>();
  for (const l of LINEAGES) {
    assert.ok(l.acts.length >= 1 && l.acts.length <= 4, `${l.key}: 묶음 크기`);
    assert.deepEqual([...l.acts], CARE_ORDER.filter((a) => l.acts.includes(a)), `${l.key}: 묶음이 CARE_ORDER 순서가 아니다`);
    const id = l.acts.join("+");
    assert.ok(!sets.has(id), `${l.key}: 묶음 ${id} 가 겹친다`);
    sets.add(id);
  }
  // 표 순서 = 크기 → 사전순(돌림 번호가 이 순서를 따라 돈다 — 바꾸면 '다음 생 미리보기'가 달라진다)
  const idx = (l: Lineage) => [l.acts.length, ...l.acts.map((a) => CARE_ORDER.indexOf(a))];
  for (let i = 1; i < LINEAGES.length; i++) {
    const a = idx(LINEAGES[i - 1]), b = idx(LINEAGES[i]);
    let cmp = 0;
    for (let j = 0; j < Math.max(a.length, b.length) && cmp === 0; j++) cmp = (a[j] ?? -1) - (b[j] ?? -1);
    assert.ok(cmp < 0, `${LINEAGES[i - 1].key} → ${LINEAGES[i].key}: 표 순서가 크기·사전순이 아니다`);
  }
  // 만능은 '한 가지만 뺀' 다섯이 전부다
  assert.deepEqual(
    sizeOf(4).map((l) => CARE_ORDER.find((a) => !l.acts.includes(a))).sort(),
    [...CARE_ORDER].sort(),
  );
  for (const act of CARE_ACTS) assert.ok(FAMILY_NAME[act] && CARE_NAME[act], `${act} 이름`);
  for (const n of [1, 2, 3, 4] as const) assert.ok(LINEAGE_CLASS[n].name && LINEAGE_CLASS[n].blurb);
  assert.equal(lineageLabel(LINEAGES[0]), "볕");
  assert.equal(lineageLabel(sizeOf(4)[0]), "그늘 뺀 만능");
});

test("★ 계보 표 — 키가 유일하고 계보마다 세 폼이 PET_FORMS 에 규칙대로 있다", () => {
  assert.equal(new Set(LINEAGES.map((l) => l.key)).size, LINEAGES.length, "계보 키가 겹친다");
  for (const l of LINEAGES) {
    assert.equal(l.forms.length, 3);
    l.forms.forEach((f, i) => {
      assert.equal(f.key, `${l.key}_${i + 2}`, "폼 키 규칙");
      const pf = PET_FORMS[f.key];
      assert.ok(pf, `${f.key} 가 PET_FORMS 에 없다`);
      assert.equal(pf.stage, 2 + i);
      assert.equal(pf.lineage, l.key);
      assert.ok(!pf.legacy, "계보 폼은 legacy 가 아니다");
    });
  }
});

test("★ 이름·이모지가 폼 전체에서 유일하다 — 도감·박물관에서 같은 폼으로 읽히면 안 된다", () => {
  const forms = Object.values(PET_FORMS);
  for (const field of ["name", "emoji"] as const) {
    const seen = new Map<string, string>();
    for (const f of forms) {
      const hit = seen.get(f[field]);
      assert.equal(hit, undefined, `${field} '${f[field]}' 가 ${hit} 와 ${f.key} 에서 겹친다`);
      seen.set(f[field], f.key);
    }
  }
});

test("레지스트리 = PET_FORMS 의 계보 폼 전부 — 새 폼이 가드를 피해 가지 못한다", () => {
  const fromForms = Object.values(PET_FORMS).filter((f) => f.lineage).map((f) => f.key).sort();
  assert.deepEqual([...LINEAGE_FORM_KEYS].sort(), fromForms);
  assert.equal(LINEAGE_FORM_KEYS.length, LINEAGES.length * 3);
  for (const k of LINEAGE_FORM_KEYS) assert.ok(LINEAGE_OF_FORM[k], `${k} 역참조`);
});

test("★ 계보의 그림 — 진짜 그림이나 임시 그림 중 정확히 하나, 둘 다 없으면 펫이 알로 그려진다", () => {
  const egg = petSprites("egg")[0].rows.join("");
  for (const l of LINEAGES) {
    const own = l.key in LINEAGE_ART, ph = l.key in PLACEHOLDER;
    assert.ok(own !== ph, `${l.key}: 진짜 그림=${own} · 임시 그림=${ph} — 정확히 하나여야 한다`);
    if (ph) assert.ok(PLACEHOLDER[l.key].base in LINEAGE_ART, `${l.key}: 빌려 온 계보(${PLACEHOLDER[l.key].base})에 그림이 없다`);
    for (const f of l.forms) {
      assert.notEqual(petSprites(f.key)[0].rows.join(""), egg, `${f.key}: 도트가 없어 알로 떨어졌다`);
      assert.notEqual(sleepSprite(f.key).rows.join(""), sleepSprite("egg").rows.join(""), `${f.key}: 수면 도트가 알이다`);
    }
  }
  for (const k of Object.keys(PLACEHOLDER)) assert.ok(LINEAGES.some((l) => l.key === k), `임시 그림 ${k} 는 표에 없는 계보다`);
});

// ── 2. 진입 규칙 ────────────────────────────────────────────────

test("★ 후보 = 묶음이 자주 해 준 돌봄(near) 안에 들어가는 계보", () => {
  assert.deepEqual(lineagePool(["play"]).map((l) => l.key), ["ember"], "한 가지만 해 줬으면 한 우물 하나");
  assert.equal(lineagePool([...CARE_ORDER]).length, 30, "다 해 줬으면 서른이 다 후보");
  for (const near of [["play", "hug"], ["hug", "feed", "rest"], ["play", "feed", "clean", "rest"]] as CareAct[][]) {
    const pool = lineagePool(near);
    const want = LINEAGES.filter((l) => l.acts.every((a) => near.includes(a))).length;
    assert.equal(pool.length, want);
    assert.equal(pool.length, 2 ** near.length - 1, `${near.join("+")}: 비어 있지 않은 부분집합 수`);
  }
});

test("★ 손버릇이 한 가지로 뚜렷하면 그 한 우물 — 생이 바뀌어도 · 다 만나도 그대로다", () => {
  const clear: [Partial<Record<CareAct, number>>, string][] = [
    [{ play: 10, hug: 2, feed: 2, clean: 1, rest: 1 }, "ember_2"],
    [{ hug: 9, play: 3 }, "burr_2"],
    [{ feed: 8, play: 2 }, "leaf_2"],
    [{ clean: 7, hug: 2 }, "conch_2"],
    [{ rest: 6, play: 1 }, "bat_2"],
  ];
  const allSeen = new Set(LINEAGES.map((l) => l.key));
  for (const [care, want] of clear) for (let lives = 0; lives < 8; lives++) {
    assert.equal(root(care, lives), want);
    assert.equal(root(care, lives, 12345, allSeen), want, "다 만나도 후보가 하나뿐이라 그대로");
  }
});

test("★ 두 가지를 즐겨 하면 딱 맞는 투톱이 먼저 — 그다음 못 만난 후보를 번갈아, 다 만나면 딱 맞는 쪽", () => {
  const care = { play: 6, hug: 6, feed: 1 }; // near = 놀기·안기
  const seen = new Set<string>();
  const order: string[] = [];
  for (let lives = 0; lives < 6; lives++) {
    const k = root(care, lives, 4242, seen);
    order.push(k);
    seen.add(LINEAGE_OF_FORM[k].lineage.key);
  }
  assert.equal(order[0], "toy_2", "딱 맞는 계보가 먼저");
  assert.deepEqual([...order.slice(1, 3)].sort(), ["burr_2", "ember_2"], "그다음 못 만난 한 우물 둘");
  assert.deepEqual(order.slice(3), ["toy_2", "toy_2", "toy_2"], "다 만난 뒤엔 딱 맞는 계보");
});

test("★ 고루 키우는 사람은 서른 생에 서른 계보를 한 번씩 — 못 만난 것 우선이라 반복이 안 낀다", () => {
  for (const seed of [0, 1, 12345, 99999]) {
    const seen = new Set<string>();
    const order: string[] = [];
    for (let lives = 0; lives < 30; lives++) {
      const k = root(FLAT, lives, seed, seen);
      const lin = LINEAGE_OF_FORM[k].lineage.key;
      assert.ok(!seen.has(lin), `seed ${seed}: ${lives + 1}번째 생에 이미 만난 ${lin} 이 또 나왔다`);
      seen.add(lin);
      order.push(lin);
    }
    assert.equal(new Set(order).size, 30);
  }
  // 이미 몇 계보를 만난 뒤(한 우물 생 몇 번)에 고루 키우기 시작해도, 남은 계보를 먼저 다 만난다.
  const pre = LINEAGES.slice(0, 3).map((l) => l.key);
  const seen2 = new Set<string>(pre);
  for (let lives = 0; lives < 27; lives++) {
    const lin = LINEAGE_OF_FORM[root(FLAT, lives, 12345, seen2)].lineage.key;
    assert.ok(!seen2.has(lin), `${lives + 1}번째 생에 이미 만난 ${lin} 이 또 나왔다`);
    seen2.add(lin);
  }
  assert.equal(seen2.size, 30);
  // 대조(mutation): 못 만난 것을 안 보고 돌림 번호만 쓰면 이미 만난 계보가 끼어든다 — 이 테스트가 그걸 잡아야 한다.
  const pool = lineagePool([...CARE_ORDER]);
  const naive = new Set<string>();
  for (let lives = 0; lives < 27; lives++) naive.add(pool[(12345 + lives) % pool.length].key);
  assert.ok(pre.some((k) => naive.has(k)), "대조군이 이미 만난 계보를 안 건드리면 이 테스트가 못 잡는다");
  // 서른을 다 만난 뒤엔 되풀이(again)
  const all = new Set(LINEAGES.map((l) => l.key));
  const p = pickLineage([...CARE_ORDER], 7, (k) => all.has(k))!;
  assert.equal(p.why, "again");
  assert.equal(p.fresh, 0);
});

test("pickLineage — why · 후보 수 · 못 만난 수 · 음수 돌림 · 빈 후보", () => {
  const none = () => false;
  const e = pickLineage(["play", "hug"], 3, none)!;
  assert.deepEqual({ k: e.lineage.key, why: e.why, pool: e.pool, fresh: e.fresh }, { k: "toy", why: "exact", pool: 3, fresh: 3 });
  const f = pickLineage(["play", "hug"], 3, (k) => k === "toy")!;
  assert.equal(f.why, "fresh");
  assert.equal(f.fresh, 2);
  assert.ok(["ember", "burr"].includes(f.lineage.key));
  const a = pickLineage(["play", "hug", "feed", "clean", "rest"], -1, none)!;
  assert.ok(a.lineage, "음수 돌림도 안전");
  assert.equal(pickLineage(["play"], 0, none, new Set())?.lineage, undefined, "live 가 비면 후보가 없다(null)") ;
});

test("돌림은 결정적이다 — 같은 섬·같은 생이면 두 사람이 같은 답을 본다", () => {
  const a = root(FLAT, 3, 777);
  for (let i = 0; i < 5; i++) assert.equal(root(FLAT, 3, 777), a);
  // 섬 시드가 다르면 돌림 순서가 달라진다(커플마다 다른 계보부터)
  const starts = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) starts.add(root(FLAT, 0, seed));
  assert.ok(starts.size >= 3, "시드가 달라도 같은 계보부터 시작한다");
});

test("careStyle 은 careStyleInfo 의 act 와 언제나 같다 — 기존 호출부가 안 어긋난다", () => {
  const cases: Partial<Record<CareAct, number>>[] = [
    {}, { feed: 3, play: 1 }, { rest: 2, play: 2 }, { clean: 4, hug: 4 },
    { play: 6, hug: 6, feed: 6, clean: 6, rest: 6 }, { hug: 6, play: 4, feed: 3, clean: 2, rest: 1 },
  ];
  for (const c of cases) for (const rot of [-3, 0, 1, 2, 5, 12345]) {
    assert.equal(careStyle(c, rot), careStyleInfo(c, rot)?.act ?? null);
  }
  const info = careStyleInfo(FLAT, 7)!;
  assert.equal(info.k, 5);
  assert.equal(info.clear, false);
  assert.equal(info.cycle, 1, "⌊7 ÷ 5⌋");
  assert.deepEqual(info.near, [...CARE_ACTS], "near 는 CARE_ACTS 순서");
  assert.deepEqual(careStyleInfo({ play: 9, hug: 1 }, 0)!.near, ["play"]);
  assert.deepEqual(careStyleInfo({ hug: 6, play: 4, feed: 3, clean: 2, rest: 1 }, 0)!.near, ["play", "hug"], "자주 해 준 돌봄 = 1등의 5/8 이상");
});

test("★ 후보가 없으면(계보가 꺼졌으면) · 기록 없는 저장분은 옛 규칙으로 간다 — 무마이그레이션", () => {
  const care = { feed: 8, play: 2 };
  assert.equal(String(nextEvolution("hatchling", 50, 1, 0, 0, care, { seed: 1, lives: 0, liveLineages: new Set() })), "sprout");
  assert.equal(String(nextEvolution("hatchling", 50, 1, 0, 0, care, { seed: 1, lives: 0, liveLineages: new Set(["ember"]) })), "sprout", "숲 한 우물만 꺼졌다");
  assert.equal(String(nextEvolution("hatchling", 80, 1, 0)), "sunny", "기록 없음 → 예전 CQ 규칙");
});

test("seenLineagesOf — 도감 · 박물관 · 지금 펫의 계보를 만난 것으로 센다", () => {
  const s = createIsland("콩", null, T);
  assert.equal(seenLineagesOf(s).size, 0);
  s.catalog.push("ember_2", "ember_3");
  s.museum.push("burr_4");
  s.pet.form = "leaf_2";
  assert.deepEqual([...seenLineagesOf(s)].sort(), ["burr", "ember", "leaf"]);
});

// ── 3. 일직선 ───────────────────────────────────────────────────

test("★ 계보 안은 일직선 — 성장기 → 중간형 → 최종형 → 신화(막다른 길 없음, 조건에 안 흔들린다)", () => {
  for (const l of LINEAGES) {
    const [f2, f3, f4] = l.forms.map((f) => f.key);
    for (const [cq, bond, neglect] of [[10, 0, 9], [95, 9, 0], [50, 3, 1]] as const) {
      assert.equal(nextEvolution(f2, cq, bond, neglect), f3, `${f2} → ${f3} (cq ${cq})`);
      assert.equal(nextEvolution(f3, cq, bond, neglect), f4, `${f3} → ${f4} (cq ${cq})`);
    }
    const up = nextEvolution(f4, 95, 9, 0, 1);
    assert.ok(up && PET_FORMS[up].stage === 5, `${f4} 에서 신화형으로 못 간다`);
  }
});

test("★ 어떤 손버릇이든 성장기는 표 안의 계보 폼이다(도트 없는 폼으로 안 간다)", () => {
  const archetypes: Partial<Record<CareAct, number>>[] = [
    { play: 10, hug: 2 }, { hug: 9 }, { feed: 8 }, { clean: 7 }, { rest: 6 }, FLAT,
    { hug: 6, play: 4, feed: 3, clean: 2, rest: 1 }, { play: 5, hug: 5 }, { feed: 5, clean: 5, rest: 5 },
  ];
  for (const care of archetypes) for (let lives = 0; lives < 12; lives++) for (const seed of [0, 1, 99]) {
    const k = root(care, lives, seed);
    const hit = LINEAGE_OF_FORM[k];
    assert.ok(hit && hit.stage === 2, `${k}: 성장기 계보 폼이 아니다`);
  }
});

// ── 4. 몸 구조가 바뀐다 ──────────────────────────────────────────

/** 몸통(0~43행) 실루엣을 바운딩박스 기준 N×N 으로 정규화한 마스크. 같은 모양을 키우기만 하면 두 마스크는 같다. */
function normMask(form: string, N = 32): number[] {
  const s = petSprites(form)[0];
  const ink = (x: number, y: number) => (s.rows[y]?.[x] ?? ".") !== ".";
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < 44; y++) for (let x = 0; x < 48; x++) if (ink(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const m: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) m.push(ink(x0 + Math.floor(((i + 0.5) * w) / N), y0 + Math.floor(((j + 0.5) * h) / N)) ? 1 : 0);
  return m;
}
const shapeDiff = (a: number[], b: number[]): number => {
  let d = 0, u = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] || b[i]) u++; if (a[i] !== b[i]) d++; }
  return d / u;
};

test("★ 진화하면 **모습이 바뀐다** — 크기만 달라지는 그림은 안 된다", () => {
  // 크기만 달라진 그림(같은 모양의 확대)은 정규화 마스크가 거의 같다(≈ 0). 실측: 최소 0.16, 보통 0.25~0.40.
  const self = normMask("ember_3");
  assert.equal(shapeDiff(self, self), 0, "대조군: 같은 그림");
  for (const l of LINEAGES) {
    const [a, b, c] = l.forms.map((f) => normMask(f.key));
    assert.ok(shapeDiff(a, b) >= 0.12, `${l.key}: 성장기→중간형 실루엣 차이 ${shapeDiff(a, b).toFixed(2)} — 크기만 변했다`);
    assert.ok(shapeDiff(b, c) >= 0.12, `${l.key}: 중간형→최종형 실루엣 차이 ${shapeDiff(b, c).toFixed(2)} — 크기만 변했다`);
    assert.ok(shapeDiff(a, c) >= 0.15, `${l.key}: 성장기→최종형 실루엣 차이 ${shapeDiff(a, c).toFixed(2)}`);
  }
});

test("진짜 그림이 있는 계보끼리는 서로 다른 몸이다 — 같은 단계끼리도 실루엣이 갈린다(임시 그림은 빌려 온 몸이라 제외)", () => {
  const own = LINEAGES.filter((l) => l.key in LINEAGE_ART);
  assert.ok(own.length >= 10);
  for (const n of [2, 3, 4]) {
    const masks = own.map((l) => ({ k: l.key, m: normMask(l.forms[n - 2].key) }));
    for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) {
      assert.ok(shapeDiff(masks[i].m, masks[j].m) >= 0.1, `${masks[i].k}·${masks[j].k} 의 ${n}단계 실루엣이 거의 같다`);
    }
  }
});

// ── 5. 도트 계약(계보 폼 전부) ──────────────────────────────────────

const FACE = { x: 6, y: 0, w: 36, h: 30 }; // PetPixel 의 얼굴 크롭 창과 짝
const overlap = (pet: Sprite, gear: Sprite, ox: number, oy: number): number => {
  let n = 0;
  for (let y = 0; y < gear.h; y++)
    for (let x = 0; x < gear.w; x++) {
      if (!pixelAt(gear, x, y)) continue;
      const px = ox + x, py = oy + y;
      if (px < 0 || px >= pet.w || py < 0 || py >= pet.h) continue;
      if (pixelAt(pet, px, py)) n++;
    }
  return n;
};

test("★ 계보 폼 전부 — 걷기 6프레임이 서로 다르고, 48×48 · 정의된 글자만 · 바닥에 붙는다", () => {
  for (const form of LINEAGE_FORM_KEYS) {
    const fr = petSprites(form);
    assert.equal(fr.length, GAIT_FRAMES, `${form}: 프레임 ${fr.length}`);
    fr.forEach((s, i) => {
      assert.deepEqual(validateSprite(s, `${form}#${i}`), [], `${form}#${i}: 정의 안 된 글자·행 길이`);
      assert.equal(s.w, 48);
      assert.equal(s.h, 48);
      assert.ok(/[^.]/.test(s.rows[47]), `${form}#${i}: 마지막 행이 비어 캐릭터가 뜬다`);
      assert.notDeepEqual(s.rows, fr[(i + 1) % fr.length].rows, `${form}: ${i}번과 다음 프레임이 동일`);
    });
  }
});

test("★ 계보 폼 전부 — 다리 사이 실루엣이 끊기지 않는다(엉덩이 선 44행)", () => {
  for (const form of LINEAGE_FORM_KEYS) {
    for (const [i, s] of petSprites(form).entries()) {
      const xs: number[] = [];
      for (let x = 0; x < s.w; x++) if (pixelAt(s, x, 44)) xs.push(x);
      assert.ok(xs.length, `${form}#${i}: 44행에 다리가 없다 — 43행이 비어 몸과 안 이어진다`);
      for (let x = xs[0]; x <= xs[xs.length - 1]; x++) assert.ok(pixelAt(s, x, 44), `${form}#${i}: 44행 x=${x} 구멍`);
    }
  }
});

test("★ 계보 폼 전부 — 얼굴 크롭 창(행 0~29)이 프레임 간 같고 안에 눈이 있다", () => {
  for (const form of LINEAGE_FORM_KEYS) {
    const fr = petSprites(form);
    const win = (i: number) => fr[i].rows.slice(FACE.y, FACE.y + FACE.h).map((r) => r.slice(FACE.x, FACE.x + FACE.w)).join("|");
    for (let i = 1; i < fr.length; i++) assert.equal(win(i), win(0), `${form}: ${i}번 프레임의 얼굴 구역이 0번과 다르다`);
    let pupils = 0;
    for (let y = 0; y < 30; y++) for (const ch of fr[0].rows[y]) if (ch === "e") pupils++;
    assert.ok(pupils >= 4, `${form}: 얼굴 창(행 0~29) 안 눈동자가 ${pupils}칸 — 작은 아이콘에서 눈이 잘린다`);
  }
});

test("★ 계보 폼 전부 — 장비 앵커가 프레임 간 흔들리지 않는다", () => {
  for (const form of LINEAGE_FORM_KEYS) {
    const fr = petSprites(form);
    const a0 = gearAnchors(fr[0]);
    assert.ok(a0.ok, `${form}: 앵커 산출 실패`);
    for (const [name, pt] of [["정수리", a0.head], ["손", a0.hand], ["등", a0.back]] as const) {
      assert.ok(pt.x >= 0 && pt.x < 48 && pt.y >= 0 && pt.y < 48, `${form} ${name} 범위 밖`);
    }
    assert.ok(a0.hand.y > a0.head.y, `${form}: 손이 머리보다 위에 있다`);
    for (let i = 1; i < fr.length; i++) {
      const a = gearAnchors(fr[i]);
      assert.deepEqual({ head: a.head, hand: a.hand, back: a.back }, { head: a0.head, hand: a0.hand, back: a0.back }, `${form}: ${i}번 프레임에서 앵커가 달라진다 — 모자·무기가 한 사이클에 한 번 튄다`);
    }
  }
});

test("★ 계보 폼 전부 — 모자는 머리에 얹히고 무기는 몸에 걸쳐 쥐어진다(겹침 ≥ 4칸)", () => {
  const hatPos = (a: ReturnType<typeof gearAnchors>, g: Sprite) => ({ x: a.head.x - Math.floor(g.w / 2), y: a.head.y - g.h });
  const weaponPos = (a: ReturnType<typeof gearAnchors>, g: Sprite) => ({ x: a.hand.x - Math.floor(g.w / 2), y: a.hand.y - Math.round(g.h * 0.75) });
  for (const form of LINEAGE_FORM_KEYS) {
    const pet = petSprites(form)[0];
    const a = gearAnchors(pet);
    for (const gear of GEARS) {
      const g = gearSprite(gear.key);
      if (!g) continue;
      if (gear.slot === "hat") {
        const { x, y } = hatPos(a, g);
        assert.ok(overlap(pet, g, x, y) >= 4, `${form} × ${gear.name}: 머리 겹침 ${overlap(pet, g, x, y)}칸 — 쓴 게 아니라 떠 있다`);
        assert.ok(y + g.h > 0, `${form} × ${gear.name}: 모자가 스프라이트 밖(y=${y})`);
      }
      if (gear.slot === "weapon") {
        const { x, y } = weaponPos(a, g);
        assert.ok(overlap(pet, g, x, y) >= 4, `${form} × ${gear.name}: 몸 겹침 ${overlap(pet, g, x, y)}칸 — 쥔 게 아니라 옆에 있다`);
      }
    }
  }
});

test("계보 폼 전부 — 수면 스프라이트도 정의된 글자만 쓰고 바닥에 붙는다", () => {
  for (const form of LINEAGE_FORM_KEYS) {
    const s = sleepSprite(form);
    assert.deepEqual(validateSprite(s, `${form}#sleep`), [], `${form}: 수면 정의 안 된 글자`);
    assert.ok(/[^.]/.test(s.rows[47]), `${form}: 수면 마지막 행이 비었다`);
  }
});

// ── 6. 미리 알림 · 도감 · 업적 ───────────────────────────────────

test("★ 아기 단계에서 계보를 미리 알려 준다 — 어느 계보인지·왜인지·후보·손버릇·세 폼", () => {
  const mk = (care: Partial<Record<CareAct, number>>, seenKeys: string[] = []) => {
    const s = createIsland("콩", null, T);
    s.pet.form = "hatchling";
    s.pet.care = care;
    for (const k of seenKeys) s.catalog.push(k);
    return evolutionPreview(s);
  };
  const clear = mk({ play: 10, hug: 2 });
  assert.equal(clear.target, "ember_2");
  assert.equal(clear.lineage?.key, "ember");
  assert.equal(clear.lineage?.why, "exact");
  assert.deepEqual(clear.lineage?.forms.map((f) => f.name), ["불똥이", "불도롱", "염룡"]);
  assert.deepEqual(clear.lineage?.style?.near, ["play"]);
  assert.equal(clear.lineage?.style?.counts.play, 10);
  assert.ok(clear.hint && clear.hint.includes("놀기") && clear.hint.includes("볕"), "무엇이 계보를 정하는지");
  const pair = mk({ play: 6, hug: 5 });
  assert.equal(pair.lineage?.key, "toy", "두 가지를 즐겨 하면 딱 맞는 투톱");
  assert.equal(pair.lineage?.why, "exact");
  assert.equal(pair.lineage?.label, "볕·포근");
  const flat = mk(FLAT);
  assert.equal(flat.lineage?.why, "fresh");
  assert.equal(flat.lineage?.style?.pool, 30);
  assert.equal(flat.lineage?.style?.fresh, 30);
  assert.ok(flat.hint && flat.hint.includes("못 만난"), "고루 하면 못 만난 계보에서 번갈아 나온다고 알려 준다");
  const met = mk(FLAT, LINEAGES.map((l) => l.forms[0].key));
  assert.equal(met.lineage?.why, "again");
  assert.ok(met.hint && met.hint.includes("다 만났어요"));
  // 미리보기는 엔진과 같은 답이다(어긋나면 안내가 거짓말이다)
  const s3 = createIsland("콩", null, T);
  s3.pet.form = "hatchling";
  s3.pet.care = { play: 6, hug: 6, feed: 3 };
  assert.equal(evolutionPreview(s3).target, root(s3.pet.care, s3.lives ?? s3.museum.length, s3.seed ?? 0, seenLineagesOf(s3)));
  // 이미 계보 안에 든 펫은 이유를 안 묻는다(분기가 끝났다)
  const s2 = createIsland("콩", null, T);
  s2.pet.form = "ember_2";
  const p2 = evolutionPreview(s2);
  assert.equal(p2.target, "ember_3");
  assert.equal(p2.lineage?.why, null);
  assert.equal(p2.lineage?.style, null);
});

test("★ 계보 최종형 업적이 있고, 옛 히어로 최종형 업적도 갈림길로 다시 닿아 보인다(fork.test)", () => {
  assert.ok(ACHIEVEMENTS.some((a) => a.key === "pet_ember_4"), "계보 최종형 업적");
  const s = createIsland("콩", null, T);
  const keys = achievementViews(s, T).map((v) => v.key);
  assert.ok(keys.includes("pet_ember_4"));
  assert.ok(keys.includes("pet_royal_cat"), "옛 최종형도 이제 닿는다 — 감추면 따야 하는 칸이 사라진다");
});

// ── 7. 소스 계약 ────────────────────────────────────────────────

test("★ 일러스트 모드도 원화 없는 폼을 알로 그리지 않는다 [소스 스캔]", () => {
  // petArt(form) 는 PET_ART[form] ?? Egg — 계보 폼(도트 전용)을 그대로 넘기면 일러스트 모드에서 **알**이 나온다.
  const raw = readFileSync(join(import.meta.dirname, "..", "components", "island", "PetIcon.tsx"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(/petArtOrNull|hasPetArt/.test(src), "PetIcon 이 원화 유무를 모른다");
  const pets = readFileSync(join(import.meta.dirname, "..", "components", "island", "art", "pets.tsx"), "utf8");
  assert.ok(/export function petArtOrNull/.test(pets), "pets.tsx 에 petArtOrNull 이 없다");
});

test("★ petArt(form) 을 직접 부르는 화면은 도트 전용 폼을 따로 가른다 — 안 그러면 일러스트 모드에서 알이 나온다 [소스 스캔]", () => {
  // 2026-10-17 실제로 새었다: 섬 펫 무대가 PetYard 에 form 을 안 넘겨서 일러스트 모드의 conch_4 가 **알**로 그려졌다.
  // petArt 를 직접 쓰는 파일은 isPixelOnlyForm 을 알거나, 폼을 넘겨 PetYard 가 가르게 해야 한다.
  const root = join(import.meta.dirname, "..", "components");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) files.push(p);
    }
  };
  walk(root);
  const offenders: string[] = [];
  let checked = 0;
  for (const p of files) {
    if (/art[\\/]pets\.tsx$/.test(p)) continue; // 레지스트리 본체
    const src = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    if (!/\bpetArt\(/.test(src)) continue;
    checked++;
    const knows = /isPixelOnlyForm/.test(src);
    // PetYard 를 쓰는 곳은 form 을 넘기면 안쪽에서 가른다(HomePet).
    const passesForm = /<PetYard[^>]*\bform=\{/.test(src);
    if (!knows && !passesForm) offenders.push(p);
  }
  assert.ok(checked >= 3, `petArt 를 부르는 화면을 못 찾았다(${checked}) — 스캔이 깨졌다`);
  assert.deepEqual(offenders, [], "도트 전용 폼을 거르지 않고 petArt 를 쓰는 화면이 있다");
});

test("★ island.ts 는 계보 표(lineages.ts)를 **값으로** 읽고 lineages.ts 는 island.ts 를 타입으로만 읽는다 — 순환 import 금지", () => {
  const lin = readFileSync(join(import.meta.dirname, "lineages.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const imports = [...lin.matchAll(/^import\s+(type\s+)?[^;]*from\s+"([^"]+)"/gm)];
  for (const [, isType, from] of imports) {
    if (/island/.test(from)) assert.ok(isType, "lineages.ts 가 island.ts 를 값으로 import 한다 — 순환이다");
  }
  assert.ok(/from "\.\/lineages\.ts"/.test(readFileSync(join(import.meta.dirname, "island.ts"), "utf8")), "island.ts 가 계보 표를 안 읽는다");
});
