/* 모험 온라인 대전 — 앱 쪽 통로. 판은 엣지 함수 adventure-battle 이 돌린다(lib/adventurepvp 머리 주석). README §14.6
 *
 * 대전 다듬기(2026-11-09):
 *   · 4xx 는 다시 보내도 같은 답이다 — 재시도하지 않는다(`retryable` 은 연결 끊김 · 5xx 만). 오류 응답의 본문(서버가 정한 결과)을 버리지 않고 DuelError.body 에
 *   · finish 는 판 id 로 멱등 — 응답을 잃어도 다시 보내면 같은 결과(200). 무효 판은 {status: "void"}
 *   · 못 보낸 입력 기록은 이 기기에 남겨(`keepUnsent`) 대전 칸을 열 때 · 새 판을 열기 전에 다시 보낸다(10분 안 — 그 뒤는 서버가 진 것으로 닫는다)
 *   · engine 409 는 서버 지문을 싣는다 — 배포된 앱 버전이 지금 앱과 같으면 서버가 뒤처진 것(배포 중), 아니면 앱을 새로 받는다(`engineAdvice`) */
import { getSupabase } from "@/lib/supabase";
import { BASE } from "@/lib/base";
import type { Battle, Mon } from "@/lib/adventure";
import type { LogEntry } from "@/lib/arena";
import { ENGINE_HASH } from "@/lib/adventurehash";

/** practice_* 는 연습 상대 전적(점수와 따로, 2026-11-09 — 옛 함수는 안 준다) */
export type Rating = { rating: number; wins: number; losses: number; streak: number; best: number; practice_wins?: number; practice_losses?: number };
export type MiniMon = { species: string; level: number };
/** id 는 계정 id 가 아니라 서버가 준 상대 표(팀 행의 무작위 id · 연습 상대는 "bot:N") — 그대로 startDuel 에 넘긴다 */
export type Opponent = { id: string; nickname: string; rating: number | null; wins: number; losses: number; bot?: boolean; team: MiniMon[] };
export type BoardRow = { rank: number; nickname: string; rating: number; wins: number; losses: number; lead: string | null; is_me: boolean };
export type HistoryRow = { id: string; attack: boolean; opponent: string; bot: boolean; result: "win" | "lose"; delta: number; finished_at: string };
/** 판 결과 — status 'done'(again: 이미 끝난 판의 남긴 결과) · 'void'(무효 — 점수 그대로). 옛 함수는 status 없이 result 만 준다 */
export type Result = { status?: "done" | "void"; result?: "win" | "lose"; delta?: number; rating?: number; practice?: boolean; capped?: boolean; again?: boolean; ticks?: number };
/** 오늘(KST) 현황 — 새 함수만 준다(없으면 화면이 안 그린다) */
export type Today = { duels: number; duelsMax: number; gain: number; gainMax: number; sameMax: number; opponents: { id: string; n: number }[] };

