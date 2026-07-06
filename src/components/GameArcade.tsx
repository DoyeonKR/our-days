"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type GameChallenge,
  type RankEntry,
  createGameChallenge,
  getMyDailyPlays,
  listGameChallenges,
  listLeaderboard,
  recordPlay,
  resolveGameChallenge,
  submitGameAttempt,
  subscribeGameChallenges,
  updateMyRank,
} from "@/lib/couple";
import {
  DAILY_PLAYS,
  GAMES,
  type GameKey,
  gameRecord,
  newSeed,
  rankAscending,
} from "@/lib/game";
import { sendEventPush } from "@/lib/notify";
import Icon from "@/components/Icon";
import { SkeletonList } from "@/components/Skeleton";
import ReactionGame from "@/components/games/ReactionGame";
import MemoryMatch from "@/components/games/MemoryMatch";
import TapRace from "@/components/games/TapRace";
import NumberOrder from "@/components/games/NumberOrder";
import TimingBar from "@/components/games/TimingBar";

type PlayState =
  | { kind: "new"; game: GameKey; seed: number }
  | { kind: "respond"; challenge: GameChallenge };

const gameMeta = (k: GameKey) => GAMES.find((g) => g.key === k);
const fmtScore = (game: GameKey, s: number) =>
  game === "reaction" ? `${s}ms` : game === "tap" ? `${s}회` : `${s}`;

