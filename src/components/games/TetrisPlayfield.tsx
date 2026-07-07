"use client";

// 테트리스 공용 플레이필드 — 점수 대결(울트라)·실시간 대결(versus) 양쪽이 쓰는
// 캔버스 렌더 + 조작 + 게임 루프. 룰은 전부 lib/tetris.ts(순수 엔진), 여기는 시간/입력만.
//
// 조작(모바일 퍼스트):
// - 보드 드래그: 가로 = 셀 단위 이동(손가락 따라감), 아래로 드래그 = 소프트 드롭,
//   아래로 빠른 플릭 = 하드 드롭, 짧은 탭 = 시계 회전
// - 하단 버튼(백업): ◀ ▶ (길게 = 연속이동 DAS) · ⟲ ⟳ · ⤓ 하드드롭, 홀드 박스 탭 = 홀드
// - 키보드(데스크톱): ←→(DAS) ↓소프트 ↑/X 시계 Z 반시계 Space 하드 C 홀드
//
// 렌더: rAF 루프가 stateRef 를 캔버스에 그리고, DOM(점수/홀드/넥스트)은 100ms 스로틀
// 스냅샷으로만 재렌더(입력 60Hz 가 React 렌더로 새지 않게).

import { useEffect, useRef, useState } from "react";
import {
  type TetrisState,
  LOCK_DELAY_MS,
  LOCK_RESETS_MAX,
  T_COLS,
  T_HIDDEN,
  T_ROWS,
  canFall,
  clearLabel,
  createTetris,
  ghostY,
  gravityMs,
  gravityStep,
  hardDrop,
  holdSwap,
  lockNow,
  minosOf,
  moveX,
  queueGarbage,
  rotate,
  softDrop,
} from "@/lib/tetris";

// 조각 색(셀값 1..7), 8=쓰레기. 다크 배경 위 형광톤.
export const CELL_COLORS = [
  "",
  "#22d3ee", // I
  "#fbbf24", // O
  "#a78bfa", // T
  "#34d399", // S
  "#fb7185", // Z
  "#60a5fa", // J
  "#fb923c", // L
  "#4b5563", // 쓰레기
];

const DAS_MS = 160; // 좌우 길게 누름 최초 지연
const ARR_MS = 38; // 이후 반복 간격

export type PlayfieldHandle = {
  addGarbage: (n: number) => void;
  getState: () => TetrisState;
};

export type PlayfieldEnd = { score: number; lines: number; toppedOut: boolean };

/** 넥스트/홀드 미리보기(DOM 그리드 — 캔버스보다 단순). */
function PiecePreview({ kind, dim }: { kind: number; dim?: boolean }) {
  if (kind < 0) return <div className="h-8 w-12" />;
  const minos = minosOf(kind);
  const xs = minos.map((m) => m[0]);
  const ys = minos.map((m) => m[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 1;
  const h = Math.max(...ys) - minY + 1;
  const u = 10; // 미니 셀 px
  return (
    <div
      className="relative"
      style={{ width: w * u, height: h * u, opacity: dim ? 0.4 : 1 }}
      aria-hidden
    >
      {minos.map(([x, y], i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: (x - minX) * u,
            top: (y - minY) * u,
            width: u - 1,
            height: u - 1,
            background: CELL_COLORS[kind + 1],
          }}
        />
      ))}
    </div>
  );
}

