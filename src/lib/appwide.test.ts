// 앱 공통 리뷰 lock (2026-11-05 — README §10.13). 사용자: "Fix all".
// 서비스워커 · 확대 · 서체 · 그림 캐시 · DB 채우기 · 로그 보관 · CI · 죽은 코드 · 움직임 줄이기를 한 번에 고쳤다.
// 소스 스캔은 주석을 먼저 지운다(README §10.5 — 이 저장소는 '왜'를 주석에 길게 쓴다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const raw = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
// 줄 주석은 줄 머리나 공백 뒤의 // 만 — 문자열 속 "//" · 정규식 \// · https:// 는 코드다(sw.js 함수를 꺼내 실제로 돌린다)
const code = (p: string) => raw(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
const sqlCode = (p: string) => raw(p).replace(/--[^\n]*/g, "");

const sw = code("public/sw.js");
/** sw.js 의 함수 하나를 꺼낸다(todayhub.test 와 같은 방법) */
function fnSrc(name: string): string {
  const a = sw.indexOf(`function ${name}(`);
  assert.ok(a >= 0, name);
  let depth = 0;
  for (let i = sw.indexOf("{", a); i < sw.length; i++) {
    if (sw[i] === "{") depth++;
    else if (sw[i] === "}" && --depth === 0) return sw.slice(a, i + 1);
  }
  throw new Error(name);
}
const self = { registration: { scope: "https://doyeonkr.github.io/our-days/" }, location: { href: "https://doyeonkr.github.io/our-days/sw.js" } };

// ── 서비스워커 ────────────────────────────────────────────────────────────────
test("SW ⓐ 청소가 activate 밖에서도 돈다 — 페이지가 {type:'gc'} 를 보내고 SW 는 하루 한 번만", () => {
  assert.match(sw, /addEventListener\("message"/);
  assert.match(sw, /d\.type === "gc"/);
  assert.match(sw, /GC_EVERY_MS = 86400000/);
  assert.match(fnSrc("gc"), /keepSet\.has\(r\.url\)/, "지금 페이지가 쓰는 청크를 남기지 않는다");
  assert.match(fnSrc("gc"), /statics\.length - STATIC_MAX/, "_next/static 상한이 없다");
  assert.doesNotMatch(fnSrc("gc"), /trimCache\(CACHE/, "앱 셸(프리캐시)까지 덜어 내면 오프라인 폴백이 사라진다");
  const chip = code("src/components/UpdateChip.tsx");
  assert.match(chip, /postMessage\(\{ type: "gc", keep: \[\.\.\.keep\] \}\)/);
  assert.match(chip, /getEntriesByType\("resource"\)/, "지연 로드 청크까지 남길 목록에 넣어야 한다");
});

test("SW ⓑ 문서는 경로 키로 저장 · ignoreSearch 로 찾는다(?f=<id> 알림 주소마다 쌓이던 것)", () => {
  const docKey = new Function(`${fnSrc("docKey")}\nreturn docKey;`)() as (u: URL) => string;
  const a = docKey(new URL("https://doyeonkr.github.io/our-days/?go=photo&f=123"));
  assert.equal(a, docKey(new URL("https://doyeonkr.github.io/our-days/?go=mood")));
  assert.equal(a, "https://doyeonkr.github.io/our-days/");
  const nav = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf("/_next/static/\")) {"));
  assert.match(nav, /c\.put\(docKey\(url\), copy\)/);
  assert.doesNotMatch(nav, /c\.put\(request, copy\)/, "쿼리째 저장이 되살아났다");
  assert.match(nav, /ignoreSearch: true/);
});

test("SW ⓒ 앱이 앞에 있어도 WebKit 에선 알림을 잠깐 띄웠다 닫는다(조용한 푸시 = 구독 해지 위험)", () => {
  const push = sw.slice(sw.indexOf('addEventListener("push"'), sw.indexOf('addEventListener("pushsubscriptionchange"'));
  const focused = push.slice(push.indexOf("c.focused"), push.indexOf("const isPoke"));
  assert.match(focused, /if \(!isWebKitPush\(\)\) return;/);
  assert.match(focused, /showNotification\(title, \{[^}]*tag[^}]*\}\)/);
  assert.match(focused, /getNotifications\(\{ tag \}\)/);
  assert.match(focused, /\.close\(\)/);
  const isWebKit = (ua: string) => (new Function("self", `${fnSrc("isWebKitPush")}\nreturn isWebKitPush;`)({ navigator: { userAgent: ua } }) as () => boolean)();
  assert.equal(isWebKit("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"), true);
  assert.equal(isWebKit("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"), false);
  assert.equal(isWebKit("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"), true);
});