/** 게임 탭 — 커플 1:1 대결. 플레이하면 자동으로 글로벌 순위에 반영, 최고기록이면 축하 팝업. */
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
  const [daily, setDaily] = useState<Record<string, number>>({});
  // 최고기록 축하 팝업(자동 순위 반영)
  const [celebrate, setCelebrate] = useState<{ game: GameKey; score: number } | null>(null);
  const [cName, setCName] = useState("");
  const [cMsg, setCMsg] = useState("");
  // 순위판 보기(on-demand)
  const [boardOpen, setBoardOpen] = useState(false);
  const [rankGame, setRankGame] = useState<GameKey>("reaction");
  const [board, setBoard] = useState<RankEntry[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);

  const refreshDaily = () => getMyDailyPlays().then(setDaily).catch(() => {});

  useEffect(() => {
    refreshDaily();
    if (!coupleId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = () =>
      listGameChallenges(coupleId)
        .then((c) => !cancelled && (setChallenges(c), setLoading(false)))
        .catch(() => !cancelled && setLoading(false));
    load();
    const unsub = subscribeGameChallenges(coupleId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [coupleId]);

  // 순위판 시트 열릴 때 / 게임 전환 시 로드
  useEffect(() => {
    if (!boardOpen) return;
    let cancelled = false;
    setBoardLoading(true);
    listLeaderboard(rankGame, rankAscending(rankGame))
      .then((b) => !cancelled && (setBoard(b), setBoardLoading(false)))
      .catch(() => !cancelled && setBoardLoading(false));
    return () => {
      cancelled = true;
    };
  }, [boardOpen, rankGame]);

  // 자가치유: 양쪽 attempt 보이는데 open 이면 resolve
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
  const remaining = (g: GameKey) => DAILY_PLAYS - (daily[g] ?? 0);

  function startNew(game: GameKey) {
    setPicking(false);
    if (remaining(game) <= 0) {
      setErr(`${gameMeta(game)?.label}은 오늘 3판 다 했어요. 자정에 초기화돼요.`);
      return;
    }
    setErr(null);
    setPlay({ kind: "new", game, seed: newSeed() });
  }
  function startRespond(c: GameChallenge) {
    if (remaining(c.game) <= 0) {
      setErr(`${gameMeta(c.game)?.label}은 오늘 3판 다 했어요. 자정에 초기화돼요.`);
      return;
    }
    setErr(null);
    setPlay({ kind: "respond", challenge: c });
  }

  // 한 판 종료 → 순위 자동 반영(일일 제한) + 대결 처리 + 최고기록이면 축하 팝업
  async function onPlayDone(score: number) {
    if (!play || !coupleId) {
      setPlay(null);
      return;
    }
    const game = play.kind === "respond" ? play.challenge.game : play.game;
    setBusy(true);
    setErr(null);
    let isBest = false;
    try {
      const res = await recordPlay(game, score); // 순위 자동 반영 + 일일 제한
      isBest = res.isBest;
      if (play.kind === "new") {
        await createGameChallenge(play.game, play.seed, score);
        const g = gameMeta(play.game);
        sendEventPush(
          coupleId,
          "game",
          `${g?.emoji ?? "🎮"} ${g?.label} 대결 신청!`,
          `${myName || "상대"}이 도전했어요 · 얼른 도전해서 기록을 남겨봐요!`,
        );
      } else {
        await submitGameAttempt(coupleId, play.challenge.id, score);
        await resolveGameChallenge(play.challenge.id);
        const g = gameMeta(play.challenge.game);
        sendEventPush(
          coupleId,
          "game",
          `${g?.emoji ?? "🎮"} 대결 결과가 나왔어요!`,
          `${myName || "상대"}이 도전을 완료했어요 · 결과를 확인해 보세요`,
        );
      }
      setPlay(null);
      if (isBest) {
        setCMsg("");
        setCName(myName || "");
        setCelebrate({ game, score });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPlay(null);
    } finally {
      setBusy(false);
      refreshDaily();
    }
  }

  // 축하 팝업에서 한마디 등록
  async function saveCelebrate() {
    if (!celebrate) return;
    setBusy(true);
    try {
      if (cName.trim() || cMsg.trim()) {
        await updateMyRank(celebrate.game, cName || myName || "익명", cMsg);
      }
      setCelebrate(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // 게임 플레이 오버레이 (단판)
  if (play) {
    const game = play.kind === "respond" ? play.challenge.game : play.game;
    const seed = play.kind === "respond" ? play.challenge.seed : play.seed;
    const props = { seed, onDone: onPlayDone, onCancel: () => setPlay(null) };
    if (game === "reaction") return <ReactionGame {...props} />;
    if (game === "memory") return <MemoryMatch {...props} />;
    if (game === "tap") return <TapRace {...props} />;
    if (game === "order") return <NumberOrder {...props} />;
    return <TimingBar {...props} />;
  }

  return (
    <section className="mx-auto max-w-md px-5 pb-28 pt-8">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">둘이 대결</h1>
          <p className="mt-0.5 text-xs text-muted">
            하루 3판 · 최고 기록은 순위판에 자동 반영 🎮
          </p>
        </div>
        <button
          onClick={() => setBoardOpen(true)}
          className="tap mt-1 flex shrink-0 items-center gap-1 rounded-full bg-rose/12 px-3 py-1.5 text-xs font-bold text-rose-deep"
        >
          <Icon name="flame" size={14} />순위판
        </button>
      </div>

      {!coupleId ? (
        <div className="rounded-[var(--radius-card)] bg-card glass px-5 py-10 text-center shadow-[var(--shadow-md)] ring-1 ring-line">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-glass text-rose-deep ring-1 ring-line">
            <Icon name="gamepad" size={26} />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">커플 연결 후 즐겨요</p>
          <p className="mt-1 text-xs text-muted">
            홈에서 상대와 연결하면 대결과 순위판을 열 수 있어요.
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

          {pending.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 px-1 text-xs font-bold text-rose-deep">도전 왔어요! ⚔️</p>
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
                        onClick={() => startRespond(c)}
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
              내가 먼저 하고, 상대가 같은 판에 도전해요. 최고 기록은 순위판에 자동 반영!
            </p>
            {GAMES.map((g) => {
              const left = remaining(g.key);
              return (
                <button
                  key={g.key}
                  onClick={() => startNew(g.key)}
                  disabled={busy || left <= 0}
                  className="tap flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-[var(--shadow-sm)] ring-1 ring-line disabled:opacity-40"
                >
                  <span className="text-2xl">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{g.label}</p>
                    <p className="truncate text-[11px] text-muted">
                      {left > 0 ? g.desc : "오늘 3판 다 했어요"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-muted">
                    {left}/{DAILY_PLAYS}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 최고기록 축하 팝업 — 순위 자동 반영 + 한마디 등록 */}
      {celebrate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="최고 기록 축하"
            className="animate-pop w-full max-w-sm space-y-3 rounded-[var(--radius-card)] bg-surface glass p-6 text-center shadow-[var(--shadow-lg)] ring-1 ring-line"
          >
            <p className="text-4xl">🎉</p>
            <p className="text-lg font-extrabold text-ink">축하드려요!</p>
            <p className="text-sm text-muted">
              {gameMeta(celebrate.game)?.label} <b className="text-rose-deep">최고 기록</b>{" "}
              <b className="tabular-nums text-ink">{fmtScore(celebrate.game, celebrate.score)}</b>
              <br />
              순위판에 반영됐어요!
            </p>
            <div className="space-y-2 pt-1 text-left">
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value.slice(0, 16))}
                maxLength={16}
                placeholder="순위판 이름 (닉네임)"
                className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-sm outline-none focus:border-rose"
              />
              <input
                value={cMsg}
                onChange={(e) => setCMsg(e.target.value.slice(0, 30))}
                maxLength={30}
                placeholder="한마디 남기기 (30자, 선택)"
                className="w-full rounded-xl border border-line bg-glass px-3 py-2.5 text-sm outline-none focus:border-rose"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCelebrate(null)}
                className="tap rounded-xl px-4 py-2.5 text-sm text-muted"
              >
                나중에
              </button>
              <button
                onClick={saveCelebrate}
                disabled={busy}
                className="tap flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-[var(--shadow-md)] disabled:opacity-50"
              >
                등록하기 🏆
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 순위판 보기 시트 (on-demand) */}
      {boardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setBoardOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="순위판"
            className="animate-sheet max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-card)] bg-surface glass p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line-strong" />
            <h3 className="text-lg font-extrabold text-ink">🏆 순위판</h3>
            <p className="mt-0.5 text-xs text-muted">
              전체 사용자 · {rankAscending(rankGame) ? "낮을수록" : "높을수록"} 상위
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {GAMES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setRankGame(g.key)}
                  className={`tap rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
                    rankGame === g.key
                      ? "bg-rose/15 text-rose-deep ring-rose"
                      : "bg-glass text-muted ring-line"
                  }`}
                >
                  {g.emoji} {g.label}
                </button>
              ))}
            </div>
            {boardLoading ? (
              <div className="mt-4">
                <SkeletonList rows={4} />
              </div>
            ) : board.length === 0 ? (
              <p className="mt-8 text-center text-xs text-muted">
                아직 기록이 없어요. 첫 기록의 주인공이 되어보세요! 🏆
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {board.map((e, i) => {
                  const mine = e.user_id === uid;
                  const top = i === 0;
                  return (
                    <li
                      key={e.user_id}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${
                        mine ? "bg-rose/10 ring-rose" : "bg-card ring-line"
                      }`}
                    >
                      <span
                        className={`w-6 shrink-0 text-center text-sm font-black tabular-nums ${
                          top ? "text-rose-deep" : "text-muted"
                        }`}
                      >
                        {top ? "👑" : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">
                          {e.display_name}
                          {mine && (
                            <span className="ml-1 text-[10px] font-semibold text-rose-deep">나</span>
                          )}
                        </p>
                        {e.message && (
                          <p className="truncate text-[11px] text-muted">“{e.message}”</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                        {fmtScore(e.game, e.best_score)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
