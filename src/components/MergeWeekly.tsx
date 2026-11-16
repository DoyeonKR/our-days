"use client";

/* 정원 합치기 · 주간 도전판 (2026-11-13) [사용자 승인: "합치기 주간 도전판"]
 * 주(KST 월요일 0시 ~)마다 특별한 판 규칙 하나 — 규칙 · 점수 범위는 lib/merge.ts(WEEKLY_RULES · weeklyScoreCeiling),
 * 서버는 merge_weekly_runs · submit_merge_weekly · merge_weekly_board(README §14.4.5 '주간 도전판').
 * 커플 점수 = 그 주 두 사람 각자의 최고 도전 점수의 합. 끝난 주의 커플 점수로 섬 하트를 한 번(useWeeklyReward).
 *
 * ⚠ 보통 판과 저장 · 정산 · 순위가 따로다 — 진행 중인 도전판은 자기 localStorage(`ourdays:merge:wk:v1:<커플>`),
 *   끝난 판은 하트(settleGame) · 전체 순위(merge_runs)로 가지 않는다. 옛 앱이 보통 판 저장 자리를 읽으므로
 *   5×5 · 돌이 든 판이 그쪽으로 새면 옛 앱이 보통 판으로 정산 · 순위에 올린다.
 * ⚠ 주와 보상 판정은 서버 시각(gameNow) — 폰 날짜로 지난 주를 '끝났다'고 우기지 못하게.
 */

import { ActionButton } from "@/components/AppButtons";
import MergeArt from "@/components/MergeArt";
import { Coin } from "@/components/island/UiIcon";
import { getMergeWeeklyBoard, saveIsland, submitMergeWeekly, type MergeWeeklyRow, type MergeWeeklySubmit } from "@/lib/couple";
import { refreshIsland } from "@/lib/islandstore";
import { backoffMs, gameNow, saveErrorKind } from "@/lib/islandsync";
import type { IslandRow } from "@/lib/couple";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NICK_MAX, WEEKLY_REWARD_CAP, WEEKLY_REWARD_SCALE, WEEKLY_REWARD_TIERS, chainOf, isChallengeGame, mergeOf, newChallenge, normalizeNick, play, settleWeekly,
  weekOf, weekStartOf, weeklyRule, type Dir, type Game, type Tile, type WeeklyRuleId,
} from "@/lib/merge";

const SLIDE_MS = 110;
const storeKey = (scope: string) => `ourdays:merge:wk:v1:${scope}`;
/** 끝난 도전판 — 서버에 올렸는지(sent). 그 주 · 규칙을 같이 들고 있다(주가 바뀐 뒤 올리면 서버가 PT422 로 거른다). */
type WFin = { id: number; week: string; rule: WeeklyRuleId; game: Game; sent: boolean };
type WSaved = { week: string; game: Game; queue: WFin[] };
const QUEUE_MAX = 20;
let finSeq = 0;
const finId = () => Date.now() * 100 + (finSeq++ % 100);
const freshSeed = () => (Math.random() * 2 ** 32) >>> 0;

function readSaved(scope: string, week: string, rule: WeeklyRuleId): WSaved {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(scope)) ?? "null") as Partial<WSaved> | null;
    const queue = (Array.isArray(v?.queue) ? v.queue : [])
      .filter((f): f is WFin => !!f && typeof f.id === "number" && typeof f.week === "string" && !!weeklyRule(f.rule) && isChallengeGame(f.game) && !f.sent);
    const same = !!v && v.week === week && isChallengeGame(v.game) && v.game.rule === rule && !v.game.over;
    // 지난 주에 하던 판은 그 주 기록으로 마친다(점수가 있으면) — 서버가 경계 뒤 10분까지는 받고, 그 뒤면 PT422 로 걸러진다.
    // 이번 주 판은 규칙이 다르니 새로 시작한다.
    if (!same && v && typeof v.week === "string" && isChallengeGame(v.game) && v.game.score > 0 && !v.game.over && v.game.rule)
      queue.push({ id: finId(), week: v.week, rule: v.game.rule, game: { ...v.game, over: true }, sent: false });
    return { week, game: same ? (v!.game as Game) : newChallenge(freshSeed(), rule), queue: queue.slice(-QUEUE_MAX) };
  } catch {
    return { week, game: newChallenge(freshSeed(), rule), queue: [] };
  }
}
function writeSaved(scope: string, v: WSaved) {
  try {
    localStorage.setItem(storeKey(scope), JSON.stringify(v));
  } catch {
    /* 저장 실패해도 판은 계속된다 */
  }
}

