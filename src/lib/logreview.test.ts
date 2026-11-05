// 3초 로그 리뷰 lock [2026-11-06] — 고친 것 19가지 + 기능 7가지가 되돌아가지 않게.
// 소스 스캔은 주석을 먼저 지운다(README §10.5 — 설명문이 먼저 잡힌다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOG_MISSIONS,
  LOG_REACTIONS,
  applyLogStreakReward,
  archiveMonths,
  bothRecordedDays,
  canKeepMore,
  coverRect,
  dailyMission,
  expiryDaysLeft,
  expirySoon,
  firstFrameSrc,
  followToday,
  freezeLeftThisWeek,
  humanLogError,
  isNetworkishError,
  logAgeDays,
  logIsNew,
  logStreak,
  logStreakHearts,
  montagePlan,
  monthDays,
  monthLeadBlanks,
  nextReaction,
  reactionSummary,
  recordRetryPath,
  retakeWarning,
  slotOpenWithGrace,
  weekStartIso,
  withTimeout,
  yearsAgoDates,
} from "./logreview.ts";
import { extForMime, rawFallbackAllowed } from "./logvideo.ts";
import { cropFrame34 } from "./videoColor.ts";
import { LOG_VIDEO_KEEP_DAYS } from "./logretention.ts";
import { shiftDateIso } from "./logslot.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const sql = (p: string) => read(p).replace(/--[^\n]*/g, "");
const MIG = "supabase/migrations/20261106010000_log_review.sql";

const capture = code("src/components/LogCapture.tsx");
const todayLog = code("src/components/TodayLog.tsx");
const card = code("src/components/TodayLogCard.tsx");
const renderer = code("src/lib/videoColorRenderer.ts");
const couple = code("src/lib/couple.ts");

/* ── 1 · 카메라를 바꾸면 필터가 꺼지고 전면 영상이 거울 없이 저장되던 것 ── */
test("#1 미리보기 캔버스는 카메라 · 재연결마다 새로 달고, 미리보기 렌더러는 컨텍스트를 놓지 않는다", () => {
  assert.match(capture, /<canvas key=\{`\$\{facing\}-\$\{camTry\}`\}/, "같은 캔버스를 다시 쓰면 잃은 WebGL 컨텍스트가 돌아온다");
  assert.match(capture, /createColorRenderer\(canvas,\{loseOnDispose:false\}\)/);
  assert.match(renderer, /if\(loseOnDispose\)gl!\.getExtension\("WEBGL_lose_context"\)\?\.loseContext\(\)/);
  assert.match(renderer, /if\(gl\.isContextLost\(\)\)throw/, "잃은 컨텍스트를 받으면 컴파일 실패 대신 바로 알린다");
  // 파일 폴백의 임시 캔버스는 기본값(놓는다)
  assert.match(renderer, /renderer=createColorRenderer\(canvas\);/);
});