test("SW ⓓ 알림 태그 — 서버가 준 tag(쿡은 poke-<couple_id>) 먼저, 없으면 쿡은 couple_id · 그 밖엔 category · renotify", () => {
  const push = sw.slice(sw.indexOf("const isPoke"), sw.indexOf('addEventListener("pushsubscriptionchange"'));
  assert.match(push, /const tag = d\.tag \|\| \(isPoke && \(d\.couple_id \|\| d\.coupleId\) \? "poke-" \+ \(d\.couple_id \|\| d\.coupleId\) : d\.category\);/);
  assert.match(push, /opts\.tag = String\(tag\)\.slice\(0, 64\);\s*opts\.renotify = true;/);
});

test("SW ⓔ 빠른 답장 토큰 계약 — src/lib/pokereply.ts 와 같은 캐시 · 키 · 값 · 주소", () => {
  assert.match(sw, /const POKE_REPLY = "ourdays:poke-reply-tokens"/);
  assert.match(fnSrc("replyTokenKey"), /self\.location\.origin \+ "\/__ourdays\/poke-reply\/" \+ t/);
  // 토큰 = 소문자 hex 32자(16바이트), 난수가 없으면 null
  const tok = (new Function("self", `${fnSrc("randomToken")}\nreturn randomToken;`)({ crypto: globalThis.crypto }) as () => string | null)();
  assert.match(tok ?? "", /^[0-9a-f]{32}$/);
  assert.equal((new Function("self", `${fnSrc("randomToken")}\nreturn randomToken;`)({}) as () => string | null)(), null);
  const click = sw.slice(sw.indexOf('addEventListener("notificationclick"'));
  assert.match(click, /caches\.open\(POKE_REPLY\)/);
  assert.match(click, /await purgeReplyTokens\(c\);/, "만들 때 만료 토큰을 지운다");
  assert.match(click, /c\.put\(replyTokenKey\(t\), new Response\(JSON\.stringify\(\{ kind, exp: Date\.now\(\) \+ 600000 \}\)\)\)/);
  assert.match(click, /url \+ \(url\.indexOf\("\?"\) >= 0 \? "&" : "\?"\) \+ "pokeReply=" \+ kind \+ "&t=" \+ t/);
  assert.match(click, /if \(!t\) return self\.clients\.openWindow\(url\);/, "토큰 없이 ?pokeReply 를 열지 않는다");
  assert.match(click, /if \(!\/\^\[a-z\]\{1,16\}\$\/\.test\(kind\)\) return;/, "알림 버튼 이름을 그대로 주소에 넣지 않는다");
  assert.ok(click.indexOf("c.put(") < click.lastIndexOf("openWindow("), "토큰을 넣은 뒤에 연다");
  assert.match(click, /c\.postMessage\(\{ type: "pokeReply", kind \}\)/, "열린 앱에는 토큰 없이 바로 전한다");
  assert.match(fnSrc("gc"), /purgeReplyTokens\(await caches\.open\(POKE_REPLY\)\)/);
  assert.match(raw("public/sw.js"), /src\/lib\/pokereply\.ts/, "계약 머리 주석이 앱 쪽 파일을 가리킨다");
  // 배포(activate)가 토큰 · 그림 캐시를 지우지 않는다
  assert.match(sw, /k !== CACHE && k !== THUMBS && k !== ART && k !== POKE_REPLY/);
});

