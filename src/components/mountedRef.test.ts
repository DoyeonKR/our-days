// mountedRef 고착 회귀 lock. [2026-08-02]
// 증상: 우리 섬에서 첫 액션 뒤 **모든 버튼이 disabled 로 굳음**(공방 3택 클릭이 커밋에 도달 못 함).
// 원인: `useRef(true)` 를 정리(cleanup)에서 false 로 내리면서 **effect 재실행 때 true 로 복구하지 않음**.
//   React Strict Mode 는 effect→cleanup→effect 로 두 번 돌기 때문에 ref 가 false 로 고착되고,
//   `if (mountedRef.current) setBusy(false)` / `setRow(updated)` 가 영영 실행되지 않는다.
// 규칙: 정리에서 false 로 내리는 ref 는, **같은 effect 본문 첫 줄에서 true 로 되돌려야 한다.**
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = import.meta.dirname;

/** src/components 이하(1단계 하위 포함)의 .tsx 전부. */
function tsxFiles(): { name: string; src: string }[] {
  const out: { name: string; src: string }[] = [];
  const walk = (d: string, prefix = "") => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), `${prefix}${e.name}/`);
      else if (e.name.endsWith(".tsx")) out.push({ name: prefix + e.name, src: readFileSync(join(d, e.name), "utf8") });
    }
  };
  walk(dir);
  return out;
}

test("정리에서 false 로 내리는 mounted ref 는 effect 재실행 시 true 로 복구한다", () => {
  const offenders: string[] = [];
  for (const { name, src } of tsxFiles()) {
    // `<ref>.current = false` 로 내리는 ref 이름들을 수집
    const downs = [...src.matchAll(/(\w+)\.current\s*=\s*false/g)].map((m) => m[1]);
    for (const ref of new Set(downs)) {
      // 같은 파일에 `<ref>.current = true` 복구가 있어야 한다(초기값 useRef(true) 만으론 부족 —
      // Strict Mode 2회 실행 시 두 번째 effect 가 복구하지 않으면 false 로 남는다)
      const up = new RegExp(`${ref}\\.current\\s*=\\s*true`).test(src);
      if (!up) offenders.push(`${name}:${ref}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `정리에서만 false 로 내리고 복구하지 않는 ref — Strict Mode 에서 고착되어 setState 가 전부 무시된다: ${offenders.join(", ")}`,
  );
});

test("IslandGame — 시계 effect 가 mountedRef 를 복구한다(버튼 잠김 재발 방지)", () => {
  const src = readFileSync(join(dir, "IslandGame.tsx"), "utf8");
  const i = src.indexOf("const iv = setInterval(() => setNow(Date.now()), 3000)");
  assert.ok(i >= 0, "시계 effect 를 찾지 못함");
  // effect 본문 시작(직전 useEffect) ~ setInterval 사이에 복구가 있어야 한다
  const head = src.slice(src.lastIndexOf("useEffect(", i), i);
  assert.ok(
    /mountedRef\.current\s*=\s*true/.test(head),
    "시계 effect 가 mountedRef 를 true 로 복구하지 않음 → 첫 액션 뒤 busy 고착",
  );
});
