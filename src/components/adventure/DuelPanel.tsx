"use client";
/* 모험 › 대전 — 대전 팀 등록 · 내 점수 · 상대 고르기 · 순위 · 전적. 판은 서버가 돌린다(lib/adventureonline). README §14.6
 * 대전 다듬기(2026-11-09): 못 보낸 결과는 이 기기에 남겨 대전 칸을 열 때 · 새 판을 열기 전에 다시 보낸다 · 4xx 는 다시 보내지 않고 서버의 답을 보여 준다
 * (무효 · 늦음 · 깨진 기록) · 엔진이 다르면 서버가 뒤처졌는지 앱이 낡았는지 가른다 · 오늘 남은 판 · 오른 점수 · 상대마다 남은 판 · 순위는 내 앞뒤도 */
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SPECIES, type AdvSave, type Battle, type Region } from "@/lib/adventure";
import { TEAM_MAX } from "@/lib/adventurepvp";
import * as duelApi from "@/lib/adventureonline";
import type { BoardRow, HistoryRow, Opponent, Rating, Result } from "@/lib/adventureonline";
import type { LogEntry } from "@/lib/arena";
import { enterBattleFullscreen, exitBattleFullscreen } from "@/lib/battlefull";
import { useBackClose } from "@/lib/useBackClose";
import { useDialogFocus } from "@/lib/useDialogFocus";
import MonArt from "@/components/adventure/MonArt";
import StatePanel from "@/components/StatePanel";
import { josa } from "@/lib/josa";
import { confirmDialog } from "@/lib/confirm";

const {
  DuelError, clearUnsent, duelBoard, duelFinish, duelForfeit, duelHistory, duelMe, duelMessage, duelOpponents, duelText, engineAdvice, keepUnsent, readUnsent,
  registerTeam, reloadFresh, resultNote, resultOf, retryable, startDuel, unregisterTeam,
} = duelApi;
/** 연습 상대 전적 — 점수와 따로 센다(서버가 rating 이나 me 에 실어 줄 때만 보인다) */
function practiceOf(me: unknown): { wins: number; losses: number } | null {
  const m = me as { practice_wins?: number; practice_losses?: number; rating?: { practice_wins?: number; practice_losses?: number } } | null;
  const w = m?.rating?.practice_wins ?? m?.practice_wins;
  const l = m?.rating?.practice_losses ?? m?.practice_losses;
  return typeof w === "number" || typeof l === "number" ? { wins: w ?? 0, losses: l ?? 0 } : null;
}

const BattleView = dynamic(() => import("@/components/adventure/BattleView"), { ssr: false });

/** 대전장 — 전투 화면의 배경 */
const ARENA: Region = { key: "arena", name: "대전장", blurb: "", levels: [1, 50], needLevel: 0, table: [], sky: ["#3a2f6e", "#c06f9a"], ground: "#7a68b0" };
const NICK_KEY = "ourdays:adventure:nick";

type Me = Awaited<ReturnType<typeof duelMe>>;
type Live = { match: string; battle: Battle; opponent: string; at: number };
/** 결과 창 — 서버가 정한 결과(ok, note: 상승 한도 · 이미 정산 · 진 것으로 친 이유) · 무효(void) · 서버가 거절(final) ·
 *  기권했지만 서버에 못 알림(forfeit) · 결과를 못 보냄(unsent: 다시 보낼 기록을 들고 있다 — 이 기기에도 남겼다) */
type DuelOutcome =
  | { status: "ok"; win: boolean; delta: number; rating?: number; opponent: string; note?: string | null }
  | { status: "void"; opponent: string }
  | { status: "final"; opponent: string; message: string }
  | { status: "forfeit"; opponent: string }
  | { status: "unsent"; opponent: string; match: string; log: LogEntry[] };
/** 판을 연 시각(이벤트 안에서만 부른다) — 못 보낸 기록의 10분은 서버처럼 판을 연 때부터 센다 */
const openedAt = () => Date.now();
/** 판이 끝난 뒤 서버의 답 — 결과 · 무효 · 거절 문구 */
type Got = { result?: "win" | "lose"; delta?: number; rating?: number; note?: string | null; void?: boolean; final?: string };

