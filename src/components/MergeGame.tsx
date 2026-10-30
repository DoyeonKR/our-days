"use client";

/* 정원 합치기 — 밀어서 같은 작물을 합치는 4×4 퍼즐. 규칙은 전부 lib/merge.ts(순수) 가 정하고
 * 이 화면은 입력(스와이프 · 방향키) · 연출(미끄러짐 · 합쳐짐 · 새 타일) · 기록만 맡는다.
 * [사용자 2026-10-31 "2048 게임 알아? 진짜 이걸 완벽하게 +@ 로 구현해볼래?"]
 *
 * ⚠ 진행 중인 판은 이 기기 localStorage 에 둔다(섬에 매 수 쓰면 무료 티어에서 사고다 — 사냥과 같은 이유).
 *   섬에는 **끝난 판만** 한 번 쓴다(하트 · 최고 기록 — settleGame).
 * ⚠ 연출은 타일 id 를 key 로 그려서 같은 DOM 이 옮겨 가게 한다. 합쳐져 사라지는 타일은 잠깐(ghost) 남겨
 *   목표 칸까지 미끄러진 뒤 지운다 — 바로 지우면 한쪽 타일이 순간이동한 것처럼 보인다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CropIcon } from "@/components/island/CropIcon";
import { Coin } from "@/components/island/UiIcon";
import { confirmDialog } from "@/lib/confirm";
import { getMergeLeaderboard, loadIsland, saveIsland, submitMergeScore, type MergeRank } from "@/lib/couple";
import { kstDate } from "@/lib/kst";
import {
  CHAIN, DAILY_COIN_CAP, GOAL_LV, SCORE_PER_COIN, SIZE,
  chainOf, isGame, mergeOf, newGame, play, settleGame,
  type Dir, type Game, type MergeRecord, type Tile,
} from "@/lib/merge";

const SLIDE_MS = 110;
/* 연출 — [사용자 2026-10-31 "이펙트도 엄청 화려하게"]
   합칠 때마다: 도트 파편이 사방으로 튀고(높은 단계일수록 많이 · 멀리) · 빛 고리 · 점수가 떠오른다.
   한 번에 여럿 합치면 '콤보' · 높은 단계는 판이 흔들리고 번쩍 · 무등산수박을 처음 키우면 화면 가득 축포.
   ⚠ 파편 각도·거리는 난수가 아니라 칸 번호로 정한다(렌더가 순수해야 한다 — react-hooks/purity).
   ⚠ 움직임 줄이기 설정이면 CSS 가 전부 끈다(globals.css 끝). */
const FX_MS = 720;
type Burst = { key: number; at: number; lv: number; gain: number; fert: boolean };
const PALETTE = ["#9be15d", "#ffb05c", "#ff6b8a", "#ffe066", "#b18cff", "#f4f4f4", "#ff8a65", "#d36ba6", "#ffa94d", "#9d7bff", "#5fd35f", "#ff9ec7", "#ffd35c"];
const sparkColor = (lv: number) => PALETTE[(Math.max(1, lv) - 1) % PALETTE.length];
const storeKey = (scope: string) => `ourdays:merge:v1:${scope}`;
/** settled = 섬(하트 · 커플 기록)에 남김 · ranked = 전체 순위에 등록. 둘을 따로 세야 한쪽만 실패했을 때
 *  다시 시도하면서 하트를 두 번 주지 않는다. ranked 가 없는 옛 저장분은 등록 안 된 것으로 본다. */
type Saved = { game: Game; settled: boolean; ranked?: boolean };

function readSaved(scope: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(scope)) ?? "null") as Saved | null;
    return v && isGame(v.game) ? v : null;
  } catch {
    return null;
  }
}
function writeSaved(scope: string, v: Saved) {
  try {
    localStorage.setItem(storeKey(scope), JSON.stringify(v));
  } catch {
    /* 저장 실패해도 판은 계속된다(새로고침하면 처음부터일 뿐) */
  }
}
const freshSeed = () => (Math.random() * 2 ** 32) >>> 0;

