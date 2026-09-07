// accent 파생 토큰 lock — 6테마 × 라이트/다크를 **전부 계산해서** 4.5:1 을 강제한다.
// [배포본 실측 2026-09-07, 로그인한 채로 5탭 전부]
//
// 왜 토큰을 하나 더 만들었나: accent 는 **글씨색**으로도 쓰이고 **흰 글씨를 받는 면**으로도
// 쓰이는데 두 용도가 서로 반대 방향을 원한다.
//   · 글씨 → 배경에서 멀어져야 한다 (라이트=더 어둡게 / 다크=더 밝게)
//   · 흰 글씨를 받는 면 → 라이트·다크 **둘 다** 어두워져야 한다
// 그래서 --rose-deep 을 옮기면 한쪽을 고칠 때마다 반대쪽이 깨진다(실제로 한 번 그랬다).
//
// ⚠ 실측 두 번을 헛돌렸다. 브라우저에서 잴 땐 —
//   · 배경을 부모로 거슬러 찾을 때 html 까지 안 가면 흰색 폴백이라 다크가 통째로 미달로 나온다.
//   · 알파 유틸리티는 계산값이 oklab 문자열이라 숫자를 RGB 로 읽으면 쓰레기가 나온다.
//     캔버스에 1px 칠하고 되읽는 게 유일하게 안 틀린다.
//   이 테스트는 소스에서 직접 계산하므로 둘 다 안 겪는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ⚠ 주석을 먼저 지운다. 이 저장소는 '왜 그렇게 했는지'를 주석에 길게 남기는 스타일이라
// 선언을 세미콜론으로 자르고 첫 콜론을 찾으면 **주석 안의 콜론**이 먼저 잡힌다
// (실제로 --card / --accent-ink 가 통째로 안 보였다).
const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "app", "globals.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** `@media (prefers-color-scheme: dark)` 구간의 [시작,끝) 문자 범위. */
function darkRanges(src: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
    }
    out.push([m.index, i]);
  }
  return out;
}

const DARK = darkRanges(CSS);
const inDark = (i: number) => DARK.some(([a, b]) => i >= a && i < b);

/** mode·theme 별 커스텀 프로퍼티 표. theme 없는 `:root` 는 "" 키. */
function collect(dark: boolean): Map<string, Map<string, string>> {
  const table = new Map<string, Map<string, string>>();
  const re = /:root(?:\[data-theme="([a-z]+)"\])?\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    if (inDark(m.index) !== dark) continue;
    const theme = m[1] ?? "";
    const bag = table.get(theme) ?? new Map<string, string>();
    for (const d of m[2].split(";")) {
      const k = d.indexOf(":");
      if (k < 0) continue;
      const name = d.slice(0, k).trim();
      if (name.startsWith("--")) bag.set(name, d.slice(k + 1).trim());
    }
    table.set(theme, bag);
  }
  return table;
}

const LIGHT_T = collect(false);
const DARK_T = collect(true);
const THEMES = ["", "coral", "purple", "blue", "mint", "lime"];

/** 캐스케이드 그대로: 같은 모드의 테마 블록 → 같은 모드의 :root → 라이트 폴백. */
function raw(token: string, theme: string, dark: boolean): string {
  const order = dark
    ? [DARK_T.get(theme), DARK_T.get(""), LIGHT_T.get(theme), LIGHT_T.get("")]
    : [LIGHT_T.get(theme), LIGHT_T.get("")];
  for (const bag of order) {
    const v = bag?.get(token);
    if (v) return v;
  }
  throw new Error(`${token} 을 못 찾음 (theme=${theme || "default"}, dark=${dark})`);
}

type RGB = [number, number, number];

function hex(h: string): RGB {
  const s = h.trim().replace("#", "");
  const f = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as RGB;
}

