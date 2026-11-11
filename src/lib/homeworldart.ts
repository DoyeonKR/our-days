/* 홈 히어로 계절 원화 — 주소 · srcset · 미리 받기 한 곳(2026-11-11 첫 화면 다이어트).
 *
 * 원화(1200×1800, 249~467KB)는 JS 를 다 받고 로그인을 확인한 뒤 HomeWorld 가 그려질 때에야 요청이 나갔다.
 * ① 800w 사본(scripts/art-variants.mjs)을 srcset 으로 — 히어로는 앱 칸(최대 448px) 폭이라 DPR 2 폰은 800w 를,
 *    DPR 3 폰은 그대로 1200w 를 받는다(그림은 같고 크기만 다르다).
 * ② layout 의 인라인 스크립트가 HTML 을 읽는 순간 이 달 계절 그림을 preload 한다 — 로그인 기록이 있고 홈 주소일 때만
 *    (로그인 화면 · 다른 페이지에서 수백 KB 를 헛받지 않게). imagesrcset · imagesizes 가 <img> 와 글자까지 같아야 같은
 *    요청으로 합쳐진다 — 그래서 둘 다 이 파일의 값을 쓴다. 계절은 seasonOf(lib/kst)와 같은 식(KST 월)이다. */
import type { Season } from "@/lib/kst";

export const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];

/** 원화(1200w) 경로 — basePath 없이 */
export const SEASON_WORLD: Record<Season, string> = {
  spring: "/assets/homeworld/spring.webp",
  summer: "/assets/homeworld/summer.webp",
  autumn: "/assets/homeworld/autumn.webp",
  winter: "/assets/homeworld/winter.webp",
};
/** 800w 사본 경로 */
export const seasonWorld800 = (s: Season) => `/assets/homeworld/${s}-800w.webp`;

/** 히어로의 실제 표시 폭 — 앱 칸(max-w-md = 448px)을 넘지 않는다(object-cover 라 그림 폭 = 칸 폭) */
export const HOME_WORLD_SIZES = "(min-width: 448px) 448px, 100vw";

/** base = basePath(예: /our-days). <img srcSet> 와 preload 의 imagesrcset 이 같은 글이어야 한다. */
export function homeWorldSrcSet(s: Season, base: string): string {
  return `${base}${seasonWorld800(s)} 800w, ${base}${SEASON_WORLD[s]} 1200w`;
}

/** layout 의 인라인 스크립트 — 페인트 전에 이 달 계절 그림을 preload 한다.
 *  needSession: 서버 연동 빌드면 저장된 로그인(supabase-js 의 sb-…-auth-token)이 있을 때만(로그인 화면엔 히어로가 없다). */
export function heroPreloadScript(base: string, needSession: boolean): string {
  const sets = Object.fromEntries(SEASONS.map((s) => [s, homeWorldSrcSet(s, base)]));
  const full = Object.fromEntries(SEASONS.map((s) => [s, `${base}${SEASON_WORLD[s]}`]));
  return (
    `try{var p=location.pathname,b=${JSON.stringify(base)};` +
    `if((p===b+"/"||p===b||p===b+"/index.html")&&location.search.indexOf("go=")<0){` +
    `var ok=${needSession ? "false" : "true"};` +
    `if(!ok)for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&/^sb-.+-auth-token$/.test(k)){ok=true;break}}` +
    `if(ok){var m=new Date(Date.now()+324e5).getUTCMonth();var s=m<=1||m===11?"winter":m<=4?"spring":m<=7?"summer":"autumn";` +
    `var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${JSON.stringify(full)}[s];` +
    `l.setAttribute("imagesrcset",${JSON.stringify(sets)}[s]);l.setAttribute("imagesizes",${JSON.stringify(HOME_WORLD_SIZES)});` +
    `l.setAttribute("fetchpriority","high");document.head.appendChild(l)}}}catch(e){}`
  );
}
