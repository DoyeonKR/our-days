"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type GameChallenge,
  createGameChallenge,
  listGameChallenges,
  resolveGameChallenge,
  submitGameAttempt,
  subscribeGameChallenges,
} from "@/lib/couple";
import { GAMES, type GameKey, gameRecord, newSeed } from "@/lib/game";
import { sendEventPush } from "@/lib/notify";
import Icon from "@/components/Icon";
import { SkeletonList } from "@/components/Skeleton";
import ReactionGame from "@/components/games/ReactionGame";
import MemoryMatch from "@/components/games/MemoryMatch";

type PlayState =
  | { kind: "new"; game: GameKey; seed: number }
  | { kind: "respond"; challenge: GameChallenge };

const gameMeta = (k: GameKey) => GAMES.find((g) => g.key === k);
const fmtScore = (game: GameKey, s: number) =>
  game === "reaction" ? `${s}ms` : `${s}점`;

/** 게임 탭 — 커플 1:1 비동기 미니게임 대결 + 포인트/전적. */
export default function GameArcade({
  coupleId,
  myUserId,
  myName,
  partnerName,
}: {
  coupleId: string | null;
  myUserId: string | null;
  myName: string;
  partnerName: string;
}) {
  const uid = myUserId;
  const [challenges, setChallenges] = useState<GameChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = () =>
      listGameChallenges(coupleId)
        .then((c) => {
          if (!cancelled) {
            setChallenges(c);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    load();
    const unsub = subscribeGameChallenges(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  // 자가치유: 양쪽 attempt 가 보이는데도 open 이면(판정 누락) resolve 재시도
  useEffect(() => {
    const stuck = challenges.find(
      (c) => c.status === "open" && c.attempts.length >= 2,
    );
    if (stuck) resolveGameChallenge(stuck.id).catch(() => {});
  }, [challenges]);

  const record = useMemo(() => gameRecord(challenges, uid), [challenges, uid]);
  const pending = challenges.filter(
    (c) =>
      c.status === "open" &&
      c.challenger !== uid &&
      !c.attempts.some((a) => a.user_id === uid),
  );
  const waiting = challenges.filter(
    (c) => c.status === "open" && c.challenger === uid,
  );
  const resolved = challenges.filter((c) => c.status === "resolved").slice(0, 12);

  function startNew(game: GameKey) {
    setPicking(false);
    setPlay({ kind: "new", game, seed: newSeed() });
  }

  async function onNewDone(score: number) {
    if (!play || play.kind !== "new" || !coupleId) return;
    setBusy(true);
    setErr(null);
    try {
      await createGameChallenge(play.game, play.seed, score);
      const g = gameMeta(play.game);
      sendEventPush(
        coupleId,
        "game",
        `${g?.emoji ?? "🎮"} ${g?.label} 대결 신청!`,
        `${myName || "상대"}이 도전장을 던졌어요`,
      );
      setPlay(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPlay(null);
    } finally {
      setBusy(false);
    }
  }

  async function onRespondDone(score: number) {
    if (!play || play.kind !== "respond" || !coupleId) return;
    setBusy(true);
    setErr(null);
    const ch = play.challenge;
    try {
      await submitGameAttempt(coupleId, ch.id, score);
      await resolveGameChallenge(ch.id);
      setPlay(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPlay(null);
    } finally {
      setBusy(false);
    }
  }

  // 게임 플레이 오버레이
  if (play) {
    const game = play.kind === "new" ? play.game : play.challenge.game;
    const seed = play.kind === "new" ? play.seed : play.challenge.seed;
    const onDone = play.kind === "new" ? onNewDone : onRespondDone;
    const onCancel = () => setPlay(null);
    return game === "reaction" ? (
      <ReactionGame seed={seed} onDone={onDone} onCancel={onCancel} />
    ) : (
      <MemoryMatch seed={seed} onDone={onDone} onCancel={onCancel} />
    );
  }

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <h1 className="mb-1 text-[22px] font-extrabold tracking-tight text-ink">
        둘이 대결
      </h1>
      <p className="mb-4 text-xs text-muted">
        미니게임으로 겨루고 포인트를 모아요 🎮
      </p>

      {!coupleId ? (
        <div className="rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
            <Icon name="gamepad" size={26} />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">커플 연결 후 대결해요</p>
          <p className="mt-1 text-xs text-muted">
            홈에서 상대와 연결하면 둘이 게임을 즐길 수 있어요.
          </p>
        </div>
      ) : (
        <>
          {/* 전적 + 포인트 */}
          <div className="rounded-[var(--radius-card)] bg-card glass p-4 shadow-[var(--shadow-md)] ring-1 ring-line">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-rose/12 text-rose-deep">
                  <Icon name="gamepad" size={18} />
                </span>
                <div>
                  <p className="text-[11px] text-muted">내 포인트</p>
                  <p className="text-lg font-extrabold text-gradient tabular-nums">
                    {record.points}P
                  </p>
                </div>
              </div>
              <div className="flex gap-3 text-center">
                <div>
                  <p className="text-base font-extrabold tabular-nums text-ink">{record.wins}</p>
                  <p className="text-[10px] text-muted">승</p>
                </div>
                <div>
                  <p className="text-base font-extrabold tabular-nums text-ink">{record.losses}</p>
                  <p className="text-[10px] text-muted">패</p>
                </div>
                <div>
                  <p className="text-base font-extrabold tabular-nums text-ink">{record.draws}</p>
                  <p className="text-[10px] text-muted">무</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setPicking(true)}
            className="tap mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-[var(--shadow-md)]"
          >
            <Icon name="gamepad" size={16} />새 대결 신청
          </button>

          {err && <p className="mt-3 text-xs text-rose-deep">{err}</p>}

          {/* 받은 도전 */}
          {pending.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 px-1 text-xs font-bold text-rose-deep">
                도전 왔어요! ⚔️
              </p>
              <ul className="space-y-2">
                {pending.map((c) => {
                  const g = gameMeta(c.game);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-rose/40"
                    >
                      <span className="text-2xl">{g?.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">{g?.label}</p>
                        <p className="truncate text-[11px] text-muted">
                          {partnerName || "상대"}의 도전
                        </p>
                      </div>
                      <button
                        onClick={() => setPlay({ kind: "respond", challenge: c })}
                        className="tap shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-sm)]"
                      >
                        도전하기
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 내가 신청 · 상대 대기중 */}
          {waiting.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 px-1 text-xs font-bold text-muted">상대 대기중</p>
              <ul className="space-y-2">
                {waiting.map((c) => {
                  const g = gameMeta(c.game);
                  const my = c.attempts.find((a) => a.user_id === uid);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl bg-glass2 px-4 py-3 ring-1 ring-line"
                    >
                      <span className="text-xl opacity-80">{g?.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{g?.label}</p>
                        <p className="text-[11px] text-muted">
                          내 기록 {my ? fmtScore(c.game, my.score) : "—"} · {partnerName || "상대"} 기다리는 중
                        </p>
                      </div>
                      <Icon name="clock" size={16} className="shrink-0 text-muted" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 지난 결과 */}
          {loading ? (
            <div className="mt-5">
              <SkeletonList rows={3} />
            </div>
          ) : resolved.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 px-1 text-xs font-bold text-muted">지난 대결</p>
              <ul className="space-y-2">
                {resolved.map((c) => {
                  const g = gameMeta(c.game);
                  const won = c.winner === uid;
                  const draw = c.result === "draw";
                  const my = c.attempts.find((a) => a.user_id === uid);
                  const op = c.attempts.find((a) => a.user_id !== uid);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-line"
                    >
                      <span className="text-xl">{g?.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{g?.label}</p>
                        <p className="text-[11px] text-muted tabular-nums">
                          나 {my ? fmtScore(c.game, my.score) : "—"} · {partnerName || "상대"}{" "}
                          {op ? fmtScore(c.game, op.score) : "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                          draw
                            ? "bg-glass text-muted ring-1 ring-line"
                            : won
                              ? "bg-rose/15 text-rose-deep ring-1 ring-rose"
                              : "bg-glass2 text-muted ring-1 ring-line"
                        }`}
                      >
                        {draw ? "무승부" : won ? "WIN +10" : "패"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            pending.length === 0 &&
            waiting.length === 0 && (
              <p className="mt-8 text-center text-xs text-muted">
                아직 대결이 없어요. 먼저 신청해 볼까요?
              </p>
            )
          )}
        </>
      )}

      {/* 게임 선택 시트 */}
      {picking && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setPicking(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="게임 선택"
            className="animate-sheet w-full max-w-md space-y-3 rounded-t-[var(--radius-card)] bg-surface glass p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-line-strong" />
            <h3 className="text-lg font-extrabold text-ink">어떤 게임?</h3>
            <p className="text-xs text-muted">
              내가 먼저 하고, 상대가 같은 판에 도전해요.
            </p>
            {GAMES.map((g) => (
              <button
                key={g.key}
                onClick={() => startNew(g.key)}
                disabled={busy}
                className="tap flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-[var(--shadow-sm)] ring-1 ring-line disabled:opacity-50"
              >
                <span className="text-2xl">{g.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{g.label}</p>
                  <p className="truncate text-[11px] text-muted">{g.desc}</p>
                </div>
                <Icon name="chevronRight" size={16} className="text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