/** 지난 주 보상 — 섬이 있는 커플이 게임을 열면 한 번 본다. 지난 주의 우리 커플 점수(서버)로 하트를 섬에 적는다.
 *  ⚠ 클라이언트가 쓰는 정산이다(끝난 판 하트와 같다): 같은 주는 s.merge.weekPaid 로 한 번, 버전 잠금 저장으로 둘이 동시에 받아도 한 번.
 *  gameNow() 는 그 실행의 첫 섬 저장 전엔 기기 시계라, '끝난 주인가'는 서버가 준 ended 로 다시 본다. */
export function useWeeklyReward(coupleId: string | null, islandRow: IslandRow | null): { week: string; coins: number } | null {
  const [paid, setPaid] = useState<{ week: string; coins: number } | null>(null);
  const busy = useRef(false);
  const lastWeek = weekStartOf(weekOf(gameNow()).serial - 1);
  const already = !islandRow || (mergeOf(islandRow.state).weekPaid ?? []).includes(lastWeek);
  useEffect(() => {
    if (!coupleId || already || busy.current) return;
    busy.current = true;
    void (async () => {
      try {
        const rows = await getMergeWeeklyBoard(lastWeek);
        const mine = rows.find((r) => r.is_mine);
        // 서버 시각으로 끝난 주만 — 기기 시계가 앞선 폰은 lastWeek 가 사실 이번 주일 수 있다
        if (!mine || mine.score <= 0 || !mine.ended) return;
        for (let attempt = 0; attempt < 3; attempt++) {
          const row = await refreshIsland(coupleId);
          if (!row) return;
          const cur = weekOf(gameNow()).week;
          const r = settleWeekly(row.state, lastWeek, mine.score, cur);
          if (r.dup || r.coins <= 0) return;
          try {
            await saveIsland(coupleId, row.version, r.state);
            setPaid({ week: lastWeek, coins: r.coins });
            return;
          } catch (e) {
            if (saveErrorKind(e) !== "conflict") return;
          }
        }
      } catch {
        /* 다음에 열 때 다시 본다(이번 주 동안은 지난 주 순위를 서버가 돌려준다) */
      } finally {
        busy.current = false;
      }
    })();
  }, [coupleId, already, lastWeek]);
  return paid;
}

const fmtDay = (week: string, add: number) => {
  const d = new Date(Date.parse(`${week}T00:00:00Z`) + add * 86400_000);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
};

