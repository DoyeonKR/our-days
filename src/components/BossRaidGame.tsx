"use client";

/* 주인 레이드 화면 — 규칙은 lib/bossraid. 피버와 같은 틀(body 에 화면 전체 · --game-safe-top · 뒤로 가기 · Esc).
 * 손이 하는 일은 둘: 화살표 쪽으로 밀어 막기(스와이프 · 방향키) → 비틀거리는 동안 두드리기(누르기 · 스페이스).
 * 시계는 화면이 보일 때만 돈다. 판이 끝나면 한 번만 onEnd 를 부르고(저장은 부른 쪽이), 요약을 보여 준다.
 * ⚠ 판 도중 앱을 떠나면(화면이 숨거나 pagehide) 그 자리에서 판을 끝낸다 — 결과 창을 닫을 때까지 기다리면 앱이 꺼질 때 깎은 몫 · 토벌이 사라졌다.
 *   안내 화면(판 시작 전)에서 나가면 onQuit — 아직 겨루지 않았으니 부른 쪽이 도전 한 번을 돌려준다. */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FishArt, preloadFishArt } from "@/components/AquaArt";
import { CloseButton } from "@/components/AppButtons";
import { useBackClose } from "@/lib/useBackClose";
import { RAID_DIRS, RAID_DIR_NAME, raidLeft, raidScore, startRaid, stepRaid, swipeRaid, tapRaid, touchDown, touchMove, touchUp, type Raid, type RaidDir, type RaidGesture, type RaidTouch, type RaidTune } from "@/lib/bossraid";
import { DRAW_MS, frameGate } from "@/lib/advframe";

const buzz = (p: number | number[]) => navigator.vibrate?.(p);
const READY_MS = 1600;

/** bg — 그 낚시터 그림(어둡게 깔아 물속 무대로). 없으면 짙은 물빛만 */
export type RaidSetup = { name: string; species: string; seed: number; tune: RaidTune; hp: number; chunk: number; wound: number; duo: boolean; triesLeft: number; bg?: string };
/** 크게 외치는 한마디(막았다 · 완벽 · 한 번 더 · 분노 · 토벌) */
type Call = { id: number; text: string; tone: "good" | "gold" | "bad" | "rage" | "kill" };

