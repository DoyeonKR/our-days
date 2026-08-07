/* 보글보글 전용 도트 회귀 잠금.
 *
 * [사용자 리포트 2026-08-07 "더 캐릭터있게 만들어줘 너무 선명하지않아"]
 * 그 지적의 원인은 둘이었고, 여기서 둘 다 잠근다:
 *   1) 큰 판(48×48)을 줄여 쓰니 표정이 사라졌다 → **전용 16×16 을 손으로 찍었다**
 *   2) 하늘색 배경 위에 놓아 대비가 죽었다 → **검정 배경**(BubbleStage). 그래서
 *      여기서는 색이 검정 위에서 실제로 보이는지(휘도)를 잰다.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pixelAt, type Sprite } from "./pixel.ts";
import {
  ALL_BUBBLE_SPRITES,
  BUBBLE_MON_KINDS,
  angryPal,
  bubbleMonster,
  bubbleSkin,
  fruitSprite,
  heroSprites,
  itemSprite,
  letterSprite,
  skelSprite,
  specialIcon,
} from "./pixelbubble.ts";
import { MON_KINDS } from "./bubble.ts";

const ink = (s: Sprite): number => {
  let n = 0;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (pixelAt(s, x, y)) n++;
  return n;
};
const colorsOf = (s: Sprite): Set<string> => {
  const out = new Set<string>();
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = pixelAt(s, x, y);
      if (c) out.add(c.toLowerCase());
    }
  return out;
};
/** 상대 휘도(0~1). 검정 배경 위에서 보이는지를 재는 데 쓴다. */
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};

test("모든 스프라이트가 규격을 통과한다(행 길이·팔레트)", () => {
  // mk() 가 validateSprite 로 즉시 throw 하므로, 만들어지기만 하면 규격은 맞다.
  // 손으로 찍은 도트에서 가장 흔한 사고가 '한 칸 모자란 줄'이고 눈으로는 못 찾는다.
  const all = ALL_BUBBLE_SPRITES();
  assert.ok(Object.keys(all).length >= 25, "스프라이트가 너무 적다");
  for (const [name, s] of Object.entries(all)) {
    assert.equal(s.rows.length, s.h, `${name}: 행 수`);
    for (const r of s.rows) assert.equal(r.length, s.w, `${name}: 열 수`);
  }
});

test("주인공은 3프레임이고 서로 다르다", () => {
  const f = heroSprites("fox");
  assert.equal(f.length, 3, "서기·걷기·점프(발사) 셋이 필요하다");
  assert.notDeepEqual(f[0].rows, f[1].rows, "걷기가 서기와 같으면 걷는 걸로 안 보인다");
  assert.notDeepEqual(f[0].rows, f[2].rows, "발사 프레임이 같으면 쏘는 게 안 보인다");
});

test("주인공에게 얼굴이 있다 — 눈·눈동자·입", () => {
  /* 1차판이 "통통한 새"로 읽힌 건 입이 없고 눈이 얼굴 무늬처럼 퍼져 있었기 때문이다.
     캐릭터로 읽히려면 눈흰자·눈동자·입이 **각각 셀 수 있을 만큼** 있어야 한다. */
  for (const form of ["fox", "cat", "bear", "panda", "owl", "wolf", "egg"]) {
    const s = heroSprites(form)[0];
    const count = (key: string) =>
      s.rows.reduce((n, r) => n + [...r].filter((c) => c === key).length, 0);
    assert.ok(count("p") >= 4, `${form}: 눈동자가 ${count("p")}칸 — 눈이 안 보인다`);
    assert.ok(count("W") >= 20, `${form}: 흰색(눈흰자+배)이 너무 적다`);
    assert.ok(count("m") >= 3, `${form}: 입이 ${count("m")}칸 — 입이 없으면 표정이 없다`);
    assert.ok(count("a") >= 6, `${form}: 등 돌기가 ${count("a")}칸 — 용으로 안 보인다`);
  }
});

test("주인공 색은 종마다 다르다(우리 히어로라는 게 남아야 한다)", () => {
  const seen = new Map<string, string>();
  for (const form of ["fox", "bear", "panda", "owl", "wolf"]) {
    const key = [...colorsOf(heroSprites(form)[0])].sort().join(",");
    const dup = seen.get(key);
    assert.equal(dup, undefined, `${form} 이(가) ${dup} 와(과) 색이 같다`);
    seen.set(key, form);
  }
});

test("몬스터 종류가 엔진과 일치한다", () => {
  for (const k of MON_KINDS)
    assert.ok(BUBBLE_MON_KINDS.includes(k), `엔진이 쓰는 ${k} 의 그림이 없다`);
});

test("몬스터는 실루엣이 서로 다르다(색만 다른 같은 몸이면 안 된다)", () => {
  const shapes = new Map<string, string>();
  for (const k of BUBBLE_MON_KINDS) {
    const s = bubbleMonster(k);
    // 색을 지운 실루엣만 비교한다 — 색은 달라도 몸이 같으면 결국 같은 몬스터다
    const sil = s.rows.map((r) => [...r].map((c) => (c === "." ? "." : "#")).join("")).join("|");
    const dup = shapes.get(sil);
    assert.equal(dup, undefined, `${k} 의 실루엣이 ${dup} 와(과) 같다`);
    shapes.set(sil, k);
    assert.ok(ink(s) >= 60, `${k}: 잉크 ${ink(s)}칸 — 너무 비어 있다`);
  }
});

