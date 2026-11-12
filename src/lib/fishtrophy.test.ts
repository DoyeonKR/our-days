// 어탁 · 대물 인증 카드(2026-11-12) — 기록 남기기 · 상한 · 모습마다 한 장 · 크기 기록으로 채우기 · 낚시 저장을 지나도 남기 · 카드 배치(겹침)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, type IslandState } from "./island.ts";
import { ALL_FORMS } from "./aquarium.ts";
import { buyBait, fishingOf, sellCatch, tryStore, type FishCatch } from "./fishing.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";
import {
  HUNG_MAX, PRINT_H, PRINT_W, TROPHY_MAX, addTrophy, boxInside, boxesOverlap, fishScale, fmtTrophyDay, hungOf, noteTrophy, printLayout, printLines,
  printSeed, sealChar, sizeRatio, toggleHung, trophiesOf, trophyView, type Trophy,
} from "./fishtrophy.ts";

const T0 = Date.UTC(2026, 10, 12, 3);
const TODAY = "2026-11-12";
const island = () => ({ ...createIsland("a", null, T0), coins: 100000 }) as IslandState;
const koi = (cm: number): FishCatch => ({ family: "koi", stage: 2, species: ALL_FORMS.find((f) => f.family === "koi" && f.stage === 2)!.species, grade: "희귀", difficulty: 3, cm });
const ctx = (who: string, day = TODAY) => ({ who, by: who === "a" ? "도연" : "지우", spot: "harbor", day });
const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("기록을 깬 판은 같은 저장에 어탁 한 장 — 낚시터 · 날짜 · 이름이 남는다", () => {
  const c = koi(70);
  const r = noteTrophy(sellCatch(island(), c, TODAY, { who: "a", couple: true }), c, ctx("a"));
  assert.ok(r.ok);
  if (!r.ok) return;
  const [t] = trophiesOf(r.state);
  assert.equal(t.key, c.species);
  assert.equal(t.cm, 70);
  assert.equal(t.spot, "harbor");
  assert.equal(t.day, TODAY);
  assert.equal(t.by, "도연");
  // 더 짧은 다음 한 마리는 크기 기록이 안 바뀌니 그대로
  const c2 = koi(60);
  const r2 = noteTrophy(sellCatch(r.state, c2, TODAY, { who: "a", couple: true }), c2, ctx("a", "2026-11-13"));
  assert.ok(r2.ok && trophiesOf(r2.state)[0].cm === 70 && trophiesOf(r2.state)[0].day === TODAY);
  // 더 긴 한 마리는 그 모습의 한 장을 갈아 끼운다(두 장이 되지 않는다)
  const c3 = koi(82.5);
  const r3 = noteTrophy(sellCatch(r.state, c3, TODAY, { who: "a", couple: true }), c3, ctx("a", "2026-11-14"));
  assert.ok(r3.ok);
  if (r3.ok) {
    assert.equal(trophiesOf(r3.state).length, 1);
    assert.equal(trophiesOf(r3.state)[0].cm, 82.5);
    assert.equal(r3.sizeNote, "mine", "엔진의 크기 소식은 그대로");
  }
});

test("모습마다 가장 긴 한 장 — 상대 기록보다 짧은 내 기록은 어탁이 아니다 · 주인 · 꽝 · 놓침 규칙", () => {
  let s = island();
  const r1 = noteTrophy(sellCatch(s, koi(90), TODAY, { who: "b", couple: true }), koi(90), ctx("b"));
  assert.ok(r1.ok);
  if (!r1.ok) return;
  s = r1.state;
  const r2 = noteTrophy(sellCatch(s, koi(75), TODAY, { who: "a", couple: true }), koi(75), ctx("a"));
  assert.ok(r2.ok);
  if (r2.ok) {
    assert.equal(trophiesOf(r2.state).length, 1);
    assert.equal(trophiesOf(r2.state)[0].who, "b", "상대의 90cm 가 그대로");
  }
  const boss = { ...koi(300), boss: "harbor_boss" };
  assert.equal(noteTrophy(sellCatch(s, boss, TODAY), boss, ctx("a")).ok && trophiesOf(s).length, 1, "주인은 기록이 아니다");
  const junk = { ...koi(10), junk: "can", cm: undefined };
  const j = noteTrophy({ ok: true, state: s, outcome: "junk", coins: 0, levelUp: 0 }, junk, ctx("a"));
  assert.ok(j.ok && j.state === s);
  // 놓쳐도(slipped) 크기 기록은 남는 엔진 규칙 — 어탁도 따른다
  const fry: FishCatch = { family: "guppy", stage: 0, grade: "흔함", difficulty: 1, cm: 2.2 };
  const slip = noteTrophy(tryStore(island(), fry, 0, 1, T0, TODAY, { who: "a", couple: true }), fry, ctx("a"));
  assert.ok(slip.ok && slip.outcome === "slipped" && trophiesOf(slip.state)[0]?.cm === 2.2 && trophiesOf(slip.state)[0]?.key === "fry_guppy");
  // 실패한 저장은 그대로
  const bad = noteTrophy({ ok: false, reason: "x" }, koi(1), ctx("a"));
  assert.equal(bad.ok, false);
});