test("SW ⓕ 공개 그림 · 서체는 stale-while-revalidate · 200 만 저장 · 상한", () => {
  const isArt = new Function("self", `${fnSrc("appRootUrl")}\n${fnSrc("isArt")}\nconst ART_DIRS = ${/const ART_DIRS = (\[[^\]]+\])/.exec(sw)![1]};\nreturn isArt;`)(self) as (u: URL) => boolean;
  assert.equal(isArt(new URL("https://doyeonkr.github.io/our-days/heroes/v3/fox-md.webp?v=1")), true);
  assert.equal(isArt(new URL("https://doyeonkr.github.io/our-days/fonts/Galmuri14.woff2")), true);
  assert.equal(isArt(new URL("https://doyeonkr.github.io/our-days/_next/static/chunks/a.js")), false);
  assert.equal(isArt(new URL("https://doyeonkr.github.io/weather/heroes/x.webp")), false, "같은 오리진의 다른 앱");
  assert.equal(isArt(new URL("https://x.supabase.co/our-days/heroes/x.webp")), false);
  const art = sw.slice(sw.indexOf("if (isArt(url)"), sw.indexOf("// 5)"));
  assert.match(art, /!request\.headers\.has\("range"\)/);
  assert.match(art, /res\.status === 200 && res\.type === "basic"/);
  assert.match(art, /trimCache\(ART, ART_MAX\)/);
  assert.match(fnSrc("gc"), /ART_MAX_BYTES/);
});

