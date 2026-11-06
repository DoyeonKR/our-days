/* 3초 로그 리뷰(2026-11-06) — 화면 · 업로드 · 보관이 같이 쓰는 순수 규칙.
 *
 * 브라우저 API 를 부르지 않는다(node --test 로 그대로 잰다). 업로드 시간 제한 · 슬롯 유예 · 오류 문구 ·
 * NEW 기준 · 자정 넘김 · 보관 만료 안내 · 달력(보관함) · 오늘의 미션 · '둘 다 남긴 날' 연속 기록과 섬 하트 ·
 * 평생 보관(한 달 한 편) · 빠른 반응 · 몽타주 계획이 여기 있다. */
import { canWriteSlot, shiftDateIso, type LogSlot } from "./logslot.ts";
import { LOG_VIDEO_KEEP_DAYS } from "./logretention.ts";
import { humanError } from "./humanError.ts";
import { extForMime, type LogVideoExt } from "./logvideo.ts";

/* ── 업로드 ─────────────────────────────────────────────────────────────── */

/** 업로드 한 번에 기다리는 시간. 예전엔 백그라운드 업로드만 60초로 끊고, 그 뒤 '보관해 둔 영상으로 다시 올리기'는
 *  제한이 없어 끊긴 소켓에서 영영 기다렸다 — 그동안 닫기 · 다시 찍기가 잠겨 전체 화면에 갇혔다. */
export const LOG_UPLOAD_TIMEOUT_MS = 60_000;
/** 저장(행 upsert) 한 번에 기다리는 시간. */
export const LOG_SAVE_TIMEOUT_MS = 20_000;

/** p 가 ms 안에 안 끝나면 'upload-timeout' 으로 거절한다. 늦게 끝난 결과는 onLate 로 넘겨 치우게 한다(고아 파일). */
export function withTimeout<T>(p: Promise<T>, ms: number, onLate?: (value: T) => void): Promise<T> {
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error("upload-timeout"));
    }, ms);
  });
  p.then((v) => { if (timedOut) onLate?.(v); }, () => {});
  return Promise.race([p, guard]).finally(() => clearTimeout(timer));
}

/** 서버 RLS 와 같은 규칙 — 지금 슬롯이거나 5분 전이 그 슬롯이면 아직 올릴 수 있다(경계 5분 유예). */
export const LOG_SLOT_GRACE_MS = 5 * 60_000;
export function slotOpenWithGrace(dateIso: string, slot: LogSlot, now: Date): boolean {
  return canWriteSlot(dateIso, slot, now) || canWriteSlot(dateIso, slot, new Date(now.getTime() - LOG_SLOT_GRACE_MS));
}

const NETWORKISH = /failed to fetch|networkerror|load failed|network request failed|upload-timeout|timeout|timed out|offline/i;
/** 연결 문제인가(다시 시도하면 될 일인가). */
export function isNetworkishError(raw: string): boolean {
  return NETWORKISH.test(raw);
}
/** 로그 업로드 · 저장 오류를 사람 말로. 예전엔 "영상 업로드 실패: Failed to fetch" 가 그대로 떴다
 *  (앞에 붙은 한국어 때문에 humanError 가 원문을 통과시켰다). */
export function humanLogError(raw: unknown, slotName = "이 시간대"): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  if (/upload-timeout|timeout|timed out/i.test(msg)) return "올리는 데 너무 오래 걸려요. 기기에 보관해 두고 연결이 좋아지면 다시 올릴게요.";
  if (/failed to fetch|networkerror|load failed|network request failed|offline/i.test(msg)) return "인터넷 연결이 끊겨 올리지 못했어요. 기기에 보관해 두고 연결되면 다시 올릴게요.";
  if (/row-level security|violates|slot-closed|42501/i.test(msg)) return `${slotName} 시간이 지나 올릴 수 없어요.`;
  return humanError(msg);
}

/* ── 목록 · 화면 ─────────────────────────────────────────────────────────── */

/** 상대 새 로그 NEW 기준 — 다시 찍으면 행(id · created_at)은 그대로라 created_at 만 보면 새 영상에 배지가 안 떴다. */
export function logIsNew(log: { created_at: string; updated_at?: string | null }, lastSeen: string): boolean {
  return (log.updated_at || log.created_at) > lastSeen;
}