test("120장 상한 — 건 것과 방금 깬 기록은 남기고, 오래된 날부터 덜어 낸다(언제 돌려도 같은 결과)", () => {
  const forms = ALL_FORMS.slice(0, TROPHY_MAX + 5);
  let list: Trophy[] = [];
  forms.slice(0, TROPHY_MAX).forEach((f, i) => {
    list = addTrophy(list, { key: f.key, cm: 10, who: "a", by: "도연", spot: "brook", day: `2026-0${1 + (i % 9)}-1${i % 10}` });
  });
  assert.equal(list.length, TROPHY_MAX);
  const oldest = [...list].sort((a, b) => a.day.localeCompare(b.day) || a.cm - b.cm || a.key.localeCompare(b.key));
  const hung = [oldest[0].key];
  const next = addTrophy(list, { key: forms[TROPHY_MAX].key, cm: 10, who: "a", by: "도연", spot: "brook", day: "2026-01-01" }, hung);
  assert.equal(next.length, TROPHY_MAX);
  assert.ok(next.some((t) => t.key === hung[0]), "건 것은 안 지운다");
  assert.ok(next.some((t) => t.key === forms[TROPHY_MAX].key), "방금 깬 기록은 안 지운다(날짜가 가장 오래돼도)");
  assert.ok(!next.some((t) => t.key === oldest[1].key), "그다음 오래된 것이 빠진다");
  assert.deepEqual(addTrophy(list, next[0], hung).map((t) => t.key), addTrophy(list, next[0], hung).map((t) => t.key));
  // 섬 한 행 1MB — 120장이 넉넉히 작다
  assert.ok(JSON.stringify(next).length < 20_000, `${JSON.stringify(next).length}바이트`);
});

test("어탁첩 — 저장된 어탁 + 크기 기록(옛 기록 · 옛 앱의 상대 기록)으로 첫날부터 채운다", () => {
  const f0 = fishingOf(island());
  const keys = ALL_FORMS.slice(0, 3).map((f) => f.key);
  let s: IslandState = { ...island(), fishing: { ...f0, sizes: { [keys[0]]: { a: 12, b: 15 }, [keys[1]]: { a: 30 }, "모르는_모습": { a: 9 } } } };
  // keys[0] 은 저장된 어탁이 13cm(옛 앱으로 상대가 15cm 를 잡아 크기 기록이 더 길다) — 크기 기록 쪽
  s = withFishPlus(s, { trophies: [{ key: keys[0], cm: 13, who: "a", by: "도연", spot: "brook", day: "2026-11-01" }, { key: keys[2], cm: 7, who: "a", by: "도연", spot: "brook", day: "2026-11-02" }] });
  const v = trophyView(s, "a", "도연", true);
  assert.equal(v.length, 3, "모르는 모습은 뺀다");
  const k0 = v.find((x) => x.key === keys[0])!;
  assert.equal(k0.cm, 15);
  assert.equal(k0.by, "상대");
  assert.equal(k0.stored, false);
  assert.equal(k0.day, "", "크기 기록엔 날짜가 없다");
  const k1 = v.find((x) => x.key === keys[1])!;
  assert.equal(k1.by, "도연");
  const k2 = v.find((x) => x.key === keys[2])!;
  assert.equal(k2.stored, true);
  assert.equal(k2.spotName.length > 0, true, "낚시터 key → 이름");
  assert.equal(v[0].key, keys[2], "날짜가 있는 최근 것이 앞");
  // 혼자 하는 섬은 '상대'가 없다
  assert.equal(trophyView(s, "a", "도연", false).find((x) => x.key === keys[0])!.by, "도연");
  // 크기 기록에서 채운 칸은 낚시터 · 날짜 줄을 뺀다
  assert.deepEqual(printLines(k0).map(([l]) => l), ["잡은 사람"]);
  assert.deepEqual(printLines({ spotName: "", day: "", by: "" }), []);
  assert.deepEqual(printLines(k2).map(([l]) => l), ["낚시터", "날짜", "잡은 사람"]);
});