// ── 화면 공통 ────────────────────────────────────────────────────────────────
// 2026-11-06 화면 리뷰: 76px 을 따로 적던 것을 탭 바와 같은 변수(--gnb-top)로 바꿨다 — --vv-bottom 은 그 변수 안에 있다
test("업데이트 칩은 BottomNav 처럼 --vv-bottom 만큼 더 뜬다(삼성 인터넷 하단 주소창)", () => {
  assert.match(code("src/components/UpdateChip.tsx"), /bottom: "calc\(var\(--gnb-top, [^"]*var\(--vv-bottom, 0px\)[^"]*\) \+ 10px\)"/);
  assert.match(raw("src/app/globals.css"), /--gnb-top: calc\(var\(--vv-bottom, 0px\) \+ env\(safe-area-inset-bottom\)/);
});

test("옛 조각 새로고침 표시는 버전마다 — 한 번 쓴 탭이 다음 배포에서 멈추지 않는다", () => {
  const err = code("src/app/error.tsx");
  assert.match(err, /const CHUNK_KEY = `\$\{CHUNK_PREFIX\}\$\{APP_VERSION\}`/);
  assert.match(err, /process\.env\.NEXT_PUBLIC_APP_VERSION/);
  assert.match(err, /sessionStorage\.removeItem\(k\)/, "다른 버전 표시를 치우지 않는다");
});

test("서체 — public 한 벌 · 본문 서체 preload · swap (해시 사본 · block 금지)", () => {
  const layout = code("src/app/layout.tsx");
  assert.match(layout, /preload\(FONT_URL\("Galmuri14\.woff2"\), \{ as: "font", type: "font\/woff2", crossOrigin: "anonymous" \}\)/);
  assert.match(layout, /`\$\{BASE\}\/fonts\/\$\{f\}`/, "basePath 를 붙여야 GitHub Pages 에서 서체가 온다");
  assert.equal(layout.match(/font-display:swap/g)?.length, 3);
  const css = raw("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /@font-face/, "globals.css 의 @font-face 는 _next/static/media 에 두 번째 사본을 만든다");
  assert.doesNotMatch(css, /font-display:\s*block/);
  for (const f of ["Galmuri11.woff2", "Galmuri11-Bold.woff2", "Galmuri14.woff2"]) assert.ok(existsSync(join(root, "public/fonts", f)), f);
});

test("움직임 줄이기 안전망 — 빠졌던 넷 + 모든 반복 연출 한 바퀴", () => {
  const css = raw("src/app/globals.css");
  const net = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  for (const sel of [".crop-icon-shell.is-legendary::before", ".crop-legend-glint", ".merge-discover-art", ".fish-scoop-note i"]) assert.ok(net.includes(sel), sel);
  assert.match(net, /animation: none;/);
  assert.match(net, /\*,\s*\*::before,\s*\*::after \{ animation-iteration-count: 1 !important; \}/);
  assert.doesNotMatch(net, /animation-duration/, "길이까지 줄이면 한 번 도는 등장 연출이 안 보인다");
});

test("죽은 코드 — .app-bg(display:none 인데 렌더) · pixelmonster(테스트만 부르던 모듈)", () => {
  assert.doesNotMatch(code("src/app/layout.tsx"), /app-bg/);
  assert.doesNotMatch(raw("src/app/globals.css"), /\.app-bg|auraDrift|--au-/);
  assert.equal(existsSync(join(root, "src/lib/pixelmonster.ts")), false);
  assert.equal(existsSync(join(root, "src/lib/pixelmonster.test.ts")), false);
});

// ── CI ───────────────────────────────────────────────────────────────────────
test("CI — pages 동시 실행 그룹은 deploy job 에만 · 첫 화면 크기는 경고만", () => {
  const wf = raw(".github/workflows/deploy-pages.yml").replace(/#[^\n]*/g, "");
  assert.doesNotMatch(wf, /^concurrency:/m, "워크플로 전체 그룹이면 PR 테스트가 배포 줄에 선다");
  const deploy = wf.slice(wf.indexOf("\n  deploy:"));
  assert.match(deploy, /concurrency:\s*\n\s*group: pages\s*\n\s*cancel-in-progress: false/);
  const build = wf.slice(wf.indexOf("\n  build:"), wf.indexOf("\n  deploy:"));
  assert.match(build, /First-load size budget \(warn only\)\s*\n\s*continue-on-error: true\s*\n\s*run: node scripts\/first-load-size\.mjs out \d+ \|\| true/);
  const script = code("scripts/first-load-size.mjs");
  assert.match(script, /::warning/);
  assert.doesNotMatch(script, /process\.exit\(1\)|exitCode\s*=\s*1/, "경고만 — 빌드를 실패시키지 않는다");
});

// ── 엣지 함수 ────────────────────────────────────────────────────────────────
test("send-poke-push 는 내부 오류를 응답에 싣지 않는다(서버 로그에만)", () => {
  const fn = code("supabase/functions/send-poke-push/index.ts");
  assert.doesNotMatch(fn, /error: String\(e\)/);
  assert.match(fn, /console\.error\("send-poke-push failed", e\); return json\(\{ error: "internal error" \}, 500\)/);
});

test("조용시간 복사본 셋(send-poke-push · activity-nudge · daily-reminders)이 src/lib/quiet.ts 와 같은 식이다", () => {
  const body = (p: string) => {
    const s = code(p);
    const a = s.indexOf("function inQuietHours(");
    assert.ok(a >= 0, p);
    const b = s.indexOf("{", s.indexOf(")", s.indexOf("):", a)));
    let depth = 0;
    for (let i = b; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}" && --depth === 0) return s.slice(b, i + 1).replace(/\s+/g, " ").trim();
    }
    throw new Error(p);
  };
  const want = body("src/lib/quiet.ts");
  assert.match(want, /start < end \? hour >= start && hour < end : hour >= start \|\| hour < end/);
  for (const p of ["supabase/functions/send-poke-push/index.ts", "supabase/functions/activity-nudge/index.ts", "supabase/functions/daily-reminders/index.ts"]) {
    assert.equal(body(p), want, `${p}: 조용시간 식이 앱과 다르다 — 함께 고치고 함수를 다시 배포한다`);
  }
});

// ── DB (migrations/20261106070000_app_wide.sql) ─────────────────────────────
const MIG = "supabase/migrations/20261106070000_app_wide.sql";
const mig = sqlCode(MIG);

test("DB ① note_visit — UUID 모양만 · 하루 3000 에서 멈춘다 · anon 실행은 그대로", () => {
  const fn = mig.slice(mig.indexOf("create or replace function public.note_visit"), mig.indexOf("$$;", mig.indexOf("public.note_visit")));
  assert.match(fn, /security definer\s+set search_path = public/);
  assert.match(fn, /v_dev !~ '\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$' then return;/);
  assert.match(fn, />= 3000 then return;/);
  assert.match(mig, /grant execute on function public\.note_visit\(text\) to anon, authenticated;/);
  const ping = code("src/components/VisitPing.tsx");
  assert.match(ping, /!UUID\.test\(id\)/, "옛 기기의 UUID 아닌 id 를 그대로 보내면 영영 안 센다");
});

test("DB ② debug_logs 길이 제한 NOT VALID · 앱이 같은 값으로 자른다", () => {
  assert.match(mig, /add constraint debug_logs_len\s+check \(char_length\(tag\) <= 64\s+and \(detail is null or char_length\(detail\) <= 4096\)\s+and \(ua is null or char_length\(ua\) <= 512\)\) not valid;/);
  assert.match(mig, /drop constraint if exists debug_logs_len;/, "다시 돌리면 같은 이름 제약에서 멈춘다");
  // debug.ts 는 @/ 경로를 불러 node 로 직접 못 연다 — 값은 소스에서 읽는다
  assert.match(code("src/lib/debug.ts"), /DEBUG_LOG_LIMITS = \{ tag: 64, detail: 4096, ua: 512 \} as const/);
  assert.match(code("src/lib/debug.ts"), /safeSlice\(d, DEBUG_LOG_LIMITS\.detail\)/);
});

test("DB ③④ 로그 정리 — 크론만 부르고 · 나이로만 지우고 · migration 자체는 행을 지우지 않는다", () => {
  const fn = mig.slice(mig.indexOf("create or replace function private.purge_old_logs"), mig.indexOf("$$;", mig.indexOf("private.purge_old_logs")));
  assert.match(fn, /security definer\s+set search_path = ''/);
  assert.match(fn, /delete from public\.debug_logs where created_at < now\(\) - interval '30 days';/);
  assert.match(fn, /delete from public\.activity_events where created_at < now\(\) - interval '180 days';/);
  assert.match(fn, /cron\.job_run_details where end_time < now\(\) - interval ''14 days''[\s\S]*exception when others then/);
  assert.doesNotMatch(fn, /couple_photos|storage\.objects/, "사진 휴지통은 media-gc 몫이다");
  assert.match(mig, /revoke all on function private\.purge_old_logs\(\) from public, anon, authenticated;/);
  // 함수 본문 밖의 delete 없음(note_visit 의 90일 정리는 예전 함수 그대로 — 앱이 부를 때 돈다)
  const outside = mig.replace(/as \$\$[\s\S]*?\$\$;/g, "").replace(/\$q\$[\s\S]*?\$q\$/g, "");
  assert.doesNotMatch(outside, /\bdelete from\b|\btruncate\b|\bdrop table\b/i);
  // 크론: 이름으로 지우고 다시 · 비밀 없음 · 명령 본문을 읽지 않는다
  assert.match(mig, /if to_regclass\('cron\.job'\) is null then\s+return;/);
  assert.match(mig, /select cron\.unschedule\(jobid\) from cron\.job where jobname = 'purge-old-logs-daily'/);
  assert.match(mig, /select cron\.schedule\('purge-old-logs-daily', '30 18 \* \* \*', 'select private\.purge_old_logs\(\)'\)/);
  assert.doesNotMatch(mig, /select command|x-cron-secret|net\.http_post/i);
});

test("DB ⑤ 새 외래키 인덱스 셋", () => {
  assert.match(mig, /create index if not exists photo_comments_created_by_idx on public\.photo_comments \(created_by\);/);
  assert.match(mig, /create index if not exists photo_reactions_created_by_idx on public\.photo_reactions \(created_by\);/);
  assert.match(mig, /create index if not exists log_reactions_user_idx on public\.log_reactions \(user_id\);/);
});

test("DB — schema.sql 끝의 복사본이 migration 과 같다 · README 에 롤백", () => {
  const schema = raw("supabase/schema.sql");
  const m = raw(MIG).trim();
  assert.ok(schema.trimEnd().endsWith(m) || schema.indexOf(m) > schema.length / 2, "schema.sql 끝에 원문이 없다");
  assert.match(raw("README.md"), /select cron\.unschedule\('purge-old-logs-daily'\);/);
});

test("rls-verify 가 새 표들도 스냅샷한다", () => {
  const v = raw("scripts/rls-verify.mjs");
  const tables = /const TABLES = \[([\s\S]*?)\];/.exec(v)![1];
  for (const t of ["log_reactions", "photo_comments", "photo_reactions", "fish_catches", "merge_runs", "merge_scores", "daily_visits", "reminder_log"]) {
    assert.ok(tables.includes(`"${t}"`), t);
    assert.match(v, new RegExp(`insert into public\\.${t} \\(`), `${t}: 씨앗 행이 없으면 지문이 늘 빈 값이다`);
  }
});