/** 첫 장면 그림이 없는 옛 로그 — src 에 #t=0.001 을 붙여 브라우저가 그 지점을 디코딩해 첫 장면을 그리게 한다.
 *  그림이 있으면(poster) 주소는 그대로(캐시 · 재서명 비교가 흔들리지 않게). 이미 시간 조각이 있으면 그대로. */
export function firstFrameSrc(src: string, poster?: string | null): string {
  if (poster || !src || src.includes("#")) return src;
  return `${src}#t=0.001`;
}

/** 자정 넘김 — 보던 날이 '방금 전의 오늘'이면 새 오늘로 따라간다(지난 날을 일부러 보던 중이면 그대로).
 *  예전엔 앱을 켜 둔 채 자정을 넘기면 어제에 머물러 '3초 남기기' 버튼이 사라졌다. */
export function followToday(viewing: string, prevToday: string, nextToday: string): string {
  return viewing === prevToday ? nextToday : viewing;
}

/** 다시 찍기 전에 물어볼 문장 — 상대 댓글은 행(id)에 붙어 있어 새 영상으로 그대로 옮겨 간다. */
export function retakeWarning(commentCount: number): string | null {
  return commentCount > 0 ? `이 영상에 댓글 ${commentCount}개가 있어요. 다시 찍어도 댓글은 새 영상에 그대로 붙어요.` : null;
}

/* ── 보관 · 만료 ─────────────────────────────────────────────────────────── */

/** 만료 전에 알려 주는 날 수(D-7). 서버는 log_date < 오늘 − 90 일 때 떼어 내므로 마지막 날은 91 − 나이. */
export const LOG_EXPIRY_NOTICE_DAYS = 7;
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
export function logAgeDays(logDate: string, todayIso: string): number {
  return dayNumber(todayIso) - dayNumber(logDate);
}
/** 영상이 정리되기까지 남은 날(오늘 포함, 1 = 오늘이 마지막). 보관(keep) · 영상 없음이면 null. */
export function expiryDaysLeft(log: { log_date: string; video_path: string | null; keep?: boolean | null }, todayIso: string): number | null {
  if (!log.video_path || log.keep) return null;
  return LOG_VIDEO_KEEP_DAYS + 1 - logAgeDays(log.log_date, todayIso);
}
export function expirySoon(log: { log_date: string; video_path: string | null; keep?: boolean | null }, todayIso: string): boolean {
  const left = expiryDaysLeft(log, todayIso);
  return left !== null && left > 0 && left <= LOG_EXPIRY_NOTICE_DAYS;
}