export default function TetrisPlayfield({
  ref,
  seed,
  startAt,
  endAt,
  onEnd,
  onAttack,
  paused = false,
  headerRight,
}: {
  ref?: React.Ref<PlayfieldHandle>;
  seed: number;
  startAt: number; // epoch ms — 이 시각까지 3·2·1 카운트다운(대결은 양쪽 동일 t0 로 동기 시작)
  endAt?: number; // epoch ms — 울트라 제한시간(없으면 무제한 = versus)
  onEnd: (r: PlayfieldEnd) => void;
  onAttack?: (n: number) => void; // 이번 락의 실제 공격 줄 수(상쇄 후) — versus 전송용
  paused?: boolean;
  headerRight?: React.ReactNode; // 상대 미니보드 등(versus)
}) {
  const stateRef = useRef<TetrisState | null>(null);
  if (stateRef.current === null) stateRef.current = createTetris(seed);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(false);
  const propsRef = useRef({ onEnd, onAttack, paused, startAt, endAt });
  propsRef.current = { onEnd, onAttack, paused, startAt, endAt };

  // 타이밍(모두 ref — 렌더 무관)
  const lastGravityRef = useRef(0);
  const groundedRef = useRef<number | null>(null);
  const resetsRef = useRef(0);
  const dasRef = useRef<{ dir: -1 | 1; since: number; last: number } | null>(null);
  const softHeldRef = useRef(false);
  // 이펙트
  const flashRef = useRef<{ rows: number[]; t: number } | null>(null);
  const shakeRef = useRef(0); // 종료 시각(ms)
  const reducedRef = useRef(false);
  const [banner, setBanner] = useState<{ text: string; k: number } | null>(null);

  // DOM 스로틀 스냅샷
  const [ui, setUi] = useState(() => snapshot(stateRef.current!));
  const uiJsonRef = useRef(JSON.stringify(ui));
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  function snapshot(s: TetrisState) {
    return {
      score: s.score,
      lines: s.lines,
      level: s.level,
      hold: s.hold,
      canHold: s.canHold,
      next: s.queue.slice(0, 3),
      pending: s.pending,
      over: s.over,
    };
  }

  /** 시작 전/일시정지/종료엔 입력 무시. */
  function inputOk(): boolean {
    const p = propsRef.current;
    return (
      !endedRef.current &&
      !p.paused &&
      Date.now() >= p.startAt &&
      !stateRef.current!.over
    );
  }

  /** 엔진 액션 적용 + 락 이벤트(공격/이펙트) 처리. */
  function apply(next: TetrisState): void {
    const prev = stateRef.current!;
    if (next === prev) return;
    // 접지 중 이동/회전 성공 → 락 딜레이 리셋(상한 있음)
    if (!canFall(prev) && resetsRef.current < LOCK_RESETS_MAX) {
      groundedRef.current = null;
      resetsRef.current += 1;
    }
    stateRef.current = next;
    if (next.pieces !== prev.pieces) afterLock(next);
  }

  function afterLock(s: TetrisState): void {
    groundedRef.current = null;
    resetsRef.current = 0;
    lastGravityRef.current = performance.now();
    const e = s.last;
    if (e) {
      if (e.attack > 0) propsRef.current.onAttack?.(e.attack);
      const label = clearLabel(e);
      if (label) setBanner({ text: label, k: Date.now() });
      if (e.rows.length > 0) flashRef.current = { rows: e.rows, t: performance.now() };
      if (!reducedRef.current && (e.cleared === 4 || e.garbageIn > 0 || e.pc)) {
        shakeRef.current = performance.now() + 220;
      }
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        if (e.pc || e.cleared === 4) navigator.vibrate(35);
        else if (e.garbageIn > 0) navigator.vibrate(45);
        else if (e.cleared > 0) navigator.vibrate(12);
      }
    }
    if (s.over) finish(true);
  }

  function finish(toppedOut: boolean): void {
    if (endedRef.current) return;
    endedRef.current = true;
    const s = stateRef.current!;
    if (typeof navigator !== "undefined" && navigator.vibrate && toppedOut) navigator.vibrate(120);
    propsRef.current.onEnd({ score: s.score, lines: s.lines, toppedOut });
  }

  // ref 핸들(versus: 공격 수신/스냅샷)
  useEffect(() => {
    if (!ref) return;
    const h: PlayfieldHandle = {
      addGarbage: (n) => {
        if (!endedRef.current) stateRef.current = queueGarbage(stateRef.current!, n);
      },
      getState: () => stateRef.current!,
    };
    if (typeof ref === "function") ref(h);
    else (ref as { current: PlayfieldHandle | null }).current = h;
  }, [ref]);

  // 메인 루프 + 입력 바인딩(마운트 1회 — props 는 propsRef 로 참조)
  useEffect(() => {
    reducedRef.current =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    // 셀 크기: 뷰포트에 맞춤(375px 기준 22px)
    const cell = Math.max(16, Math.min(24, Math.floor((window.innerWidth - 150) / T_COLS)));
    const cw = cell * T_COLS;
    const ch = cell * T_ROWS;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    lastGravityRef.current = performance.now();
    let raf = 0;

    const cellRect = (x: number, yVis: number) => [x * cell + 1, yVis * cell + 1, cell - 2, cell - 2] as const;

    function drawCell(x: number, yVis: number, v: number, ghost = false): void {
      const [px, py, w, h] = cellRect(x, yVis);
      const color = CELL_COLORS[v] || "#666";
      if (ghost) {
        ctx.strokeStyle = color + "88";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
        return;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(px, py, w, h, 3);
      ctx.fill();
      // 상단 하이라이트/하단 음영(입체감)
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.fillRect(px + 1, py + 1, w - 2, 2);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(px + 1, py + h - 3, w - 2, 2);
    }

    function render(now: number): void {
      const s = stateRef.current!;
      ctx.clearRect(0, 0, cw, ch);
      // 흔들림
      let sx = 0;
      let sy = 0;
      if (now < shakeRef.current && !reducedRef.current) {
        const p = (shakeRef.current - now) / 220;
        sx = Math.sin(now / 14) * 2.4 * p;
        sy = Math.cos(now / 11) * 1.6 * p;
      }
      ctx.save();
      ctx.translate(sx, sy);
      // 배경 그리드
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (let y = 0; y < T_ROWS; y++) {
        for (let x = 0; x < T_COLS; x++) {
          if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      // 스택
      for (let y = 0; y < T_ROWS; y++) {
        for (let x = 0; x < T_COLS; x++) {
          const v = s.board[(y + T_HIDDEN) * T_COLS + x];
          if (v) drawCell(x, y, v);
        }
      }
      if (!s.over && s.kind >= 0) {
        // 고스트 → 현재 조각
        const gy = ghostY(s);
        for (const [dx, dy] of minosOf(s.kind, s.rot)) {
          const vy = gy + dy - T_HIDDEN;
          if (vy >= 0) drawCell(s.x + dx, vy, s.kind + 1, true);
        }
        for (const [dx, dy] of minosOf(s.kind, s.rot)) {
          const vy = s.y + dy - T_HIDDEN;
          if (vy >= 0) drawCell(s.x + dx, vy, s.kind + 1);
        }
      }
      // 라인 클리어 플래시
      const fl = flashRef.current;
      if (fl) {
        const dt = now - fl.t;
        if (dt < 240 && !reducedRef.current) {
          ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - dt / 240)})`;
          for (const r of fl.rows) {
            const vy = r - T_HIDDEN;
            if (vy >= 0) ctx.fillRect(0, vy * cell, cw, cell);
          }
        } else flashRef.current = null;
      }
      // 대기 쓰레기 게이지(좌측 빨강)
      if (s.pending > 0) {
        ctx.fillStyle = "#f43f5e";
        const gh = Math.min(T_ROWS, s.pending) * cell;
        ctx.fillRect(0, ch - gh, 3, gh);
      }
      ctx.restore();
    }

    function loop(): void {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const wallNow = Date.now();
      const p = propsRef.current;
      const s = stateRef.current!;

      // 카운트다운/타이머 DOM
      const cd = p.startAt - wallNow;
      const cdShow = cd > 0 ? Math.ceil(cd / 1000) : null;
      setCountdown((prev) => (prev === cdShow ? prev : cdShow));
      if (p.endAt) {
        const left = Math.max(0, Math.ceil((p.endAt - wallNow) / 1000));
        setTimeLeft((prev) => (prev === left ? prev : left));
        if (wallNow >= p.endAt && !endedRef.current) finish(false); // 시간 종료
      }

      if (!endedRef.current && !p.paused && cd <= 0 && !s.over) {
        // DAS(버튼/키 길게)
        const das = dasRef.current;
        if (das) {
          const held = now - das.since;
          if (held >= DAS_MS && now - das.last >= ARR_MS) {
            apply(moveX(stateRef.current!, das.dir));
            das.last = now;
          }
        }
        // 소프트 드롭 홀드
        if (softHeldRef.current && now - lastGravityRef.current >= 45) {
          apply(softDrop(stateRef.current!));
          lastGravityRef.current = now;
        }
        // 중력 + 락 딜레이
        const cur = stateRef.current!;
        if (canFall(cur)) {
          groundedRef.current = null;
          if (now - lastGravityRef.current >= gravityMs(cur.level)) {
            apply(gravityStep(cur));
            lastGravityRef.current = now;
          }
        } else {
          if (groundedRef.current === null) groundedRef.current = now;
          if (
            now - groundedRef.current >= LOCK_DELAY_MS ||
            resetsRef.current >= LOCK_RESETS_MAX
          ) {
            apply(lockNow(stateRef.current!));
          }
        }
      }

      // DOM 스냅샷(100ms 스로틀)
      if (now % 100 < 17) {
        const snap = snapshot(stateRef.current!);
        const j = JSON.stringify(snap);
        if (j !== uiJsonRef.current) {
          uiJsonRef.current = j;
          setUi(snap);
        }
      }
      render(now);
    }
    raf = requestAnimationFrame(loop);

    /* ----- 키보드 ----- */
    const down = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) e.preventDefault();
      if (!inputOk()) return;
      switch (e.key) {
        case "ArrowLeft":
          if (!e.repeat) {
            apply(moveX(stateRef.current!, -1));
            dasRef.current = { dir: -1, since: performance.now(), last: performance.now() };
          }
          break;
        case "ArrowRight":
          if (!e.repeat) {
            apply(moveX(stateRef.current!, 1));
            dasRef.current = { dir: 1, since: performance.now(), last: performance.now() };
          }
          break;
        case "ArrowDown":
          softHeldRef.current = true;
          break;
        case "ArrowUp":
        case "x":
        case "X":
          if (!e.repeat) apply(rotate(stateRef.current!, 1));
          break;
        case "z":
        case "Z":
          if (!e.repeat) apply(rotate(stateRef.current!, -1));
          break;
        case " ":
          if (!e.repeat) apply(hardDrop(stateRef.current!));
          break;
        case "c":
        case "C":
        case "Shift":
          if (!e.repeat) apply(holdSwap(stateRef.current!));
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && dasRef.current?.dir === -1) dasRef.current = null;
      if (e.key === "ArrowRight" && dasRef.current?.dir === 1) dasRef.current = null;
      if (e.key === "ArrowDown") softHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    /* ----- 터치(보드 제스처) ----- */
    const wrap = wrapRef.current!;
    let touch: {
      id: number;
      x0: number;
      y0: number;
      t0: number;
      pieceX0: number;
      movedCells: number;
      droppedCells: number;
      lastY: number;
      moved: boolean;
    } | null = null;
    const onPD = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return; // 데스크톱은 키보드
      if (!inputOk()) return;
      touch = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        t0: performance.now(),
        pieceX0: stateRef.current!.x,
        movedCells: 0,
        droppedCells: 0,
        lastY: e.clientY,
        moved: false,
      };
    };
    const onPM = (e: PointerEvent) => {
      if (!touch || e.pointerId !== touch.id || !inputOk()) return;
      const dx = e.clientX - touch.x0;
      const dy = e.clientY - touch.y0;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touch.moved = true;
      // 가로: 손가락 위치 따라 셀 단위 이동
      const wantCells = Math.trunc(dx / cell);
      while (touch.movedCells < wantCells) {
        apply(moveX(stateRef.current!, 1));
        touch.movedCells++;
      }
      while (touch.movedCells > wantCells) {
        apply(moveX(stateRef.current!, -1));
        touch.movedCells--;
      }
      // 세로: 셀 단위 소프트 드롭(아래로만)
      const wantDrop = Math.trunc(dy / cell);
      while (touch.droppedCells < wantDrop) {
        apply(softDrop(stateRef.current!));
        touch.droppedCells++;
      }
      touch.lastY = e.clientY;
    };
    const onPU = (e: PointerEvent) => {
      if (!touch || e.pointerId !== touch.id) return;
      const dt = performance.now() - touch.t0;
      const dy = e.clientY - touch.y0;
      const dx = e.clientX - touch.x0;
      if (inputOk()) {
        if (dt < 260 && dy > 52 && dy > Math.abs(dx) * 1.4) {
          apply(hardDrop(stateRef.current!)); // 빠른 아래 플릭 = 하드드롭
        } else if (!touch.moved && dt < 300) {
          apply(rotate(stateRef.current!, 1)); // 탭 = 시계 회전
        }
      }
      touch = null;
    };
    wrap.addEventListener("pointerdown", onPD);
    wrap.addEventListener("pointermove", onPM);
    wrap.addEventListener("pointerup", onPU);
    wrap.addEventListener("pointercancel", onPU);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      wrap.removeEventListener("pointerdown", onPD);
      wrap.removeEventListener("pointermove", onPM);
      wrap.removeEventListener("pointerup", onPU);
      wrap.removeEventListener("pointercancel", onPU);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- 버튼 헬퍼(누르는 동안 DAS) ----- */
  function pressMove(dir: -1 | 1): void {
    if (!inputOk()) return;
    apply(moveX(stateRef.current!, dir));
    dasRef.current = { dir, since: performance.now(), last: performance.now() };
  }
  function releaseMove(): void {
    dasRef.current = null;
  }

  const btn =
    "tap grid h-12 flex-1 place-items-center rounded-xl bg-white/10 text-lg font-black text-white ring-1 ring-white/15 select-none";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* 상단: 홀드 | 스탯 | 넥스트 */}
      <div className="flex items-start justify-between gap-2 px-3">
        <button
          onClick={() => inputOk() && apply(holdSwap(stateRef.current!))}
          className={`tap flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.07] ring-1 ${ui.canHold ? "ring-white/20" : "ring-white/5 opacity-50"}`}
          aria-label="홀드"
        >
          <span className="text-[9px] font-bold text-white/50">홀드</span>
          <PiecePreview kind={ui.hold} dim={!ui.canHold} />
        </button>
        <div className="flex flex-1 flex-col items-center pt-0.5">
          {timeLeft !== null && (
            <p
              className={`text-2xl font-black tabular-nums ${timeLeft <= 10 ? "text-rose-300" : "text-white"}`}
            >
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </p>
          )}
          <p className="text-xl font-black tabular-nums text-white">{ui.score.toLocaleString()}</p>
          <p className="text-[10px] font-semibold text-white/50">
            {ui.lines}줄 · Lv{ui.level}
            {ui.pending > 0 && <span className="ml-1 font-black text-rose-300">⚠{ui.pending}</span>}
          </p>
        </div>
        <div className="flex w-16 flex-col items-center gap-1 rounded-xl bg-white/[0.07] py-1.5 ring-1 ring-white/10">
          <span className="text-[9px] font-bold text-white/50">다음</span>
          {ui.next.map((k, i) => (
            <PiecePreview key={i} kind={k} />
          ))}
        </div>
      </div>

      {/* 보드 */}
      <div ref={wrapRef} className="relative mt-2 flex min-h-0 flex-1 items-start justify-center touch-none">
        <div className="relative rounded-lg bg-black/40 p-1 ring-1 ring-white/15">
          <canvas ref={canvasRef} className="block rounded-md" />
          {headerRight && <div className="absolute -right-1 top-0 translate-x-full pl-1.5">{headerRight}</div>}
          {countdown !== null && (
            <div className="absolute inset-0 grid place-items-center rounded-md bg-black/55">
              <span key={countdown} className="animate-pop text-6xl font-black text-white">
                {countdown}
              </span>
            </div>
          )}
          {banner && countdown === null && (
            <div
              key={banner.k}
              className="pointer-events-none absolute inset-x-0 top-1/4 animate-pop text-center"
            >
              <span className="rounded-full bg-black/60 px-3 py-1.5 text-sm font-black text-white ring-1 ring-white/25">
                {banner.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="flex gap-1.5 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
        <button
          className={btn}
          onPointerDown={() => pressMove(-1)}
          onPointerUp={releaseMove}
          onPointerLeave={releaseMove}
          onPointerCancel={releaseMove}
          aria-label="왼쪽"
        >
          ◀
        </button>
        <button
          className={btn}
          onPointerDown={() => pressMove(1)}
          onPointerUp={releaseMove}
          onPointerLeave={releaseMove}
          onPointerCancel={releaseMove}
          aria-label="오른쪽"
        >
          ▶
        </button>
        <button className={btn} onClick={() => inputOk() && apply(rotate(stateRef.current!, -1))} aria-label="반시계 회전">
          ⟲
        </button>
        <button className={btn} onClick={() => inputOk() && apply(rotate(stateRef.current!, 1))} aria-label="시계 회전">
          ⟳
        </button>
        <button
          className={`${btn} bg-rose/25 ring-rose/40`}
          onClick={() => inputOk() && apply(hardDrop(stateRef.current!))}
          aria-label="하드 드롭"
        >
          ⤓
        </button>
      </div>
    </div>
  );
}
