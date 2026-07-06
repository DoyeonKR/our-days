"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  BOARD,
  BG_ISLAND_FEE,
  BG_MAX_LEVEL,
  BG_MAX_LAPS,
  type BGState,
  applyRoll,
  autoResolve,
  buildUp,
  buyTile,
  chooseSpace,
  createBoardState,
  endTurn,
  netWorth,
  newBoardSeed,
  payIsland,
  skipBuy,
  upgradableTiles,
} from "@/lib/boardgame";
import {
  type BoardGameRow,
  commitBoardAction,
  createBoardGame,
  getBoardGame,
  resignBoardGame,
  subscribeBoardGame,
  subscribeBoardPresence,
} from "@/lib/couple";
import { sendEventPush } from "@/lib/notify";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";

const DIE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const PLAYER_COLOR = ["#ec4899", "#38bdf8"]; // p0 핑크, p1 하늘
const GROUP_HUE: Record<string, string> = {
  A: "#f9a8d4",
  B: "#fca5a5",
  C: "#fcd34d",
  D: "#86efac",
  E: "#5eead4",
  F: "#93c5fd",
  H: "#c4b5fd",
};

/** 링(28칸) idx → 8×8 CSS 그리드 위치(1-based). 모서리 0/7/14/21. */
function tileRC(idx: number): { r: number; c: number } {
  if (idx <= 7) return { r: 1, c: idx + 1 }; // 상단
  if (idx <= 14) return { r: idx - 6, c: 8 }; // 우측
  if (idx <= 21) return { r: 8, c: 22 - idx }; // 하단
  return { r: 29 - idx, c: 1 }; // 좌측
}

const won = (v: number) => `₩${v.toLocaleString()}`;

