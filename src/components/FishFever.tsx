"use client";

/* 피버타임 화면 — 규칙은 lib/fishingfever. 힘겨루기를 멈추고 화면 전체에 펼친다. 누른 쪽 · 민 쪽으로 답한다.
 * ⚠ 낚시터 안(캔버스 · 스크롤 창 · 둥근 클립 속)에 두면 사파리에서 안 보였다는 신고가 있어 body 로 빼서 그린다(2026-11-03).
 * ⚠ 시계는 준비 화면 뒤에 돈다 — 그림을 그 자리에서 받으면 10초 중 앞쪽이 빈 칸으로 지나간다.
 * ⚠ 피버가 뜨기 전에 누른 손가락은 답이 아니다 — 줄을 감던 손을 떼거나 이어 누르는 순간 절반 확률로 틀려 화면이 번쩍하고 사라졌다. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FishArt, preloadFishArt } from "@/components/AquaArt";
import { FEVER_ROUNDS, FEVER_SECONDS, answerFever, feverPick, feverRound, feverRoundArts, startFever, tickFever, type Fever, type FeverSide } from "@/lib/fishingfever";
import type { FishSpot } from "@/lib/fishing";

const buzz = (p: number | number[]) => navigator.vibrate?.(p);
/** 규칙을 읽을 만큼은 보여 준다 */
const READY_MIN_MS = 1200;
/** 그림이 늦어도 이 뒤엔 시작한다 — 망이 끊겨도 판이 멈추면 안 된다 */
const READY_MAX_MS = 3000;

export default function FishFever({ spot, seed, onDone }: { spot: FishSpot; seed: number; onDone: (won: boolean, left: number) => void }) {
  const [f, setF] = useState<Fever>(startFever);
  const [ready, setReady] = useState(false);
  const fRef = useRef(f);
  const box = useRef<HTMLDivElement>(null);
  const down = useRef<number | null>(null);
  const doneSent = useRef(false);
  const round = feverRound(spot, seed, Math.min(f.hits, FEVER_ROUNDS - 1));

  useEffect(() => {
    box.current?.focus({ preventScroll: true });
    let alive = true;
    const min = new Promise((go) => setTimeout(go, READY_MIN_MS));
    const art = Promise.race([preloadFishArt(feverRoundArts(spot, seed)), new Promise((go) => setTimeout(go, READY_MAX_MS))]);
    void Promise.all([min, art]).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [spot, seed]);

  useEffect(() => {
    if (!ready) return;
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      const next = tickFever(fRef.current, Math.min(0.1, (now - last) / 1000));
      last = now;
      fRef.current = next;
      setF(next);
    }, 50);
    return () => clearInterval(iv);
  }, [ready]);

  useEffect(() => {
    if (f.status !== "on" && !doneSent.current) {
      doneSent.current = true;
      onDone(f.status === "won", f.left);
    }
  }, [f, onDone]);

  function pick(side: FeverSide) {
    const cur = fRef.current;
    if (!ready || cur.status !== "on") return;
    const next = answerFever(cur, side, feverRound(spot, seed, cur.hits).answer);
    fRef.current = next;
    setF(next);
    buzz(next.status === "lost" ? [80, 40, 80] : 14);
  }

  return createPortal(
    <div
      ref={box}
      className="fish-fever"
      role="application"
      aria-label={`피버타임. 가운데 물고기와 같은 쪽을 고르세요. ${FEVER_ROUNDS}문제를 다 맞혀야 하고 틀리면 놓칩니다`}
      tabIndex={0}
      onPointerDown={(e) => {
        e.stopPropagation();
        down.current = ready ? e.clientX : null;
      }}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => {
        e.stopPropagation();
        const from = down.current;
        down.current = null;
        if (from === null) return; // 피버 전에, 또는 준비 화면에서 누른 손가락
        pick(feverPick(from, e.clientX, e.currentTarget.getBoundingClientRect().width));
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        down.current = null;
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "ArrowLeft") pick("left");
        if (e.key === "ArrowRight") pick("right");
      }}
    >
      {!ready ? (
        <div className="fish-fever-intro">
          <b>피버타임!</b>
          <p>가운데 물고기와 같은 쪽을 눌러요</p>
          <small>{FEVER_SECONDS}초 안에 {FEVER_ROUNDS}문제 · 하나라도 틀리면 놓쳐요</small>
        </div>
      ) : (
        <>
          <div className="fish-fever-top" aria-hidden>
            <b>피버타임!</b>
            <span><i style={{ width: `${(f.left / FEVER_SECONDS) * 100}%` }} /></span>
            <em>{f.left.toFixed(1)}초</em>
          </div>
          <div className="fish-fever-score" aria-live="polite">
            <div className="fish-fever-dots" aria-hidden>{Array.from({ length: FEVER_ROUNDS }, (_, i) => <i key={i} className={i < f.hits ? "is-on" : ""} />)}</div>
            <small>{FEVER_ROUNDS}문제를 다 맞혀요 · 틀리면 놓쳐요</small>
          </div>
          <div className="fish-fever-target" key={`t${f.hits}`} data-art={round.target}><FishArt artKey={round.target} sync /></div>
          <p className="fish-fever-ask">같은 쪽을 눌러요</p>
          <div className="fish-fever-sides">
            {(["left", "right"] as const).map((side) => (
              <div key={side} className={`fish-fever-side is-${side}`} data-side={side} data-art={round[side]}>
                <span key={`${side}${f.hits}`}><FishArt artKey={round[side]} sync /></span>
                <u aria-hidden>{side === "left" ? "←" : "→"}</u>
              </div>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