test("화난 몬스터는 분홍으로 변한다(원작 규칙)", () => {
  /* 원작에서 적은 거품에서 풀려나면 **분홍이 되고 빨라진다**. 1차판은 머리 위에
     빨간 점을 찍었는데 그건 원작도 아니고 작아서 잘 보이지도 않았다. */
  for (const k of BUBBLE_MON_KINDS) {
    const base = bubbleMonster(k);
    const mad = angryPal(base.pal);
    assert.notDeepEqual(mad, base.pal, `${k}: 화나도 색이 그대로다`);
    // 분홍 = 빨강이 파랑보다 확실히 크다
    const n = parseInt(mad.B.slice(1), 16);
    const [r, , b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    assert.ok(r > b + 40, `${k}: 화난 색 ${mad.B} 가 분홍으로 안 보인다`);
  }
});

test("모든 색이 검정 배경 위에서 보인다", () => {
  /* 배경이 검정이라 **어두운 색은 그냥 사라진다.** 외곽선(o)은 어두워야 하니 빼고,
     나머지 색은 최소 휘도를 넘어야 한다. 등 돌기를 어두운 톤으로 뒀다가
     아예 안 보였던 적이 있어서 이 테스트가 있다. */
  const all = ALL_BUBBLE_SPRITES();
  for (const [name, s] of Object.entries(all)) {
    for (const [key, hex] of Object.entries(s.pal)) {
      if (key === "o" || key === "p") continue; // 외곽선·눈동자는 어두운 게 정상
      if (!s.rows.some((r) => r.includes(key))) continue; // 안 쓰는 색은 넘어간다
      assert.ok(
        lum(hex) > 0.045,
        `${name}: 색 '${key}'(${hex}) 이(가) 검정 배경에 묻힌다(휘도 ${lum(hex).toFixed(3)})`,
      );
    }
  }
});

test("열매는 값에 따라 달라진다", () => {
  const low = fruitSprite(6);
  const high = fruitSprite(50);
  assert.notDeepEqual(low.rows, high.rows, "값이 달라도 같은 열매면 연쇄로 터뜨릴 맛이 없다");
  const seen = new Set<string>();
  for (const v of [6, 14, 20, 30, 50]) seen.add(fruitSprite(v).rows.join("|"));
  assert.equal(seen.size, 5, "열매 5종이 서로 달라야 한다");
});

test("스프라이트는 캐시된다(매 프레임 다시 만들지 않는다)", () => {
  // 60fps 로 도는 화면에서 스프라이트를 매번 새로 만들면 GC 가 프레임을 먹는다
  assert.equal(heroSprites("fox"), heroSprites("fox"));
  assert.equal(bubbleMonster("zen"), bubbleMonster("zen"));
  assert.equal(fruitSprite(6), fruitSprite(6));
});

test("무기에 따라 거품 모양이 달라진다(사용자 요구)", () => {
  /* [사용자 요구 2026-08-07 "히어로는 무기에 따라 버블 모양이 색다르게 변할 것"]
     사거리·재장전은 숫자라 손에만 남는다. 눈에도 남아야 산 보람이 있다. */
  const none = bubbleSkin(null);
  const stick = bubbleSkin("stick");
  const wand = bubbleSkin("wand");
  const melon = bubbleSkin("melonsword");

  assert.equal(none.key, stick.key, "맨손과 나무막대는 같은 기본 물방울이다");
  const keys = [none.key, wand.key, melon.key];
  assert.equal(new Set(keys).size, 3, `세 등급이 서로 달라야 한다: ${keys.join(",")}`);
  assert.ok(wand.points > 0, "별지팡이는 별 모양이어야 한다(원이면 무기가 안 보인다)");
  assert.equal(melon.points, 0, "수박은 둥글다");
  // 색도 달라야 한다 — 모양만 바뀌고 색이 같으면 어두운 화면에서 구분이 안 된다
  assert.equal(new Set([none.rim, wand.rim, melon.rim]).size, 3, "테두리 색이 겹친다");
  assert.equal(new Set([none.spark, wand.spark, melon.spark]).size, 3, "파편 색이 겹친다");
});

test("새 장치 스프라이트가 전부 규격을 통과한다", () => {
  for (const k of ["gem", "candy", "shoes", "lantern"]) {
    const sp = itemSprite(k);
    assert.equal(sp.w, 8);
    assert.ok(ink(sp) >= 12, `${k}: 너무 비어 있다`);
  }
  for (const k of ["lightning", "fire", "water"]) {
    assert.equal(specialIcon(k).w, 8);
  }
  // 특수 거품 아이콘 셋은 실루엣이 달라야 한다(작아서 색만으론 못 가린다)
  const sils = ["lightning", "fire", "water"].map((k) =>
    specialIcon(k).rows.map((r) => [...r].map((c) => (c === "." ? "." : "#")).join("")).join("|"),
  );
  assert.equal(new Set(sils).size, 3, "특수 거품 아이콘 실루엣이 겹친다");

  const sk = skelSprite();
  assert.equal(sk.w, 16);
  assert.ok(ink(sk) >= 60, "해골이 너무 비어 있다");

  // EXTEND 글자 — E 는 두 번 쓰이므로 같아야 하고, 나머지는 서로 달라야 한다
  assert.deepEqual(letterSprite(0).rows, letterSprite(3).rows, "E 두 개가 다르면 이상하다");
  const glyphs = new Set([0, 1, 2, 4, 5].map((i) => letterSprite(i).rows.join("|")));
  assert.equal(glyphs.size, 5, "E·X·T·N·D 가 서로 달라야 한다");
});