/** 평생 보관 — 한 사람이 한 달에 한 편. 서버 트리거(couple_logs_keep_cap)와 같은 규칙. */
export const LOG_KEEP_PER_MONTH = 1;
export function keepMonth(logDate: string): string {
  return logDate.slice(0, 7);
}
/** 보관함 달 목록(최신 먼저) — 보관 기간이 닿는 달 + 평생 보관한 영상이 있는 달. */
export function archiveMonths(todayIso: string, keptDates: readonly string[] = []): string[] {
  const out = new Set<string>();
  for (let i = 0; i <= LOG_VIDEO_KEEP_DAYS; i += 1) out.add(shiftDateIso(todayIso, -i).slice(0, 7));
  for (const d of keptDates) out.add(d.slice(0, 7));
  return [...out].sort().reverse();
}
/** 'YYYY-MM' 의 날짜들(1일 ~ 말일). */
export function monthDays(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}
/** 달력 첫 칸 앞의 빈칸 수(일요일 시작). */
export function monthLeadBlanks(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

/** '1년 전 오늘'(그리고 그 전 해들) — 2/29 는 윤년에만. 사진·추억 쪽이 couple.ts 의 listLogsOnDates 와 같이 쓴다. */
export function yearsAgoDates(todayIso: string, years = 5): string[] {
  const [y, m, d] = todayIso.split("-").map(Number);
  const out: string[] = [];
  for (let k = 1; k <= years; k += 1) {
    const yy = y - k;
    if (m === 2 && d === 29 && new Date(Date.UTC(yy, 1, 29)).getUTCMonth() !== 1) continue;
    out.push(`${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/* ── 오늘의 미션 ─────────────────────────────────────────────────────────── */

/** 빈 칸에 띄우는 촬영 미션 — KST 날짜로 정해져 둘이 같은 미션을 본다(질문처럼). 오전 · 오후가 다르다. */
export const LOG_MISSIONS = [
  "지금 보이는 하늘", "오늘 마신 첫 음료", "창밖 풍경", "지금 내 손", "발밑 풍경", "오늘의 점심",
  "가장 가까운 초록색", "지금 듣는 소리가 나는 곳", "오늘 입은 옷의 색", "책상 위", "가방 속 하나",
  "오늘 본 귀여운 것", "그림자 하나", "빛이 드는 곳", "지금 걷는 길", "내 표정 한 번",
  "오늘의 간식", "가장 좋아하는 물건", "지나가는 하늘의 구름", "오늘 만난 동물", "거울 속 나",
  "지금 이 순간의 손짓 인사", "가까운 꽃이나 나무", "오늘의 퇴근길", "따뜻한 것 하나", "반짝이는 것",
  "오늘 쓴 글씨", "문 앞 풍경", "지금 켜진 불빛", "상대에게 보여 주고 싶은 것",
] as const;
export function dailyMission(dateIso: string, slot: LogSlot): string {
  const n = LOG_MISSIONS.length;
  // 7 은 30 과 서로소라 매일 한 바퀴를 고르게 돈다. 오후는 반 바퀴 떨어진 미션.
  const i = ((dayNumber(dateIso) * 7 + (slot === "pm" ? 15 : 0)) % n + n) % n;
  return LOG_MISSIONS[i];
}

/* ── '둘 다 남긴 날' 연속 기록 + 섬 하트 ────────────────────────────────── */

/** 둘 다 하나 이상 남긴 날(KST). 한 사람이 두 칸을 채워도 상대가 없으면 안 친다. */
export function bothRecordedDays(rows: readonly { log_date: string; created_by: string }[], myUid: string): Set<string> {
  const mine = new Set<string>(), theirs = new Set<string>();
  for (const r of rows) (r.created_by === myUid ? mine : theirs).add(r.log_date);
  return new Set([...mine].filter((d) => theirs.has(d)));
}
/** 그 날이 속한 주(월요일 시작)의 월요일. */
export function weekStartIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  return shiftDateIso(iso, -((dow + 6) % 7));
}
/** 연속 기록 — 오늘이 아직이면 어제부터 센다(오늘 안 찍었다고 아침마다 0 이 되지 않게).
 *  한 주에 한 번은 빠진 날을 '쉬어 가기'로 건너뛴다(그 날은 세지 않는다). 쉬어 가기 뒤에 바로 이어지는 날이 있어야 한다. */
export function logStreak(days: ReadonlySet<string>, todayIso: string): { count: number; freezes: string[]; doneToday: boolean } {
  const doneToday = days.has(todayIso);
  let cur = doneToday ? todayIso : shiftDateIso(todayIso, -1);
  let count = 0;
  const freezes: string[] = [];
  const usedWeeks = new Set<string>();
  for (let guard = 0; guard < 800; guard += 1) {
    if (days.has(cur)) {
      count += 1;
    } else {
      const wk = weekStartIso(cur);
      const prev = shiftDateIso(cur, -1);
      if (count > 0 && !usedWeeks.has(wk) && days.has(prev)) {
        usedWeeks.add(wk);
        freezes.push(cur);
      } else break;
    }
    cur = shiftDateIso(cur, -1);
  }
  return { count, freezes, doneToday };
}
/** 이번 주 쉬어 가기가 남았나. */
export function freezeLeftThisWeek(freezes: readonly string[], todayIso: string): boolean {
  const wk = weekStartIso(todayIso);
  return !freezes.some((f) => weekStartIso(f) === wk);
}
/** 섬 하트 보상 — 2일째부터, 작게(최대 12). 연속이 길수록 조금 더. */
export function logStreakHearts(count: number): number {
  if (count < 2) return 0;
  return Math.min(12, 2 + count);
}
export type LogStreakMark = { day: string; n: number; hearts: number };
/** 섬 상태에 오늘 보상을 얹는다 — 하루 한 번(이미 오늘 받았으면 null). 섬 상태의 선택 칸 logStreak 만 쓴다.
 *  같은 입력 = 같은 결과라 두 사람 기기가 동시에 시도해도 버전 충돌 뒤 다시 읽으면 '이미 받음'으로 끝난다. */
export function applyLogStreakReward<S extends { coins: number; logStreak?: LogStreakMark }>(s: S, todayIso: string, count: number): S | null {
  const hearts = logStreakHearts(count);
  if (hearts <= 0) return null;
  if (s.logStreak && s.logStreak.day >= todayIso) return null;
  return { ...s, coins: s.coins + hearts, logStreak: { day: todayIso, n: count, hearts } };
}

/* ── 녹화 실패 재시도 ────────────────────────────────────────────────────── */

/** 캔버스 녹화가 프레임을 거의 못 받았을 때(10장 미만) 한 번 더 찍는 길.
 *  후면 + 보정 없음이면 카메라 원본 스트림으로 — 후면은 원래 뒤집지 않으니 잃는 게 없다.
 *  전면은 원본 스트림이 거울 없이 저장돼 README 결정(찍는 화면 = 저장 영상)을 어기므로 캔버스로 한 번 더.
 *  보정을 골랐으면 원본으로 몰래 바꾸지 않는다(보정 없는 영상이 저장된다). */
export function recordRetryPath(facing: "user" | "environment", colored: boolean): "raw" | "canvas" {
  return facing === "environment" && !colored ? "raw" : "canvas";
}
export const LOG_MIN_FRAMES = 10;

/* ── 몽타주 · 나란히 ─────────────────────────────────────────────────────── */

export type MontageClip = { id: string; log_date: string; slot: LogSlot; created_by: string; video_path: string | null };
/** 한 달 필름 계획 — 날짜 · 오전/오후 · (나, 상대) 순. iOS 메모리를 생각해 최대 60편, 편이 많으면 한 편을 짧게.
 *  (한 달 둘이 다 채우면 124편 × 3초 = 6분 — 폰에서 한 번에 굽기엔 길다.) */
export function montagePlan(clips: readonly MontageClip[], myUid: string | null, maxClips = 60): { clips: MontageClip[]; perClipMs: number } {
  const sorted = clips
    .filter((c) => !!c.video_path)
    .slice()
    .sort((a, b) =>
      a.log_date !== b.log_date ? (a.log_date < b.log_date ? -1 : 1)
        : a.slot !== b.slot ? (a.slot === "am" ? -1 : 1)
          : (a.created_by === myUid ? 0 : 1) - (b.created_by === myUid ? 0 : 1));
  let picked = sorted;
  if (sorted.length > maxClips) {
    // 고르게 솎는다(앞쪽만 남기면 월말이 통째로 빠진다).
    const step = sorted.length / maxClips;
    picked = Array.from({ length: maxClips }, (_, i) => sorted[Math.floor(i * step)]);
  }
  const n = picked.length;
  const perClipMs = n <= 20 ? 3000 : n <= 40 ? 2000 : 1500;
  return { clips: picked, perClipMs };
}
/** 영상을 칸에 가득 채우는 가운데 자르기(cover) — 원본 좌표 [sx, sy, sw, sh]. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): [number, number, number, number] {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return [0, 0, Math.max(0, srcW), Math.max(0, srcH)];
  const s = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / s, sh = dstH / s;
  return [(srcW - sw) / 2, (srcH - sh) / 2, sw, sh];
}
/** 나란히(나 | 상대) 출력 크기 — 칸마다 3:4, 높이 720(720p). */
export const SPLIT_SIZE = { width: 1080, height: 720 } as const;
export const MONTAGE_SIZE = { width: 720, height: 960 } as const;

/** 내려받기 확장자 — 형식(mime)이 아는 영상이면 그것, 아니면 저장 경로의 확장자.
 *  ⚠ 예전엔 mp4 가 아니면 전부 .webm 이라 아이폰 폴백(video/quicktime) 영상이 .webm 이름으로 저장됐다.
 *  스토리지가 형식을 비워 주거나(octet-stream) 하면 올릴 때 붙인 경로의 확장자가 진짜다. */
export function exportExt(mime: string, path?: string | null): LogVideoExt {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  if (base === "video/mp4" || base === "video/quicktime" || base === "video/webm") return extForMime(base);
  const fromPath = /\.(mp4|mov|webm)$/i.exec(path ?? "")?.[1]?.toLowerCase();
  return (fromPath as LogVideoExt | undefined) ?? extForMime(mime);
}
/** 내려받기 파일 이름 — 확장자는 실제 녹화 형식(exportExt). */
export function exportFileName(kind: "month" | "split" | "clip", key: string, mime: string, path?: string | null): string {
  const ext = exportExt(mime, path);
  if (kind === "clip") return `our-3s-${key}.${ext}`;
  return kind === "month" ? `our-3s-film-${key}.${ext}` : `our-3s-together-${key}.${ext}`;
}
