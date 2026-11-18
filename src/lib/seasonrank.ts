/* 시즌 순위에 올리기(2026-11-18) — 이번 달 채운 미션 수를 서버(submit_season)에 올린다.
 * 진행은 섬 상태라 두 사람이 같은 수를 본다. 서버는 우리 커플이 이미 그 수 이상이면 넣지 않으므로 두 폰이 같이 보내도 한 줄이다.
 * 올리는 곳: 게임 허브(카드가 보일 때)와 시즌 시트(열 때) — 미션은 여러 게임에서 차지만 수를 보는 자리는 이 둘이다.
 * 올리는 조건: 커플 · 닉네임(합치기 순위와 같은 ourdays:merge:nick — 전체 공개라 한 번 직접 정한 것만) ·
 *   보이는 달이 지금(KST) 달(시계가 빨랐던 폰이 다음 달을 보내면 서버가 PT422 로 거절할 뿐이지만 보내지도 않는다) ·
 *   이 기기에서 그 달에 보낸 수보다 클 때(localStorage — 못 남기면 다시 보낼 뿐, 서버가 중복을 거른다).
 * PT422 · PT403 은 그 수를 보낸 것으로 친다(다시 보내도 같은 답). PT429 · 연결 오류는 다음 기회에. RPC 가 아직 없는 DB(앱이 먼저 배포)도 조용히 넘어간다. */
import { submitSeasonDone } from "@/lib/couple";
import { normalizeNick } from "@/lib/merge";

export const NICK_KEY = "ourdays:merge:nick";
const sentKey = (coupleId: string, month: string) => `ourdays:season:sent:${coupleId}:${month}`;

export function readRankNick(): string {
  try {
    const v = normalizeNick(localStorage.getItem(NICK_KEY) ?? "");
    return v.ok ? v.nick : "";
  } catch {
    return "";
  }
}
export function writeRankNick(v: string) {
  try {
    localStorage.setItem(NICK_KEY, v);
  } catch {
    /* 못 남겨도 이번엔 올라간다 */
  }
}
function readSent(coupleId: string, month: string): number {
  try {
    const n = Number(localStorage.getItem(sentKey(coupleId, month)) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
function writeSent(coupleId: string, month: string, done: number) {
  try {
    localStorage.setItem(sentKey(coupleId, month), String(done));
  } catch {
    /* 못 남기면 다음에 한 번 더 보낼 뿐 — 서버가 같은 수를 거른다 */
  }
}

const inflight = new Set<string>();
/** 올릴 게 있으면 올린다. 올렸으면(또는 서버가 이미 가졌으면) true */
export async function syncSeasonRank(coupleId: string | null, month: string, nowMonth: string, done: number): Promise<boolean> {
  if (!coupleId || month !== nowMonth || done < 1) return false;
  const nick = readRankNick();
  if (!nick || done <= readSent(coupleId, month)) return false;
  const key = `${coupleId}:${month}:${done}`;
  if (inflight.has(key)) return false;
  inflight.add(key);
  try {
    const r = await submitSeasonDone(month, nick, done);
    if (!r) return false; // 연동 없음(로컬 모드)
    writeSent(coupleId, month, done);
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "PT422" || code === "PT403") writeSent(coupleId, month, done);
    return false;
  } finally {
    inflight.delete(key);
  }
}
