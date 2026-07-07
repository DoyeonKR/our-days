"use client";

// 테트리스 실시간 대결 — 무제한(일일 캡 없음), Supabase Realtime broadcast 채널.
// 로비(프레즌스로 상대 접속 확인) → 동일 시드 3초 카운트다운 동기 시작 → 플레이
// (라인 클리어 공격 ↔ 쓰레기줄 수신, 상대 미니보드 스로틀 표시) → 탑아웃 = 패배.
// 승패는 tetris_results 에 1행 기록(match_id 멱등 — 둘 다 써도 중복 없음).
//
// 시작 레이스: 둘이 동시에 '시작'을 눌러 start 가 교차하면 (t0, from) 이 작은 쪽을
// 채택해 양쪽이 같은 매치로 수렴한다(카운트다운 3초 안에 정리됨).

import { useEffect, useRef, useState } from "react";
import {
  type TetrisChannel,
  type TetrisMsg,
  getTetrisResults,
  joinTetrisChannel,
  recordTetrisResult,
  tetrisRecord,
} from "@/lib/couple";
import { newSeed } from "@/lib/game";
import { T_COLS, T_ROWS, decodeBoard, encodeBoard } from "@/lib/tetris";
import TetrisPlayfield, { CELL_COLORS, type PlayfieldHandle } from "@/components/games/TetrisPlayfield";
import Icon from "@/components/Icon";

type Phase = "lobby" | "playing" | "result";
type Match = { seed: number; t0: number; starter: string };
type OppSnap = { board: string; score: number; lines: number };

const SNAP_MS = 600; // 상대 미니보드 전송 주기(하트비트 겸용)
const LEAVE_GRACE_MS = 8000; // 상대 이탈 유예(플레이 중) — presence+메시지 둘 다 끊겨야 몰수승
const SETTLE_WINDOW_MS = 800; // 동시 탑아웃 대비 — 양쪽 'over' 교환을 기다렸다 결정적으로 판정(BUG#3)
const START_GRACE_MS = 1200; // 시작 레이스 수렴 유예(레이턴시/시계 스큐 흡수)(BUG#4)

/** 상대 미니보드(캔버스 60×120). snap 스로틀 수신분만 그린다. */
function OppBoard({ snap, name }: { snap: OppSnap | null; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const u = 6; // 미니 셀
    canvas.width = T_COLS * u;
    canvas.height = T_ROWS * u;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cells = snap ? decodeBoard(snap.board) : null;
    if (cells) {
      for (let y = 0; y < T_ROWS; y++) {
        for (let x = 0; x < T_COLS; x++) {
          const v = cells[y * T_COLS + x];
          if (v) {
            ctx.fillStyle = CELL_COLORS[v] || "#666";
            ctx.fillRect(x * u, y * u, u - 0.5, u - 0.5);
          }
        }
      }
    }
  }, [snap]);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="max-w-[64px] truncate text-[9px] font-bold text-white/60">{name}</p>
      <canvas ref={ref} className="rounded-[3px] ring-1 ring-white/20" />
      <p className="text-[9px] font-bold tabular-nums text-white/70">
        {snap ? snap.score.toLocaleString() : "—"}
      </p>
    </div>
  );
}