export default function BossRaidGame({ setup, onEnd, onClose, onQuit }: { setup: RaidSetup; onEnd: (r: Raid) => void; onClose: () => void; onQuit: () => void }) {
  const raid = useRef<Raid>(startRaid(setup.seed, setup.tune, setup.hp, setup.chunk, setup.wound));
  const [, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  // 막기 · 맞기 · 속임수 — 무대를 다시 그리지(key) 않고 클래스만 바꾼다. 무대를 새로 붙이면 주인 그림이 다시 붙고 움직임(transition)이 끊겼다.
  // n 이 바뀔 때마다 흔들기 이름을 번갈아(fx-b) 같은 흔들기를 이어 맞아도 처음부터 다시 돈다
  const [fx, setFx] = useState<{ id: number; n: number; kind: "parry" | "perfect" | "hit" | "feint" } | null>(null);
  const fxN = useRef(0);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string; big: boolean }[]>([]);
  // 연출(2026-11-13) [사용자: "보스전도 게임 자체가 너무 허접해"] — 외침 · 막은 자리의 충격파 · 분노 · 비틀거림 시간 막대
  const [call, setCall] = useState<Call | null>(null);
  const [burst, setBurst] = useState<{ id: number; dir: number; perfect: boolean } | null>(null);
  const [rageFx, setRageFx] = useState(0);
  const staggerMax = useRef(1);
  /** 마지막으로 누른 자리(무대 비율) — 연타 숫자가 손가락 자리에서 튄다 */
  const lastPt = useRef({ x: 50, y: 50 });
  const sent = useRef(false);
  // 부른 쪽이 렌더마다 새 함수를 넘겨도 시계(rAF)를 다시 걸지 않게
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; }, [onEnd]);
  const seen = useRef(0);
  /** 손가락마다 시작점(pointerId) — 두 엄지로 번갈아 두드려도 섞이지 않는다 */
  const touches = useRef(new Map<number, RaidTouch>());
  const box = useRef<HTMLDivElement>(null);
  // 움직임 줄이기 설정은 한 번만 읽는다 — 매 프레임 그릴 때마다 matchMedia 를 불렀다
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const readyRef = useRef(false);

  const finishNow = useCallback(() => {
    const r = raid.current;
    if (!r.end) { r.end = "time"; r.atk = null; r.events.push({ k: "end", t: r.t, why: "time" }); }
    if (!sent.current) { sent.current = true; endRef.current(r); }
  }, []);
  const quitRef = useRef(onQuit);
  useEffect(() => { quitRef.current = onQuit; }, [onQuit]);
  /** 판 시작 전에 나간다 — 한 번만 */
  const quit = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    quitRef.current();
  }, []);
  // 도중에 닫아도 깎은 만큼 남긴다 · 안내 화면에서 닫으면 도전을 돌려받는다
  const close = useCallback(() => {
    if (!readyRef.current) { quit(); return; }
    finishNow();
    onClose();
  }, [finishNow, onClose, quit]);
  useBackClose(close);

  // 앱을 떠나면(다른 앱 · 홈 · 탭 닫기) 판을 그 자리에서 끝낸다 — 깎은 몫 · 토벌을 바로 남긴다. 돌아오면 결과 창이 떠 있다
  useEffect(() => {
    const away = () => {
      if (!readyRef.current) { quit(); return; }
      if (sent.current) return;
      finishNow();
      setFrame((n) => n + 1);
    };
    const onVis = () => { if (document.visibilityState === "hidden") away(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", away);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", away);
    };
  }, [finishNow, quit]);

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.focus({ preventScroll: true });
    let alive = true;
    void Promise.all([new Promise((go) => setTimeout(go, READY_MS)), Promise.race([preloadFishArt([setup.species]), new Promise((go) => setTimeout(go, 3000))])]).then(() => {
      if (!alive || sent.current) return; // 안내 화면에서 이미 나갔다
      readyRef.current = true;
      setReady(true);
    });
    return () => { alive = false; if (before?.isConnected) before.focus({ preventScroll: true }); };
  }, [setup.species]);

  useEffect(() => {
    if (!ready) return;
    let last = performance.now(), prev = last, acc = DRAW_MS, raf = 0;
    const fxNow = (id: number, kind: "parry" | "perfect" | "hit" | "feint") => setFx({ id, n: ++fxN.current, kind });
    const loop = (now: number) => {
      const r = raid.current;
      // 120Hz 화면에서도 초당 60번까지만 진행 · 다시 그리기(advframe) — 거른 박자의 시간은 다음 박자에 함께 센다
      const gate = frameGate(acc, now - prev);
      prev = now;
      acc = gate.acc;
      if (!gate.draw) { raf = requestAnimationFrame(loop); return; }
      // 숨은 탭에서는 시간이 흐르지 않는다 — 돌아오면 그 자리부터
      const dt = document.hidden ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!r.end) stepRaid(r, dt);
      for (; seen.current < r.events.length; seen.current++) {
        const e = r.events[seen.current];
        if (e.k === "parry") {
          fxNow(e.t, e.perfect ? "perfect" : "parry");
          buzz(e.perfect ? [30, 30, 90] : [20, 20, 50]);
          setBurst({ id: e.t, dir: e.dir, perfect: e.perfect });
          setCall({ id: e.t, text: e.chain ? "한 번 더!" : e.kind === "heavy" && e.perfect ? "강공격 파쇄!" : e.perfect ? "완벽!" : "막았다!", tone: e.perfect ? "gold" : "good" });
          if (r.stagger > 0) staggerMax.current = r.stagger;
        }
        else if (e.k === "hit") { fxNow(e.t, "hit"); buzz([90, 40, 90]); setCall({ id: e.t, text: e.why === "wrong" ? "반대쪽이에요!" : e.why === "early" ? "너무 일러요!" : "늦었어요!", tone: "bad" }); }
        else if (e.k === "feint") { fxNow(e.t, "feint"); buzz(15); }
        else if (e.k === "warn") buzz(10);
        else if (e.k === "tap") {
          const big = e.combo >= 10 && e.combo % 5 === 0;
          setPops((p) => [...p.slice(-12), { id: e.t, x: lastPt.current.x + (((e.t * 977) % 14) - 7), y: lastPt.current.y - 4 - ((e.t * 613) % 8), text: `-${Math.round(e.d * 10) / 10}`, big }]);
        }
        else if (e.k === "rage") { setRageFx(e.t); setCall({ id: e.t, text: e.phase >= 2 ? "격노!" : "분노!", tone: "rage" }); buzz([40, 30, 40, 30, 120]); }
        else if (e.k === "end") {
          if (!sent.current) { sent.current = true; endRef.current(r); }
          buzz(e.why === "kill" ? [60, 40, 60, 40, 220] : 40);
          if (e.why === "kill") setCall({ id: e.t, text: "토벌!", tone: "kill" });
        }
      }
      setFrame((n) => n + 1);
      if (!r.end) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  const swipe = (d: RaidDir) => { if (ready) swipeRaid(raid.current, d); };
  const tap = () => { if (ready) tapRaid(raid.current); };
  const gesture = (g: RaidGesture) => {
    if (!g || raid.current.end) return;
    if (g.k === "tap") tap();
    else swipe(g.dir);
  };

  const r = raid.current, a = r.atk;
  const score = raidScore(r), left = raidLeft(setup.hp, setup.chunk, r);
  // 덮치기까지 남은 비율(1 → 0) — 고리가 줄어 표적 원에 닿는 순간이 막을 때
  const k = a ? Math.max(0, Math.min(1, (a.hitAt - r.t) / Math.max(0.1, a.hitAt - a.warnAt))) : 0;
  const lunge = a ? ["is-l", "is-u", "is-r", "is-d"][a.dir] : "";

  return createPortal(
    <div
      ref={box}
      className="boss-raid"
      role="application"
      aria-label={`주인 레이드 — ${setup.name}. 화살표 쪽으로 밀어 막고, 비틀거리면 두드리세요. 방향키로 막고 스페이스로 두드립니다`}
      tabIndex={0}
      onPointerDown={(e) => { e.stopPropagation(); touchDown(touches.current, e.pointerId, e.clientX, e.clientY); const b = box.current?.getBoundingClientRect(); if (b) lastPt.current = { x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 }; }}
      // 미는 동안 SWIPE_PX 를 넘는 순간 판정한다 — 손을 뗄 때까지 기다리면 박자에 맞춰 민 것도 늦었다
      onPointerMove={(e) => { e.stopPropagation(); gesture(touchMove(touches.current, e.pointerId, e.clientX, e.clientY)); }}
      onPointerUp={(e) => { e.stopPropagation(); gesture(touchUp(touches.current, e.pointerId, e.clientX, e.clientY)); }}
      onPointerCancel={(e) => { touches.current.delete(e.pointerId); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); close(); return; }
        if (r.end) return;
        const d = ({ ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3 } as Record<string, RaidDir | undefined>)[e.key];
        if (d !== undefined) { e.preventDefault(); if (!e.repeat) swipe(d); }
        else if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); }
      }}
    >
      {setup.bg && <i className="boss-raid-bg" aria-hidden style={{ backgroundImage: `url(${setup.bg})` }} />}
      <i className={`boss-raid-water ${r.phase > 0 ? `is-rage${r.phase}` : ""}`} aria-hidden />
      {rageFx > 0 && !reduced && <i key={`rage${rageFx}`} className="boss-raid-ragefx" aria-hidden />}
      <div className="boss-raid-top">
        <b><span aria-hidden>👑</span> {setup.name}</b>
        <span onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}><CloseButton onClose={close} label={r.end ? "닫기" : "그만하기"} /></span>
      </div>
      <div className="boss-raid-hp" role="meter" aria-label="주인 체력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(left * 100)}>
        <i className="was" style={{ width: `${setup.hp * 100}%` }} />
        <i className="lag" style={{ width: `${left * 100}%` }} />
        <i className="now" style={{ width: `${left * 100}%` }} />
        <u style={{ left: "33.3%" }} /><u style={{ left: "66.6%" }} />
        <small>{Math.round(left * 100)}%{setup.duo ? " · 협공 ×1.5" : ""}</small>
      </div>
      <div className="boss-raid-meta" aria-hidden>
        <span className="hearts">{Array.from({ length: setup.tune.hearts }, (_, i) => <i key={i} className={i < r.hearts ? "on" : ""} />)}</span>
        <span className="clock"><i style={{ width: `${Math.max(0, 1 - r.t / setup.tune.dur) * 100}%` }} /></span>
        <em>{Math.max(0, Math.ceil(setup.tune.dur - r.t))}초</em>
      </div>

      {!ready ? (
        <div className="boss-raid-intro">
          <b>주인 레이드</b>
          <p>화살표 쪽으로 <u>밀어서 막고</u></p>
          <p>비틀거리면 <u>마구 두드려요</u></p>
          <small>줄 {setup.tune.hearts}개 · {setup.tune.dur}초 · 깎은 만큼 남아요</small>
          {setup.wound > 0 && <em>상대가 오늘 남긴 상처 — 비틀거리는 주인으로 시작해요</em>}
        </div>
      ) : (
        <div className={`boss-raid-stage ${fx && !reduced ? `fx-${fx.kind}${fx.n % 2 ? " fx-b" : ""}` : ""}`}>
          {a && <i className={`boss-raid-danger is-${a.dir} ${a.kind === "heavy" ? "is-heavy" : ""}`} style={{ opacity: String(0.25 + (1 - k) * 0.6) }} aria-hidden />}
          {burst && <i key={`b${burst.id}`} className={`boss-raid-burst is-${burst.dir} ${burst.perfect ? "is-perfect" : ""}`} aria-hidden>{Array.from({ length: 10 }, (_, i) => <b key={i} style={{ rotate: `${i * 36}deg` }} />)}</i>}
          {fx && <i key={`flash${fx.n}`} className={`boss-raid-flash is-${fx.kind}`} aria-hidden />}
          <div className={`boss-raid-boss ${lunge} ${r.stagger > 0 ? "is-dazed" : ""} ${r.end === "kill" ? "is-down" : ""} ${a?.kind === "heavy" ? "is-charge" : ""} ${r.phase > 0 ? `is-rage${r.phase}` : ""} ${a && a.dir === 0 ? "is-flip" : ""}`} style={{ ["--k" as string]: String(1 - k) }}>
            <i className="aura" aria-hidden />
            <i className="shadow" aria-hidden />
            <span className="body"><FishArt artKey={setup.species} sync /></span>
            {r.stagger > 0 && !r.end && <i className="stars" aria-hidden><b>★</b><b>★</b><b>★</b></i>}
          </div>
          {r.stagger > 0 && !r.end && <i className="boss-raid-staggerbar" aria-hidden><i style={{ width: `${Math.min(100, (r.stagger / Math.max(0.1, staggerMax.current)) * 100)}%` }} /></i>}
          {r.combo >= 3 && r.stagger > 0 && !r.end && <p key={`c${Math.floor(r.combo / 5)}`} className={`boss-raid-combo ${r.combo >= 15 ? "is-hot" : ""}`} aria-hidden><b>{r.combo}</b> 콤보<small>×{Math.min(1.5, 1 + (r.combo - 1) * 0.03).toFixed(2)}</small></p>}
          {a && (
            <div className={`boss-raid-cue is-${a.dir}`} aria-live="assertive" data-left={process.env.NODE_ENV === "production" ? undefined : Math.round((a.hitAt - r.t) * 1000)}>
              <span className="ring" style={{ scale: String(1 + k * 1.6) }} aria-hidden />
              <span className="arrow" aria-hidden>{RAID_DIRS[a.dir]}</span>
              {a.kind !== "strike" && <span className="tag" aria-hidden>{a.kind === "heavy" ? "강공격" : "연속"}</span>}
              <span className="sr-only">{RAID_DIR_NAME[a.dir]}으로 밀어요</span>
            </div>
          )}
          {r.stagger > 0 && !r.end && <p className="boss-raid-daze" aria-live="polite">비틀비틀 — 두드려요!</p>}
          {pops.map((p) => <span key={p.id} className={`boss-raid-pop ${p.big ? "is-big" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden>{p.text}</span>)}
          {call && <p key={`call${call.id}${call.text}`} className={`boss-raid-call is-${call.tone}`} aria-live="polite">{call.text}</p>}
          {fx?.kind === "feint" && <p key={`f${fx.id}`} className="boss-raid-feint" aria-hidden>속임수!</p>}
        </div>
      )}

      {r.end && (
        <div className="boss-raid-end" role="dialog" aria-label="레이드 결과">
          <b>{r.end === "kill" ? `${setup.name} 토벌!` : r.end === "down" ? "줄이 다 끊겼어요" : "시간 끝"}</b>
          <p>{r.end === "kill" ? "마지막 일격! 끌어올려요" : `체력 ${Math.round(setup.hp * 100)}% → ${Math.round(left * 100)}% · 깎은 만큼 남아요`}</p>
          <small>막기 {r.parried} · 완벽 {r.perfect} · 연타 {r.taps} · 최고 콤보 {r.maxCombo} · 점수 {Math.round(score * 100)}</small>
          <button type="button" className="tap boss-raid-btn" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClose(); }}>{r.end === "kill" ? "끌어올리기" : setup.triesLeft > 0 ? `확인 · 오늘 ${setup.triesLeft}번 남음` : "확인"}</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
