// 배터리 lock — 안 보이는 동안 도는 것들. [2026-11-11]
//   · 홈 하늘 연출은 화면 밖이면 멈춘다 · 해 맥동은 filter 가 아니라 투명도
//   · 새 버전 점검(5분)은 앱이 보일 때만 · 업데이트 새로고침 뒤엔 보던 탭으로(자동 적용은 그대로 — 2026-11-04 사용자 요청)
//   · 게임 창 지킴이는 폴링하지 않는다 · 브이로그 영상은 보일 때만 재생(autoPlay 없음)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { markUpdateReload, rememberView, takeUpdateReloadView } from "./reloadview.ts";

const root = join(import.meta.dirname, "..", "..");
const code = (p: string) => readFileSync(join(root, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

test("홈 하늘 — 화면 밖이면 모든 반복 연출이 멈추고, 해 맥동은 filter 를 애니메이션하지 않는다", () => {
  const w = code("src/components/HomeWorld.tsx");
  assert.match(w, /new IntersectionObserver\(\(\[e\]\) => el\.toggleAttribute\("data-hw-paused", !e\.isIntersecting\), \{ threshold: 0 \}\)/);
  assert.doesNotMatch(w, /rootMargin/, "iOS 는 main 이 스크롤한다 — rootMargin 을 쓰려면 root 가 필요하다(lib/pageScroll)");
  // 반복 애니가 걸린 hw- 클래스는 전부 멈춤 목록에 있다
  const style = w.slice(w.indexOf("<style>{`"), w.indexOf("`}</style>"));
  const animated = [...style.matchAll(/\.(hw-[\w-]+)[^{]*\{[^}]*animation:[^}]*infinite/g)].map((m) => m[1]);
  assert.ok(animated.length >= 14, `반복 연출을 ${animated.length}개만 찾았다`);
  const paused = style.slice(style.indexOf("[data-hw-paused]"), style.indexOf("animation-play-state: paused"));
  for (const c of animated) assert.ok(paused.includes(`[data-hw-paused] .${c}`), `${c} 가 화면 밖에서도 돈다`);
  assert.doesNotMatch(style, /@keyframes[^{]*\{[^@]*filter:/, "filter 애니메이션은 매 프레임 다시 칠한다 — 투명도 막으로");
  assert.match(style, /@keyframes hw-sun-g \{ 0%,100% \{ opacity: 0 \} 50% \{ opacity: \.08 \} \}/);
  assert.match(w, /className="hw-sun-glint pointer-events-none absolute inset-0 block"/);
});

test("새 버전 — 5분 점검은 보일 때만, 새로고침 직전에 표식(자동 적용 · 칩 둘 다)", () => {
  const u = code("src/components/UpdateChip.tsx");
  assert.match(u, /setInterval\(\(\) => \{\s*if \(document\.visibilityState !== "hidden"\) check\(\);\s*\}, 5 \* 60_000\)/);
  assert.match(u, /if \(!canReloadNow\(\) \|\| !reloadOnce\(j\.v\)\) setReady\(true\)/, "자동 적용(2026-11-04 사용자 요청)은 그대로");
  assert.match(u, /markUpdateReload\(\);\s*location\.reload\(\);\s*return true;/);
  assert.match(u, /onClick=\{\(\) => \{\s*markUpdateReload\(\);\s*location\.reload\(\);/);
  const page = code("src/app/page.tsx");
  assert.match(page, /const restored = takeUpdateReloadView\(VIEWS\);[\s\S]{0,120}if \(route\) goRouteRef\.current\(route\);\s*else if \(restored && restored !== "home"\) setView\(restored\);/, "알림 · 링크가 이긴다");
  assert.match(page, /if \(viewRestoredRef\.current\) rememberView\(view\);/);
  assert.doesNotMatch(page, /useState<View>\(\(\) =>/, "첫 렌더는 서버 HTML 과 같은 홈이어야 한다(되살리기는 마운트 뒤)");
});

test("보던 탭 되살리기 — 업데이트 새로고침 뒤 한 번만, 허용된 탭만", () => {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const V = ["home", "diary", "plan"] as const;
  rememberView("plan");
  assert.equal(takeUpdateReloadView(V), null, "평소 새로고침은 홈");
  markUpdateReload();
  assert.equal(takeUpdateReloadView(V), "plan");
  assert.equal(takeUpdateReloadView(V), null, "한 번만");
  rememberView("toString");
  markUpdateReload();
  assert.equal(takeUpdateReloadView(V), null, "모르는 값은 버린다");
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  assert.equal(takeUpdateReloadView(V), null, "저장소가 없으면 조용히 홈");
});

test("게임 창 지킴이 — 폴링 없이 일이 생길 때만 잰다(두 번 같은 값일 때만 고치는 규칙은 그대로)", () => {
  const g = code("src/components/GameWindowGuard.tsx");
  assert.doesNotMatch(g, /setInterval/);
  assert.match(g, /const fix = shellShift\(prev, top\);/);
  assert.match(g, /window\.setTimeout\(sample, 400\)/);
  assert.match(g, /new MutationObserver\(\(records\) => \{\s*for \(const r of records\) for \(const n of r\.addedNodes\) if \(isShell\(n\)\) return kick\(\);/, "자손 변화는 창이 붙을 때만 깨운다");
  assert.match(g, /locked\.observe\(document\.body, \{ attributes: true, attributeFilter: \["style", "class"\] \}\)/);
  for (const ev of ['"resize", kick', 'vv?.addEventListener("resize", kick)', 'vv?.addEventListener("scroll", kick)']) assert.ok(g.includes(ev), ev);
});

test("브이로그 영상 — autoPlay 없이 보일 때만 재생, 첫 장면 그림이 있으면 영상은 미리 받지 않는다", () => {
  const v = code("src/components/LoopVideo.tsx");
  assert.doesNotMatch(v, /\bautoPlay\b/);
  assert.match(v, /if \(!v \|\| !visibleRef\.current \|\| document\.visibilityState === "hidden"\) return;/, "모든 재시도(로드 · 포커스 · 복귀)가 tryPlay 를 거친다");
  assert.match(v, /visibleRef\.current = entry\.isIntersecting;/);
  assert.match(v, /preload=\{poster \? "none" : "metadata"\}/);
  assert.match(v, /\bmuted\b[\s\S]{0,40}\bplaysInline\b/);
  assert.equal((v.match(/\.play\(\)/g) ?? []).length, 1, "play() 는 tryPlay 한 곳");
});