export default function TetrisVersus({
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
  const uid = myUserId ?? "";
  const [phase, setPhase] = useState<Phase>("lobby");
  const [partnerHere, setPartnerHere] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [oppSnap, setOppSnap] = useState<OppSnap | null>(null);
  const [record, setRecord] = useState({ wins: 0, losses: 0, draws: 0 });
  const [outcome, setOutcome] = useState<{
    win: boolean | null; // null = 무승부
    myScore: number;
    oppScore: number;
    reason: string;
  } | null>(null);
  const [leaveLeft, setLeaveLeft] = useState<number | null>(null); // 상대 이탈 카운트다운

  const chanRef = useRef<TetrisChannel | null>(null);
  const fieldRef = useRef<PlayfieldHandle | null>(null);
  const phaseRef = useRef<Phase>("lobby");
  phaseRef.current = phase;
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;
  const myOverRef = useRef<{ score: number; lines: number } | null>(null);
  const oppOverRef = useRef<{ score: number; lines: number } | null>(null);
  const settledRef = useRef(false); // 이 매치 결과 확정(중복 기록 방지)
  const leaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oppUidRef = useRef<string | null>(null); // 결과 기록용 상대 uid(presence 캡처)
  const lastOppMsgRef = useRef(0); // 마지막 상대 메시지 시각(스냅=하트비트) — 몰수 오판 방지(BUG#5)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 판정 대기 타이머(BUG#3)
  const mountedRef = useRef(true);

  /* ----- 전적 로드 ----- */
  const loadRecord = () => {
    getTetrisResults(coupleId)
      .then((rs) => mountedRef.current && setRecord(tetrisRecord(rs, uid)))
      .catch(() => {});
  };
  useEffect(loadRecord, [coupleId, uid]);

  // 언마운트 정리 — 대기 타이머 취소 + setState 가드
  useEffect(
    () => () => {
      mountedRef.current = false;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [],
  );

  /* ----- 채널 ----- */
  useEffect(() => {
    if (!uid) return;
    const chan = joinTetrisChannel(coupleId, uid, onMsg, (uids) => {
      const other = uids.find((u) => u !== uid) ?? null;
      if (other) oppUidRef.current = other; // 결과 기록용 상대 uid(이탈해도 마지막 값 유지)
      setPartnerHere(other !== null);
    });
    chanRef.current = chan;
    return () => {
      chan.leave();
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, uid]);

  /* ----- 상대 이탈 감시(플레이 중) ----- */
  useEffect(() => {
    if (phase !== "playing" || partnerHere) {
      if (leaveTimerRef.current) clearInterval(leaveTimerRef.current);
      leaveTimerRef.current = null;
      setLeaveLeft(null);
      return;
    }
    // 상대가 나감 — 유예 후 몰수승
    const deadline = Date.now() + LEAVE_GRACE_MS;
    setLeaveLeft(Math.ceil(LEAVE_GRACE_MS / 1000));
    leaveTimerRef.current = setInterval(() => {
      // presence 는 끊겼지만 broadcast(스냅/공격)가 계속 오면 실제로는 살아있음 → 몰수 오판 방지(BUG#5)
      const alive = Date.now() - lastOppMsgRef.current < LEAVE_GRACE_MS;
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setLeaveLeft(alive ? null : left);
      if (!alive && left <= 0) {
        if (leaveTimerRef.current) clearInterval(leaveTimerRef.current);
        leaveTimerRef.current = null;
        const st = fieldRef.current?.getState();
        settle(true, st?.score ?? 0, 0, "상대 연결 끊김 — 몰수승");
      }
    }, 300);
    return () => {
      if (leaveTimerRef.current) clearInterval(leaveTimerRef.current);
      leaveTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, partnerHere]);

  /* ----- 스냅샷 전송(플레이 중 600ms) ----- */
  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      const st = fieldRef.current?.getState();
      if (!st || myOverRef.current) return;
      chanRef.current?.send({
        t: "snap",
        board: encodeBoard(st),
        score: st.score,
        lines: st.lines,
        from: uid,
      });
    }, SNAP_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match?.seed]);

  /* ----- 메시지 처리 ----- */
  function onMsg(msg: TetrisMsg): void {
    if (msg.from && msg.from !== uid) lastOppMsgRef.current = Date.now(); // 하트비트(BUG#5)
    switch (msg.t) {
      case "start": {
        const incoming: Match = { seed: msg.seed, t0: msg.t0, starter: msg.from };
        const mine = matchRef.current;
        // 레이스 수렴: 진행 중 매치가 없거나, (t0, starter) 가 더 작은 쪽 채택.
        // 카운트다운 중(+유예)만 교체 — 이미 시작한 판을 갈아엎지 않음(BUG#4: 유예로 레이턴시 흡수).
        const key = (m: Match) => `${String(m.t0).padStart(15, "0")}:${m.starter}`;
        if (
          phaseRef.current === "lobby" ||
          (phaseRef.current === "playing" &&
            mine &&
            Date.now() < mine.t0 + START_GRACE_MS &&
            key(incoming) < key(mine))
        ) {
          beginMatch(incoming);
        }
        break;
      }
      case "attack":
        if (phaseRef.current === "playing" && !myOverRef.current) {
          fieldRef.current?.addGarbage(msg.n);
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
        }
        break;
      case "snap":
        setOppSnap({ board: msg.board, score: msg.score, lines: msg.lines });
        break;
      case "over": {
        oppOverRef.current = { score: msg.score, lines: msg.lines };
        // 즉시 판정하지 않고 대기창을 열어, 동시 탑아웃이면 양쪽이 같은 규칙(점수)으로 수렴(BUG#3).
        scheduleSettle();
        break;
      }
      case "rematch":
        // 상대가 재대결 준비 — 로비로 (버튼 노출은 partnerHere 로 이미 처리)
        break;
    }
  }

  /** 결과 판정 대기창 — 첫 탑아웃(내/상대) 관측 시 열고, 창이 끝나면 양쪽 상태로 결정적 판정.
   *  둘 다 topout → 점수 비교(양쪽 동일), 상대만 → 내 승, 나만 → 내 패. 양쪽이 같은 승자로 수렴. */
  function scheduleSettle(): void {
    if (settledRef.current || settleTimerRef.current) return;
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      if (settledRef.current) return;
      const my = myOverRef.current;
      const opp = oppOverRef.current;
      if (my && opp) {
        if (my.score === opp.score) settle(null, my.score, opp.score, "동시 탑아웃 · 동점");
        else settle(my.score > opp.score, my.score, opp.score, "동시 탑아웃 · 점수 비교");
      } else if (opp && !my) {
        const st = fieldRef.current?.getState();
        settle(true, st?.score ?? 0, opp.score, "상대 블록이 가득 찼어요");
      } else if (my && !opp) {
        settle(false, my.score, oppSnap?.score ?? 0, "내 블록이 가득 찼어요");
      }
    }, SETTLE_WINDOW_MS);
  }

  /* ----- 매치 시작/종료 ----- */
  function beginMatch(m: Match): void {
    setMatch(m);
    matchRef.current = m;
    myOverRef.current = null;
    oppOverRef.current = null;
    settledRef.current = false;
    setOppSnap(null);
    setOutcome(null);
    setPhase("playing");
  }

  function tapStart(): void {
    const m: Match = { seed: newSeed(), t0: Date.now() + 3500, starter: uid };
    chanRef.current?.send({ t: "start", seed: m.seed, t0: m.t0, from: uid });
    beginMatch(m);
  }

  /** 내 판 종료(탑아웃) — 상대에게 통보 후 대기창 열어 결정적 판정(동시 탑아웃도 양쪽 수렴). */
  function onMyEnd(r: { score: number; lines: number; toppedOut: boolean }): void {
    myOverRef.current = { score: r.score, lines: r.lines };
    chanRef.current?.send({ t: "over", score: r.score, lines: r.lines, from: uid });
    scheduleSettle();
  }

  /** 결과 확정 + 기록(멱등). win: true=승/false=패/null=무. */
  function settle(win: boolean | null, myScore: number, oppScore: number, reason: string): void {
    if (settledRef.current) return;
    settledRef.current = true;
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setOutcome({ win, myScore, oppScore, reason });
    setPhase("result");
    const m = matchRef.current;
    const partner = oppUid();
    if (m && uid) {
      recordTetrisResult({
        match_id: `${m.seed}:${m.t0}`,
        couple_id: coupleId,
        winner_user: win === null ? null : win ? uid : partner,
        loser_user: win === null ? null : win ? partner : uid,
        winner_score: win === false ? oppScore : myScore,
        loser_score: win === false ? myScore : oppScore,
      })
        .then(loadRecord)
        .catch(() => {});
    }
  }

  /** 상대 uid — 결과 기록용(승/패자 지정). 채널 onPresence 에서 캡처(이탈해도 마지막 값 유지). */
  function oppUid(): string | null {
    return oppUidRef.current;
  }

  /* ----- 렌더 ----- */
  const total = record.wins + record.losses + record.draws;

  return (
    <div
      className="fixed inset-0 z-[75] flex flex-col bg-[#0f0a12] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="테트리스 실시간 대결"
    >
      <div className="relative flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="glass rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/15">
          ⚔️ 테트리스 실시간 대결
        </span>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="tap glass grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="text-6xl">⚔️</span>
          <h2 className="mt-4 text-2xl font-black">실시간 공격전</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
            줄을 지우면 상대에게 <b className="text-white">쓰레기 줄 공격</b>이 날아가요.
            먼저 블록이 가득 차면 패배! <b className="text-white">무제한</b>으로 즐길 수 있어요.
          </p>
          {total > 0 && (
            <div className="mt-4 flex items-center gap-2.5 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold tabular-nums ring-1 ring-white/15">
              <span className="text-[11px] font-bold text-white/55">전적</span>
              <span className="text-emerald-300">{record.wins}승</span>
              <span className="text-rose-300">{record.losses}패</span>
              <span className="text-white/50">{record.draws}무</span>
            </div>
          )}
          <div
            className={`mt-5 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ring-1 ${
              partnerHere
                ? "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30"
                : "bg-white/[0.06] text-white/60 ring-white/10"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${partnerHere ? "bg-emerald-300" : "bg-white/30"}`}
            />
            {partnerHere ? `${partnerName} 접속 중!` : `${partnerName} 기다리는 중…`}
          </div>
          {!partnerHere && (
            <p className="mt-2 max-w-[250px] text-[11px] leading-relaxed text-white/45">
              상대도 게임 탭 → 테트리스 → 실시간 대결에 들어와야 시작할 수 있어요
            </p>
          )}
          <button
            onClick={tapStart}
            disabled={!partnerHere}
            className="tap mt-7 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-40"
          >
            대결 시작 ⚔️
          </button>
          <button onClick={onClose} className="tap mt-4 text-xs text-white/50 underline">
            닫기
          </button>
        </div>
      )}

      {phase === "playing" && match && (
        <>
          {leaveLeft !== null && (
            <div className="mx-4 mb-1 rounded-xl bg-rose/20 px-3 py-2 text-center text-xs font-bold text-rose-200 ring-1 ring-rose/40">
              상대 연결이 끊겼어요 — {leaveLeft}초 안에 돌아오지 않으면 몰수승
            </div>
          )}
          <TetrisPlayfield
            key={`${match.seed}:${match.t0}`}
            ref={fieldRef}
            seed={match.seed}
            startAt={match.t0}
            onEnd={onMyEnd}
            onAttack={(n) => chanRef.current?.send({ t: "attack", n, from: uid })}
            headerRight={<OppBoard snap={oppSnap} name={partnerName} />}
          />
        </>
      )}

      {phase === "result" && outcome && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="text-6xl">{outcome.win === null ? "🤝" : outcome.win ? "🏆" : "💥"}</span>
          <h2 className="mt-4 text-3xl font-black">
            {outcome.win === null ? "무승부!" : outcome.win ? "승리!" : "패배…"}
          </h2>
          <p className="mt-1.5 text-xs text-white/55">{outcome.reason}</p>
          <div className="mt-5 flex items-center gap-4 tabular-nums">
            <div>
              <p className="text-[10px] text-white/50">{myName || "나"}</p>
              <p className="text-2xl font-black text-white">{outcome.myScore.toLocaleString()}</p>
            </div>
            <span className="text-white/30">vs</span>
            <div>
              <p className="text-[10px] text-white/50">{partnerName}</p>
              <p className="text-2xl font-black text-white">{outcome.oppScore.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold tabular-nums ring-1 ring-white/15">
            <span className="text-[11px] font-bold text-white/55">전적</span>
            <span className="text-emerald-300">{record.wins}승</span>
            <span className="text-rose-300">{record.losses}패</span>
            <span className="text-white/50">{record.draws}무</span>
          </div>
          <button
            onClick={tapStart}
            disabled={!partnerHere}
            className="tap mt-8 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-40"
          >
            다시 대결 ⚔️
          </button>
          {!partnerHere && (
            <p className="mt-2 text-[11px] text-white/45">상대가 다시 들어오면 시작할 수 있어요</p>
          )}
          <button onClick={onClose} className="tap mt-4 text-xs text-white/50 underline">
            나가기
          </button>
        </div>
      )}
    </div>
  );
}
