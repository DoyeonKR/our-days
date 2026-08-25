// 날씨 픽셀 아이콘 회귀 lock. [2026-08-11]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WEATHER_KINDS, weatherSprite } from "./pixelweather.ts";
import { pixelAt, validateSprite } from "./pixel.ts";

/** #rrggbb → 상대 휘도(0~1 근사). */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

test("날씨 아이콘 — 8종 전부 24×24 규격이고 잉크가 있다", () => {
  assert.equal(WEATHER_KINDS.length, 8);
  for (const k of WEATHER_KINDS) {
    const s = weatherSprite(k);
    assert.equal(s.w, 24, `${k}: 판 폭`);
    assert.equal(s.h, 24, `${k}: 판 높이`);
    assert.deepEqual(validateSprite(s, k), [], `${k} 규격`);
    let ink = 0;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (pixelAt(s, x, y)) ink++;
    assert.ok(ink >= 60, `${k}: 잉크 ${ink}칸 — 아이콘이라기엔 비어 있다`);
  }
});

/** 실루엣(잉크 유무만)으로 두 아이콘이 다른 칸 수. */
function shapeDiff(a: string, b: string): number {
  const A = weatherSprite(a as never);
  const B = weatherSprite(b as never);
  let n = 0;
  for (let y = 0; y < A.h; y++)
    for (let x = 0; x < A.w; x++) if (!!pixelAt(A, x, y) !== !!pixelAt(B, x, y)) n++;
  return n;
}

test("★ 눈/비/흐림이 비슷비슷하면 안 된다 — 실루엣이 크게 갈린다 [사용자 피드백 2026-08-11]", () => {
  // 16판의 실패: 구름 하나 공유 + 아래 1px 점만 교체 → "다 비슷비슷하잖아".
  // 헷갈리기 쉬운 짝마다 **다른 칸 수의 하한**을 잠근다. 겹치는 구름 몸통을 감안해도
  // 특징(빗줄기 다발/눈송이 결정/두 겹 구름/안개 띠/번개)이 이 정도는 갈라야 한 눈에 읽힌다.
  const pairs: [string, string][] = [
    ["rain", "snow"],
    ["rain", "drizzle"],
    ["rain", "cloud"],
    ["snow", "cloud"],
    ["snow", "drizzle"],
    ["cloud", "fog"],
    ["cloud", "drizzle"],
    ["fog", "drizzle"],
  ];
  for (const [a, b] of pairs) {
    const d = shapeDiff(a, b);
    assert.ok(d >= 30, `${a}↔${b}: 실루엣 차이 ${d}칸 < 30 — 또 비슷해졌다`);
  }
});

test("★ 구름 색도 조건을 따라 갈린다 — 비구름은 어둡고 눈구름은 얼음빛 [사용자 피드백]", () => {
  const body = (k: string) => weatherSprite(k as never).pal.B;
  // 비/뇌우/눈/흐림의 구름 몸통색이 전부 달라야 한다 — 실루엣이 뭉개지는 작은 크기(24px 렌더)
  // 에서는 색이 첫 번째 구분자다.
  const four = [body("rain"), body("thunder"), body("snow"), body("cloud")];
  assert.equal(new Set(four).size, 4, `구름 몸통색이 겹친다: ${four.join(" ")}`);
  const l = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };
  assert.ok(l(body("thunder")) < l(body("rain")), "먹구름(뇌우)이 비구름보다 어둡다");
  assert.ok(l(body("rain")) < l(body("snow")), "비구름이 눈구름보다 어둡다");
});

test("날씨 아이콘 — 전부 어두운 외곽선이 있다(흰 카드 위에서 사라지지 않게) [회귀 lock]", () => {
  for (const k of WEATHER_KINDS) {
    const s = weatherSprite(k);
    const dark = Object.values(s.pal).filter((c) => lum(c) < 0.5);
    assert.ok(dark.length >= 1, `${k}: 어두운 톤이 없다 — 라이트 카드에서 통째로 사라진다`);
    // 외곽선 글자가 실제로 찍혀 있는가 (팔레트에만 있고 안 쓰이면 소용없다)
    assert.ok(
      s.rows.some((r) => r.includes("o") || r.includes("O")),
      `${k}: 외곽선이 그려져 있지 않다`,
    );
  }
});

test("partly — 구름 외곽선은 남회색, 해 외곽선은 금색 [회귀 lock]", () => {
  // 실제로 낸 버그: SUN_PAL 을 통째로 스프레드해 그쪽 `o`(금색)가 구름 외곽선까지 덮었다.
  // 해 쪽은 별도 글자 `O` 를 쓴다 — PNG 를 굽고서야 보인 종류라 여기 잠근다.
  const p = weatherSprite("partly");
  assert.equal(p.pal.o, weatherSprite("cloud").pal.o, "구름 외곽선이 구름 아이콘과 같은 색이어야 한다");
  assert.ok(p.pal.O, "해 외곽선 글자 O 가 있어야 한다");
  assert.notEqual(p.pal.O, p.pal.o, "해/구름 외곽선이 같은 색이면 스프레드 사고 재발이다");
});