export default function MergeGame({
  coupleId,
  myUserId,
  myName = "",
  partnerName = "",
  onClose,
}: {
  coupleId: string | null;
  myUserId: string | null;
  myName?: string;
  partnerName?: string;
  onClose: () => void;
}) {
  const who = myUserId ?? "me";
  const scope = coupleId ?? "solo";
  const [saved, setSaved] = useState<Saved | null>(null);
  const [ghosts, setGhosts] = useState<{ tile: Tile; at: number }[]>([]);
  const [fx, setFx] = useState<{ merged: number[]; born: number | null }>({ merged: [], born: null });
  const [record, setRecord] = useState<MergeRecord | null>(null);
  const [hasIsland, setHasIsland] = useState(true);
  const [reward, setReward] = useState<{ coins: number; newBest: boolean; capped: boolean } | null>(null);
  const [rewardErr, setRewardErr] = useState<string | null>(null);
  const [goalToast, setGoalToast] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null);
  const [shake, setShake] = useState<{ key: number; big: boolean } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [bestFlash, setBestFlash] = useState(0);
  const fxSeq = useRef(0);
  const bestShown = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settling = useRef(false);
  const [board, setBoard] = useState<MergeRank[] | null>(null);
  const [boardErr, setBoardErr] = useState(false);
  const loadBoard = useCallback(async () => {
    try {
      setBoard(await getMergeLeaderboard());
      setBoardErr(false);
    } catch {
      setBoardErr(true);
    }
  }, []);
  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  // 이어하기 — 저장된 판이 있으면 그대로, 없으면 새 판
  useEffect(() => {
    const v = readSaved(scope);
    setSaved(v ?? { game: newGame(freshSeed()), settled: false });
  }, [scope]);
  useEffect(() => {
    if (saved) writeSaved(scope, saved);
  }, [scope, saved]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const loadRecord = useCallback(async () => {
    const row = await loadIsland(coupleId).catch(() => null);
    setHasIsland(!!row);
    setRecord(row ? mergeOf(row.state) : null);
  }, [coupleId]);
  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  /** 끝난 판을 전체 순위에 — 판이 끝나면 **무조건** 등록한다(섬이 없어도). 실패하면 ranked 가 false 로 남아 다음에 다시. */
  const rank = useCallback(
    async (g: Game) => {
      if (g.score <= 0) return;
      await submitMergeScore((myName || "").trim() || "이름 없음", g.score, g.top);
      void loadBoard();
    },
    [myName, loadBoard],
  );

  /** 끝난 판을 섬에 — 하트 · 최고 기록. 버전 충돌이면 다시 읽어 한 번 더. */
  const settle = useCallback(
    async (g: Game) => {
      if (settling.current || g.score <= 0) return;
      settling.current = true;
      setRewardErr(null);
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const row = await loadIsland(coupleId).catch(() => null);
          if (!row) {
            setHasIsland(false);
            return;
          }
          const today = kstDate(Date.now());
          const r = settleGame(row.state, who, g.score, g.top, today);
          try {
            const updated = await saveIsland(coupleId, row.version, r.state);
            setRecord(mergeOf(updated.state));
            setReward({ coins: r.coins, newBest: r.newBest, capped: mergeOf(r.state).dayCoins >= DAILY_COIN_CAP });
            return;
          } catch {
            /* 상대가 그 사이 섬을 바꿨다 — 다시 읽어서 한 번 더 */
          }
        }
        setRewardErr("섬에 기록하지 못했어요. 잠시 후 다시 열면 이어서 시도해요.");
        // 실패하면 settled 가 false 로 남아 다음에 열 때 다시 시도한다
        throw new Error("settle failed");
      } finally {
        settling.current = false;
      }
    },
    [coupleId, who],
  );

  // 끝난 판인데 섬 · 순위에 못 남긴 채 닫혔으면(네트워크 · 바로 닫기) 다시 열 때 이어서 남긴다
  const pendingSettle = saved && saved.game.over && !saved.settled ? saved.game : null;
  useEffect(() => {
    if (!pendingSettle) return;
    void settle(pendingSettle).then(() => setSaved((cur) => (cur && cur.game === pendingSettle ? { ...cur, settled: true } : cur))).catch(() => {});
    // 판이 바뀔 때만(같은 판으로 두 번 남기지 않게 settle 안에서도 settling 으로 막는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSettle?.moves, pendingSettle?.score]);
  const pendingRank = saved && saved.game.over && !saved.ranked ? saved.game : null;
  useEffect(() => {
    if (!pendingRank) return;
    void rank(pendingRank).then(() => setSaved((cur) => (cur && cur.game === pendingRank ? { ...cur, ranked: true } : cur))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRank?.moves, pendingRank?.score]);

  const move = useCallback(
    (dir: Dir) => {
      if (!saved || saved.game.over) return;
      const t = play(saved.game, dir);
      if (!t.result) return;
      const vanishedAt = new Map(t.result.slides.map((s) => [s.id, s.to]));
      setGhosts(t.result.vanished.map((tile) => ({ tile, at: vanishedAt.get(tile.id) ?? 0 })));
      setFx({ merged: t.result.merged, born: t.born });
      timers.current.push(setTimeout(() => setGhosts([]), SLIDE_MS + 20));
      timers.current.push(setTimeout(() => setFx({ merged: [], born: null }), 260));
      if (t.goalNow) setGoalToast(true);

      // ── 연출 ──
      const board = t.game.board;
      const made = t.result.merged
        .map((id) => {
          const at = board.findIndex((x) => x?.id === id);
          const tile = at >= 0 ? board[at] : null;
          return tile ? { at, lv: tile.lv } : null;
        })
        .filter((x): x is { at: number; lv: number } => !!x);
      if (made.length) {
        const base = ++fxSeq.current * 100;
        const vanishedFert = new Set(t.result.vanished.filter((v) => v.fert).map((v) => vanishedAt.get(v.id)));
        setBursts(made.map((m, i) => ({ key: base + i, at: m.at, lv: m.lv, gain: 2 ** m.lv, fert: vanishedFert.has(m.at) })));
        timers.current.push(setTimeout(() => setBursts((cur) => cur.filter((b) => b.key < base || b.key >= base + 100)), FX_MS));
        const top = Math.max(...made.map((m) => m.lv));
        if (made.length >= 2) {
          setCombo({ n: made.length, key: base });
          timers.current.push(setTimeout(() => setCombo((c) => (c?.key === base ? null : c)), 900));
        }
        if (top >= 7 || made.length >= 3) setShake({ key: base, big: top >= 9 });
        if (t.goalNow) setConfetti(base);
        const prevBest = record?.best[who] ?? 0;
        if (!bestShown.current && prevBest > 0 && t.game.score > prevBest) {
          bestShown.current = true;
          setBestFlash(base);
        }
      }
      // 끝난 판은 아래 pendingSettle effect 가 섬에 남긴다(한 곳에서만)
      setSaved({ game: t.game, settled: false });
    },
    [saved, record, who],
  );

  // 방향키(데스크톱)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const)[e.key as "ArrowLeft"];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // 스와이프 — 판 위에서만(페이지 스크롤과 안 싸우게 touch-action: none)
  const start = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  async function restart() {
    if (!saved) return;
    const g = saved.game;
    if (!g.over && g.score > 0) {
      const ok = await confirmDialog({
        message: `지금 판을 끝내고 새로 시작할까요? 점수 ${g.score.toLocaleString()}점은 섬 하트로 받아요.`,
        confirmText: "새로 시작",
      });
      if (!ok) return;
    }
    if (!saved.settled) await settle(g).catch(() => {});
    if (!saved.ranked) await rank(g).catch(() => {});
    setReward(null);
    setGoalToast(false);
    bestShown.current = false;
    setGhosts([]);
    setSaved({ game: newGame(freshSeed()), settled: false, ranked: false });
  }

  if (!saved) return <Shell onClose={onClose}><p className="p-6 text-center text-sm text-muted">불러오는 중…</p></Shell>;
  const g = saved.game;
  const myBest = Math.max(record?.best[who] ?? 0, g.score);
  const partnerBest = record ? Object.entries(record.best).find(([k]) => k !== who)?.[1] : undefined;
  const tiles: { tile: Tile; at: number; ghost?: true }[] = [
    ...g.board.flatMap((t, i) => (t ? [{ tile: t, at: i }] : [])),
    ...ghosts.map((x) => ({ ...x, ghost: true as const })),
  ].sort((a, b) => a.tile.id - b.tile.id); // DOM 순서를 id 로 고정 — 순서가 바뀌면 React 가 노드를 옮겨 전환이 끊긴다

  return (
    <Shell onClose={onClose}>
      <div className="merge-wrap px-4 pb-10">
        {/* 점수판 */}
        <div className="merge-scores">
          <div><small>점수</small><strong>{g.score.toLocaleString()}</strong></div>
          <div><small>내 최고</small><strong>{myBest.toLocaleString()}</strong></div>
          {partnerBest !== undefined && <div><small>{partnerName || "상대"} 최고</small><strong>{partnerBest.toLocaleString()}</strong></div>}
        </div>
        <div className="merge-tools">
          <button type="button" onClick={() => void restart()} className="tap">새 게임</button>
        </div>

        {/* 판 */}
        {combo && (
          <p key={combo.key} className="merge-combo" aria-live="polite">
            콤보 <b>×{combo.n}</b>
          </p>
        )}
        <div
          className={`merge-board ${shake ? (shake.key % 200 ? "is-shake-a" : "is-shake-b") : ""} ${shake?.big ? "is-flash" : ""}`}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (start.current = null)}
          role="application"
          aria-label={`정원 합치기 판. 화살표 키나 밀기로 움직여요. 점수 ${g.score}`}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => <span key={`c${i}`} className="merge-cell" style={pos(i)} aria-hidden />)}
          {tiles.map(({ tile, at, ghost }) => (
            <span
              key={tile.id}
              className={`merge-tile ${tile.fert ? "is-fert" : `lv-${tile.lv}`} ${fx.merged.includes(tile.id) ? "is-merged" : ""} ${fx.born === tile.id ? "is-born" : ""} ${ghost ? "is-ghost" : ""}`}
              style={pos(at)}
              aria-hidden
            >
              {tile.fert ? (
                <><b className="merge-fert-glyph">✦</b><small>황금 거름</small></>
              ) : (
                <><CropIcon cropKey={chainOf(tile.lv).key} stage={3} size={tile.lv >= 10 ? 46 : 40} /><small>{chainOf(tile.lv).name}</small></>
              )}
            </span>
          ))}
          {bursts.map((b) => (
            <span key={b.key} className={`merge-burst ${b.lv >= GOAL_LV ? "is-legend" : ""}`} style={{ ...pos(b.at), "--spark": sparkColor(b.lv) } as React.CSSProperties} aria-hidden>
              <i className="merge-ring" />
              {b.lv >= 6 && <i className="merge-ring is-late" />}
              {Array.from({ length: Math.min(20, 8 + b.lv) }, (_, k) => {
                const n = Math.min(20, 8 + b.lv);
                const ang = ((k / n) * 360 + b.at * 17) * (Math.PI / 180);
                const dist = 30 + b.lv * 4 + (k % 3) * 9;
                return <i key={k} className="merge-spark" style={{ "--dx": `${Math.round(Math.cos(ang) * dist)}px`, "--dy": `${Math.round(Math.sin(ang) * dist)}px`, "--d": `${(k % 4) * 25}ms` } as React.CSSProperties} />;
              })}
              <b className="merge-gain">+{b.gain.toLocaleString()}</b>
              {b.fert && <b className="merge-fert-pop">거름 효과!</b>}
            </span>
          ))}
          {g.over && (
            <div className="merge-over" role="status">
              <strong>더 합칠 수 없어요</strong>
              <span>점수 {g.score.toLocaleString()} · {chainOf(Math.max(1, g.top)).name}까지 키웠어요</span>
              {reward && (
                <span className="merge-reward">
                  {reward.coins > 0 ? <>섬 하트 +{reward.coins}<Coin /></> : reward.capped ? "오늘 받을 하트는 다 받았어요" : "하트는 점수 50점마다 1개"}
                  {reward.newBest && " · 새 최고 기록!"}
                </span>
              )}
              {!hasIsland && <span className="merge-reward">섬을 시작하면 점수가 하트로 쌓여요</span>}
              {rewardErr && <span className="merge-reward">{rewardErr}</span>}
              <button type="button" onClick={() => void restart()} className="tap">다시 하기</button>
            </div>
          )}
        </div>

        {bestFlash > 0 && (
          <p key={bestFlash} className="merge-best-flash" aria-live="polite">새 최고 기록!</p>
        )}
        {confetti > 0 && (
          <div key={confetti} className="merge-confetti" aria-hidden>
            {Array.from({ length: 56 }, (_, k) => (
              <i key={k} style={{ "--x": `${(k * 37) % 100}%`, "--d": `${(k % 7) * 90}ms`, "--c": PALETTE[k % PALETTE.length], "--w": `${6 + (k % 3) * 3}px`, "--sway": `${((k % 5) - 2) * 18}px` } as React.CSSProperties} />
            ))}
          </div>
        )}
        {goalToast && !g.over && (
          <button type="button" className="merge-goal tap" onClick={() => setGoalToast(false)}>
            <CropIcon cropKey="watermelon" stage={3} size={34} />
            <span><strong>전설의 무등산수박을 키웠어요!</strong><small>계속하면 천도복숭아 · 불로초까지 — 눌러서 닫기</small></span>
          </button>
        )}

        {/* 성장 사다리 — 어디까지 키웠는지 */}
        <div className="merge-ladder" aria-label={`키운 단계 ${g.top} / ${CHAIN.length}`}>
          {CHAIN.map((c, i) => (
            <span key={c.key} className={i + 1 <= Math.max(g.top, record?.top[who] ?? 0) ? "is-seen" : ""} title={`${i + 1}단계 ${c.name}`}>
              <CropIcon cropKey={c.key} stage={3} size={22} />
              {i + 1 === GOAL_LV && <i aria-hidden>목표</i>}
            </span>
          ))}
        </div>

        {/* 전체 순위 — 모든 커플 공통, 사람마다 최고 점수 한 줄. 판이 끝나면 저절로 올라간다. */}
        <section className="merge-rank" aria-label="전체 순위">
          <header><strong>전체 순위</strong><small>모든 사람 · 최고 점수</small></header>
          {board === null ? (
            <p className="merge-rank-empty">{boardErr ? "순위를 불러오지 못했어요" : "불러오는 중…"}</p>
          ) : board.length === 0 ? (
            <p className="merge-rank-empty">아직 기록이 없어요. 첫 1등이 되어 보세요!</p>
          ) : (
            <ol>
              {board.map((r) => (
                <li key={`${r.rank}-${r.is_me}`} className={`${r.is_me ? "is-me" : ""} ${r.rank <= 3 ? `is-top is-top-${r.rank}` : ""} ${r.rank > 10 ? "is-outside" : ""}`}>
                  <b className="merge-rank-no">{r.rank}</b>
                  <CropIcon cropKey={chainOf(Math.max(1, r.top_lv)).key} stage={3} size={22} />
                  <span className="merge-rank-name">{r.nickname}{r.is_me && <em> (나)</em>}</span>
                  <span className="merge-rank-score">{r.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <ul className="merge-rules">
          <li>밀면 모든 작물이 그쪽으로 몰리고, <b>같은 작물 둘</b>이 부딪히면 다음 작물로 자라요.</li>
          <li><b>황금 거름</b>은 부딪힌 작물을 한 단계 키워 줘요.</li>
          <li>판이 끝나면 점수가 <b>전체 순위</b>에 저절로 올라가요(내 최고 점수 한 줄).</li>
          <li>끝난 판의 점수 {SCORE_PER_COIN}점마다 <b>섬 하트 1개</b>(하루 {DAILY_COIN_CAP}개까지).</li>
        </ul>
      </div>
    </Shell>
  );
}

/** 칸 위치 — 판 너비를 CSS 변수로 나눠 쓴다(화면 폭이 바뀌어도 같은 비율). */
function pos(i: number): React.CSSProperties {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  return { "--r": r, "--c": c, "--slide": `${SLIDE_MS}ms` } as React.CSSProperties;
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="merge-shell fixed inset-0 z-[90] overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-md">
        <div className="merge-head sticky top-0 z-10 flex items-center justify-between px-4 py-3">
          <p className="flex items-center gap-1.5 text-base font-extrabold">
            <CropIcon cropKey="watermelon" stage={3} size={24} />
            정원 합치기
          </p>
          <button onClick={onClose} className="tap rounded-full px-3 py-1.5 text-sm font-bold merge-close">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