test("fishPlus 의 어탁 · 건 것은 낚시 저장을 지나도 남는다 · 벽은 6장", () => {
  let s = island();
  const c = koi(70);
  const r = noteTrophy(sellCatch(s, c, TODAY, { who: "a", couple: true }), c, ctx("a"));
  assert.ok(r.ok);
  if (!r.ok) return;
  s = withFishPlus(r.state, { future: 1 });
  const h = toggleHung(s, c.species!);
  assert.ok(h.ok);
  if (!h.ok) return;
  s = h.state;
  assert.deepEqual(hungOf(s), [c.species]);
  const b = buyBait(s, "bait_shrimp", TODAY);
  assert.ok(b.ok);
  if (b.ok) assert.deepEqual(b.state.fishPlus, s.fishPlus, "미끼 사기가 지우지 않는다");
  const sold = sellCatch(s, koi(5), TODAY, { who: "a", couple: true });
  assert.ok(sold.ok);
  if (sold.ok) assert.deepEqual(sold.state.fishPlus, s.fishPlus, "팔기가 지우지 않는다");
  const kept = tryStore(s, { family: "guppy", stage: 0, grade: "흔함", difficulty: 1, cm: 2 }, 1, 0, T0, TODAY);
  assert.ok(kept.ok && kept.outcome === "stored");
  if (kept.ok) assert.deepEqual(kept.state.fishPlus, s.fishPlus, "담기가 지우지 않는다");
  assert.equal(fishPlusOf(s).future, 1, "남의 칸은 그대로");
  const off = toggleHung(s, c.species!);
  assert.ok(off.ok && hungOf(off.state).length === 0, "다시 누르면 내린다");
  let full = s;
  for (const f of ALL_FORMS.slice(0, HUNG_MAX + 1)) {
    if (f.key === c.species) continue;
    const t = toggleHung(full, f.key);
    if (t.ok) full = t.state;
  }
  assert.equal(hungOf(full).length, HUNG_MAX);
  assert.equal(toggleHung(full, ALL_FORMS[HUNG_MAX + 3].key).ok, false, "7장째는 막는다");
  assert.equal(toggleHung(s, "모르는_모습").ok, false);
});