/** 서버 결과 → 결과 창에 넘길 것 */
function gotOf(r: Result, reason?: string): Got {
  if (r.status === "void") return { void: true };
  return { result: r.result, delta: r.delta, rating: r.rating, note: reason ?? resultNote(r) };
}
/** 4xx — 진 것으로 정산된 결과가 실려 오면 그것(이유와 함께), 아니면 문구만 */
function gotOfError(e: unknown): Got {
  const r = resultOf(e);
  return r ? gotOf(r, duelMessage(e)) : { final: duelMessage(e) };
}
function outcomeOf(g: Got, opponent: string): DuelOutcome | null {
  if (g.void) return { status: "void", opponent };
  if (g.result) return { status: "ok", win: g.result === "win", delta: g.delta ?? 0, rating: g.rating, opponent, note: g.note };
  if (g.final) return { status: "final", opponent, message: g.final };
  return null;
}

export default function DuelPanel({ save, flash, sync }: {
  save: AdvSave;
  flash: (s: string) => void;
  /** 등록 전에 모험 기록을 서버까지 올린다(방금 잡은 생물이 서버에 없으면 팀에서 빠진다) */
  sync?: () => Promise<void>;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [opps, setOpps] = useState<Opponent[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [hist, setHist] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string[]>(() => save.party.slice(0, TEAM_MAX).map((m) => m.id));
  const [nick, setNick] = useState(() => {
    try {
      return localStorage.getItem(NICK_KEY) ?? "";
    } catch {
      return "";
    }
  });
  /** 닉네임 칸을 고쳤나 — 안 고쳤으면 서버의 등록 닉네임을 보여 준다(이 기기 값이 옛 이름일 수 있다) */
  const nickTouched = useRef(false);
  const [live, setLive] = useState<Live | null>(null);
  const [result, setResult] = useState<DuelOutcome | null>(null);
  /** 엔진이 달라 새 앱을 받아야 한다(서버는 최신) */
  const [stale, setStale] = useState(false);
  const outcome = useRef<Got>({});
  /** 보낸 입력 기록 · 끝낸 방식 — 못 보냈을 때 다시 보내려고 */
  const sent = useRef<{ log: LogEntry[] | null; kind: "finish" | "forfeit" }>({ log: null, kind: "finish" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await duelMe();
      setMe(m);
      if (m.team) {
        setPick(m.team.team.map((x) => x.id));
        // 팀이 있으면 서버 닉네임이 정본이다 — 예전엔 이 기기에 남은 옛 이름을 먼저 보여 줘 '팀 바꾸기'가 이름까지 되돌렸다
        if (!nickTouched.current) setNick(m.team.nickname);
      }
      const [b, h, o] = await Promise.all([duelBoard(30), duelHistory(), m.team ? duelOpponents() : Promise.resolve({ people: [], bots: [] })]);
      setBoard(b);
      setHist(h);
      setOpps([...o.people, ...o.bots]);
    } catch (e) {
      setError(duelMessage(e));
    }
  }, []);

  // 대전 칸을 열면 — 못 보낸 결과(10분 안)를 먼저 보내고 그다음 읽는다(me 가 10분 지난 판을 진 것으로 닫기 전에)
  const resendRef = useRef<(u: { match: string; log: LogEntry[]; opponent: string }) => Promise<boolean>>(async () => true);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const u = readUnsent();
      if (u) await resendRef.current(u);
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  async function register() {
    setBusy(true);
    try {
      await sync?.();
      const r = await registerTeam(pick, nick);
      try {
        localStorage.setItem(NICK_KEY, r.nickname);
      } catch {
        /* 저장이 막힌 기기 */
      }
      nickTouched.current = false;
      // 서버 기록에 아직 없는 생물은 서버가 건너뛴다 — 말없이 빠지지 않게 알린다
      const dropped = pick.length - r.team.length;
      flash(dropped > 0 ? `${dropped}마리는 아직 서버 기록에 없어 빠졌어요 — 잠시 뒤 '팀 바꾸기'로 다시 등록해 주세요` : "대전 팀을 등록했어요");
      await load();
    } catch (e) {
      flash(duelMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function challenge(id: string) {
    enterBattleFullscreen(); // 탭 안에서만 열린다 — 서버를 기다리기 전에
    setBusy(true);
    try {
      // 새 판을 열기 전에 못 보낸 결과부터 — 새 판이 그 판을 진 것으로 닫기 전에
      const u = readUnsent();
      if (u && !(await resend(u))) {
        exitBattleFullscreen();
        return;
      }
      const r = await startDuel(id);
      outcome.current = {};
      setLive({ match: r.match, battle: r.battle, opponent: r.opponent, at: openedAt() });
      if (r.abandoned) flash("끝내지 않은 대전은 진 것으로 기록됐어요");
    } catch (e) {
      exitBattleFullscreen();
      if (e instanceof DuelError && e.code === "engine") {
        // 지문끼리는 순서가 없다 — 배포된 앱이 지금 앱과 같으면 서버(함수)가 뒤처진 것, 아니면 이 앱이 낡았다
        if ((await engineAdvice()) === "server") flash(duelText("engine server"));
        else setStale(true);
      } else flash(duelMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** 못 보낸 결과를 다시 보낸다 — 서버가 정한 결과만 보여 준다. 서버가 답을 줬으면(결과 · 4xx) true, 연결이 안 되면 false */
  async function resend(r: { match: string; log: LogEntry[]; opponent: string }): Promise<boolean> {
    setBusy(true);
    try {
      const x = await duelFinish(r.match, r.log);
      clearUnsent(r.match);
      setResult(outcomeOf(gotOf(x), r.opponent));
      void load();
      return true;
    } catch (e) {
      if (retryable(e)) {
        setResult({ status: "unsent", opponent: r.opponent, match: r.match, log: r.log });
        flash(duelMessage(e));
        return false;
      }
      // 4xx — 다시 보내도 같은 답이다. 서버의 답(진 것으로 친 결과 · 거절 이유)을 보여 주고 기록을 지운다
      clearUnsent(r.match);
      setResult(outcomeOf(gotOfError(e), r.opponent));
      void load();
      return true;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    resendRef.current = resend;
  });

  async function leaveBoard() {
    if (!(await confirmDialog({ message: "랭킹에서 빠질까요? 대전 팀 등록이 지워지고 순위에서 사라져요. 다시 등록하면 돌아와요.", confirmText: "빠지기", danger: true }))) return;
    setBusy(true);
    try {
      await unregisterTeam();
      flash("랭킹에서 빠졌어요");
      await load();
    } catch (e) {
      flash(duelMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= TEAM_MAX ? p : [...p, id]));
  }

  const rating: Rating | undefined = me?.rating;
  const practice = practiceOf(me);
  const all = [...save.party, ...save.box];
  const registered = me?.team?.team ?? [];
  const today = me?.today ?? null;
  /** 오늘 이 상대와 붙은 판 수(public_id 로) */
  const metToday = new Map((today?.opponents ?? []).map((o) => [o.id, o.n]));

  if (error && !me) return <div className="mt-3"><StatePanel kind="error" title="대전 정보를 불러오지 못했어요" detail={error} onRetry={() => void load()} /></div>;
  if (!me) return <div className="mt-3"><StatePanel kind="loading" title="대전장을 불러오는 중" /></div>;

  return (
    <div className="mt-3 grid gap-3">
      {/* 내 점수 */}
      <section className="adv-card adv-duel-head">
        <div>
          <p className="text-[12px] text-muted">내 대전 점수</p>
          <p className="adv-duel-rating">{rating?.rating ?? 1000}</p>
          <p className="text-[12px] text-muted">{rating?.wins ?? 0}승 {rating?.losses ?? 0}패{rating && rating.streak > 1 ? ` · ${rating.streak}연승 중` : ""} · 최고 {rating?.best ?? 1000}</p>
          {practice && <p className="text-[12px] text-muted">연습 {practice.wins}승 {practice.losses}패 · 점수와 따로 세요</p>}
          {today && (
            <p className="text-[12px] text-muted">
              오늘 남은 대전 {Math.max(0, today.duelsMax - today.duels)}/{today.duelsMax} · 오늘 오른 점수 {today.gain}/{today.gainMax}
              {today.gain >= today.gainMax ? " · 오늘 상승 한도에 닿았어요" : ""}
            </p>
          )}
        </div>
        <div className="flex -space-x-3">{registered.map((m) => <MonArt key={m.id} species={m.species} size={52} />)}</div>
      </section>

      {stale && (
        <section className="adv-card" role="alert">
          <p className="text-[15px]">앱이 새 버전이 아니라 대전 판정이 서버와 달라요.</p>
          <button type="button" className="tap adv-btn adv-btn-main mt-2" onClick={reloadFresh}>새 버전 받기</button>
        </section>
      )}

      {/* 대전 팀 */}
      <section className="adv-card">
        <h2 className="adv-h">대전 팀 <small>최대 {TEAM_MAX}마리 · 다른 사람이 이 팀과 겨뤄요(컴퓨터가 조종)</small></h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {all.map((m) => {
            const on = pick.includes(m.id);
            return (
              <button key={m.id} type="button" className={`tap adv-pick ${on ? "is-on" : ""}`} onClick={() => toggle(m.id)} aria-pressed={on}>
                <MonArt species={m.species} size={48} />
                <b>{SPECIES[m.species].name}</b>
                <small>Lv.{m.level}</small>
                {on && <span className="adv-pick-no">{pick.indexOf(m.id) + 1}</span>}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block text-[12px] text-muted" htmlFor="adv-nick">순위판에 보일 닉네임(1~12자)</label>
        <div className="mt-1 flex gap-2">
          <input id="adv-nick" className="adv-input min-w-0 flex-1" value={nick} maxLength={12} onChange={(e) => { nickTouched.current = true; setNick(e.target.value); }} placeholder="예: 숲속 탐험가" />
          <button type="button" className="tap adv-btn adv-btn-main" disabled={busy || !pick.length || !nick.trim()} onClick={() => void register()}>
            {me.team ? "팀 바꾸기" : "등록"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted">대전에서는 모두 체력이 가득한 채로 시작해요. 방금 잡은 생물은 저장이 끝난 뒤(몇 초) 고를 수 있어요.</p>
        {me.team && <button type="button" className="tap adv-chip mt-2" disabled={busy} onClick={() => void leaveBoard()}>랭킹에서 빠지기</button>}
      </section>

      {/* 상대 */}
      {me.team && (
        <section className="adv-card">
          <h2 className="adv-h">상대 고르기 <small>점수가 가까운 순</small></h2>
          {opps.length === 0 ? <p className="mt-2 text-[12px] text-muted">아직 다른 사람이 없어요.</p> : (
            <div className="mt-2 grid gap-2">
              {opps.map((o) => (
                <div key={o.id} className="adv-opp">
                  <div className="flex -space-x-2">{o.team.map((m, i) => <MonArt key={i} species={m.species} size={40} />)}</div>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{o.nickname}</b>
                    <small>{o.bot ? `연습 상대 · 평균 Lv.${Math.round(o.team.reduce((a, m) => a + m.level, 0) / o.team.length)}` : `${o.rating}점 · ${o.wins}승 ${o.losses}패${today ? ` · 오늘 ${Math.max(0, today.sameMax - (metToday.get(o.id) ?? 0))}판 남음` : ""}`}</small>
                  </div>
                  <button type="button" className="tap adv-btn adv-btn-main" disabled={busy} onClick={() => void challenge(o.id)}>도전</button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[12px] text-muted">연습 상대와의 판은 점수가 움직이지 않아요(연습 전적에만 남아요). 사람 상대에게 이기면 그 사람 점수도 조금 내려가요.</p>
        </section>
      )}

      {/* 순위 */}
      <section className="adv-card">
        <h2 className="adv-h">순위</h2>
        {board.length === 0 ? <p className="mt-2 text-[12px] text-muted">아직 대전 기록이 없어요. 첫 승을 남겨 보세요.</p> : (
          <ol className="mt-2 grid gap-1">
            {board.map((r, i) => [
              // 위 30등과 내 앞뒤 다섯 사이가 떨어져 있으면 비었다는 표시
              i > 0 && r.rank > board[i - 1].rank + 1 ? <li key={`gap-${r.rank}`} aria-hidden className="text-center text-[12px] text-muted">⋯</li> : null,
              <li key={`${r.rank}-${r.nickname}`} className={`adv-rank ${r.is_me ? "is-me" : ""}`}>
                <span className="adv-rank-no">{r.rank}</span>
                {r.lead && SPECIES[r.lead] ? <MonArt species={r.lead} size={32} /> : <span className="w-8" />}
                <b className="min-w-0 flex-1 truncate">{r.nickname}{r.is_me ? " (나)" : ""}</b>
                <small>{r.wins}승 {r.losses}패</small>
                <span className="adv-rank-pt">{r.rating}</span>
              </li>,
            ])}
          </ol>
        )}
      </section>

      {/* 전적 */}
      <section className="adv-card">
        <h2 className="adv-h">내 전적 <small>도전 · 방어 최근 30판</small></h2>
        {hist.length === 0 ? <p className="mt-2 text-[12px] text-muted">아직 기록이 없어요.</p> : (
          <ul className="mt-2 grid gap-1">
            {hist.map((h) => (
              <li key={h.id} className="adv-hist">
                <span className={`adv-hist-res ${h.result === "win" ? "is-win" : "is-lose"}`}>{h.result === "win" ? "승" : "패"}</span>
                <span className="min-w-0 flex-1 truncate">{h.attack ? "도전" : "방어"} · {h.opponent}</span>
                <span className={h.delta >= 0 ? "adv-delta-up" : "adv-delta-down"}>{h.delta >= 0 ? `+${h.delta}` : h.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {live && (
        <BattleView
          key={live.match}
          battle={live.battle}
          region={ARENA}
          bag={{ balls: { basic: 0, great: 0, star: 0 }, items: { potion: 0, bigpotion: 0, cure: 0 } }}
          online={{
            finish: async (log) => {
              sent.current = { log, kind: "finish" };
              // 보내기 전에 남긴다 — 응답을 잃거나 앱이 닫혀도 다음에 대전 칸을 열 때 다시 보낸다(판 id 로 멱등)
              keepUnsent({ match: live.match, log, at: live.at, opponent: live.opponent });
              try {
                const r = await duelFinish(live.match, log);
                clearUnsent(live.match);
                outcome.current = gotOf(r);
              } catch (e) {
                // 4xx 는 서버가 정한 답 — 다시 보내지 않는다(BattleView 가 retryable 로 멈춘다)
                if (!retryable(e)) {
                  clearUnsent(live.match);
                  outcome.current = gotOfError(e);
                }
                throw e;
              }
            },
            forfeit: async () => {
              sent.current = { log: null, kind: "forfeit" };
              try {
                outcome.current = gotOf(await duelForfeit(live.match));
              } catch (e) {
                if (!retryable(e)) outcome.current = gotOfError(e);
                throw e;
              }
            },
            errorText: duelMessage,
            retryable,
          }}
          onEnd={() => {
            const o = outcome.current;
            setLive(null);
            // 승패 · 점수는 서버가 돌려준 것만 — 앱의 판(이겼다)을 보여 주면 서버가 진 것으로 기록했을 때 거짓이 된다
            if (o.void || o.final) setResult(outcomeOf(o, live.opponent));
            else if (o.result) setResult({ status: "ok", win: o.result === "win", delta: o.delta ?? 0, rating: o.rating, opponent: live.opponent, note: o.note });
            else if (sent.current.kind === "forfeit") setResult({ status: "forfeit", opponent: live.opponent });
            else setResult({ status: "unsent", opponent: live.opponent, match: live.match, log: sent.current.log ?? [] });
            void load();
          }}
        />
      )}

      {result && <DuelResult result={result} busy={busy} onResend={(r) => void resend(r)} onClose={() => setResult(null)} />}
    </div>
  );
}

function DuelResult({ result, busy, onResend, onClose }: {
  result: DuelOutcome;
  busy: boolean;
  onResend: (r: Extract<DuelOutcome, { status: "unsent" }>) => void;
  onClose: () => void;
}) {
  useBackClose(onClose);
  const ref = useDialogFocus(true, onClose);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="대전 결과">
      <div ref={ref} tabIndex={-1} className="adv-card w-full max-w-sm text-center">
        {result.status === "ok" ? (
          <>
            <p className={`adv-duel-res ${result.win ? "is-win" : "is-lose"}`}>{result.win ? "승리!" : "패배…"}</p>
            <p className="mt-1 text-[15px]">{josa(result.opponent, "과/와")}의 대전</p>
            <p className="mt-2 text-[15px]">
              점수 <b className={result.delta >= 0 ? "adv-delta-up" : "adv-delta-down"}>{result.delta >= 0 ? `+${result.delta}` : result.delta}</b>
              {result.rating != null && <> · 지금 <b>{result.rating}</b>점</>}
            </p>
            {result.note && <p className="mt-1 text-[12px] text-muted">{result.note}</p>}
            <button type="button" data-dialog-initial className="tap adv-btn adv-btn-main mt-4 w-full" onClick={onClose}>확인</button>
          </>
        ) : result.status === "void" ? (
          <>
            <p className="adv-duel-res">무효</p>
            <p className="mt-2 text-[15px]">{josa(result.opponent, "과/와")}의 대전은 무효가 된 판이에요 — 점수는 그대로예요.</p>
            <p className="mt-1 text-[12px] text-muted">판을 여는 사이 서버가 새 판정으로 바뀌었거나, 하루 넘게 열려 있던 판이에요.</p>
            <button type="button" data-dialog-initial className="tap adv-btn adv-btn-main mt-4 w-full" onClick={onClose}>확인</button>
          </>
        ) : result.status === "final" ? (
          <>
            <p className="adv-duel-res is-lose">결과를 받지 못했어요</p>
            <p className="mt-2 text-[15px]">{result.message}</p>
            <button type="button" data-dialog-initial className="tap adv-btn adv-btn-main mt-4 w-full" onClick={onClose}>확인</button>
          </>
        ) : result.status === "forfeit" ? (
          <>
            <p className="adv-duel-res is-lose">기권했어요</p>
            <p className="mt-2 text-[15px]">서버에 아직 알리지 못했어요. 다음 대전을 열 때 진 것으로 정산돼요.</p>
            <button type="button" data-dialog-initial className="tap adv-btn adv-btn-main mt-4 w-full" onClick={onClose}>확인</button>
          </>
        ) : (
          <>
            <p className="adv-duel-res is-lose">결과를 보내지 못했어요</p>
            <p className="mt-2 text-[15px]">{josa(result.opponent, "과/와")}의 대전 결과는 서버가 다시 돌려 봐야 정해져요. 연결을 확인하고 다시 보내 주세요.</p>
            <p className="mt-1 text-[12px] text-muted">이 기기에 남겨 뒀어요 — 10분 안에 대전 칸을 다시 열면 저절로 보내요. 그 뒤엔 진 것으로 기록돼요.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="tap adv-btn flex-1" onClick={onClose}>나중에</button>
              <button type="button" data-dialog-initial className="tap adv-btn adv-btn-main flex-1" disabled={busy} onClick={() => onResend(result)}>{busy ? "보내는 중…" : "다시 보내기"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

