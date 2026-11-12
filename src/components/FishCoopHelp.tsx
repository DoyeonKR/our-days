"use client";

/* 함께 끌어올리기 — 도와주는 사람(B) 쪽 창 (2026-11-12, 규칙은 lib/fishcoop)
 * 상대가 큰 걸 걸어 "도와줘!"가 오면 낚시터 위에 뜬다: 받기 창(6초) → 짧은 뜰채 들어올리기(최대 5초) → 결과 한 줄.
 * 낚시터 위에 얹지만 자기 판은 건드리지 않는다 — 누르기 · 끌기는 여기서 멈추고(stopPropagation) 낚시터의 던지기로 새지 않는다.
 * ⚠ 이 창은 아무것도 저장하지 않는다(단일 작성자 — 결과는 메시지로 상대 화면에 가고, 저장은 상대가 한 번만 한다). */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ActionButton } from "@/components/AppButtons";
import { COOP_ACCEPT_MS, COOP_BONUS, COOP_GAME_MS, coopLiftQuality, coopLiftTune, startCoopLift, stepCoopLift, type Coop } from "@/lib/fishcoop";
import { LIFT_EDGE, LIFT_SLIP_S, type Lift } from "@/lib/fishingmodes";

const buzz = (p: number | number[]) => navigator.vibrate?.(p);

/** 받기 창 — 남은 시간 막대. 시각은 effect 에서만 읽는다(렌더 중 Date.now 금지) */
function Prompt({ at, onAccept, onDecline }: { at: number; onAccept: () => void; onDecline: () => void }) {
  const [left, setLeft] = useState(1);
  useEffect(() => {
    buzz([30, 40, 30]);
    const tick = () => setLeft(Math.max(0, 1 - (Date.now() - at) / COOP_ACCEPT_MS));
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [at]);
  return (
    <div className="fish-coop-card" role="alertdialog" aria-label="상대가 도움을 청했어요">
      <strong>상대가 큰 걸 걸었어요</strong>
      <p>뜰채로 도와주면 상대가 수조에 담을 확률이 {Math.round(COOP_BONUS * 100)}%p 올라가요</p>
      <span className="fish-coop-time" aria-hidden><b style={{ width: `${left * 100}%` }} /></span>
      <div className="fish-coop-actions">
        <ActionButton main wide onClick={onAccept}>뜰채로 도와주기</ActionButton>
        <ActionButton wide onClick={onDecline}>괜찮아요</ActionButton>
      </div>
    </div>
  );
}

/** 짧은 들어올리기 — 누르고 있으면 올라오고, 그물이 기울면 손가락을 반대쪽으로 끌어 버틴다(뜰채 2막과 같은 손) */
function LiftGame({ onFinish }: { onFinish: (ok: boolean, q: number) => void }) {
  const [lift, setLift] = useState<Lift>(() => startCoopLift(Math.floor(Math.random() * 2 ** 31)));
  const liftRef = useRef(lift);
  const hold = useRef(false);
  const counter = useRef(0);
  const [holding, setHolding] = useState(false);
  const done = useRef(false);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    const tune = coopLiftTune();
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      // 프레임이 밀려도 한 번에 0.1초까지만 — 숨었다 돌아와 한꺼번에 시간이 흘러 바로 떨어지지 않게
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (done.current) return;
      const cur = liftRef.current;
      const next = stepCoopLift(cur, dt, hold.current, counter.current, tune);
      liftRef.current = next;
      setLift(next);
      if (cur.kickLeft <= 0 && next.kickLeft > 0) buzz([20, 20, 20]);
      if (next.status !== "on") {
        done.current = true;
        buzz(next.status === "landed" ? [40, 30, 120] : 80);
        finishRef.current(next.status === "landed", coopLiftQuality(next));
      }
    }, 33);
    return () => clearInterval(iv);
  }, []);
  const steer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    counter.current = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width - 0.5) * 2.4));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    hold.current = true;
    setHolding(true);
    steer(e);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    hold.current = false;
    setHolding(false);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      counter.current = e.type === "keyup" ? 0 : e.key === "ArrowLeft" ? -0.9 : 0.9;
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      hold.current = e.type === "keydown";
      setHolding(hold.current);
    }
  };
  const left = Math.max(0, 1 - (lift.t * 1000) / COOP_GAME_MS);
  const hint = lift.warnLeft > 0 ? (lift.side < 0 ? "곧 왼쪽으로 몸부림쳐요" : "곧 오른쪽으로 몸부림쳐요") : lift.slip > 0 ? "떨어지기 직전이에요! 반대쪽으로" : holding ? "기울면 반대쪽으로 끌어요" : "누르고 있어 들어 올려요";
  return (
    <div className="fish-coop-pad" role="application" aria-roledescription="뜰채 들어올리기" aria-label={hint} tabIndex={0} onPointerDown={down} onPointerMove={(e) => { e.stopPropagation(); if (hold.current) steer(e); }} onPointerUp={up} onPointerCancel={up} onKeyDown={key} onKeyUp={key}>
      <span className="fish-coop-time is-game" aria-hidden><b style={{ width: `${left * 100}%` }} /></span>
      <div className="fish-dist" aria-hidden>
        <b style={{ width: `${Math.max(0, Math.min(1, lift.h)) * 100}%` }} />
        <em>상대 물고기 받치는 중</em>
      </div>
      <div className={`fish-sway fish-lift ${Math.abs(lift.tilt) < LIFT_EDGE ? "is-ok" : "is-bad"}`} aria-hidden>
        <i className="fish-sway-mid" />
        {lift.warnLeft > 0 && <u className="fish-sway-next" style={{ left: `${50 + lift.side * 40}%` }} />}
        <b className="fish-sway-rod" style={{ left: `${50 + Math.max(-1.1, Math.min(1.1, lift.tilt)) * 42}%` }} />
        {lift.slip > 0 && <em className="fish-lift-slip" style={{ width: `${Math.min(1, lift.slip / LIFT_SLIP_S) * 100}%` }} />}
      </div>
      <p className="fish-coop-hint">{hint}</p>
    </div>
  );
}

export default function FishCoopHelp({ coop, onAccept, onDecline, onFinish }: { coop: Coop; onAccept: () => void; onDecline: () => void; onFinish: (ok: boolean, q: number) => void }) {
  const helper = coop.k === "prompt" || ((coop.k === "helping" || coop.k === "result") && coop.role === "helper");
  if (!helper) return null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div className="fish-coop" onPointerDown={stop} onPointerUp={stop} onPointerMove={stop} onKeyDown={stop} onKeyUp={stop}>
      {coop.k === "prompt" && <Prompt at={coop.at} onAccept={onAccept} onDecline={onDecline} />}
      {/* 판 번호가 key — 새 부탁이면 새 판 */}
      {coop.k === "helping" && <LiftGame key={coop.round} onFinish={onFinish} />}
      {coop.k === "result" && (
        <p className={`fish-coop-result ${coop.ok ? "is-ok" : "is-miss"}`} aria-live="polite">
          {coop.ok ? `건졌어요! 상대가 담을 확률 +${Math.round(COOP_BONUS * 100)}%p` : "놓쳤어요. 상대는 혼자 마저 끌어올려요"}
        </p>
      )}
    </div>
  );
}