test("카드 배치 — 실루엣 · 글자 · 낙관이 겹치지 않고 카드 안에 있다(길이 0.6~1.8배 · 줄 0~3개 · 어떤 몸 비율도)", () => {
  const card = { x: 0, y: 0, w: PRINT_W, h: PRINT_H };
  let prev = 0;
  for (const ratio of [0.5, 0.6, 0.75, 1, 1.3, 1.7, 1.8, 3, Number.NaN]) {
    for (const aspect of [0.35, 0.8, 1, 2, 3.2, 6, 0]) {
      for (let n = 0; n <= 3; n++) {
        const L = printLayout({ ratio, aspect, lines: Array.from({ length: n }, (_, i) => [`줄${i}`, "가나다"] as const) });
        assert.ok(boxInside(L.fishBounds, L.fishArea), `기운 실루엣이 칸 밖 ${ratio} ${aspect}`);
        assert.ok(boxInside(L.fish, L.fishArea), "실루엣 사각형도 칸 안");
        const texts = [L.head, L.name, L.cm, ...L.lines.map((x) => x.box), L.foot];
        for (const b of [...texts, L.seal, L.fishArea]) assert.ok(boxInside(b, { x: 34, y: 34, w: PRINT_W - 68, h: PRINT_H - 68 }) && boxInside(b, card), "테두리 안");
        for (const b of [...texts, L.seal]) assert.ok(!boxesOverlap(b, L.fishArea), "글자 · 낙관이 실루엣 칸에 들어간다");
        const all = [...texts, L.seal];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!boxesOverlap(all[i], all[j]), `상자 ${i} · ${j} 가 겹친다`);
      }
    }
    // 길수록 크게(같은 몸 비율이면)
    const w = printLayout({ ratio, aspect: 2, lines: [] }).fish.w;
    if (Number.isFinite(ratio)) assert.ok(w >= prev - 1e-9, `${ratio}배가 더 작다`);
    if (Number.isFinite(ratio)) prev = w;
  }
  assert.ok(fishScale(1.7) > fishScale(1) && fishScale(1) > fishScale(0.75));
  assert.ok(fishScale(0.1) >= 0.46 && fishScale(9) <= 1);
  assert.ok(Math.abs(sizeRatio({ family: "koi", stage: 2 }, 65) - 1) < 1e-9, "다 큰 비단잉어 65cm = 보통");
  assert.ok(sizeRatio({ family: "koi", stage: 0 }, 26) > 0.99, "치어는 치어 크기 기준");
});

test("카드 글자 · 씨앗", () => {
  assert.equal(fmtTrophyDay("2026-11-12"), "2026년 11월 12일");
  assert.equal(fmtTrophyDay(""), "");
  assert.equal(sealChar("  도연"), "도");
  assert.equal(sealChar(""), "어");
  assert.equal(printSeed("koi", 70), printSeed("koi", 70), "같은 어탁 = 같은 번짐");
  assert.notEqual(printSeed("koi", 70), printSeed("koi", 70.1));
});

test("그리기 · 화면 계약 — 먹 실루엣 · 한지 · 낙관 · 공유 · 한 줄 연결", () => {
  const g = code("src/lib/gyotaku.ts");
  assert.match(g, /getImageData/, "그림의 알파로 먹을 찍는다");
  assert.match(g, /globalCompositeOperation = "multiply"/, "종이 결이 먹 사이로 비친다");
  assert.match(g, /canvas\.toBlob\(res, "image\/png"\)/);
  assert.match(g, /printSeed\(t\.key, t\.cm\)/, "번짐은 key · cm 씨앗");
  assert.doesNotMatch(g.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""), /shadowBlur|\.filter\s*=|Math\.random|@font-face|new FontFace/, "사파리 · 시스템 서체 · 같은 결과");
  assert.match(g, /\/aqua\/fish\/sm\/\$\{key\}\.webp/, "원본이 없으면 화면용 그림");
  const ui = code("src/components/FishTrophies.tsx");
  assert.match(ui, /webShareOrDownload\(file, "어탁"\)/);
  assert.match(ui, /nativePlatform\(\)/);
  // 공유 누를 때 첫 await 전에 share 를 부른다 — share() 안엔 await 가 없다
  const share = ui.slice(ui.indexOf("function share()"), ui.indexOf("return (", ui.indexOf("function share()")));
  assert.doesNotMatch(share, /await /);
  assert.match(ui, /toggleHung\(s, shown\.key\)/);
  assert.match(code("src/components/FishCollect.tsx"), /<FishTrophies \{\.\.\.p\} \/>/);
  const game = code("src/components/FishingGame.tsx");
  // 다른 갈래가 같은 줄을 감싸도 깨지지 않게 — 담기 · 팔기 · 닫으며 팔기 세 저장이 trophyRef 를 거치는지만 본다
  assert.ok((game.match(/act\(\(s\) => trophyRef\.current\(/g)?.length ?? 0) >= 3, "담기 · 팔기 · 닫으며 팔기 저장 안에서");
  assert.match(game, /result\?\.sizeNote && fish\.cm && !fish\.boss && <ActionButton className="fish-trophy-make"/, "기록을 깬 결과 카드에 '어탁 만들기'");
  const css = code("src/styles/games.css").replace(/\r\n/g,"\n");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.fish-trophy-back, \.fish-trophy-sheet \{ animation: none; \}/);
});
