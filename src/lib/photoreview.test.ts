// 사진첩 · 추억 리뷰 회귀 lock (2026-11-06). 항목 번호는 리뷰 표의 번호다.
// 소스 스캔은 주석을 먼저 지운다(이 레포는 '왜'를 주석에 길게 적어 설명문이 먼저 잡힌다 — README §10.5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { classifyImage, exifToIso, fitSize, pickTakenAt, readExifDate, PHOTO_ERRORS, toHex } from "./image.ts";
import { URL_CACHE_CAP, URL_MIN_LEFT_MS, isFreshUrlEntry, isThumbPath, ttlForPath, THUMB_TTL_S, MEDIA_TTL_S } from "./urlcache.ts";
import {
  bestPhotos, clampPan, countByDay, dayLabel, eventAlbums, formatBytes, groupByDay, hungToastText, keysetFilter, kstDay,
  kstDayRange, neighborIds, nextAfterRemove, pinchScale, shortDate, storageSummary, trashDaysLeft, uploadSummary,
} from "./photoalbum.ts";
import { dateInTimezone, groupMemoriesByDate, kstMonthRange, monthlyRecap, onThisDayMemories, photoShotAt, recapFromStats, teaserLabel, type MemoryItem } from "./memories.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
const sqlStrip = (s: string) => s.replace(/--[^\n]*/g, "");
const couple = strip(read("src/lib/couple.ts"));
const album = strip(read("src/components/PhotoAlbum.tsx"));
const viewer = strip(read("src/components/PhotoViewer.tsx"));
const recapUi = strip(read("src/components/MemoriesRecap.tsx"));
const teaser = strip(read("src/components/MemoryTeaser.tsx"));
const imageSrc = strip(read("src/lib/image.ts"));
const MIG_FILE = "supabase/migrations/20261106020000_photo_review.sql";
const migRaw = read(MIG_FILE).trim();
const mig = sqlStrip(migRaw);
const fnBody = (src: string, name: string) => {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, `${name} 가 없다`);
  const rest = src.slice(i + 10);
  const j = rest.indexOf("\nexport ");
  return j >= 0 ? rest.slice(0, j) : rest;
};

