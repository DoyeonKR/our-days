// 진동 — 안드로이드는 navigator.vibrate, 아이폰은 스위치 햅틱 우회(2026-11-21, lib/haptic)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { haptic } from "./haptic.ts";

const g = globalThis as unknown as { navigator?: unknown; document?: unknown };

function withEnv(nav: unknown, doc: unknown, run: () => void) {
  const n0 = Object.getOwnPropertyDescriptor(globalThis, "navigator"), d0 = g.document;
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
  g.document = doc;
  try { run(); } finally {
    if (n0) Object.defineProperty(globalThis, "navigator", n0); else delete g.navigator;
    g.document = d0;
  }
}

test("vibrate 가 있으면(안드로이드) 그대로 넘긴다 — 스위치는 안 만든다", () => {
  const got: unknown[] = [];
  let made = 0;
  withEnv({ vibrate: (p: unknown) => { got.push(p); return true; } }, { createElement: () => { made++; return {}; }, head: {} }, () => haptic([30, 60, 30]));
  assert.deepEqual(got, [[30, 60, 30]]);
  assert.equal(made, 0);
});

test("vibrate 가 없으면(아이폰) 보이지 않는 스위치 라벨을 눌렀다 바로 뗀다", () => {
  const log: string[] = [];
  const el = (tag: string) => {
    const o: Record<string, unknown> = { tag, style: {}, attrs: {} as Record<string, string> };
    o.setAttribute = (k: string, v: string) => { (o.attrs as Record<string, string>)[k] = v; };
    o.appendChild = (c: { tag: string }) => log.push(`append ${c.tag}`);
    o.click = () => log.push(`click ${tag}`);
    o.remove = () => log.push(`remove ${tag}`);
    return o;
  };
  let input: Record<string, unknown> | null = null;
  const doc = { createElement: (t: string) => { const o = el(t); if (t === "input") input = o; return o; }, head: { appendChild: () => log.push("head") } };
  withEnv({}, doc, () => haptic(12));
  assert.deepEqual(log, ["append input", "head", "click label", "remove label"]);
  assert.equal(input!.type, "checkbox");
  assert.equal((input!.attrs as Record<string, string>).switch, "");
});

test("진동은 lib/haptic 한 곳으로만 — 화면이 navigator.vibrate 를 직접 부르지 않는다 · 문서 전체 클릭 리스너 없음", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !f.endsWith(".test.ts")) files.push(p); } };
  walk(join(import.meta.dirname, ".."));
  for (const f of files) {
    if (f.endsWith(join("lib", "haptic.ts"))) continue;
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(src, /navigator\.vibrate/, f);
    assert.doesNotMatch(src, /document\.addEventListener\(\s*["']click["']/, `${f} — 스위치 클릭이 문서까지 올라간다`);
  }
});
