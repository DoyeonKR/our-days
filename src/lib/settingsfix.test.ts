// 설정 · 계정 다듬기 (2026-11-09) — README §10.22 의 lock. 소스 스캔은 주석을 먼저 지운다(§10.5).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inQuietHours } from "./quiet.ts";

const root = join(import.meta.dirname, "../..");
const code = (f: string) =>
  readFileSync(join(root, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/[^\n]*/g, "");
function body(src: string, name: string): string {
  const a = src.indexOf(name);
  assert.ok(a >= 0, `${name} 를 못 찾았다`);
  const open = src.slice(a).search(/\{\n/);
  assert.ok(open >= 0, name);
  let depth = 0;
  for (let i = a + open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(a, i + 1);
  }
  throw new Error(name);
}

test("① 로그아웃 — signOut 의 error 를 보고, 실패면 이 기기만(local) 다시 · 그것도 실패면 던진다(기기 데이터는 안 지움)", () => {
  const out = body(code("src/lib/auth.ts"), "export async function signOutAccount(");
  assert.match(out, /const \{ error \} = await sb\.auth\.signOut\(\);/);
  assert.match(out, /if \(error\) \{\s*const \{ error: localError \} = await sb\.auth\.signOut\(\{ scope: "local" \}\);/);
  // 오프라인이면 local 도 서버를 부르다 실패한다 — 저장된 세션을 직접 지우고, 못 지웠을 때만 던진다
  assert.match(out, /if \(localError && isAuthNetworkError\(localError\) && forgetStoredSession\(\)\) \{[\s\S]*?\} else if \(localError\)\s*throw new Error\(/);
  const ses = code("src/lib/session.ts");
  assert.match(ses, /export function forgetStoredSession\(\): boolean/);
  assert.match(ses, /for \(const k of \[key, `\$\{key\}-code-verifier`, `\$\{key\}-user`\]\) localStorage\.removeItem\(k\);/);
  assert.ok(out.indexOf("throw new Error(") < out.indexOf('localStorage.removeItem("ourdays:signedurls:v1")'), "던지는 게 기기 데이터 지우기보다 먼저");
  const ui = code("src/components/AccountSection.tsx");
  const logout = body(ui, "async function logout(");
  assert.match(logout, /if \(loggingOut \|\| busy\) return;/);
  assert.match(logout, /try \{\s*await signOutAccount\(\);\s*location\.reload\(\);\s*\} catch \(e\) \{\s*setErr\(/, "실패하면 새로고침하지 않고 알린다");
  assert.match(ui, /disabled=\{loggingOut\}/);
});

test("② 오프라인 ≠ 로그인 풀림 — getSession 오류면 알리지 않고 연결 오류로, 부팅은 저장된 세션으로", () => {
  const session = code("src/lib/session.ts");
  assert.match(session, /export const NETWORK_RETRY_MESSAGE = "연결을 확인해 주세요/);
  assert.match(session, /e\.name === "AuthRetryableFetchError"/);
  assert.match(session, /storageKey/, "저장소 키는 supabase-js 런타임 값을 읽는다");

  const ensure = body(code("src/lib/couple.ts"), "export async function ensureAnonAuth(");
  assert.match(ensure, /const \{ data: sessionData, error \} = await sb\.auth\.getSession\(\);/);
  const iErr = ensure.indexOf("if (error) throw new Error(NETWORK_RETRY_MESSAGE);");
  assert.ok(iErr > 0 && iErr < ensure.indexOf("announceSessionLost()"), "오류면 알리기 전에 연결 오류로 던진다");

  const info = body(code("src/lib/auth.ts"), "export async function getAuthInfo(");
  assert.match(info, /const \{ data, error \} = await sb\.auth\.getSession\(\);/);
  assert.match(info, /if \(error && isAuthNetworkError\(error\)\) \{\s*const stored = storedSessionUser\(\);\s*if \(!stored\) throw new AuthOfflineError\(\);/);
  assert.match(info, /offline: true/);

  const page = code("src/app/page.tsx");
  assert.match(page, /if \(e instanceof AuthOfflineError && attempt < 3\)/, "오프라인이면 로그인 화면 대신 다시 묻는다");
  assert.match(page, /window\.addEventListener\("online", retry\);/);
  assert.doesNotMatch(page, /getAuthInfo\(\)\s*\.then\([\s\S]{0,200}?\.catch\(\(\) => \{\}\)\s*\.finally\(\(\) => setAuthReady\(true\)\)/, "옛 모양: 오류를 삼키고 로그인 화면");
});

test("③ 프로필 저장 — 날짜는 바꿨을 때만, 쓰기마다 성공 즉시 로컬 반영", () => {
  const page = code("src/app/page.tsx");
  const save = page.slice(page.indexOf("async function saveProfile"), page.indexOf("function adoptStart"));
  assert.match(save, /async function saveProfile\(iso: string \| null, a: string\)/);
  assert.match(save, /if \(iso !== null\) \{\s*if \(coupleId\) await updateCoupleStartDate\(coupleId, iso\);\s*startStored = safeSet\(LS\.start, iso\);\s*setStart\(iso\);/);
  assert.ok(save.indexOf("setStart(iso)") < save.indexOf("updateMyMemberProfile"), "날짜 반영이 애칭 쓰기보다 먼저 — 애칭이 실패해도 어긋나지 않게");
  const settings = page.slice(page.indexOf("function Settings("));
  assert.match(settings, /const \[openedStart\] = useState\(start\);/);
  assert.match(settings, /const dateChanged = date !== openedStart && date !== start;/);
  assert.match(settings, /await onSave\(dateChanged \? date : null, a\.trim\(\)\)/);
});

test("④ 개인정보 안내 — 자동 정리 기간 · FCM · 변경일", () => {
  const p = code("src/app/privacy/page.tsx");
  assert.doesNotMatch(p, /날짜 제한으로 자동 삭제하지 않습니다/, "옛 문구는 사실이 아니다");
  assert.match(p, /3초 로그 영상은 90일/);
  assert.match(p, /휴지통으로 옮긴 사진은 30일/);
  assert.match(p, /오류 진단 기록은 30일, 활동 알림 기록은 180일, 모험 대전 기록은 60일/);
  assert.match(p, /Google Firebase Cloud Messaging\(FCM\)/);
  assert.match(p, /Web Push/);
  assert.match(p, /마지막 변경 2026년 11월 9일/);
  assert.match(code("src/lib/logretention.ts"), /LOG_VIDEO_KEEP_DAYS = 90;/, "안내의 90일과 같은 숫자");
});

test("⑤ 테마 — 저장 오류를 삼키지 않고, 불러오기 실패면 이유 + 다시 불러오기", () => {
  const t = code("src/components/ThemePicker.tsx");
  assert.doesNotMatch(t, /\.catch\(\(\)\s*=>\s*\{\s*\}\)/);
  assert.match(t, /shared\.save\(\{theme:id\},shared\.record\.version\)\.catch\(\(e:unknown\)=>setErr\(/);
  assert.match(t, /const problem = err \|\| shared\?\.error \|\| null;/);
  assert.match(t, /<p role="alert"[\s\S]*?onClick=\{retry\}[\s\S]*?다시 불러오기/);
  assert.match(t, /shared\?\.refresh\(\);/);
  assert.match(code("src/components/SharedAppearanceProvider.tsx"), /refresh:\(\)=>\{setSaveError\(""\);refreshRef\.current\(\);\}/);
});

test("⑥ 기분 한 줄 — 저장 실패를 role=alert 한 줄로", () => {
  const m = code("src/components/MoodLine.tsx");
  assert.doesNotMatch(body(m, "async function pick("), /catch \{\s*\}/);
  assert.match(body(m, "async function pick("), /catch \(error\) \{[\s\S]*?setErr\(/);
  assert.match(body(m, "async function saveNote("), /catch \(error\) \{[\s\S]*?setErr\(/);
  assert.match(m, /\{err && \(\s*<p role="alert"/);
});

test("⑦ 조용시간 — 시작 = 끝은 고를 수 없다(quiet.ts 는 그대로)", () => {
  assert.equal(inQuietHours(3, 5, 5), false, "같으면 서버는 조용시간이 없다고 본다 — 이 규칙은 엣지 함수 복사본과 같아서 안 바꾼다");
  const n = code("src/components/NotifySettings.tsx");
  assert.match(n, /if \(h !== endH\) update\(\{ \.\.\.p, quiet_start: h \}\);/);
  assert.match(n, /if \(h !== startH\) update\(\{ \.\.\.p, quiet_end: h \}\);/);
  assert.match(n, /disabled=\{h === endH && h !== startH\}/);
  assert.match(n, /disabled=\{h === startH && h !== endH\}/);
  assert.match(n, /\{quietSame && \(\s*<p role="alert"/);
});

test("⑧ 문제 해결 — 앱 안이면 앱 알림 상태, 실패는 빈 칸 대신 오류", () => {
  const d = code("src/components/Diagnostics.tsx");
  assert.match(d, /import \{ nativePlatform \} from "@\/lib\/nativeplatform";/);
  assert.match(d, /if \(where === "android"\) \{\s*const \{ nativePushStatus \} = await import\("@\/lib\/nativepush"\);/, "nativepush 는 앱에서만 받는다");
  assert.match(d, /\} else if \(!where\) \{\s*setDiag\(await runDiagnostics\(\)\);/, "웹 푸시 점검은 브라우저에서만");
  assert.match(d, /platform === "ios"/);
  assert.match(body(d, "async function refresh("), /\} catch \(e\) \{\s*setErr\(/);
  assert.match(d, /\{err && \(\s*<p role="alert"/);
});

test("⑨ 홈 문구 꾸미기 — 스크롤 잠금은 매니저가(fixed inset-0), body overflow 를 직접 만지지 않는다", () => {
  const e = code("src/components/HomeAppearanceEditor.tsx");
  assert.doesNotMatch(e, /document\.body\.style\.overflow/);
  assert.match(e, /className="home-appearance-backdrop fixed inset-0"/);
  assert.match(code("src/lib/scrollLock.ts"), /OVERLAY_SELECTOR = "\.fixed\.inset-0:not\(\.pointer-events-none\)"/);
});

test("⑩ 테스트 알림 — 서버에 구독이 없으면 다시 등록하고 한 번만 다시, 버튼은 보내는 동안 막는다", () => {
  const fn = body(code("src/lib/push.ts"), "export async function sendTestPush(");
  assert.match(fn, /if \(reason === "no self subscription"\) \{\s*if \(retried\) return /);
  assert.match(fn, /await enablePush\(\);/);
  assert.match(fn, /return sendTestPush\(opts, true\);/);
  assert.doesNotMatch(fn, /먼저 '백그라운드 푸시 켜기'를 해주세요/, "옛 막다른 길 문구");
  const ps = code("src/components/PushSettings.tsx");
  assert.match(body(ps, "async function test("), /if \(busy\) return;\s*setBusy\(true\);/);
  assert.match(ps, /onClick=\{\(\) => void test\(\)\}\s*disabled=\{busy\}/);
});

test("⑪ 계정 칸 접근성 — 입력칸 aria-label, 오류는 alert · 소식은 status", () => {
  const a = code("src/components/AccountSection.tsx");
  for (const label of ["현재 비밀번호", "새 비밀번호", "새 비밀번호 확인", "계정 삭제 확인용 현재 비밀번호", "확인을 위해 삭제 입력"])
    assert.ok(a.includes(`aria-label="${label}"`), label);
  assert.match(a, /\{msg && <p role="status"/);
  assert.match(a, /\{err && <p role="alert"/);
});

test("⑫ 로그인 화면 — 진짜 form · submit 버튼 · autocomplete · 개인정보 링크(basePath)", () => {
  const g = code("src/components/AuthGate.tsx");
  assert.match(g, /<form\s+noValidate\s+onSubmit=\{\(e\) => \{\s*e\.preventDefault\(\);/);
  assert.match(g, /type="submit"/);
  assert.doesNotMatch(g, /onKeyDown=/, "Enter 는 form 이 처리한다");
  assert.match(g, /autoComplete="email"/);
  assert.match(g, /autoComplete=\{mode === "signup" \? "new-password" : "current-password"\}/);
  assert.match(g, /href=\{`\$\{BASE\}\/privacy\/`\}/);
  assert.match(g, /import \{ BASE \} from "@\/lib\/base";/);
  assert.ok(g.indexOf("계정이 없어요 · 회원가입") < g.indexOf("/privacy/"), "가입 버튼 아래");
});

test("⑬ 계정 칸 — 옛 익명 '계정 저장 · 다른 기기 로그인'을 걷고, 못 불러오면 다시 시도", () => {
  const a = code("src/components/AccountSection.tsx");
  assert.doesNotMatch(a, /계정 저장|다른 기기 로그인|linkEmail|mode === "save"/);
  assert.match(a, /const \[infoState, setInfoState\] = useState<"loading" \| "ready" \| "error">\("loading"\);/);
  assert.match(a, /\.catch\(\(\) => setInfoState\("error"\)\)/);
  assert.match(a, /계정 정보를 불러오는 중…/);
  assert.match(a, /onClick=\{loadInfo\}/);
});
