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

import { ActionButton } from "@/components/AppButtons";
import { GameCoach, GameHead, coachSeen } from "@/components/GameHead";
import { useBackClose } from "@/lib/useBackClose";
import { useCallback, useEffect, useRef, useState } from "react";
import MergeArt from "@/components/MergeArt";
import { Coin } from "@/components/island/UiIcon";
import { confirmDialog } from "@/lib/confirm";
import { sendMergeOvertakePush } from "@/lib/notify";
import { asset } from "@/lib/base";
import { SKINS, buySkin, ownedSkins, seenFormsOf, skinById, skinsOfLv, wearSkin, wornForms, type MergeSkin } from "@/lib/mergeskins";
import { getMergeRunBoard, loadIsland, saveIsland, submitMergeRun, type MergeRunRank } from "@/lib/couple";
import { kstDate } from "@/lib/kst";
import {
  CHAIN, DAILY_COIN_CAP, GOAL_LV, SCORE_PER_COIN, SIZE, STREAK_FROM, bonusRate,
  chainOf, isGame, mergeOf, newGame, play, settleGame,
  type Dir, type Game, type MergeRecord, type Tile,
} from "@/lib/merge";

const SLIDE_MS = 110;
/* 연출 — [사용자 2026-10-31 "이펙트도 엄청 화려하게"]
   합칠 때마다: 도트 파편이 사방으로 튀고(높은 단계일수록 많이 · 멀리) · 빛 고리 · 점수가 떠오른다.
   한 번에 여럿 합치면 '콤보' · 높은 단계는 판이 흔들리고 번쩍 · 화이트 트러플을 처음 만들면 화면 가득 축포.
   ⚠ 파편 각도·거리는 난수가 아니라 칸 번호로 정한다(렌더가 순수해야 한다 — react-hooks/purity).
   ⚠ 움직임 줄이기 설정이면 CSS 가 전부 끈다(globals.css 끝). */
const FX_MS = 720;
/** 판이 끝나고 순위판이 뜨기까지 — 축포가 터지고 판이 사라지는 시간 */
const END_MS = 1100;
type Burst = { key: number; at: number; lv: number; gain: number; fert: boolean };
const PALETTE = ["#9be15d", "#ffb05c", "#ff6b8a", "#ffe066", "#b18cff", "#f4f4f4", "#ff8a65", "#d36ba6", "#ffa94d", "#9d7bff", "#ffd35c", "#7ae08a", "#5fd38a", "#ff6a4a", "#ff9ec7", "#cfe0ff", "#fffbe0"];
/** 단계별 파편 수 — 높을수록 더 많이 · 멀리(12단계부터는 한 번 더 크게). 같은 식을 렌더 두 곳이 쓴다. */
const sparkCount = (lv: number) => Math.min(40, 8 + lv * 2 + (lv >= 12 ? 8 : 0));
const sparkColor = (lv: number) => PALETTE[(Math.max(1, lv) - 1) % PALETTE.length];
const storeKey = (scope: string) => `ourdays:merge:v1:${scope}`;
/** 끝난 판 — 섬(하트 · 커플 기록)에 남겼는지(settled) · 전체 순위에 넣었는지(ranked)를 따로 센다.
 *  둘을 따로 세야 한쪽만 실패했을 때 다시 시도하면서 하트를 두 번 주지 않는다. */
type Finished = { game: Game; settled: boolean; ranked: boolean };
/** 지금 판 + (아직 섬 · 순위에 다 못 남긴) 끝난 판. 판이 끝나면 **곧바로 새 판**이 된다
 *  [사용자 2026-11-01 "게임이 끝나면 자동으로 새게임으로 돌아가고"]. */
type Saved = { game: Game; finished: Finished | null };