export default function MergeWeekly({
  coupleId,
  partnerName = "",
  nick,
  onNick,
  worn,
  reward,
  onBack,
}: {
  coupleId: string | null;
  partnerName?: string;
  nick: string;
  onNick: (v: string) => void;
  worn: Record<number, string | undefined>;
  reward: { week: string; coins: number } | null;
  onBack: () => void;
}) {
  const scope = coupleId ?? "solo";
  const [wk, setWk] = useState(() => weekOf(gameNow()));
  const rule = wk.rule;
  const [saved, setSaved] = useState<WSaved | null>(null);
  const [view, setView] = useState<"card" | "play">("card");
  const [ghosts, setGhosts] = useState<{ tile: Tile; at: number }[]>([]);
  const [fx, setFx] = useState<{ merged: number[]; born: number | null }>({ merged: [], born: null });
  const [moveNote, setMoveNote] = useState("");
  const [board, setBoard] = useState<MergeWeeklyRow[] | null>(null);
  const [boardErr, setBoardErr] = useState(false);
  const [result, setResult] = useState<{ fid: number; game: Game; sub?: MergeWeeklySubmit; err?: "later" | "rejected" | "couple" | "local" } | null>(null);
  const [nickDraft, setNickDraft] = useState(nick);
  const [nickErr, setNickErr] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sendBusy = useRef(false);
  const retryN = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  // 주가 바뀌는 순간을 따라간다(화면을 켠 채 월요일 0시를 넘기면 새 규칙 · 새 판)
  useEffect(() => {
    const t = setInterval(() => {
      const now = weekOf(gameNow());
      setWk((cur) => (cur.week === now.week ? cur : now));
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setSaved(readSaved(scope, wk.week, wk.rule.id));
  }, [scope, wk.week, wk.rule.id]);
  useEffect(() => {
    if (saved) writeSaved(scope, saved);
  }, [scope, saved]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const on = () => setRetryTick((n) => n + 1);
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);

  const loadBoard = useCallback(async () => {
    if (!coupleId) return;
    try {
      setBoard(await getMergeWeeklyBoard(null));
      setBoardErr(false);
    } catch {
      setBoardErr(true);
    }
  }, [coupleId]);
  useEffect(() => {
    void loadBoard();
  }, [loadBoard, wk.week]);

  /** 끝난 도전판을 서버에 — 점수가 있고 닉네임이 있을 때만. 받을 수 없는 판(PT422 · PT403 · PT400)은 다시 보내지 않는다. */
  const pending = saved?.queue.find((f) => !f.sent) ?? null;
  useEffect(() => {
    if (!pending || !nick || !coupleId || sendBusy.current) return;
    const f = pending;
    const done = (patch?: Partial<NonNullable<typeof result>>) => {
      setSaved((cur) => (cur ? { ...cur, queue: cur.queue.filter((x) => x.id !== f.id) } : cur));
      if (patch) setResult((cur) => (cur && cur.fid === f.id ? { ...cur, ...patch } : cur));
    };
    if (f.game.score <= 0) {
      done();
      return;
    }
    sendBusy.current = true;
    void submitMergeWeekly(f.week, f.rule, nick, f.game.score, f.game.top)
      .then((sub) => {
        retryN.current = 0;
        done(sub ? { sub, err: undefined } : { err: "local" });
        void loadBoard();
      })
      .catch((e) => {
        const code = (e as { code?: string })?.code;
        if (code === "PT422" || code === "PT400") return done({ err: "rejected" });
        if (code === "PT403") return done({ err: "couple" });
        setResult((cur) => (cur && cur.fid === f.id ? { ...cur, err: "later" } : cur));
        const delay = code === "PT429" ? 25_000 : backoffMs(retryN.current++);
        timers.current.push(setTimeout(() => setRetryTick((n) => n + 1), delay));
      })
      .finally(() => {
        sendBusy.current = false;
      });
    // 판이 바뀔 때 · 다시 시도할 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id, nick, coupleId, retryTick]);

  const finish = useCallback((g: Game) => {
    const f: WFin = { id: finId(), week: wk.week, rule: wk.rule.id, game: g, sent: false };
    setResult({ fid: f.id, game: g });
    setGhosts([]);
    setSaved((cur) => (cur ? { ...cur, game: newChallenge(freshSeed(), wk.rule.id), queue: [...cur.queue, f].slice(-QUEUE_MAX) } : cur));
  }, [wk.week, wk.rule.id]);

  const move = useCallback(
    (dir: Dir) => {
      if (!saved || result) return;
      const t = play(saved.game, dir);
      if (!t.result) {
        setMoveNote("그쪽으로는 움직일 수 없어요");
        return;
      }
      const vanishedAt = new Map(t.result.slides.map((s) => [s.id, s.to]));
      setGhosts(t.result.vanished.map((tile) => ({ tile, at: vanishedAt.get(tile.id) ?? 0 })));
      setFx({ merged: t.result.merged, born: t.born });
      timers.current.push(setTimeout(() => setGhosts([]), SLIDE_MS + 20));
      timers.current.push(setTimeout(() => setFx({ merged: [], born: null }), 260));
      const gain = t.result.gained + (t.bonus ?? 0);
      setMoveNote(t.result.merged.length ? `${t.result.merged.length}번 합쳐 ${gain.toLocaleString()}점` : "움직였어요");
      if (t.game.over) {
        finish(t.game);
        return;
      }
      setSaved((cur) => (cur ? { ...cur, game: t.game } : cur));
    },
    [saved, result, finish],
  );

  // 방향키 — 판이 보일 때만, 입력칸 · 대화 상자의 키는 건드리지 않는다
  useEffect(() => {
    if (view !== "play" || result) return;
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const)[e.key as "ArrowLeft"];
      if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const tg = e.target instanceof Element ? e.target : null;
      if (tg?.closest("input, textarea, select, [role='dialog'], [role='alertdialog']")) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, view, result]);

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

  const saveNick = () => {
    const v = normalizeNick(nickDraft);
    if (!v.ok) {
      setNickErr(v.reason);
      return;
    }
    setNickErr(null);
    onNick(v.nick);
  };

  /** 판 중간에 그만두기 — 점수가 있으면 그 판으로 도전을 마친다(올린다) */
  const endNow = () => {
    if (!saved || result) return;
    const g = saved.game;
    if (g.score > 0) finish({ ...g, over: true });
    else setSaved((cur) => (cur ? { ...cur, game: newChallenge(freshSeed(), wk.rule.id) } : cur));
  };

  const resultRef = useDialogFocus(!!result, () => setResult(null));
  const mine = board?.find((r) => r.is_mine) ?? null;
  const myBest = mine?.my_best ?? 0;
  const partnerBest = mine?.partner_best ?? 0;
  const total = mine?.score ?? 0;
  const daysLeft = Math.max(0, Math.ceil((wk.endsAt - gameNow()) / 86400_000));

  if (!saved) return <p className="p-6 text-center text-sm text-muted">불러오는 중…</p>;
  const g = saved.game;
  const n = rule.size;
  const left = rule.moveLimit > 0 ? Math.max(0, rule.moveLimit - g.moves) : null;
  const tiles: { tile: Tile; at: number; ghost?: true }[] = [
    ...g.board.flatMap((t, i) => (t ? [{ tile: t, at: i }] : [])),
    ...ghosts.map((x) => ({ ...x, ghost: true as const })),
  ].sort((a, b) => a.tile.id - b.tile.id);

  const standings = (
    <section className="merge-rank mwk-rank" aria-label="이번 주 커플 순위">
      <header><strong>이번 주 커플 순위</strong><small>두 사람 최고 점수의 합</small></header>
      {!coupleId ? (
        <p className="merge-rank-empty">커플을 맺으면 둘의 점수로 순위에 올라요</p>
      ) : board === null ? (
        <p className="merge-rank-empty">{boardErr ? "순위를 불러오지 못했어요" : "불러오는 중…"}</p>
      ) : board.length === 0 ? (
        <p className="merge-rank-empty">이번 주 첫 기록을 남겨 보세요</p>
      ) : (
        <ol>
          {board.map((r) => (
            <li key={`${r.rank}-${r.is_mine}`} className={`${r.is_mine ? "is-me" : ""} ${r.rank <= 3 ? `is-top is-top-${r.rank}` : ""} ${r.rank > 20 ? "is-outside" : ""}`}>
              <b className="merge-rank-no">{r.rank}</b>
              <span className="merge-rank-name">{r.names}{r.is_mine && <em> (우리)</em>}</span>
              <span className="merge-rank-score">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  return (
    <div className="mwk px-4 pb-10">
      <div className="mwk-head">
        <ActionButton onClick={view === "play" ? () => setView("card") : onBack} aria-label={view === "play" ? "도전판 안내로" : "보통 게임으로"}>
          {view === "play" ? "← 도전판" : "← 게임"}
        </ActionButton>
        <strong className="mwk-title">주간 도전</strong>
        <span className="mwk-days">{daysLeft > 0 ? `${daysLeft}일 남음` : "오늘 끝나요"}</span>
      </div>

      {reward && <p className="mwk-reward" role="status">지난 주 도전 보상 섬 하트 +{reward.coins}<Coin /></p>}

      {view === "card" ? (
        <>
          <section className={`mwk-card is-${rule.id}`} aria-label="이번 주 규칙">
            <small>이번 주 규칙 · {fmtDay(wk.week, 0)} ~ {fmtDay(wk.week, 6)}</small>
            <strong>{rule.name}</strong>
            <p>{rule.desc}</p>
          </section>
          <dl className="mwk-score">
            <div><dt>내 최고</dt><dd>{myBest.toLocaleString()}</dd></div>
            <div><dt>{partnerName || "상대"} 최고</dt><dd>{partnerBest.toLocaleString()}</dd></div>
            <div className="is-total"><dt>우리 합계</dt><dd>{total.toLocaleString()}</dd></div>
          </dl>
          {!nick && (
            <form className="merge-nick is-inline" onSubmit={(e) => { e.preventDefault(); saveNick(); }}>
              <input value={nickDraft} onChange={(e) => { setNickDraft(e.target.value.slice(0, NICK_MAX)); setNickErr(null); }} placeholder="랭킹 닉네임 (12자까지)" aria-label="랭킹 닉네임 — 전체 공개" maxLength={NICK_MAX} aria-invalid={!!nickErr} />
              <button type="submit" className="tap" disabled={!nickDraft.trim()}>이 이름으로 정하기</button>
              {nickErr ? <small className="merge-nick-err" role="alert">{nickErr}</small> : <small className="merge-nick-hint">순위판에 모두에게 보여요 · 정하기 전 판은 기다렸다가 올라가요</small>}
            </form>
          )}
          <ActionButton main wide className="mwk-go" onClick={() => setView("play")}>{g.moves > 0 ? "이어서 도전하기" : "도전하기"}</ActionButton>
          {standings}
          <ul className="merge-rules">
            <li>이번 주 안에 몇 번이든 도전할 수 있어요. 사람마다 <b>가장 높은 한 판</b>만 세요.</li>
            <li>커플 점수 = 나와 상대의 최고 점수를 더한 값이에요.</li>
            <li>주가 끝나면 우리 점수만큼 <b>섬 하트</b>를 받아요(최대 {WEEKLY_REWARD_CAP}개 · 주에 한 번). 이번 주 기준 {WEEKLY_REWARD_TIERS.slice().reverse().map(([min, c]) => `${Math.ceil(min / WEEKLY_REWARD_SCALE[rule.id]).toLocaleString()}점 ${c}`).join(" · ")}</li>
            <li>도전판 점수는 보통 판 순위 · 하루 하트에 들어가지 않아요.</li>
          </ul>
        </>
      ) : (
        <>
          <div className="merge-hud">
            <div className="merge-hud-now"><small>{rule.name}</small><strong>{g.score.toLocaleString()}</strong></div>
            <dl className="merge-hud-best">
              {left !== null && <div><dt>남은 수</dt><dd>{left}</dd></div>}
              <div><dt>내 최고</dt><dd>{Math.max(myBest, g.score).toLocaleString()}</dd></div>
            </dl>
          </div>
          <div className="merge-tools">
            <ActionButton onClick={endNow}>{g.score > 0 ? "이 점수로 마치기" : "새 판"}</ActionButton>
          </div>
          <div
            className={`merge-board ${n === 5 ? "is-n5" : ""}`}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={() => (start.current = null)}
            role="application"
            aria-label={`주간 도전 판(${rule.name}). 화살표 키나 밀기로 움직여요. 점수 ${g.score}`}
            aria-describedby="mwk-board-live"
          >
            {Array.from({ length: n * n }, (_, i) => <span key={`c${i}`} className="merge-cell" style={pos(i, n)} aria-hidden />)}
            {tiles.map(({ tile, at, ghost }) => (
              <span
                key={tile.id}
                className={`merge-tile ${tile.stone ? "is-stone" : tile.fert ? "is-fert" : `lv-${tile.lv}`} ${fx.merged.includes(tile.id) ? "is-merged" : ""} ${fx.born === tile.id ? "is-born" : ""} ${ghost ? "is-ghost" : ""}`}
                style={pos(at, n)}
                aria-hidden
              >
                {tile.stone ? (
                  <><span className="merge-tile-art"><i className="mwk-stone" /></span><small className="merge-tile-name">돌</small></>
                ) : tile.fert ? (
                  <><span className="merge-tile-art"><b className="merge-fert-glyph">✦</b></span><small className="merge-tile-name">황금 거름</small></>
                ) : (
                  <><span className="merge-tile-art"><MergeArt k={chainOf(tile.lv).key} skin={worn[tile.lv]} /></span><small className="merge-tile-name">{chainOf(tile.lv).name}</small><i className="merge-tile-lv">{tile.lv}</i></>
                )}
              </span>
            ))}
          </div>
          <p id="mwk-board-live" className="sr-only" aria-live="polite" aria-atomic="true">
            {`점수 ${g.score.toLocaleString()}점.${left !== null ? ` 남은 수 ${left}.` : ""}${moveNote ? ` ${moveNote}.` : ""}`}
          </p>
        </>
      )}

      {result && (
        <div ref={resultRef} tabIndex={-1} className="merge-result-back" role="dialog" aria-modal="true" aria-label="도전 끝 — 이번 주 순위">
          <div className="merge-result">
            <p className="merge-result-kicker">도전 끝!</p>
            <div className={`merge-result-art lv-${Math.max(1, result.game.top)}`}><MergeArt k={chainOf(Math.max(1, result.game.top)).key} skin={worn[Math.max(1, result.game.top)]} /></div>
            <p className="merge-result-reach">{rule.name} · {chainOf(Math.max(1, result.game.top)).name}까지</p>
            <strong className="merge-result-score">{result.game.score.toLocaleString()}<small>점</small></strong>
            <p className="merge-result-rank">
              {result.game.score <= 0 ? "점수가 없어 올리지 않았어요"
                : !coupleId || result.err === "couple" ? "커플을 맺으면 도전 기록이 올라가요"
                : !nick ? "닉네임을 정하면 이 판이 올라가요"
                : result.sub ? <>우리 합계 {result.sub.coupleScore.toLocaleString()}점 · {result.sub.couples.toLocaleString()}커플 중 <b>{result.sub.coupleRank.toLocaleString()}위</b></>
                : result.err === "rejected" ? "이 판은 이번 주 도전에 올릴 수 없어요"
                : result.err === "local" ? "연동 없이 하는 중이라 순위는 없어요"
                : result.err === "later" ? "아직 못 올렸어요 — 연결되면 이어서 올려요"
                : "올리는 중…"}
            </p>
            {result.sub && <p className="merge-result-reward">이번 주 내 최고 {result.sub.myBest.toLocaleString()}점{result.sub.myBest === result.game.score ? " · 새 최고!" : ""}</p>}
            {board && board.length > 0 && (
              <ol className="merge-result-board">
                {board.slice(0, 10).concat(board.filter((r) => r.rank > 10 && r.is_mine)).map((r) => (
                  <li key={`${r.rank}-${r.is_mine}`} className={`${r.is_mine ? "is-me" : ""} ${r.rank <= 3 ? `is-top-${r.rank}` : ""} ${r.rank > 10 ? "is-outside" : ""}`}>
                    <b className="merge-rank-no">{r.rank}</b>
                    <span className="merge-rank-name">{r.names}{r.is_mine && <em> (우리)</em>}</span>
                    <span className="merge-rank-score">{r.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
            <ActionButton main wide className="merge-result-action" onClick={() => setResult(null)} autoFocus>다시 도전</ActionButton>
            <button type="button" className="tap mwk-result-back" onClick={() => { setResult(null); setView("card"); }}>도전판으로</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 칸 위치 — 판 한 변(n)에 맞춰 CSS 변수로(5×5 는 .is-n5 가 칸 크기를 바꾼다) */
function pos(i: number, n: number): React.CSSProperties {
  const r = Math.floor(i / n), c = i % n;
  return { "--r": r, "--c": c, "--slide": `${SLIDE_MS}ms` } as React.CSSProperties;
}