/** color-mix(in srgb, …) 는 감마 인코딩된 sRGB 에서 채널별 선형 보간이다. */
function resolve(token: string, theme: string, dark: boolean): RGB {
  const v = raw(token, theme, dark);
  if (v.startsWith("#")) return hex(v);
  const mix = v.match(/color-mix\(\s*in srgb,\s*var\((--[\w-]+)\)\s*([\d.]+)%,\s*(#[0-9a-fA-F]{3,6})\s*\)/);
  if (mix) {
    const base = resolve(mix[1], theme, dark);
    const p = Number(mix[2]) / 100;
    const other = hex(mix[3]);
    return base.map((c, i) => Math.round(c * p + other[i] * (1 - p))) as RGB;
  }
  const alias = v.match(/^var\((--[\w-]+)\)$/);
  if (alias) return resolve(alias[1], theme, dark);
  throw new Error(`해석 불가: ${token} = ${v}`);
}

const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
function contrast(a: RGB, b: RGB): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const AA = 4.5;

/** 카드 안에서만 쓰이는 글씨색이 밟는 면. */
const CARD_BG = ["--card", "--surface"];
/** accent 글씨는 카드 밖(페이지 그라디언트) 위에도 그대로 앉는다 — .eyebrow 가 그렇다. */
const PAGE_BG = ["--bg-1", "--bg-2", "--bg-3"];

test("글씨용 파생 토큰이 모든 테마·모드에서 면 대비 4.5:1 을 넘는다", () => {
  // ⚠ --card 만 보고 통과시키면 두 번 새어 나간다(실제로 둘 다 겪었다) —
  //    크림 면(--surface)이 패널보다 어둡고, 페이지 그라디언트는 그보다 더 어둡다.
  const targets: [string, string[]][] = [
    ["--accent-ink", [...CARD_BG, ...PAGE_BG]],
    // partner/anniv 는 지금 카드 안(캘린더·아젠다)에서만 쓴다.
    // ⚠ 페이지 위로 내보낼 일이 생기면 여기 PAGE_BG 를 더하고 비율을 다시 잡아라
    //   (실측: partner 50% / anniv 50% 까지 내려가야 페이지 위에서 4.5 를 넘는다).
    ["--partner-ink", CARD_BG],
    ["--anniv-ink", CARD_BG],
  ];
  for (const dark of [false, true]) {
    for (const theme of THEMES) {
      for (const [ink, surfaces] of targets) {
        const c = resolve(ink, theme, dark);
        for (const bg of surfaces) {
          const cr = contrast(c, resolve(bg, theme, dark));
          assert.ok(
            cr >= AA,
            `${ink} on ${bg} (${theme || "default"}, ${dark ? "dark" : "light"}) = ${cr.toFixed(2)}`,
          );
        }
      }
    }
  }
});

test("흰 글씨를 받는 면(--brand-solid)이 모든 테마·모드에서 4.5:1 을 넘는다", () => {
  for (const dark of [false, true]) {
    for (const theme of THEMES) {
      const cr = contrast([255, 255, 255], resolve("--brand-solid", theme, dark));
      assert.ok(cr >= AA, `--brand-solid (${theme || "default"}, ${dark ? "dark" : "light"}) = ${cr.toFixed(2)}`);
    }
  }
});

test("네온 배지는 면을 안 깎고 글씨를 어둡게 얹어서 통과한다", () => {
  // 네온을 어둡게 깎으면(다크 기준 48%) 배지가 칙칙해져 '안 읽음' 신호 자체가 죽는다.
  for (const dark of [false, true]) {
    for (const theme of THEMES) {
      const cr = contrast(resolve("--neon-ink", theme, dark), resolve("--neon", theme, dark));
      assert.ok(cr >= AA, `--neon-ink on --neon (${theme || "default"}, ${dark ? "dark" : "light"}) = ${cr.toFixed(2)}`);
    }
  }
});

test("라이트는 검정과, 다크의 글씨는 흰색과 섞는다 (방향이 뒤집히면 더 안 보인다)", () => {
  assert.match(raw("--accent-ink", "", false), /#000/);
  assert.match(raw("--accent-ink", "", true), /#fff/);
  // 면은 라이트·다크 둘 다 어두워져야 한다 — 여기서 #fff 가 나오면 흰 글씨가 사라진다.
  assert.match(raw("--brand-solid", "", false), /#000/);
  assert.match(raw("--brand-solid", "", true), /#000/);
});

test("accent 를 글씨색으로 쓰던 규칙이 파생 토큰으로 넘어가 있다", () => {
  for (const sel of ["eyebrow", "text-gradient", "game-hub-kicker"]) {
    const m = CSS.match(new RegExp("\\." + sel + "\\s*\\{([^}]*)\\}"));
    assert.ok(m, `.${sel} 규칙을 못 찾음`);
    assert.ok(!/color:\s*var\(--rose-deep\)/.test(m![1]), `.${sel} 가 아직 --rose-deep 을 글씨색으로 쓴다`);
  }
  const brand = CSS.match(/\.bg-brand\s*\{([^}]*)\}/);
  assert.ok(brand && /background:\s*var\(--brand-solid\)/.test(brand[1]), ".bg-brand 가 --brand-solid 를 안 쓴다");
});

test("알파를 붙인 accent 글씨 유틸리티는 파생 토큰을 못 타므로 쓰지 않는다", () => {
  // `.text-rose-deep` 오버라이드는 **다른 클래스명**인 알파 변형에 안 걸린다.
  // 캘린더 일요일이 그래서 3.29 로 남아 있었다.
  const files = ["Calendar.tsx", "CoupleSync.tsx", "TodayLog.tsx"];
  for (const f of files) {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "components", f),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const hit = src.match(/text-(rose-deep|partner|anniv)\/\d+/g);
    assert.equal(hit, null, `${f} 에 알파 붙은 accent 글씨: ${hit?.join(", ")}`);
  }
});

test("탭 타겟은 보이는 크기가 아니라 가짜 요소로 넓힌다 (44px 기준)", () => {
  // ⚠ getBoundingClientRect 로 재면 이 확장을 못 봐서 멀쩡한 버튼도 미달로 잡힌다.
  //   실측은 elementFromPoint 로 중심에서 사방으로 넓혀 가며 **주인**을 확인해야 한다.
  const tap = CSS.match(/\.tap:not\(\.game-mode-card\)::after\s*\{([^}]*)\}/);
  assert.ok(tap, ".tap 확장 규칙이 없다");
  for (const axis of ["width", "height"]) {
    const m = tap![1].match(new RegExp(axis + ":\\s*max\\(100%,\\s*(\\d+)px\\)"));
    assert.ok(m, `.tap 확장에 ${axis} 가 없다`);
    // 46 인 이유: 정확히 44 로 두면 위 실측 방식이 반올림 때문에 43 으로 읽는다.
    assert.ok(Number(m![1]) >= 44, `.tap ${axis} = ${m![1]}px (44 미만)`);
  }
  // 확장은 positioned ancestor 가 있어야 먹는다.
  assert.match(CSS, /\.tap\s*\{[^}]*position:\s*relative/);
});

test("포커스 링이 있고, 지우는 곳은 :focus-visible 을 남긴다", () => {
  assert.match(CSS, /:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  // outline 을 0 으로 만드는 규칙이 :focus 전체를 덮으면 키보드 사용자가 길을 잃는다.
  const killers = CSS.match(/[^{}]*:focus[^-:v][^{}]*\{[^}]*outline:\s*(0|none)/g) ?? [];
  assert.deepEqual(killers, [], `:focus 포커스 링을 통째로 지우는 규칙: ${killers.join(" | ")}`);
});

test("GNB 활성 탭 — 흰 글씨가 그라디언트 양 끝에서 4.5:1 을 넘는다", () => {
  // 예전 배경은 --neon → --rose-deep 이었고 흰 글씨가 3.44 / 3.93 이었다
  // (라벨이 10~12px 이라 large text 예외도 못 받는다).
  // ⚠ 글씨를 어둡게 얹는 우회로도 막힌다 — purple 은 --rose-deep 자체가 어두워
  //   --neon-ink 가 3.36 이 된다. **네온 끝이 남는 한 어떤 글씨색도 6테마를 못 넘긴다.**
  const rule = CSS.match(/\.cosmic-gnb-tab\.is-active\s*\{([^}]*)\}/);
  assert.ok(rule, ".cosmic-gnb-tab.is-active 규칙을 못 찾음");
  const stops = [...rule![1].matchAll(/var\(--([\w-]+)\)/g)].map((m) => "--" + m[1]);
  assert.ok(stops.includes("--brand-solid"), `활성 탭 면이 --brand-solid 가 아니다: ${rule![1].trim()}`);
  assert.equal(stops.includes("--neon"), false, "활성 탭 면에 --neon 이 돌아왔다 — 흰 글씨가 3.44 로 떨어진다");

  // 아래쪽 스톱은 --brand-solid 를 더 어둡게 깎은 값이라 항상 더 안전하다. 위쪽만 확인하면 된다.
  for (const dark of [false, true]) {
    for (const theme of THEMES) {
      const cr = contrast([255, 255, 255], resolve("--brand-solid", theme, dark));
      assert.ok(cr >= AA, `활성 탭 흰 글씨 (${theme || "default"}, ${dark ? "dark" : "light"}) = ${cr.toFixed(2)}`);
    }
  }
});

test("게임 허브 — 모드 색이 글씨를 지배하면 크림 카드 위에서 안 읽힌다", () => {
  // --game-accent 셋은 전부 밝은 계열이라, 글씨에 그 색을 많이 섞으면 2.30~2.55 가 된다
  // (9~12px 이라 large text 예외도 못 받는다). 정체성은 바·테두리·아이콘 면이 든다.
  // ⚠ --ink / --muted / --card 는 data-theme 을 안 타고 모드만 탄다 → theme "" 로 충분하다.
  const modes = [...CSS.matchAll(/\.game-mode-(island|hunt|bubble)\s*\{([^}]*)\}/g)].map((m) => {
    const acc = m[2].match(/--game-accent:\s*(#[0-9a-fA-F]{6})/);
    const soft = m[2].match(/--game-soft:\s*(#[0-9a-fA-F]{6})/);
    assert.ok(acc && soft, `.game-mode-${m[1]} 의 색을 못 읽었다`);
    return { name: m[1], accent: hex(acc![1]), soft: hex(soft![1]) };
  });
  assert.equal(modes.length, 3, "게임 모드 색 3종을 못 찾았다");

  const blend = (a: RGB, b: RGB, p: number): RGB =>
    a.map((c, i) => Math.round(c * p + b[i] * (1 - p))) as RGB;
  /** `color-mix(in srgb, var(--game-accent) N%, var(--base))` 의 N 을 규칙에서 읽는다. */
  const ratio = (sel: string, base: string) => {
    // 정규식 대신 문자열로 찾는다 — 셀렉터를 조립하다 이스케이프를 한 겹 잃으면
    // "규칙을 못 찾음" 으로만 터져서 원인이 안 보인다(실제로 한 번 그랬다).
    const at = CSS.indexOf("." + sel + " {");
    assert.ok(at >= 0, `.${sel} 규칙을 못 찾음`);
    const body = CSS.slice(at, CSS.indexOf("}", at));
    const key = "color: color-mix(in srgb, var(--game-accent) ";
    const k = body.indexOf(key);
    assert.ok(k >= 0, `.${sel} 의 글씨색 형식이 바뀌었다`);
    const rest = body.slice(k + key.length);
    assert.ok(rest.includes(`%, var(${base}))`), `.${sel} 가 ${base} 와 안 섞인다`);
    return parseFloat(rest) / 100;
  };

  const targets = [
    { sel: "game-mode-number", base: "--muted", onSoft: false },
    { sel: "game-mode-badge", base: "--ink", onSoft: true },
    { sel: "game-mode-cta", base: "--ink", onSoft: false },
  ];
  for (const dark of [false, true]) {
    const card = resolve("--card", "", dark);
    for (const t of targets) {
      const p = ratio(t.sel, t.base);
      const baseInk = resolve(t.base, "", dark);
      for (const m of modes) {
        const fg = blend(m.accent, baseInk, p);
        // 배지만 면에 --game-soft 를 16% 섞는다. 나머지는 카드 그라디언트라 사실상 --card.
        const bg = t.onSoft ? blend(card, m.soft, 0.84) : card;
        const cr = contrast(fg, bg);
        assert.ok(cr >= AA, `.${t.sel} / ${m.name} (${dark ? "dark" : "light"}) = ${cr.toFixed(2)}`);
      }
    }
  }
});
