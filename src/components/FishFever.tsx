"use client";

/* 피버타임 화면 — 규칙은 lib/fishingfever. 힘겨루기를 멈추고 낚시 장면 위에 펼친다. 누른 쪽 · 민 쪽으로 답한다. */
import { useEffect, useRef, useState } from "react";
import { FishArt } from "@/components/AquaArt";
import { FEVER_ROUNDS, FEVER_SECONDS, answerFever, feverPick, feverRound, startFever, tickFever, type Fever, type FeverSide } from "@/lib/fishingfever";
import type { FishSpot } from "@/lib/fishing";

const buzz = (p: number | number[]) => navigator.vibrate?.(p);

export default function FishFever({ spot, seed, onDone }: { spot: FishSpot; seed: number; onDone: (won: boolean, left: number) => void }) {
  const [f, setF] = useState<Fever>(startFever);
  const fRef = useRef(f);
  const down = useRef<number | null>(null);
  const doneSent = useRef(false);
  const round = feverRound(spot, seed, Math.min(f.hits, FEVER_ROUNDS - 1));

  useEffect(() => {
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      const next = tickFever(fRef.current, Math.min(0.1, (now - last) / 1000));
      last = now;
      fRef.current = next;
      setF(next);
    }, 50);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (f.status !== "on" && !doneSent.current) {
      doneSent.current = true;
      onDone(f.status === "won", f.left);
    }
  }, [f, onDone]);

  function pick(side: FeverSide) {
    const cur = fRef.current;
    if (cur.status !== "on") return;
    const next = answerFever(cur, side, feverRound(spot, seed, cur.hits).answer);
    fRef.current = next;
    setF(next);
    buzz(next.status === "lost" ? [80, 40, 80] : 14);
  }

  return (
    <div
      className="fish-fever"
      role="application"
      aria-label={`피버타임. 가운데 물고기와 같은 쪽을 고르세요. ${FEVER_ROUNDS}문제를 다 맞혀야 하고 틀리면 놓칩니다`}
      tabIndex={0}
      onPointerDown={(e) => {
        e.stopPropagation();
        down.current = e.clientX;
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const box = e.currentTarget.getBoundingClientRect();
        pick(feverPick((down.current ?? e.clientX) - box.left, e.clientX - box.left, box.width));
        down.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") pick("left");
        if (e.key === "ArrowRight") pick("right");
      }}
    >
      <div className="fish-fever-top" aria-hidden>
        <b>피버타임!</b>
        <span><i style={{ width: `${(f.left / FEVER_SECONDS) * 100}%` }} /></span>
        <em>{f.left.toFixed(1)}초</em>
      </div>
      <div className="fish-fever-score" aria-live="polite">
        <div className="fish-fever-dots" aria-hidden>{Array.from({ length: FEVER_ROUNDS }, (_, i) => <i key={i} className={i < f.hits ? "is-on" : ""} />)}</div>
        <small>{FEVER_ROUNDS}문제를 다 맞혀요 · 틀리면 놓쳐요</small>
      </div>
      <div className="fish-fever-target" key={`t${f.hits}`} data-art={round.target}><FishArt artKey={round.target} /></div>
      <p className="fish-fever-ask">같은 쪽을 눌러요</p>
      <div className="fish-fever-sides">
        {(["left", "right"] as const).map((side) => (
          <div key={side} className={`fish-fever-side is-${side}`} data-side={side} data-art={round[side]}>
            <span key={`${side}${f.hits}`}><FishArt artKey={round[side]} /></span>
            <u aria-hidden>{side === "left" ? "←" : "→"}</u>
          </div>
        ))}
      </div>
    </div>
  );
}