/* ── 1) 행 상한 1000 — 목록은 키셋, 리캡은 서버 집계, 통째 select 금지 ── */
test("1 사진첩은 키셋 페이지 · 전체 스냅샷(listMemorySnapshot)은 없다 · 리캡은 서버 집계", () => {
  const page = fnBody(couple, "listPhotosPage");
  assert.match(page, /\.limit\(limit\)/);
  assert.match(page, /keysetFilter\(cursor/);
  assert.match(page, /\.order\("id", \{ ascending: false \}\)/, "같은 시각의 사진을 id 로 가르지 않으면 페이지 경계에서 빠진다");
  assert.ok(!couple.includes("listMemorySnapshot"), "네 표를 범위 없이 받는 스냅샷이 돌아왔다");
  assert.match(fnBody(couple, "getMonthRecap"), /rpc\("memory_month_stats"/);
  assert.match(fnBody(couple, "listPhotosInRange"), /\.range\(offset, offset \+ PAGE - 1\)/);
  assert.match(fnBody(couple, "listPhotoShotTimes"), /\.range\(offset, offset \+ PAGE - 1\)/);
  assert.ok(!recapUi.includes("listMemorySnapshot"));
  assert.equal(keysetFilter({ shotAt: "2025-03-02T05:00:00.000Z", id: "abc" }), 'shot_at.lt."2025-03-02T05:00:00.000Z",and(shot_at.eq."2025-03-02T05:00:00.000Z",id.lt.abc)');
});

test("1 월간 집계 함수 — invoker(부른 사람의 RLS) · KST 달 범위 · 휴지통 제외 · 찍은 시각", () => {
  const fn = mig.slice(mig.indexOf("create or replace function public.memory_month_stats"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  assert.match(body, /security invoker/);
  assert.match(body, /at time zone 'Asia\/Seoul'/);
  assert.match(body, /p\.deleted_at is null and p\.shot_at >= r\.t0/);
  const r = recapFromStats("2026-10", { diaries: 3, photos: 5, logs: 2, answers: "1", active_days: 4, moods: [{ emoji: "😊", count: 2 }, { emoji: "🥰", count: 3 }, { bad: 1 }] });
  assert.deepEqual([r.diaries, r.photos, r.logs, r.answers, r.activeDays, r.total, r.topMood], [3, 5, 2, 1, 4, 11, "🥰"]);
  assert.deepEqual(recapFromStats("2026-10", null).total, 0, "모양이 깨진 응답도 던지지 않는다");
  assert.deepEqual(kstMonthRange("2026-12"), ["2026-11-30T15:00:00Z", "2026-12-31T15:00:00Z"]);
});

/* ── 2) 서명 URL 만료 — 원본은 보기에서 서명, 깨지면 한 번 다시 서명, 여유 5분 ── */
test("2 원본은 목록에서 서명하지 않고 보기에서 · 타일과 보기 모두 onError 재서명", () => {
  const rows = couple.slice(couple.indexOf("async function rowsToPhotos"), couple.indexOf("export const PHOTO_PAGE"));
  assert.match(rows, /signPaths\(rows\.map\(\(r\) => r\.thumb_path \|\| r\.storage_path\)\)/, "목록이 원본까지 서명한다");
  assert.match(viewer, /signPhotoOriginals\(need\)/);
  assert.match(viewer, /onError=\{\(\) => void fixOriginal\(photo\)\}/);
  assert.match(viewer, /onError=\{\(\) => void fixThumb\(photo\)\}/);
  assert.match(album, /onError=\{\(\) => void fixThumb\(p\)\}/);
  for (const src of [album, viewer]) assert.match(src, /resignPaths\(\[/);
  assert.match(viewer, /retried\.current\.has\(key\)/, "한 번만 다시 서명해야 깨진 파일에서 무한 반복하지 않는다");
  assert.equal(URL_MIN_LEFT_MS, 5 * 60_000);
  assert.equal(isFreshUrlEntry({ url: "u", exp: 1_000_000 + 4 * 60_000 }, 1_000_000), false, "4분 남은 URL 은 다시 서명한다");
});

/* ── 3) · 4) · 18) 이미지 준비 — 원본 폴백 없음 · 한 번 디코드 · GIF 썸네일은 정지 그림 ── */
test("3 형식 판별 · 한국어 문구(HEIC 안내) · 원본을 그대로 올리는 길이 없다", () => {
  assert.equal(classifyImage("image/heic", "a.HEIC"), "heic");
  assert.equal(classifyImage("", "IMG_1.heif"), "heic");
  assert.equal(classifyImage("", "x.jpg"), "jpeg");
  assert.equal(classifyImage("image/gif", "a.gif"), "gif");
  assert.equal(classifyImage("image/tiff", "a.tif"), "unsupported");
  assert.equal(classifyImage("application/pdf", "a.pdf"), "unsupported");
  assert.match(PHOTO_ERRORS.heic, /높은 호환성/);
  for (const m of Object.values(PHOTO_ERRORS)) assert.match(m, /[가-힣]/);
  const prep = imageSrc.slice(imageSrc.indexOf("export async function preparePhoto"), imageSrc.indexOf("export async function renderImage"));
  assert.ok(!/return file\b/.test(prep), "준비에 실패하면 원본을 돌려준다(EXIF · GPS 가 그대로 올라간다)");
  assert.match(prep, /throw new PhotoPrepError\(kind === "heic" \? PHOTO_ERRORS\.heic : PHOTO_ERRORS\.decode\)/);
  const up = fnBody(couple, "uploadPhoto");
  assert.match(up, /await preparePhoto\(file\)/);
  assert.ok(!/renderImage\(/.test(up), "사진첩 업로드가 원본 폴백이 있는 renderImage 를 쓴다");
  assert.match(up, /storageError\(upErr\.message\)/, "버킷의 영어 원문이 그대로 뜬다");
});

test("4 · 18 한 번만 디코드하고 썸네일은 1280 캔버스에서 · GIF 썸네일도 캔버스(첫 장면)", () => {
  const prep = imageSrc.slice(imageSrc.indexOf("export async function preparePhoto"), imageSrc.indexOf("export async function renderImage"));
  assert.equal((prep.match(/await decode\(file\)/g) ?? []).length, 1, "같은 파일을 두 번 디코드한다(48MP ≈ 190MB × 2)");
  assert.match(prep, /thumbCanvas = draw\(fullCanvas,/);
  assert.match(prep, /const thumb = await encode\(thumbCanvas/, "썸네일이 원본 파일이면 그리드가 25MB 를 받는다");
  assert.match(prep, /kind === "gif" \? file : await encode\(fullCanvas/);
  assert.ok(prep.indexOf("decoded.close()") < prep.indexOf("const thumb = await encode"), "큰 비트맵을 썸네일을 만들기 전에 놓아 주지 않는다");
  assert.deepEqual(fitSize(8000, 6000, 1280), { w: 1280, h: 960 });
  assert.deepEqual(fitSize(100, 50, 1280), { w: 100, h: 50 }, "작은 사진은 키우지 않는다");
});

/* ── 5) 여러 장 올리기 ── */
test("5 실패해도 다음 장으로 · 'N장 중 M장' · 진행 N/M · 올리는 동안 실시간 재조회 미룸", () => {
  const on = album.slice(album.indexOf("async function onFiles"), album.indexOf("async function openTrash"));
  // 장마다 try — 반복을 감싼 바깥 try/finally(2026-11-09 바쁨 셈 풀기, shellfix.test)는 별개라 반복 뒤의 첫 try 를 본다
  const loop = on.indexOf("for (let i = 0");
  assert.ok(loop >= 0 && on.indexOf("try {", loop) > loop && on.indexOf("catch (e)", loop) > on.indexOf("try {", loop), "try 가 반복 밖에 있으면 첫 실패에서 멈춘다");
  assert.match(on, /outcome\.failed\.push/);
  assert.match(on, /humanError\(/);
  assert.match(on, /uploadSummary\(list\.length, outcome\)/);
  assert.match(album, /올리는 중 \$\{upload\.done\}\/\$\{upload\.total\}/);
  assert.match(album, /if \(uploading\.current\) \{\s*pendingRefresh\.current = true;/);
  assert.match(album, /setTimeout\(\(\) => void refresh\(\), 700\)/);
  assert.deepEqual(uploadSummary(10, { ok: 9, duplicate: 0, failed: [{ name: "a", message: "열지 못했어요" }] }), { text: "10장 중 9장을 올렸어요 · 열지 못했어요", tone: "warn" });
  assert.equal(uploadSummary(3, { ok: 2, duplicate: 1, failed: [] }).text, "3장 중 2장을 올렸어요 · 이미 있는 사진 1장은 건너뛰었어요");
  assert.equal(uploadSummary(2, { ok: 0, duplicate: 0, failed: [{ name: "a", message: "x" }, { name: "b", message: "x" }] }).tone, "error");
  assert.equal(uploadSummary(1, { ok: 1, duplicate: 0, failed: [] }).text, "사진을 올렸어요");
});

test("5 사진 활동은 같은 사람 10분에 한 줄(트리거) — 상대 활동함에 N줄 쌓이지 않게", () => {
  assert.match(mig, /create or replace function public\.capture_photo_activity\(\)/);
  assert.match(mig, /interval '10 minutes'/);
  assert.match(mig, /revoke execute on function public\.capture_photo_activity\(\) from public, anon, authenticated;/);
  assert.match(mig, /create trigger activity_on_photo after insert on public\.couple_photos\s+for each row execute function public\.capture_photo_activity\(\);/);
  assert.match(mig, /ourdays\.suppress_activity/, "rls-verify 시드 · 대량 이관의 끄기 스위치를 지켜야 한다");
});

/* ── 6) 찍은 시각 ── */
function tiffWithDate(dt: string, off: string | null, le = true): Uint8Array {
  const b = new Uint8Array(200);
  const v = new DataView(b.buffer);
  const E = [0x45, 0x78, 0x69, 0x66, 0, 0];
  E.forEach((x, i) => (b[i + 4] = x)); // 앞 4바이트는 쓰레기(HEIC 항목 머리 같은 것)
  const t = 10;
  const u16 = (o: number, x: number) => v.setUint16(t + o, x, le);
  const u32 = (o: number, x: number) => v.setUint32(t + o, x, le);
  b.set(le ? [0x49, 0x49, 0x2a, 0] : [0x4d, 0x4d, 0, 0x2a], t);
  u32(4, 8);
  u16(8, 1); u16(10, 0x8769); u16(12, 4); u32(14, 1); u32(18, 26); u32(22, 0);
  const n = off ? 2 : 1;
  u16(26, n);
  u16(28, 0x9003); u16(30, 2); u32(32, dt.length + 1); u32(36, 60);
  if (off) { u16(40, 0x9011); u16(42, 2); u32(44, off.length + 1); u32(48, 90); }
  for (let i = 0; i < dt.length; i++) b[t + 60 + i] = dt.charCodeAt(i);
  if (off) for (let i = 0; i < off.length; i++) b[t + 90 + i] = off.charCodeAt(i);
  return b;
}

test("6 EXIF 찍은 시각 — 작은 파서(II/MM) · 오프셋 · 없으면 KST · 깨진 값은 null", () => {
  assert.deepEqual(readExifDate(tiffWithDate("2025:03:02 14:30:00", "+09:00")), { dateTime: "2025:03:02 14:30:00", offset: "+09:00" });
  assert.deepEqual(readExifDate(tiffWithDate("2024:12:31 23:59:59", null, false)).dateTime, "2024:12:31 23:59:59");
  assert.equal(exifToIso("2025:03:02 14:30:00", "+09:00"), "2025-03-02T05:30:00.000Z");
  assert.equal(exifToIso("2025:03:02 14:30:00", null), "2025-03-02T05:30:00.000Z", "오프셋이 없으면 KST");
  assert.equal(exifToIso("2025:03:02 14:30:00", "-05:00"), "2025-03-02T19:30:00.000Z");
  assert.equal(exifToIso("2025:02:31 10:00:00", null), null);
  assert.equal(exifToIso("0000:00:00 00:00:00", null), null);
  assert.deepEqual(readExifDate(new Uint8Array([1, 2, 3])), { dateTime: null, offset: null });
  const junk = new Uint8Array(5000).map((_, i) => (i * 37) % 251);
  assert.deepEqual(readExifDate(junk), { dateTime: null, offset: null }, "아무 바이트에도 던지지 않는다");
  const now = Date.UTC(2026, 10, 6);
  assert.equal(pickTakenAt("2025-03-02T05:30:00.000Z", now, now), "2025-03-02T05:30:00.000Z");
  assert.equal(pickTakenAt(null, Date.UTC(2025, 0, 1), now), "2025-01-01T00:00:00.000Z", "EXIF 가 없으면 파일 수정 시각");
  assert.equal(pickTakenAt(null, now - 30_000, now), null, "방금 만든 사본의 수정 시각은 찍은 시각이 아니다");
  assert.equal(pickTakenAt("2030-01-01T00:00:00.000Z", null, now), null, "미래 값");
  assert.equal(toHex(new Uint8Array([0, 15, 255]).buffer), "000fff");
});

test("6 추억 · 리캡 · 정렬은 coalesce(taken_at, created_at) — 옛 여행 사진이 올린 날에 몰리지 않는다", () => {
  assert.match(mig, /add column if not exists taken_at timestamptz;/);
  assert.match(mig, /add column if not exists shot_at timestamptz\s+generated always as \(coalesce\(taken_at, created_at\)\) stored;/);
  const snap = { diaries: [], logs: [], answers: [], photos: [{ id: "p", storage_path: "c/1.webp", thumb_path: null, created_by: "u", created_at: "2026-11-06T01:00:00Z", taken_at: "2025-11-06T03:00:00Z" }] };
  const items = onThisDayMemories(snap, "2026-11-06");
  assert.equal(items.length, 1);
  assert.equal(items[0].yearsAgo, 1);
  assert.equal(items[0].photoId, "p");
  assert.equal(monthlyRecap(snap, "2025-11").photos, 1);
  assert.equal(monthlyRecap(snap, "2026-11").photos, 0, "올린 달이 아니라 찍은 달로 센다");
  assert.equal(photoShotAt({ created_at: "a", taken_at: null }), "a");
  assert.match(fnBody(couple, "listOnThisDaySnapshot"), /const col = v2 \? "shot_at" : "created_at"/);
});

/* ── 7) · F2) 휴지통 ── */
test("7 지우기 = 30일 휴지통 · 되살리기 · 누가 올렸는지 말한다 · 모든 목록이 휴지통을 뺀다", () => {
  assert.match(mig, /add column if not exists deleted_at timestamptz;/);
  for (const fn of ["photo_trash", "photo_restore"]) {
    const body = mig.slice(mig.indexOf(`function public.${fn}(`));
    assert.match(body.slice(0, body.indexOf("$$;")), /security definer\s+set search_path = ''/);
    assert.match(body.slice(0, body.indexOf("$$;")), /p\.couple_id in \(select private\.my_couple_ids\(\)\)/);
  }
  assert.match(mig, /p\.deleted_at > now\(\) - interval '30 days'/);
  assert.match(mig, /exception when unique_violation then\s+raise exception '같은 사진이 이미 사진첩에 있어요\.' using errcode = 'PT409'/);
  const trash = mig.slice(mig.indexOf("function public.photo_trash("));
  assert.match(trash.slice(0, trash.indexOf("$$;")), /cover_path = case when c\.cover_path = any\(v_paths\) then null/, "휴지통 사진이 대표 · 빨랫줄 자리를 계속 차지한다");
  assert.match(album, /상대가 올린 사진이에요\. 휴지통으로 옮길까요\?/);
  assert.match(album, /await trashPhoto\(p\.id\)/);
  assert.ok(!/await deletePhoto\(p\.id, p\.path, p\.thumbPath\);\s*\n\s*showToast\(\{\s*text: "휴지통/.test(album));
  for (const name of ["listPhotosPage", "listRecentPhotos", "photosByPaths", "listPhotosInRange", "listPhotoShotTimes"])
    assert.match(fnBody(couple, name), /if \(v2\) q = q\.is\("deleted_at", null\)/, `${name} 가 휴지통 사진을 보여 준다`);
  assert.match(fnBody(couple, "listOnThisDaySnapshot"), /q\.is\("deleted_at", null\)/);
  const gc = read("supabase/functions/media-gc/index.ts");
  assert.match(gc, /const TRASH_KEEP_MS = 30 \* 24 \* 60 \* 60 \* 1000/, "media-gc 가 휴지통 파일을 30일 전에 고아로 지운다");
  assert.match(gc, /allRows\("couple_photos", "id,storage_path,thumb_path,deleted_at"\)/);
  assert.equal(trashDaysLeft("2026-11-01T00:00:00Z", Date.parse("2026-11-06T00:00:00Z")), 25);
  assert.equal(nextAfterRemove(["a", "b", "c"], "b"), "c");
  assert.equal(nextAfterRemove(["a", "b", "c"], "c"), "b");
  assert.equal(nextAfterRemove(["a"], "a"), null);
});

/* ── 9) 썸네일 TTL · SW 캐시 · LS 상한 ── */
test("9 썸네일은 7일 서명 · SW 가 토큰을 뗀 경로로 캐시 · LS 상한 1500", () => {
  assert.equal(isThumbPath("c/123-ab.thumb.webp"), true);
  assert.equal(isThumbPath("c/123-ab.webp"), false);
  assert.equal(isThumbPath("c/log-1.mp4"), false);
  assert.equal(ttlForPath("c/1.thumb.jpg"), THUMB_TTL_S);
  assert.equal(ttlForPath("c/1.jpg"), MEDIA_TTL_S);
  assert.equal(THUMB_TTL_S, 7 * 86400);
  assert.ok(URL_CACHE_CAP >= 1200);
  const sw = read("public/sw.js");
  const a = sw.indexOf("function thumbKey(");
  let depth = 0, end = -1;
  for (let i = sw.indexOf("{", a); i < sw.length; i++) {
    if (sw[i] === "{") depth++;
    else if (sw[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  const thumbKey = new Function(`${sw.slice(a, end)}\nreturn thumbKey;`)() as (u: URL) => string | null;
  const base = "https://x.supabase.co/storage/v1/object/sign/couple-photos/c1/1-ab.thumb.webp";
  assert.equal(thumbKey(new URL(`${base}?token=AAA`)), base);
  assert.equal(thumbKey(new URL(`${base}?token=BBB`)), base, "토큰이 바뀌어도 같은 키");
  assert.equal(thumbKey(new URL("https://x.supabase.co/storage/v1/object/sign/couple-photos/c1/1-ab.webp?token=A")), null, "원본은 캐시하지 않는다");
  assert.equal(thumbKey(new URL("https://x.supabase.co/storage/v1/object/sign/other/c1/1.thumb.webp?token=A")), null);
  assert.match(sw, /k !== CACHE && k !== THUMBS/, "배포마다 썸네일 캐시를 비운다");
  assert.match(sw, /mode: "cors", credentials: "omit"/, "불투명 응답을 저장하면 실패도 저장되고 용량이 부푼다");
  const clear = couple.slice(couple.indexOf("export function clearSignedUrlCache"), couple.indexOf("export function evictSignedUrls"));
  assert.match(clear, /caches\.delete\(THUMB_CACHE\)/, "로그아웃해도 썸네일이 기기에 남는다");
  assert.match(couple, /const THUMB_CACHE = "ourdays-thumbs-v1"/);
  assert.match(sw, /const THUMBS = "ourdays-thumbs-v1"/);
});

/* ── 10) 리캡 재조회 · 포매터 ── */
test("10 날짜 변환은 포매터를 매번 만들지 않는다 · 결과는 Intl 과 같다 · 리캡 재조회는 0.8초 모음", () => {
  const mem = read("src/lib/memories.ts");
  const body = mem.slice(mem.indexOf("export function dateInTimezone"), mem.indexOf("function yearOf"));
  assert.ok(!body.includes("new Intl.DateTimeFormat"), "행마다 포매터를 만든다(3000행 87ms)");
  const ref = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  for (let k = 0; k < 400; k++) {
    const iso = new Date(Date.UTC(2020, 0, 1) + k * 7_919_000_017 % 200_000_000_000).toISOString();
    assert.equal(dateInTimezone(iso), ref.format(new Date(iso)), iso);
    assert.equal(dateInTimezone(iso, "America/New_York"), new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso)));
  }
  assert.match(recapUi, /setTimeout\(\(\) => setBump\(\(n\) => n \+ 1\), 800\)/);
});

/* ── 11) 빨랫줄 원자 토글 ── */
test("11 빨랫줄은 행 잠금 RPC(상한 4 · FIFO 알림 · 되돌리기 CAS) · couples grant 는 건드리지 않는다", () => {
  const t = mig.slice(mig.indexOf("function public.couple_hung_toggle("));
  const body = t.slice(0, t.indexOf("$$;"));
  assert.match(body, /security definer\s+set search_path = ''/);
  assert.match(body, /p_couple not in \(select private\.my_couple_ids\(\)\)/);
  assert.match(body, /for update/, "잠그지 않으면 동시에 누른 두 사람이 서로를 덮는다");
  assert.match(body, /cardinality\(v_next\) > 4/);
  assert.match(body, /'evicted', v_evicted/);
  assert.match(body, /p\.deleted_at is null/, "휴지통 사진을 걸 수 있다");
  const s = mig.slice(mig.indexOf("function public.couple_hung_swap("));
  assert.match(s.slice(0, s.indexOf("$$;")), /v_cur is distinct from coalesce\(p_expect/);
  assert.doesNotMatch(mig, /grant\s+update/i, "couples 는 컬럼 단위 grant — 재선언하면 빠진 컬럼이 조용히 막힌다(hung.test)");
  assert.doesNotMatch(mig, /revoke\s+update/i);
  assert.match(album, /await toggleCoupleHung\(coupleId, p\.path\)/);
  assert.match(album, /onToggleHung\?\.\(p\.path\)/, "함수가 아직 없을 때 옛 길이 없다");
  assert.match(album, /swapCoupleHung\(coupleId, r\.paths, before\)/);
  assert.equal(hungToastText({ added: true, evicted: "x" }, "2025년 3월 2일"), "홈에 걸었어요 · 2025년 3월 2일 사진이 내려갔어요");
  assert.equal(hungToastText({ added: false, evicted: null }, null), "홈 빨랫줄에서 내렸어요");
});

/* ── 12) 사진 보기 ── */
test("12 보기 — 뒤로 가기 닫기 · 보기 안에서만 확대 · 썸네일 먼저 · 이웃 미리 받기 · 공유/저장 · 날짜와 올린 사람", () => {
  assert.match(viewer, /useBackClose\(onClose\)/);
  assert.match(viewer, /useDialogFocus\(true, onClose\)/);
  assert.match(viewer, /pinchScale\(g\.dist, dist\(e\.touches\), g\.s\)/);
  assert.match(viewer, /touchAction: "none"/);
  assert.match(viewer, /key=\{`t-\$\{photo\.id\}`\}/, "원본이 올 때까지 검은 화면");
  assert.match(viewer, /neighborIds\(ids, photo\.id\)/);
  // 공유는 lib/sharefile 의 webShareOrDownload(탭 안에서 바로 · 거절되면 내려받기 — 2026-11-11)
  assert.match(viewer, /webShareOrDownload\(ready, "우리 사진"\)/);
  assert.match(viewer, /\{when\} · \{who\}가 올림/);
  assert.equal(pinchScale(100, 200, 1), 2);
  assert.equal(pinchScale(100, 1000, 1), 4);
  assert.equal(pinchScale(100, 10, 1), 1);
  assert.equal(clampPan(500, 300, 2), 150);
  assert.equal(clampPan(-500, 300, 1), 0);
  assert.deepEqual(neighborIds(["a", "b", "c"], "b"), ["c", "a"]);
  assert.deepEqual(neighborIds(["a"], "a"), []);
  const zoom = read("src/components/ZoomLock.tsx");
  assert.ok(!zoom.includes("PhotoViewer"), "ZoomLock 을 사진 보기 때문에 고치지 않는다(확대는 사진 transform)");
});

/* ── 13) 타일 · 확인창 접근성 ── */
test("13 타일엔 버튼 셋이 없다 · 라벨에 날짜 · 대표 확인창은 dialog + Esc + 포커스", () => {
  assert.ok(!album.includes('aria-label="사진 삭제"'), "스크린리더가 사진마다 '사진 삭제'를 되풀이한다");
  assert.ok(!/우리 사진 \$\{photos\.length - i\}/.test(album), "번호 라벨은 새 사진이 오면 전부 밀린다");
  assert.match(album, /const label = `\$\{shortDate\(p\.shotAt\)\} 사진/);
  const cc = album.slice(album.indexOf("function CoverConfirm"), album.indexOf("type Toast"));
  assert.match(cc, /useDialogFocus\(true, onCancel\)/);
  assert.match(cc, /role="dialog"/);
  assert.match(cc, /aria-modal="true"/);
  assert.equal(shortDate("2025-03-01T16:00:00Z"), "2025년 3월 2일", "KST 날짜");
});

/* ── 14) 그날의 우리 카드 ── */
test("14 같은 날은 한 장(+N) · 한 번에 서명 · 사진 카드는 보기를 연다", () => {
  const it = (key: string, date: string, kind: MemoryItem["kind"], media: string | null): MemoryItem => ({ key, kind, date, yearsAgo: 2026 - Number(date.slice(0, 4)), emoji: "", title: key, body: null, mediaPath: media, actorUser: "u" });
  const many = Array.from({ length: 20 }, (_, i) => it(`p${i}`, "2025-11-06", "photo", `c/${i}.thumb.webp`));
  const groups = groupMemoriesByDate([...many, it("d", "2024-11-06", "diary", null)]);
  assert.equal(groups.length, 2, "사진 20장이 카드 20장이 된다");
  assert.equal(groups[0].items.length, 20);
  assert.equal(groups[0].date, "2025-11-06", "최근 해부터");
  assert.match(recapUi, /signedPhotoUrls\(paths\)/);
  assert.ok(!/signedPhotoUrl\(path\)/.test(recapUi), "경로마다 서명을 따로 부른다");
  assert.match(recapUi, /<PhotoViewer/);
  assert.match(recapUi, /void openPhotos\(g\)/);
});

/* ── 15) 홈 티저 ── */
test("15 여러 해가 섞이면 '1년 전 오늘'이라 하지 않는다 · KST 날짜", () => {
  assert.equal(teaserLabel([{ yearsAgo: 1 }]), "1년 전 오늘");
  assert.equal(teaserLabel([{ yearsAgo: 1 }, { yearsAgo: 1 }]), "1년 전 오늘 · 추억 2개");
  assert.equal(teaserLabel([{ yearsAgo: 1 }, { yearsAgo: 3 }, { yearsAgo: 2 }]), "지난해들의 오늘 3개");
  assert.match(teaser, /const today = kstDate\(Date\.now\(\)\)/);
  assert.match(teaser, /teaserLabel\(items\)/);
});

/* ── 16) 내보내기 ZIP ── */
test("16 ZIP — 미디어는 저장만(level 0) · 스트림 · 200MB 마다 나눔 · 서명은 묶어서", async () => {
  const src = strip(read("src/lib/accountData.ts"));
  assert.match(src, /new Zip\(/);
  assert.match(src, /new ZipPassThrough\(name\)/);
  assert.ok(!/zip\(files, \{ level: 6 \}/.test(src), "전부를 메모리에 모아 한 번에 압축한다");
  assert.match(src, /signedPhotoUrls\(batch\)/);
  assert.match(src, /ARCHIVE_PART_BYTES = 200 \* 1024 \* 1024/);
  assert.ok(!src.includes("250 * 1024 * 1024"), "250MB 에서 실패로 끝내는 상한이 돌아왔다");
  const re = /function zipLevelFor[\s\S]*?return (\/[^\n]+\/i)\.test\(name\) \? 0 : 6;/.exec(src);
  assert.ok(re, "zipLevelFor 를 못 찾았다");
  const lit = re![1];
  const media = new RegExp(lit.slice(1, -2), "i");
  const zipLevelFor = (n: string) => (media.test(n) ? 0 : 6);
  assert.equal(zipLevelFor("media/c/1.webp"), 0);
  assert.equal(zipLevelFor("media/c/log-1.mp4"), 0);
  assert.equal(zipLevelFor("our-days-data.json"), 6);
});

/* ── F1) 그날 묶음 · 일정 앨범 ── */
test("F1 찍은 날 머리말 · 일정이 있던 날의 앨범(반복 기념일은 해마다)", () => {
  const p = (id: string, shotAt: string) => ({ id, shotAt });
  const g = groupByDay([p("a", "2025-03-02T10:00:00Z"), p("b", "2025-03-02T01:00:00Z"), p("c", "2025-03-01T16:30:00Z"), p("d", "2025-03-01T10:00:00Z")]);
  assert.deepEqual(g.map((x) => [x.date, x.photos.length]), [["2025-03-02", 3], ["2025-03-01", 1]], "KST 자정 경계");
  assert.equal(dayLabel("2026-11-06", "2026-11-06"), "오늘");
  assert.equal(dayLabel("2026-11-05", "2026-11-06"), "어제");
  assert.equal(dayLabel("2026-03-02", "2026-11-06"), "3월 2일 (월)");
  assert.equal(dayLabel("2025-03-02", "2026-11-06"), "2025년 3월 2일 (일)");
  const counts = countByDay(["2025-07-10T03:00:00Z", "2025-07-10T04:00:00Z", "2025-10-01T03:00:00Z", "2026-10-01T03:00:00Z"]);
  const al = eventAlbums(
    [
      { id: "e1", title: "제주 여행", date: "2025-07-10", emoji: "✈️" },
      { id: "e2", title: "만난 날", date: "2024-10-01", recurrence: "yearly" },
      { id: "e3", title: "월급날", date: "2025-01-10", recurrence: "monthly" },
      { id: "e4", title: "다음 여행", date: "2027-01-01" },
    ],
    counts,
    "2026-11-06",
  );
  assert.deepEqual(al.map((a) => [a.title, a.count]), [["만난 날 · 2026", 1], ["만난 날 · 2025", 1], ["제주 여행", 2]]);
  assert.deepEqual(kstDayRange("2025-07-10"), ["2025-07-09T15:00:00Z", "2025-07-10T15:00:00Z"]);
  assert.equal(kstDay("2025-07-09T15:00:00Z"), "2025-07-10");
  assert.match(album, /listCoupleEvents\(coupleId\)/, "일정은 기존 읽기 함수로만 읽는다");
  assert.match(album, /listPhotosInRange\(coupleId, from, to\)/, "앨범은 불러온 페이지가 아니라 서버에서 그날을 다 받는다");
});

/* ── F3) 저장 공간 ── */
test("F3 저장 공간 RPC(definer · 내 커플만 · 크기 합만) · 막대 문구", () => {
  const f = mig.slice(mig.indexOf("function public.couple_storage_usage("));
  const body = f.slice(0, f.indexOf("$$;"));
  assert.match(body, /security definer\s+set search_path = ''/);
  assert.match(body, /p_couple not in \(select private\.my_couple_ids\(\)\)/);
  assert.match(body, /o\.bucket_id = 'couple-photos' and left\(o\.name, char_length\(v_prefix\)\) = v_prefix/);
  assert.doesNotMatch(body, /'name'|o\.name\s*\)/, "파일 이름을 돌려주지 않는다");
  const s = storageSummary({ photos: 100, diary: 0, logs: 50, recent30: 10, bucket_total: 512 * 1024 * 1024, bucket_recent30: 64 * 1024 * 1024 });
  assert.equal(s.monthsLeft, 8);
  assert.equal(s.usedRatio, 0.5);
  assert.equal(storageSummary({ photos: 0, diary: 0, logs: 0, recent30: 0, bucket_total: 0, bucket_recent30: 0 }).monthsLeft, null);
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0MB");
  assert.equal(formatBytes(1536 * 1024 * 1024), "1.50GB");
  assert.match(album, /남은 기간 약 \$\{storage\.monthsLeft\}개월/);
});

/* ── F4) 캡션 · 댓글 · 하트 ── */
test("F4 캡션(200자) · 사진 댓글/하트 — 일기 반응과 같은 규칙(집합 정책 · 본인만 삭제 · 휴지통 사진엔 못 단다)", () => {
  assert.match(mig, /check \(caption is null or char_length\(caption\) <= 200\)/);
  for (const t of ["photo_comments", "photo_reactions"]) {
    assert.match(mig, new RegExp(`create table if not exists public\\.${t} \\(`));
    assert.match(mig, new RegExp(`alter table public\\.${t} enable row level security;`));
    assert.match(mig, new RegExp(`photo_id uuid not null references public\\.couple_photos\\(id\\) on delete cascade`));
  }
  assert.match(mig, /created_by uuid not null default auth\.uid\(\) references auth\.users\(id\) on delete cascade/, "계정을 지워도 그 사람의 댓글이 남는다");
  assert.match(mig, /create policy pc_delete on public\.photo_comments for delete to authenticated\s+using \(created_by = \(select auth\.uid\(\)\)\);/);
  assert.match(mig, /p\.id = photo_comments\.photo_id and p\.deleted_at is null/);
  assert.match(viewer, /setPhotoCaption\(p\.id, text\)/);
  assert.match(viewer, /togglePhotoHeart\(coupleId, p\.id, myHeart\?\.id \?\? null\)/);
});

/* ── F5) 월간 공유 카드 ── */
test("F5 좋은 사진 4장 = 하트 > 댓글 > 캡션 > 최근 · 아무 달이나 · 공유/저장", () => {
  const ph = [
    { id: "a", shotAt: "2026-10-01" }, { id: "b", shotAt: "2026-10-02" }, { id: "c", shotAt: "2026-10-03", caption: "바다" },
    { id: "d", shotAt: "2026-10-04" }, { id: "e", shotAt: "2026-10-05" },
  ];
  const best = bestPhotos(ph, new Map([["a", 2]]), new Map([["b", 1]]));
  assert.deepEqual(best.map((p) => p.id), ["a", "b", "c", "e"]);
  assert.match(recapUi, /setMonthDelta\(\(d\) => Math\.max\(-240, d - 1\)\)/, "지난달 · 이번달 둘만 고를 수 있다");
  assert.match(recapUi, /shareMonthCard\(coupleId, recap\)/);
  assert.match(read("src/lib/recapshare.ts"), /renderRecapCard\(recap,/);
  const card = strip(read("src/lib/recapcard.ts"));
  assert.match(card, /createImageBitmap\(await res\.blob\(\)\)/, "서명 URL 을 img 로 그리면 캔버스가 더럽혀져 내보낼 수 없다");
});

/* ── F6) 같은 사진 ── */
test("F6 sha256 칸 · 휴지통 뺀 부분 unique · 올리기 전에 묻고 unique 위반도 '이미 있는 사진'", () => {
  assert.match(mig, /add column if not exists sha256 text;/);
  assert.match(mig, /create unique index if not exists couple_photos_sha_live_uidx\s+on public\.couple_photos \(couple_id, sha256\) where sha256 is not null and deleted_at is null;/);
  const up = fnBody(couple, "uploadPhoto");
  assert.match(up, /\.eq\("sha256", sha256\)/);
  assert.match(up, /metaErr\.code === "23505"/);
  assert.match(up, /return \{ status: "duplicate" \}/);
});

/* ── F8) 알림에서 사진으로 ── */
test("F8 focusPhotoId — 사진을 찾아(안 불러온 페이지면 한 장 받아) 보기로 연다", () => {
  assert.match(album, /focusPhotoId\?: string \| null;/);
  assert.match(album, /void openById\(focusPhotoId\)\.finally\(\(\) => onFocusHandled\?\.\(\)\)/);
  assert.match(album, /await getPhoto\(coupleId, id\)/);
  assert.match(album, /휴지통에 있는 사진이에요/);
});

/* ── 마이그레이션 계약 ── */
test("★ 마이그레이션 — schema.sql 끝에 한 덩어리 · 멱등 · 지우는 것 없음 · 정책은 집합 규약 · 함수는 authenticated 만", () => {
  const schema = read("supabase/schema.sql");
  assert.ok(schema.includes(migRaw), "schema.sql 끝의 복사본이 migration 과 다르다");
  assert.ok(schema.trimEnd().endsWith(migRaw) || schema.indexOf(migRaw) > schema.length / 2, "복사본이 끝에 있어야 한다");
  assert.doesNotMatch(mig, /\bdrop\s+(table|column|schema|function)\b|\btruncate\b|\bdelete\s+from\b/i, "운영에 push 하는 순간 적용된다 — 지우는 문장 금지");
  assert.match(mig, /^begin;/m);
  assert.match(mig, /^commit;/m);
  const stmts = mig.split(/;\s*\n/).map((s) => s.trim());
  const policies = stmts.filter((s) => /^create policy /.test(s));
  assert.equal(policies.length, 6);
  for (const p of policies) {
    const name = /^create policy (\w+) on public\.(\w+)/.exec(p)!;
    assert.match(p, /\bto authenticated\b/, name[1]);
    assert.doesNotMatch(p, /is_couple_member\(/, name[1]);
    assert.doesNotMatch(p.replaceAll("(select auth.uid())", ""), /auth\.uid\(\)/, name[1]);
    assert.ok(mig.includes(`drop policy if exists ${name[1]} on public.${name[2]};`), `${name[1]}: drop policy if exists 짝이 없다`);
  }
  for (const s of stmts.filter((x) => /^alter table .* add column /.test(x))) assert.match(s, /add column if not exists/, s);
  for (const s of stmts.filter((x) => /^create (unique )?index /.test(x))) assert.match(s, /if not exists/, s);
  for (const s of stmts.filter((x) => /add constraint/.test(x))) {
    const c = /add constraint (\w+)/.exec(s)![1];
    assert.ok(mig.includes(`drop constraint if exists ${c};`), `${c}: 다시 돌리면 이미 있는 제약으로 실패한다`);
  }
  const sigs = ["photo_trash(uuid)", "photo_restore(uuid)", "photo_set_caption(uuid, text)", "couple_hung_toggle(uuid, text)", "couple_hung_swap(uuid, text[], text[])", "memory_month_stats(uuid, text)", "couple_storage_usage(uuid)"];
  for (const sig of sigs) {
    const esc = sig.replace(/[()[\]]/g, "\\$&");
    assert.match(mig, new RegExp(`revoke all on function public\\.${esc} from public, anon;`), sig);
    assert.match(mig, new RegExp(`grant execute on function public\\.${esc} to authenticated;`), sig);
  }
  for (const fn of ["photo_trash", "photo_restore", "photo_set_caption", "couple_hung_toggle", "couple_hung_swap", "couple_storage_usage"]) {
    const f = mig.slice(mig.indexOf(`function public.${fn}(`));
    assert.match(f.slice(0, f.indexOf("$$;")), /errcode = 'PT4\d\d'/, `${fn}: 앱이 받을 오류는 PT4xx(40001 은 PostgREST 무한 재시도 — README §11)`);
  }
  assert.doesNotMatch(mig, /errcode = '40001'|errcode = '40P01'/);
  assert.doesNotMatch(mig, /storage\.objects\s+(for|enable)|policy .* on storage\.objects/i, "storage.objects 정책은 이 파일이 건드리지 않는다");
  const later = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(later.includes("20261106020000_photo_review.sql"));
});

test("옛 앱 호환 — 새 칸은 전부 nullable(기본값 없는 not null 없음) · 새 스키마가 없으면 옛 모양으로 다시 묻는다", () => {
  const adds = mig.match(/add column if not exists [^;]+;/g) ?? [];
  assert.ok(adds.length >= 6);
  for (const a of adds) assert.doesNotMatch(a, /not null/, a);
  assert.match(couple, /function isMissingColumn\(/);
  assert.match(couple, /e\.code === "42703"/);
  assert.match(fnBody(couple, "uploadPhoto"), /ins = await sb\.from\("couple_photos"\)\.insert\(base\)/, "새 칸이 없는 DB 에서 업로드가 멈춘다");
});