export class DuelError extends Error {
  // 매개변수 속성은 node 의 타입 지우기가 못 읽는다 — 테스트가 이 파일을 그대로 띄운다
  code: string;
  status: number;
  body: Record<string, unknown> | null;
  constructor(code: string, status: number, body: Record<string, unknown> | null = null) {
    super(code);
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

/** 다시 보내면 달라질 수 있는 오류인가 — 연결 끊김(0) · 서버 오류(5xx)만. 4xx 는 서버가 이미 정한 답이다 */
export function retryable(e: unknown): boolean {
  if (!(e instanceof DuelError)) return true;
  return e.status === 0 || e.status >= 500;
}

const MESSAGES: Record<string, string> = {
  nickname: "닉네임은 1~12자로, 보이는 글자로 정해 주세요(링크 · 숨은 글자는 안 돼요)",
  "nick taken": "이미 쓰는 닉네임이에요",
  "bad mon": "모험 기록에 맞지 않는 생물이 있어요 — 다시 골라 주세요",
  "legend locked": "전설 영물은 그 지역을 연 뒤(앞 지역 대장 뱃지)에 내보낼 수 있어요",
  "team size": "대전 팀은 세 마리까지예요",
  "same opponent": "같은 상대와는 하루 세 판까지예요 — 다른 상대를 골라 주세요",
  "too slow": "판을 연 지 너무 오래돼 진 것으로 기록됐어요",
  engine: "앱을 새로 고쳐 주세요",
  "engine server": "서버 업데이트 중이에요. 잠시 뒤 다시 해 주세요",
  busy: "다른 기기에서 대전 중이에요 — 2분쯤 뒤 다시 해 주세요",
  void: "무효가 된 판이에요 — 점수는 그대로예요",
  "no save": "모험 기록이 아직 서버에 없어요 — 잠시 뒤 다시 해 주세요",
  "empty team": "대전에 내보낼 생물을 골라 주세요",
  "no team": "먼저 대전 팀을 등록해 주세요",
  "daily limit": "오늘은 대전을 충분히 했어요(하루 60판) — 자정 지나 다시 겨뤄요",
  "no opponent": "상대가 팀을 내렸어요 — 다른 상대를 골라 주세요",
  "no match": "이미 끝났거나 없는 판이에요",
  stale: "이미 끝난 판이에요",
  "bad log": "판 기록이 깨졌어요 — 진 것으로 기록돼요",
  "too fast": "판이 너무 빨리 끝났어요 — 진 것으로 기록돼요",
  "invalid auth": "다시 로그인해 주세요",
  network: "서버와 연결하지 못했어요",
};
export const duelText = (code: string) => MESSAGES[code] ?? "서버와 연결하지 못했어요";
export const duelMessage = (e: unknown) => (e instanceof DuelError ? duelText(e.code) : "서버와 연결하지 못했어요");

/** 결과를 받은 쪽이 보여 줄 한 줄 — 무효 · 상승 한도 · 이미 끝난 판 */
export function resultNote(r: Result): string | null {
  if (r.status === "void") return MESSAGES.void;
  if (r.capped) return "오늘 상승 한도에 닿았어요";
  if (r.again) return "이미 정산된 판이에요 — 서버에 남은 결과예요";
  return null;
}

/** 4xx 본문에 실린 서버 결과(too slow · bad log · too fast 는 진 것으로 정산한 결과를 함께 준다) */
export function resultOf(e: unknown): Result | null {
  if (!(e instanceof DuelError) || !e.body) return null;
  const b = e.body as Result;
  if (b.status === "void") return { status: "void" };
  return b.result === "win" || b.result === "lose" ? b : null;
}

async function call<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const sb = getSupabase();
  if (!sb) throw new DuelError("offline", 0);
  const { data, error } = await sb.functions.invoke("adventure-battle", { body: { op, ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let code = "network";
    let status = 0;
    let payload: Record<string, unknown> | null = null;
    if (ctx && typeof ctx.json === "function") {
      status = ctx.status;
      // 본문을 버리지 않는다 — 진 것으로 정산된 결과 · 서버 엔진 지문이 여기 있다
      payload = await ctx.json().catch(() => null);
      code = typeof payload?.error === "string" ? payload.error : "error";
    }
    throw new DuelError(code, status, payload);
  }
  return data as T;
}

export const duelMe = () => call<{ team: { nickname: string; team: Mon[]; power: number } | null; rating: Rating; today?: Today | null }>("me");
export const registerTeam = (ids: string[], nickname: string) => call<{ team: Mon[]; nickname: string }>("register", { ids, nickname });
export const duelOpponents = () => call<{ people: Opponent[]; bots: Opponent[] }>("opponents");
/** 엔진 지문을 함께 보낸다 — 서버 엔진과 다르면 409 engine(서버 지문을 싣는다 — `engineAdvice`). 판정이 갈린 채로 겨루지 않게 */
export const startDuel = (opponent: string) => call<{ match: string; battle: Battle; opponent: string; abandoned?: boolean }>("start", { opponent, engine: ENGINE_HASH });
/** 판이 끝나면 입력 기록을 보낸다 — 서버가 같은 엔진으로 다시 돌려 판정한다(판 id 로 멱등 — 다시 보내도 같은 결과) */
export const duelFinish = (match: string, log: LogEntry[]) => call<Result>("finish", { match, log, engine: ENGINE_HASH });
/** 대전 팀을 내린다 — 순위판 · 상대 목록에서 빠진다(점수 기록은 남아 다시 등록하면 이어진다) */
export const unregisterTeam = () => call<{ ok: true }>("unregister");
export const duelForfeit = (match: string) => call<Result>("forfeit", { match });

/* ───────── 엔진 지문이 다를 때 ───────── */

/** 지문끼리는 순서가 없다 — 대신 배포된 앱 버전(version.json)을 본다. 지금 앱이 배포된 최신이면 서버(함수)가 뒤처진 것 */
export function engineVerdict(deployed: string | null | undefined, mine: string): "server" | "reload" {
  return deployed && deployed !== "dev" && deployed === mine ? "server" : "reload";
}

/** 409 engine 을 받았을 때 — 'server'(서버 업데이트 중 · 잠시 뒤) 또는 'reload'(앱을 새로 받기) */
export async function engineAdvice(): Promise<"server" | "reload"> {
  const mine = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
  try {
    const r = await fetch(`${BASE}/version.json?t=${Date.now()}`, { cache: "no-store" });
    const j = r.ok ? ((await r.json()) as { v?: string }) : null;
    return engineVerdict(j?.v, mine);
  } catch {
    return "reload";
  }
}

/** 캐시를 건너뛰는 새로고침 — 주소에 한 번 쓰는 값을 붙인다(문서 캐시가 옛 번들을 또 주지 않게) */
export function reloadFresh() {
  try {
    const u = new URL(location.href);
    u.searchParams.set("_r", String(Date.now()));
    location.replace(u.toString());
  } catch {
    location.reload();
  }
}

/* ───────── 못 보낸 결과 ───────── */

export const UNSENT_KEY = "ourdays:adventure:duel:unsent";
/** 서버가 받아 주는 시간(MATCH_TTL_MIN 10분)보다 조금 짧게 — 넘긴 기록은 '늦음'으로 진 것이 된다 */
export const UNSENT_TTL_MS = 9.5 * 60_000;
export type Unsent = { match: string; log: LogEntry[]; at: number; opponent: string };

/** 아직 다시 보낼 만한가(10분 안 · 모양이 맞다) — 순수 */
export function unsentLive(u: unknown, now: number): u is Unsent {
  const x = u as Unsent | null;
  return !!x && typeof x.match === "string" && Array.isArray(x.log) && typeof x.at === "number" && now - x.at >= 0 && now - x.at < UNSENT_TTL_MS;
}

/** 보내기 전에 남긴다 — 앱이 닫히거나 응답을 잃어도 다음에 대전 칸을 열 때 다시 보낸다 */
export function keepUnsent(u: Unsent) {
  try {
    localStorage.setItem(UNSENT_KEY, JSON.stringify(u));
  } catch {
    /* 저장이 막힌 기기 — 결과 창의 '다시 보내기'만 */
  }
}

/** 남은 기록(10분 안의 것만 — 지난 것은 지운다) */
export function readUnsent(now = Date.now()): Unsent | null {
  try {
    const u = JSON.parse(localStorage.getItem(UNSENT_KEY) ?? "null");
    if (unsentLive(u, now)) return u;
    if (u) localStorage.removeItem(UNSENT_KEY);
  } catch {
    /* 깨진 값 · 막힌 저장 */
  }
  return null;
}

/** 서버가 답을 줬다(결과 · 4xx) — 그 판의 기록만 지운다(다른 판을 지우지 않게) */
export function clearUnsent(match: string) {
  try {
    const u = JSON.parse(localStorage.getItem(UNSENT_KEY) ?? "null") as Unsent | null;
    if (!u || u.match === match) localStorage.removeItem(UNSENT_KEY);
  } catch {
    /* 막힌 저장 */
  }
}

export async function duelBoard(limit = 30): Promise<BoardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("adventure_board", { p_limit: limit });
  if (error) throw new DuelError(error.code ?? "error", 0);
  return (data ?? []) as BoardRow[];
}

export async function duelHistory(): Promise<HistoryRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("adventure_history");
  if (error) throw new DuelError(error.code ?? "error", 0);
  return (data ?? []) as HistoryRow[];
}