/* ── 2 · 업로드 재시도에 시간 제한 · 올리는 중 닫기 ── */
test("#2 withTimeout — 제한 시간에 거절하고, 늦게 끝난 결과는 치우게 넘긴다", async () => {
  const late: string[] = [];
  const slow = new Promise<string>((r) => setTimeout(() => r("c/log-late.mp4"), 40));
  await assert.rejects(withTimeout(slow, 5, (p) => late.push(p)), /upload-timeout/);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(late, ["c/log-late.mp4"], "늦게 올라간 파일을 지우지 않으면 고아가 된다");
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
});
test("#2 촬영기 — 모든 업로드 · 저장 기다림에 제한이 있고, 파일을 올리는 동안은 닫을 수 있다", () => {
  assert.match(capture, /videoPath = await withTimeout\(uploadRef\.current, LOG_UPLOAD_TIMEOUT_MS\)/);
  assert.match(capture, /videoPath = await withTimeout\(\s*\(services\?\.upload\?\?uploadLogVideo\)/, "보관한 영상으로 다시 올리기에 제한이 없었다");
  assert.match(capture, /const res = await withTimeout\([\s\S]*?LOG_SAVE_TIMEOUT_MS/);
  assert.match(capture, /const canClose = !recording && !processing && phase !== "save";/);
  assert.match(capture, /<CloseButton onClose=\{requestClose\} disabled=\{!canClose\} \/>/);
  assert.doesNotMatch(capture, /disabled=\{busy \|\| recording \|\| processing\}/, "busy 로 닫기를 막으면 전체 화면에 갇힌다");
  assert.match(capture, /function cancelPosting\(\)/);
  assert.match(capture, /if \(stopped\(\)\) \{ if \(videoPath\) discard\(videoPath\); return; \}/, "닫은 뒤 끝난 업로드는 저장하지 않고 치운다");
});

/* ── 3 · 오프라인 · 실패 뒤 닫으면 영상이 사라지던 것 · 영문 오류 ── */
test("#3 오류 문구 — 연결 문제는 '보관해 두고 다시 올린다', 슬롯 지남은 시간 안내, 영문 원문이 안 보인다", () => {
  assert.match(humanLogError(new Error("Failed to fetch")), /인터넷 연결이 끊겨/);
  assert.match(humanLogError(new Error("upload-timeout")), /너무 오래 걸려요/);
  assert.match(humanLogError(new Error("slot-closed"), "오전"), /오전 시간이 지나/);
  assert.match(humanLogError(new Error("new row violates row-level security policy"), "오후"), /오후 시간이 지나/);
  assert.ok(isNetworkishError("TypeError: Load failed"));
  assert.ok(!isNetworkishError("payload too large"));
  assert.doesNotMatch(couple, /"영상 업로드 실패: " \+/, "앞에 한국어를 붙이면 humanError 가 원문을 통과시킨다");
});
test("#3 슬롯 유예 — 서버 RLS 와 같은 5분", () => {
  // 11:59:30 KST 촬영, 12:03 KST 에 다시 올리기 → 오전 슬롯 유예 안
  assert.ok(slotOpenWithGrace("2026-11-06", "am", new Date("2026-11-06T03:03:00Z")));
  assert.ok(!slotOpenWithGrace("2026-11-06", "am", new Date("2026-11-06T03:06:00Z")), "5분이 지나면 서버가 거절한다");
  assert.ok(slotOpenWithGrace("2026-11-06", "pm", new Date("2026-11-06T03:06:00Z")));
});
test("#3 기기 보관함 — 올리기를 누르면 넣고, 성공하면 빼고, 연결이 돌아오면 다시 올린다", () => {
  assert.match(capture, /draftSaved = await putLogDraft\(/);
  assert.match(capture, /deleteLogDraft\(key\)/);
  assert.match(todayLog, /window\.addEventListener\("online", onOnline\)/);
  assert.match(todayLog, /if \(!slotOpenWithGrace\(d\.dateIso, d\.slot, new Date\(\)\)\) \{ stale\.push\(d\); continue; \}/);
  assert.match(todayLog, /downloadBlob\(d\.blob/, "슬롯이 지난 영상은 기기에 저장할 길을 준다");
  const draft = code("src/lib/logdraft.ts");
  assert.match(draft, /indexedDB\.open\(DB, 1\)/);
  assert.match(draft, /if \(typeof indexedDB === "undefined"\) return Promise\.resolve\(null\)/, "사생활 보호 창에서도 죽지 않는다");
});

/* ── 4 · 카메라 앱 폴백 — .mov 가 webm 이름으로 · 원본 그대로 ── */
test("#4 확장자 — quicktime 은 mov, 코덱 꼬리는 무시", () => {
  assert.equal(extForMime("video/quicktime"), "mov");
  assert.equal(extForMime("video/mp4;codecs=avc1"), "mp4");
  assert.equal(extForMime("video/webm;codecs=vp8"), "webm");
  assert.ok(rawFallbackAllowed("video/quicktime") && !rawFallbackAllowed("video/x-matroska"));
  // 버킷이 받는 형식과 같은 셋
  assert.match(read("supabase/schema.sql"), /'video\/mp4','video\/webm','video\/quicktime'/);
});
test("#4 폴백 파일도 3:4 · 3초로 다시 굽고, 굽지 못할 때만 보정 없는 원본을 쓴다", () => {
  assert.match(renderer, /const frame=cropFrame34\(video\.videoWidth,video\.videoHeight\)/);
  assert.match(renderer, /const limit=Math\.min\(video\.duration,LOG_VIDEO_MS\/1000\)/);
  assert.match(renderer, /if\(video\.currentTime>=limit\)\{stop\(\);return;\}/);
  assert.match(renderer, /if\(!canRecord\)\{if\(plain\)return raw\(\);/);
  assert.doesNotMatch(renderer, /if\(!hasVideoColor\(id,strength\)&&colorStrength\(beauty\)===0\)return \{blob:file/, "보정이 없다고 원본을 그대로 올리던 길");
});

/* ── 5 · 6 · 회전 · 비율 ── */
test("#6 cropFrame34 — 어떤 원본이 와도 3:4 · 최대 720×960 · 가운데 자르기", () => {
  for (const [w, h] of [[640, 640], [640, 480], [480, 640], [1920, 1080], [1080, 1920], [720, 960], [1440, 1920], [3024, 4032]]) {
    const f = cropFrame34(w, h);
    assert.ok(Math.abs(f.width / f.height - 0.75) < 0.01, `${w}×${h} → ${f.width}×${f.height}`);
    assert.ok(f.width <= 720 && f.height <= 960 && f.width % 2 === 0);
    const [x, y, sw, sh] = f.crop;
    assert.ok(Math.abs(x - (1 - sw) / 2) < 1e-9 && Math.abs(y - (1 - sh) / 2) < 1e-9, "가운데");
    assert.ok(Math.abs((w * sw) / (h * sh) - 0.75) < 1e-6, "자른 칸이 3:4");
  }
  assert.deepEqual(cropFrame34(1080, 1920).crop.slice(2), [1, 1080 / 1920 / 0.75]);
  assert.throws(() => cropFrame34(0, 10));
});
test("#5 #6 렌더러가 자른 칸을 셰이더에서 읽고, 회전(resize)하면 크기만 다시 맞춘다", () => {
  assert.match(renderer, /uniform vec4 crop;/);
  assert.match(renderer, /vec2 p=crop\.xy\+vec2\(mix\(uv\.x,1\.0-uv\.x,mirror\),uv\.y\)\*crop\.zw;/);
  assert.match(capture, /onResize=\{prepareColorPreview\}/);
  assert.match(capture, /if\(rendererRef\.current&&rendererCanvasRef\.current===canvas\)\{/, "회전마다 렌더러를 새로 만들면 컨텍스트를 다시 잡는다");
  assert.match(capture, /aspectRatio: \{ ideal: 3 \/ 4 \}/);
  assert.doesNotMatch(capture, /width: \{ ideal: 640 \}, height: \{ ideal: 640 \}/);
});

/* ── 7 · 첫 장면 ── */
test("#7 첫 장면 — 그림이 있으면 poster, 없으면 #t=0.001", () => {
  assert.equal(firstFrameSrc("https://x/a.mp4?token=1"), "https://x/a.mp4?token=1#t=0.001");
  assert.equal(firstFrameSrc("https://x/a.mp4?token=1", "https://x/p.webp"), "https://x/a.mp4?token=1");
  assert.equal(firstFrameSrc("https://x/a.mp4#t=2"), "https://x/a.mp4#t=2");
  const loop = code("src/components/LoopVideo.tsx");
  assert.match(loop, /src=\{playSrc\}\s+poster=\{poster \|\| undefined\}/);
  assert.match(capture, /posterRef\.current = \(services\?\.poster \?\? posterFromBlob\)\(blob\)/);
  assert.match(todayLog, /poster=\{log\.posterUrl\}/);
  assert.match(card, /poster=\{log\.posterUrl\}/);
  assert.match(couple, /const LOG_COLS_REVIEW = `\$\{LOG_COLS_BASE\},poster_path,keep`;/);
  assert.match(couple, /isMissingColumn\(res\.error\)/, "migration 전에 새 앱이 열려도 목록이 죽지 않는다");
});

/* ── 8 · 14일만 넘길 수 있던 것 ── */
test("#8 보관함 — 보관 기간이 닿는 달 + 평생 보관한 달, 달력 칸", () => {
  const months = archiveMonths("2026-11-06");
  assert.equal(months[0], "2026-11");
  assert.ok(months.includes(shiftDateIso("2026-11-06", -LOG_VIDEO_KEEP_DAYS).slice(0, 7)));
  assert.ok(archiveMonths("2026-11-06", ["2025-02-03"]).includes("2025-02"), "평생 보관한 옛 달도 보인다");
  assert.equal(monthDays("2026-02").length, 28);
  assert.equal(monthDays("2028-02").at(-1), "2028-02-29");
  assert.equal(monthLeadBlanks("2026-11"), 0); // 2026-11-01 은 일요일
  assert.match(todayLog, /disabled=\{dateIso <= shiftDateIso\(todayIso, -LOG_VIDEO_KEEP_DAYS\)\}/);
  assert.doesNotMatch(todayLog, /disabled=\{dateIso <= shiftDateIso\(todayIso, -\(KEEP_DAYS - 1\)\)\}/);
  assert.match(todayLog, /listCoupleLogs\(coupleId, dateIso, dateIso\)/, "받아 둔 범위 밖의 날은 그 날만 받는다");
  const archive = code("src/components/LogArchive.tsx");
  assert.match(archive, /listLogArchive\(coupleId, shiftDateIso\(todayIso, -LOG_VIDEO_KEEP_DAYS\)\)/);
  assert.match(couple, /q\.or\(`log_date\.gte\.\$\{sinceIso\},keep\.eq\.true`\)/);
});

/* ── 9 · 네이티브 카메라 권한 ── */
test("#9 앱 래퍼 — iOS 카메라 사용 문구 · 안드로이드 CAMERA 권한", () => {
  assert.match(read("ios/App/App/Info.plist"), /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]*카메라[^<]*<\/string>/);
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /<uses-permission android:name="android\.permission\.CAMERA" \/>/);
  assert.match(manifest, /<uses-feature android:name="android\.hardware\.camera" android:required="false" \/>/);
});

/* ── 10 · 화면을 벗어나도 켜져 있던 카메라 ── */
test("#10 안 찍는 동안 화면을 벗어나면 카메라를 끄고, 돌아오면 다시 연다", () => {
  assert.match(capture, /hiddenStopRef\.current = true;\s*streamRef\.current\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\);/);
  assert.match(capture, /hiddenStopRef\.current \|\|/);
  assert.match(capture, /hiddenStopRef\.current = false;\s*setCamTry\(\(n\) => n \+ 1\);/);
});

/* ── 11 · 정리 속도 ── */
test("#11 영상 정리 — 시간 예산 안에서 묶음을 되풀이하고, 편 수는 로그 id 로 센다", () => {
  const fn = code("supabase/functions/daily-reminders/index.ts");
  assert.match(fn, /const LOG_VIDEO_BUDGET_MS = 8_000;/);
  assert.match(fn, /for \(let round = 0; round < LOG_VIDEO_MAX_ROUNDS && Date\.now\(\) - started < LOG_VIDEO_BUDGET_MS; round \+= 1\)/);
  assert.match(fn, /if \(logs\.size < LOG_VIDEO_BATCH\) break;/);
  assert.match(fn, /new Set\(rows\.map\(\(row\) => row\.log_id \?\? row\.path\)\)/);
});

/* ── 12 · 다시 찍기 — NEW · 댓글 경고 ── */
test("#12 NEW 는 updated_at, 다시 찍기 전 댓글 경고", () => {
  assert.ok(logIsNew({ created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-06T01:00:00Z" }, "2026-11-05T00:00:00Z"), "다시 찍은 영상에 NEW");
  assert.ok(!logIsNew({ created_at: "2026-11-01T00:00:00Z", updated_at: null }, "2026-11-05T00:00:00Z"));
  assert.ok(logIsNew({ created_at: "2026-11-06T00:00:00Z" }, "2026-11-05T00:00:00Z"));
  assert.equal(retakeWarning(0), null);
  assert.match(retakeWarning(2) ?? "", /댓글 2개/);
  assert.match(todayLog, /const isNew = \(l: CoupleLog\) => logIsNew\(l, lastSeen\);/);
  assert.match(capture, /const warn = !clip && existing \? retakeWarning\(commentCount\) : null;/);
  assert.match(capture, /confirmDialog\(\{ message: "다시 찍을까요\?", detail: warn/);
  assert.match(todayLog, /commentCount=\{commentCountOf\(capture\.existing\)\}/);
});

/* ── 13 · 홈 CTA 중복 푸시 ── */
test("#13 '브이로그 도착' 푸시는 서버가 저장 직전에 다시 본 '새 로그'일 때만", () => {
  assert.match(couple, /return \{ created: !prevRow \};/);
  assert.match(capture, /if \(res\?\.created\) \{\s*sendEventPush\(/);
  assert.doesNotMatch(capture, /if \(!existing\) \{\s*sendEventPush/, "화면 캐시(existing)는 목록이 오기 전엔 null 이다");
});

/* ── 14 · 고아 파일 ── */
test("#14 늦게 끝난 업로드는 치우고, 남는 고아는 media-gc 몫으로 적어 둔다", () => {
  assert.match(capture, /LOG_UPLOAD_TIMEOUT_MS,\s*\(late\) => discard\(late\),/);
  assert.match(read("src/lib/couple.ts"), /media-gc 가 수거한다\(README §6\)/);
  assert.match(sql(MIG), /couple_logs_poster_follow/, "옛 앱이 다시 찍으면 옛 첫 장면이 남지 않게");
});

/* ── 15 · 댓글 전부 받기 ── */
test("#15 댓글 · 반응은 보이는 로그 id 로만(in()) 받고, 실시간 이벤트는 모아서 한 번", () => {
  assert.match(couple, /if \(logIds\) q = q\.in\("log_id", \[\.\.\.new Set\(logIds\)\]\.slice\(0, 300\)\);/);
  assert.match(couple, /if \(logIds && logIds\.length === 0\) return \[\];/);
  assert.match(todayLog, /listLogComments\(coupleId, ids\)/);
  assert.match(card, /listLogComments\(coupleId, ids\)/);
  assert.doesNotMatch(card, /listLogComments\(coupleId\)/);
  assert.doesNotMatch(todayLog, /listLogComments\(coupleId\)/);
  assert.match(todayLog, /t = setTimeout\(\(\) => loadRef\.current\(\), 300\);/);
  assert.match(card, /t = setTimeout\(\(\) => loadCommentsRef\.current\(\), 300\);/);
});

/* ── 16 · 자정 넘김 ── */
test("#16 자정을 넘기면 '방금 전의 오늘'을 보던 화면은 새 오늘로", () => {
  assert.equal(followToday("2026-11-05", "2026-11-05", "2026-11-06"), "2026-11-06");
  assert.equal(followToday("2026-11-01", "2026-11-05", "2026-11-06"), "2026-11-01", "지난 날을 보던 중이면 그대로");
  assert.match(todayLog, /setDateIso\(\(cur\) => followToday\(cur, prev, t\)\)/);
  assert.match(todayLog, /const tick = setInterval\(syncClock, 60_000\);/);
});

/* ── 17 · 보정 칸 접기 ── */
test("#17 보정 · 색감은 칩 한 줄, 펼친 패널은 하나", () => {
  assert.match(capture, /className="vlog-tune-chips"/);
  assert.match(capture, /\{panel==="beauty" && <VideoBeautyPicker/);
  assert.match(capture, /\{panel==="color" && <VideoFilterPicker/);
  assert.doesNotMatch(capture, /<VideoBeautyPicker value=\{beauty\}[^\n]*\/>\n\s*<button className="vlog-color-toggle"/, "보정 패널이 늘 펼쳐져 있던 배치");
  const css = read("src/app/globals.css");
  assert.match(css, /\.vlog-tune-chip \{[^}]*min-height: 44px/);
});

/* ── 18 · 접근성 · 촉감 · 되돌리기 ── */
test("#18 카운트다운은 읽히고, 셔터는 진동하고, 댓글 삭제는 5초 되돌리기", () => {
  assert.match(capture, /<span role="status" aria-live="polite" className="sr-only">/);
  assert.match(capture, /navigator\.vibrate\?\.\(ms\)/);
  assert.match(capture, /if\(!opts\.auto\)\{buzz\(10\);/);
  assert.match(todayLog, /undoTimerRef\.current = setTimeout\(commitDelete, UNDO_MS\);/);
  assert.match(todayLog, /onClick=\{undoDelete\}>되돌리기<\/button>/);
  assert.doesNotMatch(todayLog, /function removeComment\(id: string\) \{\s*const removed[^}]*deleteLogComment\(id\)/, "누르자마자 지우던 길");
});

/* ── 19 · 프레임 부족 자동 재시도 ── */
test("#19 프레임이 모자라면 한 번 저절로 다시 — 후면 + 보정 없음만 원본 스트림, 전면은 거울을 지켜 캔버스", () => {
  assert.equal(recordRetryPath("environment", false), "raw");
  assert.equal(recordRetryPath("environment", true), "canvas", "보정을 몰래 빼지 않는다");
  assert.equal(recordRetryPath("user", false), "canvas", "전면 원본은 거울 없이 저장된다(README 결정)");
  assert.match(capture, /const path=recordRetryPath\(facing,colored\);/);
  assert.match(capture, /startRecording\(\{raw:path==="raw",auto:true\}\)/);
  assert.match(capture, /if\(!retriedRef\.current\)\{\s*retriedRef\.current=true;/);
});

/* ── F1 · F3 한 달 필름 · 나란히 ── */
test("F1 한 달 필름 계획 — 날짜 · 오전/오후 · 나 먼저, 많으면 고르게 솎고 한 편을 짧게", () => {
  const clips = Array.from({ length: 124 }, (_, i) => ({
    id: `l${i}`, log_date: `2026-10-${String(1 + Math.floor(i / 4)).padStart(2, "0")}`, slot: (i % 4 < 2 ? "am" : "pm") as "am" | "pm",
    created_by: i % 2 ? "her" : "me", video_path: `c/${i}.mp4`,
  }));
  const plan = montagePlan(clips, "me");
  assert.equal(plan.clips.length, 60);
  assert.equal(plan.perClipMs, 1500);
  assert.equal(plan.clips[0].log_date, "2026-10-01");
  assert.ok(plan.clips.at(-1)!.log_date >= "2026-10-30", "월말이 빠지지 않는다");
  const small = montagePlan(clips.slice(0, 4), "me");
  assert.deepEqual(small.clips.map((c) => `${c.slot}:${c.created_by}`), ["am:me", "am:her", "pm:me", "pm:her"]);
  assert.equal(small.perClipMs, 3000);
  assert.equal(montagePlan([{ ...clips[0], video_path: null }], "me").clips.length, 0, "정리된 영상은 뺀다");
  assert.deepEqual(coverRect(1920, 1080, 540, 720).map((n) => Math.round(n)), [555, 0, 810, 1080]);
  const mont = code("src/lib/logmontage.ts");
  assert.match(mont, /v\.crossOrigin = "anonymous";/, "다른 출처 영상을 그리면 캔버스가 오염돼 녹화가 빈다");
  assert.match(mont, /rec\.start\(1000\);/);
  assert.match(mont, /videos\.forEach\(releaseVideo\);/, "iOS 메모리 — 다 쓴 칸은 바로 놓는다");
  assert.match(code("src/components/LogArchive.tsx"), /composeClips\(segments,/);
  assert.match(todayLog, /composeClips\(\[\{ sources: \[mine\.videoUrl, theirs\.videoUrl\] \}\], \{\s*\.\.\.SPLIT_SIZE/);
});

/* ── F2 만료 안내 ── */
test("F2 D-7 — 서버가 log_date < 오늘 − 90 에 떼어 내니 마지막 날은 91 − 나이, 별을 켠 영상은 없음", () => {
  const today = "2026-11-06";
  const at = (age: number) => ({ log_date: shiftDateIso(today, -age), video_path: "c/x.mp4" });
  assert.equal(logAgeDays(shiftDateIso(today, -83), today), 83);
  assert.equal(expiryDaysLeft(at(84), today), 7);
  assert.ok(expirySoon(at(84), today) && !expirySoon(at(83), today));
  assert.equal(expiryDaysLeft(at(90), today), 1, "90일째는 아직 남아 있다(오늘이 마지막)");
  assert.equal(expiryDaysLeft({ ...at(88), keep: true }, today), null);
  assert.equal(expiryDaysLeft({ ...at(88), video_path: null }, today), null);
});

/* ── F4 반응 ── */
test("F4 반응 — 한 사람이 클립마다 하나, 같은 걸 다시 누르면 지우기", () => {
  const rows = [{ log_id: "a", user_id: "me", emoji: "😂" }, { log_id: "a", user_id: "her", emoji: "😂" }, { log_id: "b", user_id: "her", emoji: "❤️" }];
  assert.deepEqual(reactionSummary(rows, "a", "me"), [{ emoji: "😂", count: 2, mine: true }]);
  assert.equal(nextReaction(rows, "a", "me", "😂"), null);
  assert.equal(nextReaction(rows, "a", "me", "🎉"), "🎉");
  const glyph = read("src/lib/pixelglyph.ts");
  for (const e of LOG_REACTIONS) assert.ok(glyph.includes(`"${e}": sprite(`), `${e} 에 도트가 없다(글자로 돌아간다)`);
  assert.match(todayLog, /<MoodGlyph e=\{e\} size=\{16\} \/>/);
  assert.match(todayLog, /setCapture\(\{ slot: curSlot, existing: myTodayLog, reply: true \}\)/, "3초 답장은 내 지금 슬롯을 연다");
});

/* ── F5 미션 ── */
test("F5 오늘의 미션 — KST 날짜로 정해지고 오전 · 오후가 다르며 한 바퀴를 고르게 돈다", () => {
  assert.equal(dailyMission("2026-11-06", "am"), dailyMission("2026-11-06", "am"));
  assert.notEqual(dailyMission("2026-11-06", "am"), dailyMission("2026-11-06", "pm"));
  const seen = new Set(Array.from({ length: LOG_MISSIONS.length }, (_, i) => dailyMission(shiftDateIso("2026-11-06", i), "am")));
  assert.equal(seen.size, LOG_MISSIONS.length);
  assert.match(todayLog, /오늘의 미션 · \{dailyMission\(dateIso, slot\)\}/);
});

/* ── F6 연속 기록 ── */
test("F6 '둘 다 남긴 날' — 오늘 아직이면 어제부터, 한 주 한 번 쉬어 가기, 하트는 하루 한 번", () => {
  const rows = [
    ...["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"].flatMap((d) => [{ log_date: d, created_by: "me" }, { log_date: d, created_by: "her" }]),
    { log_date: "2026-11-04", created_by: "me" }, // 혼자만 → 안 친다
  ];
  const days = bothRecordedDays(rows, "me");
  assert.ok(!days.has("2026-11-04"));
  assert.equal(weekStartIso("2026-11-06"), "2026-11-02"); // 금요일 → 월요일
  const s = logStreak(days, "2026-11-06");
  assert.deepEqual(s, { count: 4, freezes: ["2026-11-04"], doneToday: true });
  assert.ok(!freezeLeftThisWeek(s.freezes, "2026-11-06"));
  assert.equal(logStreak(days, "2026-11-07").count, 4, "오늘 아직 안 찍었다고 0 이 되지 않는다");
  assert.equal(logStreak(new Set(["2026-11-03", "2026-11-06"]), "2026-11-06").count, 1, "이틀 빠지면 쉬어 가기로도 못 잇는다");
  assert.equal(logStreakHearts(1), 0);
  assert.ok(logStreakHearts(100) <= 12, "하트는 작게");
  const st = { coins: 10 };
  const once = applyLogStreakReward(st, "2026-11-06", 4)!;
  assert.equal(once.coins, 16);
  assert.equal(applyLogStreakReward(once, "2026-11-06", 4), null, "같은 날 두 번 주지 않는다(두 기기가 동시에 시도해도)");
  assert.equal(st.coins, 10, "입력 상태를 바꾸지 않는다");
  assert.match(todayLog, /await saveIsland\(coupleId, row\.version, next/);
  assert.match(todayLog, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/, "버전 충돌은 한 번만 다시 — 고리 없음");
});

/* ── F8 평생 보관 · 1년 전 오늘 ── */
test("F8 평생 보관 — 한 사람 한 달 한 편, 1년 전 오늘 날짜", () => {
  const logs = [{ id: "a", log_date: "2026-10-03", created_by: "me", keep: true }, { id: "b", log_date: "2026-10-20", created_by: "her", keep: true }];
  assert.ok(!canKeepMore(logs, "me", { id: "c", log_date: "2026-10-09" }));
  assert.ok(canKeepMore(logs, "me", { id: "a", log_date: "2026-10-03" }), "켜 둔 그 영상 자신은 센다에 안 든다");
  assert.ok(canKeepMore(logs, "me", { id: "d", log_date: "2026-11-01" }));
  assert.ok(canKeepMore(logs, "her", { id: "e", log_date: "2026-09-30" }));
  assert.deepEqual(yearsAgoDates("2026-11-06", 2), ["2025-11-06", "2024-11-06"]);
  assert.deepEqual(yearsAgoDates("2028-02-29", 4), ["2024-02-29"], "2/29 는 윤년에만");
  assert.match(couple, /export async function listLogsOnDates\(coupleId: string, dates: readonly string\[\]\)/);
  assert.match(couple, /sb\.rpc\("set_log_keep", \{ p_log: logId, p_keep: keep \}\)/);
});

/* ── migration ── */
test("migration — 지우지 않고 · 다시 돌려도 같고 · schema.sql 끝에 그대로", () => {
  const raw = read(MIG).trim();
  const s = sql(MIG);
  assert.ok(read("supabase/schema.sql").includes(raw), "schema.sql 끝의 복사본이 migration 과 달라졌어요");
  // 통합(2026-11-06): 같은 날 migration 이 넷이라 schema.sql 끝에는 차례대로 붙는다 — 맨 끝이 아니라 '한 덩어리 그대로'만 본다
  assert.equal(read("supabase/schema.sql").split(raw).length - 1, 1, "schema.sql 에 한 번만, 한 덩어리로");
  assert.doesNotMatch(s, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\bdrop\s+column\b/i);
  assert.match(s, /add column if not exists poster_path text;/);
  assert.match(s, /add column if not exists keep boolean not null default false;/);
  assert.match(s, /create table if not exists public\.log_reactions/);
  for (const name of ["couple_logs_poster_follow", "couple_logs_keep_cap"]) {
    assert.match(s, new RegExp(`drop trigger if exists ${name} on public\\.couple_logs;`));
    assert.match(s, new RegExp(`revoke execute on function public\\.${name}\\(\\) from public, anon, authenticated;`), "트리거 전용 함수는 아무도 못 부른다");
  }
});
test("migration — 평생 보관은 서버가 한 달 한 편을 강제하고(PT409 · 잠금), 정리는 보관한 영상을 건너뛴다", () => {
  const s = sql(MIG);
  assert.match(s, /pg_advisory_xact_lock\(hashtextextended\('log_keep:'/);
  assert.match(s, /raise exception 'keep-cap' using errcode = 'PT409'/, "40001 은 PostgREST 가 스스로 재시도한다(README §11)");
  assert.match(s, /date_trunc\('month', l\.log_date\) = date_trunc\('month', new\.log_date\)/);
  // 정리 함수 — 서명 · 권한 · 바닥 · 상한 · skip locked 는 그대로, keep 만 건너뛴다
  assert.match(s, /create or replace function public\.expire_log_videos\(p_keep_days int, p_limit int\)\s+returns table \(log_id uuid, path text\)/);
  assert.match(s, /and not l\.keep/);
  assert.match(s, /auth\.role\(\)::text, ''\) <> 'service_role'/);
  assert.match(s, /p_keep_days < 30/);
  assert.match(s, /least\(greatest\(coalesce\(p_limit, 0\), 0\), 500\)/);
  assert.match(s, /for update of l skip locked/);
  assert.match(s, /revoke all on function public\.expire_log_videos\(int, int\) from public, anon, authenticated;/);
  assert.match(s, /grant execute on function public\.expire_log_videos\(int, int\) to service_role;/);
  // 보관 RPC — 본인 · 내 커플 · keep 한 칸, updated_at 은 안 건드린다
  assert.match(s, /where l\.id = p_log\s+and l\.created_by = v_uid\s+and l\.couple_id in \(select private\.my_couple_ids\(\)\);/);
  const rpc = s.slice(s.indexOf("function public.set_log_keep"), s.indexOf("grant execute on function public.set_log_keep"));
  assert.doesNotMatch(rpc, /updated_at/, "별만 켜도 상대 화면에 NEW 가 뜬다");
  assert.match(s, /revoke all on function public\.set_log_keep\(uuid, boolean\) from public, anon;/);
  assert.match(s, /grant execute on function public\.set_log_keep\(uuid, boolean\) to authenticated;/);
});
test("migration — 반응 표 정책은 집합 조회 · to authenticated · 같은 이름 drop 짝", () => {
  const stmts = sql(MIG).split(/;\s*\n/).map((x) => x.trim()).filter((x) => /^create policy /.test(x));
  assert.equal(stmts.length, 4);
  for (const p of stmts) {
    const name = /^create policy (\w+) on public\.(\w+)/.exec(p)![1];
    assert.match(p, /\bto authenticated\b/, name);
    assert.doesNotMatch(p, /is_couple_member\(/, name);
    assert.doesNotMatch(p.replaceAll("(select auth.uid())", ""), /auth\.uid\(\)/, name);
    assert.match(sql(MIG), new RegExp(`drop policy if exists ${name} on public\\.log_reactions;`));
  }
  assert.match(stmts.find((p) => p.startsWith("create policy lr_insert"))!, /couple_id = \(select l\.couple_id from public\.couple_logs l where l\.id = log_reactions\.log_id\)/, "남의 커플 로그에 반응을 못 단다");
});