function readSaved(scope: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(scope)) ?? "null") as (Saved & { settled?: boolean; ranked?: boolean }) | null;
    if (!v || !isGame(v.game)) return null;
    const finished = v.finished && isGame(v.finished.game) ? v.finished : null;
    // 끝난 판이 지금 판 자리에 남아 있으면(옛 저장 형식 · 끝나는 연출 중에 닫힘) 새 판으로 넘기고 마무리할 판으로 옮긴다
    if (v.game.over) {
      return { game: newGame(freshSeed()), finished: finished ?? { game: v.game, settled: !!v.settled, ranked: !!v.ranked } };
    }
    return { game: v.game, finished };
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
/** 이름이 없는 사람의 랭킹 닉네임 — 이 기기에 남긴다(계정 이름이 생기면 그쪽이 먼저). */
const NICK_KEY = "ourdays:merge:nick";
const NICK_MAX = 12;
function readNick(): string {
  try {
    return (localStorage.getItem(NICK_KEY) ?? "").slice(0, NICK_MAX);
  } catch {
    return "";
  }
}
function writeNick(v: string) {
  try {
    localStorage.setItem(NICK_KEY, v);
  } catch {
    /* 못 남겨도 이번 판은 올라간다 */
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
  const [coins, setCoins] = useState(0);
  /** 섬에서 만나 본 캐릭터(도감 · 박물관 · 지금 펫) — 못 만난 캐릭터의 스킨은 상점에서 '?' 로 가린다(진화 스포일러). */
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const [view, setView] = useState<"game" | "shop">("game");
  const [shopBusy, setShopBusy] = useState(false);
  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const [hasIsland, setHasIsland] = useState(true);
  useBackClose(onClose);
  const [coach, setCoach] = useState(() => !coachSeen("merge"));
  const [reward, setReward] = useState<{ coins: number; newBest: boolean; capped: boolean } | null>(null);
  const [rewardErr, setRewardErr] = useState<string | null>(null);
  const [goalToast, setGoalToast] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [combo, setCombo] = useState<{ n: number; key: number; bonus: number } | null>(null);
  /** 연속 합치기 고비(5 · 10 · 15 …)에 크게 띄우는 배너 */
  const [streakFlash, setStreakFlash] = useState<{ n: number; key: number } | null>(null);
  const [shake, setShake] = useState<{ key: number; big: boolean } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [bestFlash, setBestFlash] = useState(0);
  /** 처음 만든 단계 — 큰 카드로 펼친다(이 사람이 이 단계를 처음 만든 순간, 4단계부터). 높을수록 화려하다. */
  const [discover, setDiscover] = useState<{ lv: number; key: number } | null>(null);
  const fxSeq = useRef(0);
  const bestShown = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settling = useRef(false);
  const [board, setBoard] = useState<MergeRunRank[] | null>(null);
  const [nick, setNick] = useState("");
  const [nickDraft, setNickDraft] = useState("");
  const [nickEdit, setNickEdit] = useState(false);
  useEffect(() => {
    const v = readNick();
    setNick(v);
    setNickDraft(v);
  }, []);
  /** 순위에 올릴 이름 — 계정 이름, 없으면 이 기기에서 정한 닉네임. 둘 다 없으면 정할 때까지 올리지 않는다. */
  const rankName = (myName || "").trim() || nick.trim();
  const saveNick = () => {
    const v = nickDraft.trim().slice(0, NICK_MAX);
    if (!v) return;
    writeNick(v);
    setNick(v);
    setNickEdit(false);
  };
  const [boardErr, setBoardErr] = useState(false);
  /** 끝난 판의 결과 화면 — boom(축포 · 판이 사라짐) → board(순위판). 닫으면 이미 준비된 새 판이 보인다. */
  const [result, setResult] = useState<{
    game: Game;
    phase: "boom" | "board";
    rank?: { rank: number; total: number; runId: number };
    rows?: MergeRunRank[];
    rankErr?: boolean;
  } | null>(null);
  const loadBoard = useCallback(async () => {
    try {
      setBoard(await getMergeRunBoard(null));
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
    setSaved(v ?? { game: newGame(freshSeed()), finished: null });
  }, [scope]);
  useEffect(() => {
    if (saved) writeSaved(scope, saved);
  }, [scope, saved]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // 주소창 = 지금 화면 — 게임이 열려 있으면 /game/, 닫으면 앱 주소로(공유 · 새로고침이 같은 화면을 연다). 기록을 쌓지 않고 바꾼다.
  useEffect(() => {
    const game = asset("/game/"), home = asset("/");
    if (window.location.pathname !== game) window.history.replaceState(window.history.state, "", game);
    return () => {
      if (window.location.pathname === game) window.history.replaceState(window.history.state, "", home);
    };
  }, []);

  const loadRecord = useCallback(async () => {
    const row = await loadIsland(coupleId).catch(() => null);
    setHasIsland(!!row);
    setRecord(row ? mergeOf(row.state) : null);
    setCoins(row?.state.coins ?? 0);
    setSeen(row ? seenFormsOf(row.state) : new Set());
  }, [coupleId]);
  useEffect(() => {
    void loadRecord();
  }, [loadRecord]);

  /** 끝난 판을 전체 순위에 — 판이 끝나면 **무조건, 판마다** 한 줄 등록한다(같은 사람이 여러 번 올라갈 수 있다).
   *  돌아온 이번 판 순위로 결과 화면의 순위판을 채운다. 실패하면 ranked 가 false 로 남아 다음에 다시. */
  const rank = useCallback(
    async (g: Game) => {
      if (g.score <= 0) return;
      try {
        const r = await submitMergeRun(rankName, g.score, g.top);
        if (!r) {
          // 서버 없이 도는 로컬 모드 — 올릴 곳이 없다(다시 시도할 일도 없다)
          setResult((cur) => (cur && cur.game === g ? { ...cur, rankErr: true } : cur));
          return;
        }
        // 10등 안에 들었으면 넘어선 기록의 주인들에게 알림(10등 밖이면 넘어선 '10등 안 기록'이 있을 수 없다)
        if (r.rank <= 10) void sendMergeOvertakePush(r.runId);
        const rows = await getMergeRunBoard(r.runId).catch(() => null);
        setResult((cur) => (cur && cur.game === g ? { ...cur, rank: r, rows: rows ?? undefined } : cur));
        void loadBoard();
      } catch (e) {
        setResult((cur) => (cur && cur.game === g ? { ...cur, rankErr: true } : cur));
        throw e;
      }
    },
    [rankName, loadBoard],
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
            setCoins(updated.state.coins);
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

  // 끝난 판을 섬 · 순위에 남긴다 — 방금 끝난 판도, 못 남긴 채 닫혔던 판도(네트워크 · 바로 닫기) 같은 길로.
  // 둘 다 끝나면 마무리할 판을 비운다.
  const done = saved?.finished ?? null;
  const markDone = (g: Game, key: "settled" | "ranked") =>
    setSaved((cur) => {
      if (!cur?.finished || cur.finished.game !== g) return cur;
      const f = { ...cur.finished, [key]: true };
      return { ...cur, finished: f.settled && f.ranked ? null : f };
    });
  const pendingSettle = done && !done.settled ? done.game : null;
  useEffect(() => {
    if (!pendingSettle) return;
    void settle(pendingSettle).then(() => markDone(pendingSettle, "settled")).catch(() => {});
    // 판이 바뀔 때만(같은 판으로 두 번 남기지 않게 settle 안에서도 settling 으로 막는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSettle?.moves, pendingSettle?.score]);
  const pendingRank = done && !done.ranked ? done.game : null;
  useEffect(() => {
    if (!pendingRank || !rankName) return;
    void rank(pendingRank).then(() => markDone(pendingRank, "ranked")).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRank?.moves, pendingRank?.score, rankName]);

  /** 판 끝 — 축포가 터지고 판이 사라진 뒤 순위판이 뜬다. 그 사이 뒤에서는 새 판이 준비된다. */
  const finishGame = useCallback((g: Game) => {
    const base = ++fxSeq.current * 100;
    setConfetti(base);
    setShake({ key: base, big: true });
    setResult({ game: g, phase: "boom" });
    setReward(null);
    setRewardErr(null);
    setGoalToast(false);
    bestShown.current = false;
    setSaved({ game: g, finished: { game: g, settled: g.score <= 0, ranked: g.score <= 0 } });
    timers.current.push(
      setTimeout(() => {
        setGhosts([]);
        setSaved((cur) => (cur ? { ...cur, game: newGame(freshSeed()) } : cur));
        setResult((cur) => (cur && cur.game === g ? { ...cur, phase: "board" } : cur));
      }, END_MS),
    );
  }, []);

  const move = useCallback(
    (dir: Dir) => {
      if (!saved || saved.game.over || result?.phase === "boom") return;
      if (discover) setDiscover(null);
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
          setCombo({ n: made.length, key: base, bonus: t.bonus ?? 0 });
          timers.current.push(setTimeout(() => setCombo((c) => (c?.key === base ? null : c)), 1100));
        }
        const streakNow = t.streak ?? 0;
        if (streakNow >= 5 && streakNow % 5 === 0) {
          setStreakFlash({ n: streakNow, key: base });
          timers.current.push(setTimeout(() => setStreakFlash((c) => (c?.key === base ? null : c)), 1400));
        }
        if (top >= 7 || made.length >= 3 || (streakNow >= 10 && streakNow % 5 === 0)) setShake({ key: base, big: top >= 9 || made.length >= 4 });
        const seenTop = Math.max(record?.top[who] ?? 0, saved.game.top);
        if (top > seenTop && top >= 4) {
          setDiscover({ lv: top, key: base });
          timers.current.push(setTimeout(() => setDiscover((d) => (d?.key === base ? null : d)), top >= 12 ? 3200 : 2400));
        }
        if (t.goalNow || (top >= 12 && top > seenTop)) setConfetti(base);
        const prevBest = record?.best[who] ?? 0;
        if (!bestShown.current && prevBest > 0 && t.game.score > prevBest) {
          bestShown.current = true;
          setBestFlash(base);
        }
      }
      if (t.game.over) {
        finishGame(t.game);
        return;
      }
      setSaved({ ...saved, game: t.game });
    },
    [saved, record, who, finishGame, result?.phase, discover],
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

  /** 스킨 사기 · 끼기 — 섬 상태를 읽어 바꾸고 저장한다(버전 충돌이면 다시 읽어 한 번 더). */
  async function changeSkin(make: (s: Parameters<typeof buySkin>[0]) => ReturnType<typeof buySkin>, done?: string) {
    if (shopBusy) return;
    setShopBusy(true);
    setShopMsg(null);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const row = await loadIsland(coupleId).catch(() => null);
        if (!row) {
          setHasIsland(false);
          setShopMsg("섬을 먼저 시작해야 해요");
          return;
        }
        const r = make(row.state);
        if (!r.ok) {
          setShopMsg(r.reason);
          setRecord(mergeOf(row.state));
          setCoins(row.state.coins);
          return;
        }
        try {
          const updated = await saveIsland(coupleId, row.version, r.state);
          setRecord(mergeOf(updated.state));
          setCoins(updated.state.coins);
          setSeen(seenFormsOf(updated.state));
          if (done) setShopMsg(done);
          return;
        } catch {
          /* 상대가 그 사이 섬을 바꿨다 — 다시 읽어서 한 번 더 */
        }
      }
      setShopMsg("저장하지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      setShopBusy(false);
    }
  }
  async function buy(k: MergeSkin) {
    const hidden = !seen.has(k.form);
    const ok = await confirmDialog({
      message: hidden ? `${k.lv}단계를 아직 못 만난 캐릭터로 바꿀까요?` : `${k.lv}단계를 '${k.name}' 그림으로 바꿀까요?`,
      detail: `섬 하트 ${k.price.toLocaleString()}개를 써요.${hidden ? " 누구인지는 사고 나서 보여요." : ""} 산 스킨은 섬에 남아 언제든 다시 낄 수 있어요.`,
      confirmText: `${k.price.toLocaleString()} 하트로 사기`,
    });
    if (!ok) return;
    await changeSkin((st) => buySkin(st, who, k.id), `${k.name} 스킨을 샀어요!`);
  }

  /** 새 게임 — 점수가 있는 판은 '끝난 판'으로 마무리(순위 등록 · 하트 · 순위판)하고 새 판으로 */
  async function restart() {
    if (!saved || result?.phase === "boom") return;
    const g = saved.game;
    if (g.score > 0) {
      const ok = await confirmDialog({
        message: `지금 판을 끝내고 새로 시작할까요? 점수 ${g.score.toLocaleString()}점은 순위에 올라가고 섬 하트로 받아요.`,
        confirmText: "끝내고 새로",
      });
      if (!ok) return;
      finishGame({ ...g, over: true });
      return;
    }
    setGhosts([]);
    setSaved({ ...saved, game: newGame(freshSeed()) });
  }

  const worn = wornForms(record, who);
  const skinName = (lv: number): string | undefined => {
    const id = record?.wear?.[who]?.[String(lv)];
    return worn[lv] ? skinById(id)?.name : undefined;
  };
  const owned = ownedSkins(record);

  if (!saved) return <Shell onClose={onClose}><p className="p-6 text-center text-sm text-muted">불러오는 중…</p></Shell>;
  const g = saved.game;
  if (view === "shop") {
    const ownedCount = owned.size;
    return (
      <Shell onClose={onClose} glow={sparkColor(Math.max(record?.top[who] ?? 0, 1))}>
      {coach && <GameCoach fixed id="merge" title="정원 합치기" steps={["판 위에서 손가락을 밀면 재료가 모두 그쪽으로 몰려요", "같은 재료 둘이 부딪히면 한 단계 귀한 재료가 돼요", "빈 칸이 없어지면 끝나요. 목표는 화이트 트러플이에요"]} onDone={() => setCoach(false)} />}
        <div className="merge-shop px-4 pb-10">
          {/* 머리 — 돌아가기 · 지갑을 한 줄에, 판 위에 붙어 있게(sticky) */}
          <div className="merge-shop-head">
            <ActionButton onClick={() => setView("game")} aria-label="게임으로 돌아가기">← 게임</ActionButton>
            <strong className="merge-shop-title">스킨 상점</strong>
            <p className="merge-shop-wallet" aria-label={`섬 하트 ${coins.toLocaleString()}개`}><Coin /> {coins.toLocaleString()}</p>
          </div>
          <p className="merge-shop-lead">단계 그림을 섬 캐릭터로 바꿔요 · 산 스킨은 둘이 같이 · 끼는 건 각자 <b>{ownedCount}/{SKINS.length}</b></p>
          {!hasIsland && <p className="merge-shop-msg">섬을 시작하면 하트로 스킨을 살 수 있어요.</p>}
          {shopMsg && <p className="merge-shop-msg" aria-live="polite">{shopMsg}</p>}
          <ol className="merge-shop-list">
            {CHAIN.map((c, i) => {
              const lv = i + 1;
              const cur = worn[lv];
              return (
                <li key={c.key} className="merge-shop-row">
                  <p className="merge-shop-lv">
                    <b className={`merge-shop-badge lv-${lv}`}>{lv}</b>
                    <span>{c.name}</span>
                    <small>{c.rarity}</small>
                  </p>
                  <div className="merge-shop-opts">
                    <button type="button" className={`tap merge-shop-opt lv-${lv} ${!cur ? "is-on" : ""}`} disabled={shopBusy || !cur} onClick={() => void changeSkin((st) => wearSkin(st, who, lv, null))}>
                      <span className="merge-shop-pic"><MergeArt k={c.key} /></span>
                      <span className="merge-shop-name">기본</span>
                      <span className="merge-shop-state">{!cur ? "사용 중" : "원래대로"}</span>
                    </button>
                    {skinsOfLv(lv).map((k) => {
                      const has = owned.has(k.id), on = cur === k.form;
                      const hidden = k.kind === "hero" && !has && !seen.has(k.form); // 작물 · 음식은 스포일러가 아니라 늘 보인다
                      const short = !has && coins < k.price;
                      return (
                        <button
                          key={k.id}
                          type="button"
                          className={`tap merge-shop-opt lv-${lv} ${on ? "is-on" : ""} ${has ? "is-owned" : ""} ${hidden ? "is-hidden" : ""} ${short ? "is-short" : ""}`}
                          disabled={shopBusy || on || (!has && (!hasIsland || short))}
                          onClick={() => void (has ? changeSkin((st) => wearSkin(st, who, lv, k.id)) : buy(k))}
                          aria-label={hidden ? `${lv}단계 아직 못 만난 캐릭터 스킨` : `${lv}단계 ${k.name} 스킨`}
                        >
                          <span className="merge-shop-pic">{hidden ? <b className="merge-shop-q" aria-hidden>?</b> : <MergeArt k={c.key} skin={k.form} />}</span>
                          <span className="merge-shop-name">{hidden ? "???" : k.name}</span>
                          <span className="merge-shop-state">{on ? "사용 중" : has ? "끼기" : <><Coin /> {k.price.toLocaleString()}</>}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="merge-shop-foot">? 는 섬에서 아직 못 만난 캐릭터예요 — 섬에서 만나거나 사면 보여요.</p>
        </div>
      </Shell>
    );
  }
  const myBest = Math.max(record?.best[who] ?? 0, g.score);
  const partnerBest = record ? Object.entries(record.best).find(([k]) => k !== who)?.[1] : undefined;
  const tiles: { tile: Tile; at: number; ghost?: true }[] = [
    ...g.board.flatMap((t, i) => (t ? [{ tile: t, at: i }] : [])),
    ...ghosts.map((x) => ({ ...x, ghost: true as const })),
  ].sort((a, b) => a.tile.id - b.tile.id); // DOM 순서를 id 로 고정 — 순서가 바뀌면 React 가 노드를 옮겨 전환이 끊긴다

  return (
    <Shell onClose={onClose} glow={sparkColor(Math.max(g.top, record?.top[who] ?? 0, 1))} hot={(g.streak ?? 0) >= STREAK_FROM && !g.over}>
      <div className="merge-wrap px-4 pb-10">
        {/* 점수판 */}
        {/* 점수판 — 지금 점수를 크게, 최고 기록은 옆에 작게. 버튼은 그 아래 한 줄(상점 왼쪽 · 새 게임 오른쪽). */}
        <div className="merge-hud">
          <div className="merge-hud-now"><small>점수</small><strong>{g.score.toLocaleString()}</strong></div>
          <dl className="merge-hud-best">
            <div><dt>내 최고</dt><dd>{myBest.toLocaleString()}</dd></div>
            {partnerBest !== undefined && <div><dt>{partnerName || "상대"}</dt><dd>{partnerBest.toLocaleString()}</dd></div>}
          </dl>
        </div>
        <div className="merge-tools">
          <ActionButton onClick={() => { setShopMsg(null); setView("shop"); }} className="merge-tool-shop">스킨 상점<span><Coin /> {coins.toLocaleString()}</span></ActionButton>
          <ActionButton onClick={() => void restart()}>새 게임</ActionButton>
        </div>

        {/* 판 */}
        {/* 연속 합치기 — 이어지는 동안 머리에 뜨고, 길수록 뜨거워진다(--heat). 합치지 못하면 사라진다. */}
        {(g.streak ?? 0) >= STREAK_FROM && !g.over && (
          <p className="merge-streak" style={{ "--heat": Math.min(1, ((g.streak ?? 0) - STREAK_FROM + 1) / 10) } as React.CSSProperties} aria-live="polite">
            연속 <b>{g.streak}</b> <span>점수 +{Math.round(bonusRate(1, g.streak ?? 0).chain * 100)}%</span>
          </p>
        )}
        {combo && (
          <p key={combo.key} className={`merge-combo is-c${Math.min(4, combo.n)}`} aria-live="polite">
            콤보 <b>×{combo.n}</b>{combo.bonus > 0 && <span>+{combo.bonus.toLocaleString()} 보너스</span>}
          </p>
        )}
        {streakFlash && (
          <p key={streakFlash.key} className="merge-streak-flash" aria-hidden>연속 {streakFlash.n}!</p>
        )}
        <div
          style={{ "--heat": Math.min(1, Math.max(0, (g.streak ?? 0) - STREAK_FROM + 1) / 10) } as React.CSSProperties}
          className={`merge-board ${(g.streak ?? 0) >= STREAK_FROM ? "is-hot" : ""} ${combo && combo.n >= 3 ? `is-combo is-combo-${Math.min(4, combo.n)}` : ""} ${shake ? (shake.key % 200 ? "is-shake-a" : "is-shake-b") : ""} ${shake?.big ? "is-flash" : ""} ${result?.phase === "boom" ? "is-ending" : ""} ${result?.phase === "board" ? "is-fresh" : ""}`}
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
              {/* 그림 칸과 이름 칸을 **따로 자리 잡아** 겹칠 수 없게 한다 — 삼성 인터넷처럼 기본 글자가 큰 브라우저에서
                  이름이 그림 위로 올라와 겹쳤다(2026-10-31). 글자 크기는 칸 크기(cqw)를 따르고 넘치면 잘린다. */}
              {tile.fert ? (
                <><span className="merge-tile-art"><b className="merge-fert-glyph">✦</b></span><small className="merge-tile-name">황금 거름</small></>
              ) : (
                <><span className="merge-tile-art"><MergeArt k={chainOf(tile.lv).key} skin={worn[tile.lv]} /></span><small className="merge-tile-name">{skinName(tile.lv) ?? chainOf(tile.lv).name}</small><i className="merge-tile-lv">{tile.lv}</i></>
              )}
            </span>
          ))}
          {bursts.map((b) => (
            <span key={b.key} className={`merge-burst ${b.lv >= GOAL_LV ? "is-legend" : ""}`} style={{ ...pos(b.at), "--spark": sparkColor(b.lv) } as React.CSSProperties} aria-hidden>
              <i className="merge-ring" />
              {b.lv >= 6 && <i className="merge-ring is-late" />}
              {b.lv >= 12 && <i className="merge-ring is-last" />}
              {Array.from({ length: sparkCount(b.lv) }, (_, k) => {
                const n = sparkCount(b.lv);
                const ang = ((k / n) * 360 + b.at * 17) * (Math.PI / 180);
                const dist = 30 + b.lv * 4 + (k % 3) * 9;
                return <i key={k} className="merge-spark" style={{ "--dx": `${Math.round(Math.cos(ang) * dist)}px`, "--dy": `${Math.round(Math.sin(ang) * dist)}px`, "--d": `${(k % 4) * 25}ms` } as React.CSSProperties} />;
              })}
              <b className="merge-gain">+{b.gain.toLocaleString()}</b>
              {b.fert && <b className="merge-fert-pop">거름 효과!</b>}
            </span>
          ))}
        </div>

        {discover && (
          <button type="button" key={discover.key} className="merge-discover-back" onClick={() => setDiscover(null)} aria-label={`첫 발견 — ${chainOf(discover.lv).name}`}>
            <span className={`merge-discover lv-${discover.lv} ${discover.lv >= 12 ? "is-mythic" : ""}`}>
              <small>첫 발견!</small>
              <span className="merge-discover-art"><MergeArt k={chainOf(discover.lv).key} skin={worn[discover.lv]} /></span>
              <strong>{chainOf(discover.lv).name}</strong>
              <em>{chainOf(discover.lv).rarity} · {discover.lv}단계</em>
            </span>
          </button>
        )}
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
        {result?.phase === "board" && (
          <div className="merge-result-back" role="dialog" aria-modal="true" aria-label="게임 끝 — 순위">
            <div className="merge-result">
              <p className="merge-result-kicker">게임 끝!</p>
              <div className={`merge-result-art lv-${Math.max(1, result.game.top)}`}><MergeArt k={chainOf(Math.max(1, result.game.top)).key} skin={worn[Math.max(1, result.game.top)]} /></div>
              <p className="merge-result-reach">{chainOf(Math.max(1, result.game.top)).name}까지 · {chainOf(Math.max(1, result.game.top)).rarity}</p>
              <strong className="merge-result-score">{result.game.score.toLocaleString()}<small>점</small></strong>
              <p className="merge-result-rank">
                {!rankName && result.game.score > 0 ? "순위에 올릴 닉네임을 정해 주세요" : result.rank ? <>전체 {result.rank.total.toLocaleString()}판 중 <b>{result.rank.rank.toLocaleString()}위</b></> : result.rankErr ? "순위에 올리지 못했어요 — 다음에 열 때 다시 올려요" : result.game.score > 0 ? "순위 계산 중…" : "점수가 없어 순위에 올리지 않았어요"}
              </p>
              {!rankName && result.game.score > 0 && (
                <form className="merge-nick" onSubmit={(e) => { e.preventDefault(); saveNick(); }}>
                  <input value={nickDraft} onChange={(e) => setNickDraft(e.target.value.slice(0, NICK_MAX))} placeholder="닉네임 (12자까지)" aria-label="랭킹 닉네임" maxLength={NICK_MAX} autoFocus />
                  <button type="submit" className="tap" disabled={!nickDraft.trim()}>이 이름으로 올리기</button>
                </form>
              )}
              {reward && (
                <p className="merge-result-reward">
                  {reward.coins > 0 ? <>섬 하트 +{reward.coins}<Coin /></> : reward.capped ? "오늘 받을 하트는 다 받았어요" : "하트는 점수 50점마다 1개"}
                  {reward.newBest && " · 내 최고 기록!"}
                </p>
              )}
              {!hasIsland && <p className="merge-result-reward">섬을 시작하면 점수가 하트로 쌓여요</p>}
              {rewardErr && <p className="merge-result-reward">{rewardErr}</p>}
              {result.rows && result.rows.length > 0 && (
                <ol className="merge-result-board">
                  {result.rows.map((r) => (
                    <li key={`${r.rank}-${r.is_this}`} className={`${r.is_this ? "is-this" : r.is_me ? "is-me" : ""} ${r.rank <= 3 ? `is-top-${r.rank}` : ""} ${r.rank > 10 ? "is-outside" : ""}`}>
                      <b className="merge-rank-no">{r.rank}</b>
                      <MergeArt k={chainOf(Math.max(1, r.top_lv)).key} size={24} />
                      <span className="merge-rank-name">{r.nickname}{r.is_this ? <em> 이번 판</em> : r.is_me ? <em> (나)</em> : null}</span>
                      <span className="merge-rank-score">{r.score.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              )}
              <ActionButton main wide className="merge-result-action" onClick={() => setResult(null)} autoFocus={!!rankName || result.game.score <= 0}>새 게임 시작</ActionButton>
            </div>
          </div>
        )}
        {goalToast && !g.over && (
          <button type="button" className="merge-goal tap" onClick={() => setGoalToast(false)}>
            <MergeArt k="white_truffle" size={40} />
            <span><strong>전설의 화이트 트러플을 만들었어요!</strong><small>계속하면 천종산삼 · 불로초까지 — 눌러서 닫기</small></span>
          </button>
        )}

        {/* 성장 사다리 — 어디까지 키웠는지 */}
        <div className="merge-ladder" aria-label={`키운 단계 ${g.top} / ${CHAIN.length}`}>
          {CHAIN.map((c, i) => (
            <span key={c.key} className={`lv-${i + 1} ${i + 1 <= Math.max(g.top, record?.top[who] ?? 0) ? "is-seen" : ""}`} title={`${i + 1}단계 ${c.name} · ${c.rarity}`}>
              <MergeArt k={c.key} skin={worn[i + 1]} />
              {i + 1 === GOAL_LV && <i aria-hidden>목표</i>}
            </span>
          ))}
        </div>

        {/* 전체 순위 — 모든 커플 공통, 사람마다 최고 점수 한 줄. 판이 끝나면 저절로 올라간다. */}
        <section className="merge-rank" aria-label="전체 순위">
          <header><strong>전체 순위</strong><small>모든 사람 · 판마다</small></header>
          {!(myName || "").trim() && (
            nickEdit || !nick ? (
              <form className="merge-nick is-inline" onSubmit={(e) => { e.preventDefault(); saveNick(); }}>
                <input value={nickDraft} onChange={(e) => setNickDraft(e.target.value.slice(0, NICK_MAX))} placeholder="랭킹 닉네임 (12자까지)" aria-label="랭킹 닉네임" maxLength={NICK_MAX} />
                <button type="submit" className="tap" disabled={!nickDraft.trim()}>정하기</button>
              </form>
            ) : (
              <p className="merge-nick-now">랭킹 이름 <b>{nick}</b> <button type="button" className="tap" onClick={() => { setNickDraft(nick); setNickEdit(true); }}>바꾸기</button></p>
            )
          )}
          {board === null ? (
            <p className="merge-rank-empty">{boardErr ? "순위를 불러오지 못했어요" : "불러오는 중…"}</p>
          ) : board.length === 0 ? (
            <p className="merge-rank-empty">아직 기록이 없어요. 첫 1등이 되어 보세요!</p>
          ) : (
            <ol>
              {board.map((r) => (
                <li key={r.rank} className={`${r.is_me ? "is-me" : ""} ${r.rank <= 3 ? `is-top is-top-${r.rank}` : ""}`}>
                  <b className="merge-rank-no">{r.rank}</b>
                  <MergeArt k={chainOf(Math.max(1, r.top_lv)).key} size={26} />
                  <span className="merge-rank-name">{r.nickname}{r.is_me && <em> (나)</em>}</span>
                  <span className="merge-rank-score">{r.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <ul className="merge-rules">
          <li>밀면 모두 그쪽으로 몰리고, <b>같은 재료 둘</b>이 부딪히면 한 단계 귀한 재료가 돼요. 목표는 <b>화이트 트러플</b>(11단계).</li>
          <li><b>황금 거름</b>은 부딪힌 재료를 한 단계 올려 줘요.</li>
          <li>판이 끝나면 점수가 <b>전체 순위</b>에 저절로 올라가요 — 판마다 한 줄씩, 같은 사람이 여러 번 오를 수 있어요.</li>
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

/** 배경 — 흐르는 오로라 · 반짝이는 별 · 아래에서 떠오르는 빛가루 [사용자 2026-10-31 "합치기 게임 배경도 화려하게"].
 *  오로라 색은 지금까지 키운 가장 높은 단계의 색(--glow)을 따르고, 연속 합치기 중엔 더 밝고 빠르게(is-hot).
 *  전부 CSS(그라디언트 · transform) — 캔버스 · 블러 없이 가볍게. 움직임 줄이기 설정이면 멈춘다. */
const FLOATS = Array.from({ length: 16 }, (_, k) => ({
  "--x": `${(k * 53 + 7) % 100}%`,
  "--d": `${-((k * 1.7) % 12).toFixed(1)}s`,
  "--t": `${10 + (k % 5) * 2.5}s`,
  "--s": `${5 + (k % 4) * 3}px`,
  "--sway": `${((k % 7) - 3) * 14}px`,
  "--c": PALETTE[(k * 5) % PALETTE.length],
}) as React.CSSProperties);

function MergeSky() {
  return (
    <div className="merge-sky" aria-hidden>
      <i className="merge-aurora is-a" />
      <i className="merge-aurora is-b" />
      <i className="merge-aurora is-c" />
      <i className="merge-stars" />
      <i className="merge-stars is-far" />
      {FLOATS.map((st, k) => <b key={k} className="merge-float" style={st} />)}
    </div>
  );
}

function Shell({ children, onClose, glow, hot }: { children: React.ReactNode; onClose: () => void; glow?: string; hot?: boolean }) {
  return (
    <div className={`merge-shell fixed inset-0 z-[90] overflow-y-auto ${hot ? "is-hot" : ""}`} style={glow ? ({ "--glow": glow } as React.CSSProperties) : undefined}>
      <MergeSky />
      <div className="relative z-[1] mx-auto min-h-full w-full max-w-md">
        <GameHead title="정원 합치기" className="merge-head" icon={<MergeArt k="white_truffle" size={28} />} onClose={onClose} />
        {children}
      </div>
    </div>
  );
}