test("배선 — 로그·일기·사진은 기록 허브에 보존하고 날씨는 상위 내비에서 제외한다 [5탭 IA]", () => {
  // 5개의 목적 중심 상위 탭으로 합치되, 기존 기록 기능은 하위 세그먼트로 모두 도달 가능해야 한다.
  // 날씨 전용 화면은 상위 내비에서 내리고 장거리 카드의 현재 날씨로 맥락화한다.
  const here = import.meta.dirname;
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const nav = strip(readFileSync(join(here, "..", "components", "BottomNav.tsx"), "utf8"));
  const page = readFileSync(join(here, "..", "app", "page.tsx"), "utf8");
  assert.ok(/k:\s*"records"/.test(nav), "기록 허브 탭이 없다");
  assert.ok(!/k:\s*"weather"/.test(nav), "날씨 탭이 되살아났다");
  assert.ok(page.includes('visitedRecords.has("log")'), "로그 뷰가 사라졌다");
  assert.ok(page.includes('visitedRecords.has("diary")'), "일기 뷰가 사라졌다");
  assert.ok(page.includes('visitedRecords.has("photos")'), "사진 뷰가 사라졌다");
  assert.ok(!page.includes("<WeatherView"), "숨긴 날씨 화면이 메인 번들에 다시 연결됐다");
});

test("★ 날씨 화면 — 삼성 넘침 방지 + 도시 토글 + 일간 날짜 [사용자 리포트/요청 2026-08-11]", () => {
  const here = import.meta.dirname;
  const view = readFileSync(join(here, "..", "components", "WeatherView.tsx"), "utf8");
  // "폰트가 영역을 넘어가" — 원인은 둘: 고정폭 라벨(시스템 서체 폭이 기기마다 다르다)과
  // flex 기본 min-width:auto. 보내 버튼 잘림(inputfit)과 같은 뿌리라 같은 방식으로 잠근다.
  const code = view.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/className={?`?[^"`]*\bw-9\b/.test(code), "일간 요일 라벨이 고정폭으로 돌아갔다");
  assert.ok(!/\bw-11\b/.test(code), "강수확률 라벨이 고정폭으로 돌아갔다");
  assert.ok(!/text-lg[^"`]*font-extrabold[^"`]*text-ink">\s*\{h\.tMin\}/.test(code), "오전/오후 기온이 text-lg 로 돌아갔다(삼성에서 넘친다)");
  // 도시 토글 + 일간 날짜
  assert.ok(code.includes("setWeatherPlace"), "도시 토글이 없다");
  assert.ok(code.includes("mdLabelOf"), "일간 행에 날짜(M/D)가 없다");
  // 홈 카드·히어로도 같은 도시를 본다 — 탭만 인천이고 홈은 서울이면 두 하늘이 갈린다
  const card = readFileSync(join(here, "..", "components", "HomeWeatherCard.tsx"), "utf8");
  const world = readFileSync(join(here, "..", "components", "HomeWorld.tsx"), "utf8");
  assert.ok(card.includes("useWeatherPlace"), "홈 카드가 고른 도시를 안 따른다");
  assert.ok(world.includes("useWeatherPlace"), "히어로 하늘이 고른 도시를 안 따른다");
});

test("★ 숨긴 곳으로 가는 문이 열려 있으면 안 된다 [계약 반전 2026-08-18]", () => {
  // 원칙은 그대로다(2026-08-11 사고에서 배움): **탭이 숨어 있는 동안 그 뷰로 가는
  // 활성 경로가 0 이어야 한다.** 숨은 쪽이 로그·일기 → 날씨로 바뀌었을 뿐이다.
  // ⚠ 복구용 주석에 같은 문자열이 남아 있으므로 **주석을 벗기고** 스캔한다(README 규칙).
  const here = import.meta.dirname;
  const raw = readFileSync(join(here, "..", "app", "page.tsx"), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  // 날씨가 숨었다 — 활성 문(홈 날씨 카드·setView("weather")) 금지
  assert.ok(!src.includes("<HomeWeatherCard"), "홈 날씨 카드가 살아 있다 — 숨긴 탭으로 가는 문");
  assert.ok(!/setView\(\"weather\"\)/.test(src), "날씨 뷰로 가는 활성 경로가 남았다");
  // 로그·일기 문은 열려 있어야 한다(복원 요청 2026-08-18)
  assert.ok(src.includes("<TodayLogCard"), "홈 로그 카드가 복원되지 않았다");
  assert.ok(/onOpenDiary=/.test(src), "캘린더 일기 열기가 복원되지 않았다");
});
