/* 모험 온라인 대전 — 앱 쪽 통로. 판은 엣지 함수 adventure-battle 이 돌린다(lib/adventurepvp 머리 주석). README §14.6 */
import { getSupabase } from "@/lib/supabase";
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
export type Result = { result: "win" | "lose"; delta: number; rating: number };

export class DuelError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
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
  "no save": "모험 기록이 아직 서버에 없어요 — 잠시 뒤 다시 해 주세요",
  "empty team": "대전에 내보낼 생물을 골라 주세요",
  "no team": "먼저 대전 팀을 등록해 주세요",
  "daily limit": "오늘은 대전을 충분히 했어요 — 내일 다시 겨뤄요",
  "no opponent": "상대가 팀을 내렸어요 — 다른 상대를 골라 주세요",
  "no match": "이미 끝난 판이에요",
  stale: "이미 끝난 판이에요",
  "bad log": "판 기록이 깨졌어요 — 진 것으로 기록돼요",
  "too fast": "판이 너무 빨리 끝났어요 — 진 것으로 기록돼요",
  "invalid auth": "다시 로그인해 주세요",
};
export const duelMessage = (e: unknown) => (e instanceof DuelError ? MESSAGES[e.code] ?? "서버와 연결하지 못했어요" : "서버와 연결하지 못했어요");

async function call<T>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const sb = getSupabase();
  if (!sb) throw new DuelError("offline", 0);
  const { data, error } = await sb.functions.invoke("adventure-battle", { body: { op, ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let code = "network";
    let status = 0;
    if (ctx && typeof ctx.json === "function") {
      status = ctx.status;
      code = (await ctx.json().catch(() => ({})))?.error ?? "error";
    }
    throw new DuelError(code, status);
  }
  return data as T;
}

export const duelMe = () => call<{ team: { nickname: string; team: Mon[]; power: number } | null; rating: Rating }>("me");
export const registerTeam = (ids: string[], nickname: string) => call<{ team: Mon[]; nickname: string }>("register", { ids, nickname });
export const duelOpponents = () => call<{ people: Opponent[]; bots: Opponent[] }>("opponents");
/** 엔진 지문을 함께 보낸다 — 서버 엔진과 다르면 409 engine(앱을 새로 고쳐 주세요). 판정이 갈린 채로 겨루지 않게 */
export const startDuel = (opponent: string) => call<{ match: string; battle: Battle; opponent: string; abandoned?: boolean }>("start", { opponent, engine: ENGINE_HASH });
/** 판이 끝나면 입력 기록을 보낸다 — 서버가 같은 엔진으로 다시 돌려 판정한다 */
export const duelFinish = (match: string, log: LogEntry[]) => call<Result>("finish", { match, log, engine: ENGINE_HASH });
/** 대전 팀을 내린다 — 순위판 · 상대 목록에서 빠진다(점수 기록은 남아 다시 등록하면 이어진다) */
export const unregisterTeam = () => call<{ ok: true }>("unregister");
export const duelForfeit = (match: string) => call<Result>("forfeit", { match });

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
