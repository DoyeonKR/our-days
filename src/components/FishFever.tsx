"use client";

/* 피버타임 화면 — 규칙은 lib/fishingfever. 낚시 장면 위에 펼친다. 누른 쪽 · 민 쪽으로 답한다. */
import { useEffect, useRef, useState } from "react";
import { FishArt } from "@/components/AquaArt";
import { FEVER_SECONDS, answerFever, feverCoins, feverPick, feverRound, startFever, tickFever, type Fever, type FeverSide } from "@/lib/fishingfever";
import type { FishSpot } from "@/lib/fishing";

const buzz = (p: number | number[]) => navigator.vibrate?.(p);

export default function FishFever({ spot, seed, onDone }: { spot: FishSpot; seed: number; onDone: (f: Fever) => void }) {
  const [f, setF] = useState<Fever>(startFever);
  const [flash, setFlash] = useState<{ id: number; side: FeverSide; ok: boolean } | null>(null);
  const fRef = useRef(f);
  const down = useRef<number | null>(null);
  const flashId = useRef(0);
  const doneSent = useRef(false);
  const round = feverRound(spot, seed, f.round);

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
    if (f.done && !doneSent.current) {
      doneSent.current = true;
      onDone(f);
    }
  }, [f, onDone]);

  function pick(side: FeverSide) {
    const cur = fRef.current;
    if (cur.done) return;
    const answer = feverRound(spot, seed, cur.round).answer;
    const next = answerFever(cur, side, answer);
    fRef.current = next;
    setF(next);
    flashId.current += 1;
    setFlash({ id: flashId.current, side, ok: side === answer });
    buzz(side === answer ? 12 : [50, 30, 50]);
  }

  return (
    <div
      className={`fish-fever ${f.combo >= 5 ? "is-hot" : ""}`}
      role="application"
      aria-label="피버타임. 가운데 물고기와 같은 쪽을 고르세요"
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
      <div className="fish-fever-score"><strong>{f.hits}</strong>{f.combo >= 2 && <small key={f.combo}>{f.combo}콤보!</small>}</div>
      <div className="fish-fever-target" key={`t${f.round}`} data-art={round.target}><FishArt artKey={round.target} /></div>
      <p className="fish-fever-ask">같은 쪽을 눌러요</p>
      <div className="fish-fever-sides">
        {(["left", "right"] as const).map((side) => (
          <div key={side} className={`fish-fever-side is-${side} ${flash?.side === side ? (flash.ok ? "is-ok" : "is-no") : ""}`} data-side={side} data-art={round[side]}>
            {flash?.side === side && <i key={flash.id} className="fish-fever-flash" aria-hidden />}
            <span key={`${side}${f.round}`}><FishArt artKey={round[side]} /></span>
            <u aria-hidden>{side === "left" ? "←" : "→"}</u>
          </div>
        ))}
      </div>
      {f.done && <p className="fish-fever-end">끝! 예상 보상 {feverCoins(f.hits, f.best)}</p>}
    </div>
  );
}