function TileView({
  idx,
  cell,
  tokens,
  highlight,
  onClick,
}: {
  idx: number;
  cell: { owner: number | null; level: number };
  tokens: number[];
  highlight: boolean;
  onClick: () => void;
}) {
  const t = BOARD[idx];
  const rc = tileRC(idx);
  const isCorner = t.type !== "city" && t.type !== "chance" && t.type !== "tax";
  return (
    <button
      onClick={onClick}
      style={{
        gridRow: rc.r,
        gridColumn: rc.c,
        boxShadow: cell.owner !== null ? `inset 0 0 0 2px ${PLAYER_COLOR[cell.owner]}` : undefined,
      }}
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.06] px-0.5 py-0.5 ${
        highlight ? "animate-pulse ring-2 ring-white" : ""
      } ${isCorner ? "bg-white/[0.1]" : ""}`}
    >
      {t.group && (
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: GROUP_HUE[t.group] }} />
      )}
      <span className="text-[13px] leading-none">{t.emoji}</span>
      <span className="mt-0.5 line-clamp-1 text-[7px] font-bold leading-none text-white/75">
        {t.name}
      </span>
      {cell.level > 0 && (
        <span className="mt-0.5 flex gap-[1px]">
          {Array.from({ length: cell.level }).map((_, i) => (
            <span key={i} className="h-[3px] w-[3px] rounded-[1px] bg-amber-300" />
          ))}
        </span>
      )}
      {tokens.length > 0 && (
        <span className="absolute bottom-0.5 right-0.5 flex gap-0.5">
          {tokens.map((p) => (
            <span
              key={p}
              className="h-2 w-2 rounded-full ring-1 ring-white/80"
              style={{ background: PLAYER_COLOR[p] }}
            />
          ))}
        </span>
      )}
    </button>
  );
}

export default function BoardGame({
  coupleId,
  myUserId,
  myName,
  partnerName,
  onClose,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
  onClose: () => void;
}) {
  const [row, setRow] = useState<BoardGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollFace, setRollFace] = useState<[number, number]>([1, 1]);
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onlineRef = useRef<string[]>([]); // 최신 접속목록(커밋 클로저 stale 방지)

  const s: BGState | null = row?.state ?? null;
  const myIdx = row && myUserId ? row.players.indexOf(myUserId) : -1;
  const myTurn = !!row && row.status === "playing" && row.turn_user === myUserId;
  const partnerUid = row?.players.find((u) => u !== myUserId) ?? null;
  const partnerOnline = !!partnerUid && online.includes(partnerUid);
  const spaceMode = myTurn && s?.pending?.kind === "space";

  // 로드 + 실시간 구독 + presence
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    const load = () =>
      getBoardGame(coupleId)
        .then((r) => !cancelled && setRow(r))
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    const u1 = subscribeBoardGame(coupleId, load);
    const u2 = myUserId ? subscribeBoardPresence(coupleId, myUserId, setOnline) : () => {};
    return () => {
      cancelled = true;
      u1();
      u2();
    };
  }, [coupleId, myUserId]);

  useEffect(() => () => {
    if (rollTimer.current) clearInterval(rollTimer.current);
  }, []);

  // 접속목록을 ref 에도 미러 → 커밋 완료(비동기) 시점의 최신 값으로 푸시 판단
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  // 내 차례·건설(act)이 아니게 되면 건설모드 자동 해제(잔존 하이라이트 방지)
  useEffect(() => {
    if (!myTurn || s?.phase !== "act") setBuilding(false);
  }, [myTurn, s?.phase]);

  // 상태 커밋(차례자·버전락). 성공 시 서버행 반영 + 상대 오프라인이면 '네 차례' 푸시.
  // 상태 커밋(차례자·버전락). React Compiler 가 메모이즈 — 수동 useCallback 불필요.
  const commit = async (next: BGState) => {
    if (!row || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await commitBoardAction(row.id, row.version, next);
      setRow(updated);
      // 턴이 상대에게 넘어갔고 상대가 오프라인이면 '네 차례' 푸시(ref=최신 접속목록)
      if (updated.turn_user !== myUserId && partnerUid && !onlineRef.current.includes(partnerUid)) {
        sendEventPush(
          coupleId,
          "game",
          "🎲 네 차례야!",
          "부루마블 — 상대가 수를 뒀어요. 얼른 이어서 둬요!",
        ).catch(() => {});
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      // stale/차례 아님 → 서버 최신으로 재동기화(누른 수는 버림). 건설모드는 유지(엣지: 재시도).
      getBoardGame(coupleId)
        .then((r) => setRow(r))
        .catch(() => {});
      setErr(
        code === "40001"
          ? "동기화 중이었어요. 최신 상태로 맞췄으니 다시 시도해요."
          : (e as { message?: string })?.message ?? "오류가 났어요.",
      );
    } finally {
      setBusy(false);
    }
  };

  async function startGame() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const seed = newBoardSeed();
      const init = createBoardState(seed, [myName || "나", partnerName || "상대"]);
      const created = await createBoardGame(seed, init);
      setRow(created);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "시작 실패");
    } finally {
      setBusy(false);
    }
  }

  function doRoll() {
    if (!s || !myTurn || busy || rolling) return;
    setRolling(true);
    if (rollTimer.current) clearInterval(rollTimer.current);
    rollTimer.current = setInterval(() => {
      setRollFace([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 80);
    setTimeout(() => {
      if (rollTimer.current) clearInterval(rollTimer.current);
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      setRollFace([d1, d2]);
      setRolling(false);
      let next = applyRoll(s, d1, d2);
      next = autoResolve(next, Math.random);
      commit(next);
    }, 560);
  }

  const act = (next: BGState) => commit(next);
  const doBuy = () => s && act(autoResolve(buyTile(s), Math.random));
  const doSkip = () => s && act(autoResolve(skipBuy(s), Math.random));
  const doEndTurn = () => s && act(endTurn(s));
  const doPayIsland = () => s && act(payIsland(s));

  function onTileClick(idx: number) {
    if (!s || !myTurn || busy) return;
    if (spaceMode) {
      if (idx !== s.players[myIdx].pos && BOARD[idx].type !== "space") {
        act(autoResolve(chooseSpace(s, idx), Math.random));
      }
      return;
    }
    if (building) {
      const cell = s.cells[idx];
      if (BOARD[idx].type === "city" && cell.owner === myIdx && cell.level < BG_MAX_LEVEL) {
        act(buildUp(s, idx));
      }
    }
  }

  async function doResign() {
    if (!row || myIdx < 0 || busy) return;
    if (
      !(await confirmDialog({
        message: "정말 항복할까요?",
        detail: "상대의 승리로 판이 끝나요.",
        confirmText: "항복",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      // 차례와 무관하게 항복 가능(전용 RPC — 상대 차례에도 포기 가능)
      const updated = await resignBoardGame(row.id);
      setRow(updated);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "오류가 났어요.");
    } finally {
      setBusy(false);
    }
  }

  async function doAbandon() {
    if (!row) {
      onClose();
      return;
    }
    if (
      !(await confirmDialog({
        message: "게임을 나갈까요?",
        detail: "진행 중이면 나중에 이어서 둘 수 있어요.",
        confirmText: "나가기",
      }))
    )
      return;
    onClose();
  }

  // ── 렌더 ─────────────────────────────────────────────────────
  const shell = (inner: ReactNode) => (
    <div
      className="fixed inset-0 z-[75] flex flex-col bg-[#0f0a12] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="부루마블"
    >
      {inner}
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex flex-1 items-center justify-center text-sm text-white/60">
        불러오는 중…
      </div>,
    );
  }

  // 진행중 게임이 없으면 시작 화면
  if (!row || (!s && row.status !== "playing")) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="text-6xl">🎲</span>
        <h2 className="mt-4 text-2xl font-black">부루마블</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
          둘이 번갈아 주사위를 굴려 도시를 사고 건물을 올려요. 상대가 접속 안 해도 괜찮아요 —
          내 차례에 두면 상대에게 알림이 가요.
        </p>
        <button
          onClick={startGame}
          disabled={busy}
          className="tap mt-7 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "새 게임 시작 🎮"}
        </button>
        {err && <p className="mt-4 text-xs text-rose-300">{err}</p>}
        <button onClick={onClose} className="tap mt-3 text-xs text-white/50 underline">
          닫기
        </button>
      </div>,
    );
  }

  if (!s) return shell(<div className="flex-1" />);

  const tokensOn = (idx: number) => s.players.flatMap((p, i) => (p.pos === idx && !p.bankrupt ? [i] : []));
  const me = myIdx >= 0 ? s.players[myIdx] : s.players[0];
  const oppIdx = myIdx === 0 ? 1 : 0;
  const opp = s.players[oppIdx];
  const pending = s.pending;
  const inJail = myIdx >= 0 && me.jail > 0;
  const canBuild = myTurn && !pending && upgradableTiles(s, myIdx).length > 0;
  const upgradeSet = building && myIdx >= 0 ? new Set(upgradableTiles(s, myIdx)) : new Set<number>();

  const playerBar = (idx: number, label: string, online?: boolean) => {
    const p = s.players[idx];
    const active = s.turn === idx && s.phase !== "over";
    return (
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${
          active ? "bg-white/15 ring-1 ring-white/40" : "bg-white/[0.06]"
        }`}
      >
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PLAYER_COLOR[idx] }} />
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-bold leading-none">
            <span className="truncate">{p.name || label}</span>
            {online !== undefined && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
                title={online ? "접속중" : "오프라인"}
              />
            )}
          </p>
          <p className="mt-0.5 text-xs font-extrabold tabular-nums leading-none text-white">
            {won(p.cash)}
          </p>
        </div>
        {p.jail > 0 && <span className="ml-auto text-[10px]">🏝️</span>}
      </div>
    );
  };

  return shell(
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pb-1 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <span className="glass rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/15">
          🎲 부루마블 · {BG_MAX_LAPS}바퀴
        </span>
        <div className="flex gap-1.5">
          {s.phase !== "over" && (
            <button
              onClick={doResign}
              className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15"
            >
              항복
            </button>
          )}
          <button
            onClick={doAbandon}
            aria-label="닫기"
            className="tap grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      {/* 상대 바 */}
      <div className="px-3 pb-1">{playerBar(oppIdx, "상대", partnerOnline)}</div>

      {/* 보드 */}
      <div className="px-2">
        <div
          className="grid aspect-square w-full gap-1"
          style={{ gridTemplateColumns: "repeat(8,1fr)", gridTemplateRows: "repeat(8,1fr)" }}
        >
          {BOARD.map((t) => (
            <TileView
              key={t.idx}
              idx={t.idx}
              cell={s.cells[t.idx]}
              tokens={tokensOn(t.idx)}
              highlight={
                (spaceMode && t.idx !== me.pos && t.type !== "space") || upgradeSet.has(t.idx)
              }
              onClick={() => onTileClick(t.idx)}
            />
          ))}
          {/* 중앙 패널 */}
          <div
            style={{ gridColumn: "2 / 8", gridRow: "2 / 8" }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.04] px-3 text-center"
          >
            {s.phase === "over" ? (
              <>
                <span className="text-4xl">{s.winner === myIdx ? "🏆" : s.winner === null ? "🤝" : "🥲"}</span>
                <p className="text-sm font-black">
                  {s.winner === null
                    ? "무승부!"
                    : `${s.players[s.winner].name} 승리!`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-white/60">
                  {myTurn ? "내 차례" : `${opp.name} 차례`}
                </p>
                <div className="flex items-center gap-1 text-4xl leading-none">
                  <span>{DIE[rolling ? rollFace[0] : s.dice?.[0] ?? 1]}</span>
                  <span>{DIE[rolling ? rollFace[1] : s.dice?.[1] ?? 1]}</span>
                </div>
                {s.dice && !rolling && (
                  <p className="text-[10px] text-white/50">
                    {s.dice[0]} + {s.dice[1]} = {s.dice[0] + s.dice[1]}
                    {s.dice[0] === s.dice[1] ? " · 더블!" : ""}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-white/70">
                  {s.log[0]}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 내 바 */}
      <div className="px-3 pt-1">{playerBar(myIdx >= 0 ? myIdx : 0, "나")}</div>

      {err && <p className="px-4 pt-1 text-center text-[11px] text-rose-300">{err}</p>}

      {/* 액션 영역 */}
      <div className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
        {s.phase === "over" ? (
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="tap rounded-xl bg-white/15 px-4 py-3 text-sm font-bold"
            >
              닫기
            </button>
            <button
              onClick={startGame}
              disabled={busy}
              className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink disabled:opacity-50"
            >
              새 게임 🎮
            </button>
          </div>
        ) : !myTurn ? (
          <p className="py-3 text-center text-sm text-white/60">
            {opp.name} 차례예요 {partnerOnline ? "· 두는 중… 🎲" : "· 알림을 기다려요"}
          </p>
        ) : spaceMode ? (
          <p className="animate-pulse py-3 text-center text-sm font-bold text-white">
            🚀 이동할 곳을 골라 탭하세요
          </p>
        ) : pending?.kind === "buy" ? (
          <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/15">
            <p className="text-center text-sm font-bold">
              {BOARD[pending.tile].emoji} {BOARD[pending.tile].name} 살까요?
            </p>
            <p className="mt-0.5 text-center text-[11px] text-white/60">
              매입가 {won(BOARD[pending.tile].price ?? 0)} · 통행료 최대{" "}
              {won((BOARD[pending.tile].tolls ?? [0])[BG_MAX_LEVEL])}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={doSkip}
                disabled={busy}
                className="tap flex-1 rounded-xl bg-white/15 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                안 사기
              </button>
              <button
                onClick={doBuy}
                disabled={busy || me.cash < (BOARD[pending.tile].price ?? 0)}
                className="tap flex-1 rounded-xl bg-white py-2.5 text-sm font-extrabold text-ink disabled:opacity-40"
              >
                사기 🏠
              </button>
            </div>
          </div>
        ) : s.phase === "roll" ? (
          <div className="flex gap-2">
            {inJail && me.cash >= BG_ISLAND_FEE && (
              <button
                onClick={doPayIsland}
                disabled={busy}
                className="tap rounded-xl bg-white/15 px-4 py-3.5 text-sm font-bold disabled:opacity-50"
              >
                벌금 {won(BG_ISLAND_FEE)} 내고 탈출
              </button>
            )}
            <button
              onClick={doRoll}
              disabled={busy || rolling}
              className="tap flex-1 rounded-xl bg-white py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {rolling ? "굴리는 중…" : inJail ? "주사위 (더블 노리기) 🎲" : "주사위 굴리기 🎲"}
            </button>
          </div>
        ) : building ? (
          <button
            onClick={() => setBuilding(false)}
            className="tap w-full rounded-xl bg-white py-3.5 text-sm font-extrabold text-ink"
          >
            건설 완료 · 탭해서 마침
          </button>
        ) : (
          <div className="flex gap-2">
            {canBuild && (
              <button
                onClick={() => setBuilding(true)}
                disabled={busy}
                className="tap rounded-xl bg-white/15 px-4 py-3.5 text-sm font-bold disabled:opacity-50"
              >
                🏗️ 건설
              </button>
            )}
            <button
              onClick={doEndTurn}
              disabled={busy}
              className="tap flex-1 rounded-xl bg-white py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {s.rolledDoubles ? "더블! 한 번 더 🎲" : "턴 종료 →"}
            </button>
          </div>
        )}
        {/* 자산 힌트 */}
        {s.phase !== "over" && myIdx >= 0 && (
          <p className="mt-2 text-center text-[10px] text-white/40">
            내 자산 {won(netWorth(s, myIdx))} · {me.laps}/{BG_MAX_LAPS}바퀴
            {building ? " · 올릴 내 도시를 탭하세요" : ""}
          </p>
        )}
      </div>
    </>,
  );
}
