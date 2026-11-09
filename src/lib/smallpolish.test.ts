// 작은 다듬기 (2026-11-06) [사용자: "Small fixes first"] — 화면 점검에서 잡은 것들의 lock.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const code = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

test("홈 펫 이름 알약 — 어두운 하늘에서 흐린 흰 70% 를 쓰지 않는다", () => {
  const pet = code("src/components/island/HomePet.tsx");
  assert.doesNotMatch(pet, /text-white\/70/);
  assert.match(pet, /bg-black\/45 ring-1 ring-white\/20/);
});

test("게임 탭 칸 — 큰 수는 줄이고, 숫자와 그림은 한 줄", () => {
  const hub = code("src/components/GameArcade.tsx");
  assert.match(hub, /notation: "compact"/);
  assert.match(hub, /<Chip label="하트" title=/);
  assert.match(hub, /flex min-w-0 items-center justify-center gap-0\.5 overflow-hidden whitespace-nowrap/);
  assert.equal(new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(1815502), "181.6만");
});

test("계획 달력 — 줄은 44px, 오늘 · 추가 버튼은 40px", () => {
  const cal = code("src/components/Calendar.tsx");
  assert.match(cal, /tap flex min-h-11 flex-col items-center justify-start gap-0\.5 py-0\.5/);
  assert.match(cal, /tap inline-flex h-10 items-center rounded-full px-3 text-sm font-bold text-rose-deep/);
  assert.match(cal, /tap flex min-h-10 items-center gap-1 rounded-full bg-brand/);
  assert.match(code("src/app/page.tsx"), /onClick=\{\(\) => openAddEvent\(\)\}\s+className="tap flex min-h-10 items-center/);
});

test("홈 사진줄 — 만료된 사진은 한 번 다시 서명하고, 두 번째 실패만 숨긴다", () => {
  // 2026-11-09: 복구가 HomeWorld 의 빨랫줄(!sceneOnly — 홈은 sceneOnly 로만 그려 죽은 코드)에 있었다 → 실제 사진줄(HomeExperience)로 옮겼다
  const home = code("src/components/HomeExperience.tsx");
  assert.match(home, /if \(!path \|\| !onExpired \|\| tried\) \{\s+setHidden\(true\);/);
  assert.match(home, /src=\{fixed \?\? url\}/);
  assert.match(home, /<MemoryPhoto url=\{photo\.url\} path=\{[^}]+\} onExpired=\{props\.onPhotoExpired\} \/>/);
  assert.doesNotMatch(code("src/components/HomeWorld.tsx"), /onPhotoExpired\(/, "죽은 복사본이 되살아났다");
  assert.match(code("src/app/page.tsx"), /onPhotoExpired=\{async \(path\) => \(await resignPaths\(\[path\]\)/);
});
