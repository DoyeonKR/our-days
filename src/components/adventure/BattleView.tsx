"use client";
/* 모험 전투 화면 — 위는 상대, 아래는 나. 엔진(lib/adventure)이 낸 사건(Ev)을 하나씩 틀어 보여 준다.
 * 화면이 들고 있는 숫자(disp)는 연출용이다 — 판정은 언제나 엔진의 battle 이 정본. 사건을 다 틀면 battle 값으로 맞춘다.
 * 연출(2026-11-08 [사용자: "공격기술이나 움직임이 너무 허접해"]):
 *  - 기술 = 오는 길(lib/battlefx 의 travel — 쏘기 · 광선 · 쏟아짐 · 물결 · 소용돌이 · 베기 · 모으기) × 속성 재료, 맞는 순간 충격파 · 파편.
 *  - 생물 = 등장 · 숨쉬기 · 돌진(몸통 기술) · 시전(그 밖) · 피격 넉백과 번쩍 · 회피 · 쓰러짐. 같은 자세가 이어지면 a/b 로 번갈아 다시 튼다.
 *  - 화면 = 급소 · 효과 굉장 · 큰 기술에 흔들림, 급소에 흰 섬광, 데미지 · 회복 · 상태 숫자가 떠오른다, 체력바는 잔상을 남기고 준다.
 * ⚠ 그림은 우리 펫 원화 · 화면 모양은 이 앱 것이다(원작 게임 화면을 따라 그리지 않는다). ⚠ CSS 키프레임에 rotate 금지(pettap.test). */
import { useEffect, useRef, useState } from "react";
import {
  BALLS, ITEMS, MOVES, SPECIES, TYPE_COLOR, activeOf, catchChance, effectiveness, moveOf, playTurn, statsOf, xpFor,
  type Action, type BallKey, type Battle, type Ev, type ItemKey, type Move, type Region, type Status,
} from "@/lib/adventure";
import { BattleFx, type Pt } from "@/lib/battlefx";
import { useBackClose } from "@/lib/useBackClose";
import MonArt from "@/components/adventure/MonArt";
import { josa } from "@/lib/josa";

type Bag = { balls: Record<BallKey, number>; items: Record<ItemKey, number> };
type Disp = { species: [string, string]; level: [number, number]; hp: [number, number]; max: [number, number]; status: [Status | undefined, Status | undefined]; gone: [boolean, boolean] };
type Pose = "" | "enter" | "lunge" | "cast" | "hit" | "dodge" | "faint";
type Float = { id: number; x: number; y: number; text: string; kind: string };
type Ball = { shakes: number; caught: boolean; phase: "fly" | "shake" | "out" | "done" };
type Menu = "root" | "fight" | "bag" | "swap" | "aim";

const STATUS_LABEL: Record<Status, string> = { burn: "화상", poison: "독", para: "마비", sleep: "잠듦" };
const STAT_LABEL = { atk: "공격", def: "방어", spd: "스피드" } as const;

function dispOf(b: Battle): Disp {
  const a = activeOf(b, 0);
  const z = activeOf(b, 1);
  return {
    species: [a.mon.species, z.mon.species],
    level: [a.mon.level, z.mon.level],
    hp: [a.mon.hp, z.mon.hp],
    max: [a.stats.hp, z.stats.hp],
    status: [a.mon.status, z.mon.status],
    gone: [a.mon.hp <= 0, z.mon.hp <= 0],
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 기술 버튼의 성격 표 — 연속 · 흡수 · 반동 · 선제 · 급소 · 움찔 · 상태이상 */
export function moveTags(mv: Move): string[] {
  const t: string[] = [];
  if (mv.hits) t.push(`${mv.hits[0]}~${mv.hits[1]}연타`);
  if (mv.priority) t.push("선제");
  if (mv.drain) t.push("흡수");
  if (mv.recoil) t.push("반동");
  if (mv.crit) t.push("급소↑");
  if (mv.flinch) t.push("움찔");
  if (mv.inflict) t.push(STATUS_LABEL[mv.inflict.status]);
  if (mv.heal) t.push("회복");
  if (mv.boost) t.push(`${mv.boost.self ? "내" : "상대"} ${STAT_LABEL[mv.boost.stat]}${mv.boost.by > 0 ? "▲" : "▼"}`);
  return t;
}

export default function BattleView({ battle: start, region, bag: startBag, onEnd }: {
  battle: Battle;
  region: Region;
  bag: Bag;
  onEnd: (battle: Battle, bag: Bag) => void;
}) {
  const [battle, setBattle] = useState(start);
  const [bag, setBag] = useState(startBag);
  const [disp, setDisp] = useState<Disp>(() => dispOf(start));
  const [text, setText] = useState(() => `앗! 야생 ${josa(SPECIES[activeOf(start, 1).mon.species].name, "이/가")} 나타났다!`);
  const [busy, setBusy] = useState(true);
  const [menu, setMenu] = useState<Menu>("root");
  const [pose, setPoseState] = useState<[string, string]>(["enter", "enter"]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [shake, setShake] = useState(0);
  const [flash, setFlash] = useState(0);
  const [ball, setBall] = useState<Ball | null>(null);
  const [aimT, setAimT] = useState(0);
  const [pendingBall, setPendingBall] = useState<BallKey>("basic");
  const skip = useRef(false);
  const aimStart = useRef(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monRef = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const fxRef = useRef<BattleFx | null>(null);
  const flip = useRef([0, 0]);
  const floatId = useRef(0);

  // 이펙트 캔버스 — 화면 크기가 바뀌면 다시 잰다
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fx = new BattleFx(c);
    fxRef.current = fx;
    const ro = new ResizeObserver(() => fx.resize());
    ro.observe(c);
    return () => {
      ro.disconnect();
      fx.destroy();
      fxRef.current = null;
    };
  }, []);

  // 등장 — 둘이 양옆에서 들어온 뒤 명령을 받는다
  useEffect(() => {
    const t1 = setTimeout(() => setPoseState(["", ""]), 700);
    const t2 = setTimeout(() => {
      setText((s) => (s.startsWith("앗!") ? `${josa(SPECIES[activeOf(start, 0).mon.species].name, "은/는")} 무엇을 할까?` : s));
      setBusy(false);
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [start]);

  // 뒤로 가기 — 판을 그냥 버리지 않는다. 야생이면 도망치기를 한 번 해 본다.
  useBackClose(() => {
    if (!busy && !battle.over && battle.wild && !battle.needSwap) void act({ kind: "run" });
    return false;
  }, !battle.over);

  // 겨누기 고리 — 줄었다 커졌다(1.1초 한 바퀴)
  useEffect(() => {
    if (menu !== "aim") return;
    let raf = 0;
    aimStart.current = performance.now();
    const loop = (t: number) => {
      setAimT(((t - aimStart.current) % 1100) / 1100);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [menu]);

  /** 생물 자리의 가운데(장면 기준 좌표) */
  function center(side: 0 | 1): Pt {
    const scene = sceneRef.current?.getBoundingClientRect();
    const el = monRef[side].current?.querySelector("img")?.getBoundingClientRect();
    if (!scene || !el) return { x: side ? 260 : 100, y: side ? 120 : 300 };
    return { x: el.left - scene.left + el.width / 2, y: el.top - scene.top + el.height * 0.55 };
  }

  function setPose(side: 0 | 1, p: Pose, ms = 0) {
    const name = p === "hit" || p === "lunge" || p === "cast" ? `${p}-${(flip.current[side] ^= 1) ? "a" : "b"}` : p;
    setPoseState((cur) => (side ? [cur[0], name] : [name, cur[1]]));
    if (ms) setTimeout(() => setPoseState((cur) => {
      if (cur[side] !== name) return cur;
      return side ? [cur[0], ""] : ["", cur[1]];
    }), ms);
  }

  function addFloat(side: 0 | 1, s: string, kind: string) {
    const at = center(side);
    const id = ++floatId.current;
    setFloats((f) => [...f, { id, x: at.x + (Math.random() * 30 - 15), y: at.y - 30, text: s, kind }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1000);
  }

  async function say(s: string, ms = 760) {
    setText(s);
    skip.current = false;
    const end = Date.now() + ms;
    while (Date.now() < end && !skip.current) await wait(30);
  }

  async function play(prev: Battle, next: Battle, events: Ev[]) {
    const d = dispOf(prev);
    const fx = fxRef.current;
    const put = () => setDisp({ ...d, species: [...d.species], level: [...d.level], hp: [...d.hp], max: [...d.max], status: [...d.status], gone: [...d.gone] } as Disp);
    let last: Move | null = null;
    let shown = "";
    for (let k = 0; k < events.length; k++) {
      const e = events[k];
      if (e.t === "text") {
        // 기술 이름은 연출보다 먼저 띄웠다 — 같은 글이면 짧게만 머문다
        if (e.s === shown) await wait(200);
        else await say(e.s);
        shown = "";
      }
      else if (e.t === "use") {
        const mv = moveOf(e.move);
        last = mv;
        const next = events[k + 1];
        if (next?.t === "text") {
          setText(next.s);
          shown = next.s;
        }
        const other = (e.side ? 0 : 1) as 0 | 1;
        setPose(e.side, mv.fx === "contact" ? "lunge" : "cast", 520);
        if (mv.fx === "contact") await wait(150);
        await fx?.travel(mv.fx, mv.type, center(e.side), center(mv.fx === "self" ? e.side : other));
      } else if (e.t === "hit") {
        d.hp[e.side] = Math.max(0, d.hp[e.side] - e.dmg);
        put();
        const mv = e.move ? moveOf(e.move) : null;
        const at = center(e.side);
        if (mv) fx?.impact(mv.type, at, { power: mv.hits ? 0.45 : mv.power / 90, eff: e.eff, crit: e.crit });
        else if (e.recoil) fx?.impact("노말", at, { small: true });
        else {
          const st = d.status[e.side];
          if (st) fx?.status(st, at);
        }
        setPose(e.side, "hit", 460);
        addFloat(e.side, `-${e.dmg}`, e.crit ? "crit" : e.eff > 1 ? "super" : e.eff < 1 ? "weak" : e.recoil || !mv ? "self" : "");
        if (e.crit || e.eff > 1 || (mv && mv.power >= 90)) setShake((n) => n + 1);
        if (e.crit) setFlash((n) => n + 1);
        await wait(e.n && e.n > 0 ? 260 : 440);
      } else if (e.t === "miss") {
        setPose(e.side, "dodge", 420);
        addFloat(e.side, "빗나감", "miss");
        await wait(320);
      } else if (e.t === "heal") {
        const other = (e.side ? 0 : 1) as 0 | 1;
        if (e.drain && last) await fx?.drain(last.type, center(other), center(e.side));
        else fx?.heal(center(e.side));
        d.hp[e.side] = Math.min(d.max[e.side], d.hp[e.side] + e.amount);
        put();
        if (e.amount > 0) addFloat(e.side, `+${e.amount}`, "heal");
        await wait(380);
      } else if (e.t === "status") {
        fx?.status(e.status, center(e.side));
        d.status[e.side] = e.status;
        put();
        addFloat(e.side, STATUS_LABEL[e.status], `status-${e.status}`);
        setPose(e.side, "hit", 460);
        await wait(380);
      } else if (e.t === "stat") {
        if (e.by !== 0) {
          fx?.aura(SPECIES[d.species[e.side]].type, center(e.side), e.by > 0);
          addFloat(e.side, `${STAT_LABEL[e.stat]} ${e.by > 0 ? "▲".repeat(e.by) : "▼".repeat(-e.by)}`, e.by > 0 ? "up" : "down");
        }
        await wait(420);
      } else if (e.t === "faint") {
        d.gone[e.side] = true;
        put();
        setPose(e.side, "faint");
        fx?.impact(SPECIES[d.species[e.side]].type, center(e.side), { small: true });
        await wait(700);
      } else if (e.t === "swap") {
        const src = e.side === 0 ? prev.sides[0].team[e.to] : next.sides[1].team[e.to];
        d.species[e.side] = src.mon.species;
        d.level[e.side] = src.mon.level;
        d.hp[e.side] = src.mon.hp;
        d.max[e.side] = statsOf(src.mon).hp;
        d.status[e.side] = src.mon.status;
        d.gone[e.side] = false;
        setPose(e.side, "enter", 650);
        put();
        await wait(560);
      } else if (e.t === "throw") {
        setBall({ shakes: e.shakes, caught: e.caught, phase: "fly" });
        await wait(650);
        for (let i = 0; i < e.shakes; i++) {
          setBall({ shakes: e.shakes, caught: e.caught, phase: "shake" });
          await wait(520);
          setBall({ shakes: e.shakes, caught: e.caught, phase: "fly" });
          await wait(140);
        }
        setBall({ shakes: e.shakes, caught: e.caught, phase: e.caught ? "done" : "out" });
        if (e.caught) {
          fx?.impact("페어리", center(1), { power: 1.2 });
          await wait(600);
        } else {
          fx?.impact("노말", center(1), { small: true });
          setPose(1, "enter", 500);
          await wait(260);
          setBall(null);
        }
      }
    }
    setDisp(dispOf(next));
  }

  async function act(a: Action) {
    if (busy || battle.over) return;
    const r = playTurn(battle, a, bag);
    if (!r.events.length) return;
    setBusy(true);
    setMenu("root");
    const nextBag = { balls: { ...bag.balls }, items: { ...bag.items } };
    if (a.kind === "ball") nextBag.balls[a.ball]--;
    if (a.kind === "item") nextBag.items[a.item]--;
    setBag(nextBag);
    await play(battle, r.battle, r.events);
    setBattle(r.battle);
    setBusy(false);
    if (r.battle.over) {
      await wait(400);
      onEnd(r.battle, nextBag);
    } else if (r.battle.needSwap) {
      setText("다음으로 누구를 내보낼까?");
      setMenu("swap");
    } else setText(`${josa(SPECIES[activeOf(r.battle, 0).mon.species].name, "은/는")} 무엇을 할까?`);
  }

  const me = activeOf(battle, 0);
  const foe = activeOf(battle, 1);
  const foeType = SPECIES[foe.mon.species].type;
  const aimScale = 1.15 - 0.85 * (aimT < 0.5 ? aimT * 2 : 2 - aimT * 2);
  const aimValue = Math.max(0, Math.min(1, (1.15 - aimScale) / 0.85));
  const monCls = (side: 0 | 1) => `adv-pose pose-${pose[side] || "idle"} ${disp.gone[side] && !pose[side].startsWith("enter") ? "is-down" : ""}`;

  return (
    <div className="adv-battle fixed inset-0 z-[80] flex flex-col" role="dialog" aria-modal="true" aria-label="전투">
      <div
        ref={sceneRef}
        className={`adv-scene relative overflow-hidden ${shake ? (shake % 2 ? "shake-a" : "shake-b") : ""}`}
        style={{ background: `linear-gradient(${region.sky[0]}, ${region.sky[1]})` }}
        onClick={() => (skip.current = true)}
      >
        <div className="adv-ground adv-ground-far" style={{ background: region.ground }} />
        <div className="adv-ground adv-ground-near" style={{ background: region.ground }} />

        {/* 상대 */}
        <HpCard side={1} d={disp} />
        <div ref={monRef[1]} className={`adv-mon adv-mon-foe ${ball && ball.phase !== "out" ? "is-caught-in" : ""}`}>
          <span className="adv-shadow" aria-hidden />
          <div className={monCls(1)}>
            <div className="adv-idle adv-idle-foe">
              <MonArt species={disp.species[1]} size={150} />
            </div>
          </div>
        </div>
        {menu === "aim" && (
          <div className="adv-aim" aria-hidden>
            <span className="adv-aim-ring" style={{ transform: `translate(-50%, -50%) scale(${aimScale})`, borderColor: aimValue > 0.75 ? "#ffd84d" : aimValue > 0.4 ? "#9be37a" : "#ffffff" }} />
          </div>
        )}
        {ball && <span className={`adv-ball adv-ball-${ball.phase}`} aria-hidden><BallIcon k={pendingBall} /></span>}

        {/* 나 */}
        <div ref={monRef[0]} className="adv-mon adv-mon-me">
          <span className="adv-shadow" aria-hidden />
          <div className={monCls(0)}>
            <div className="adv-idle adv-idle-me">
              <MonArt species={disp.species[0]} size={170} back />
            </div>
          </div>
        </div>
        <HpCard side={0} d={disp} xp={me.mon} />

        <canvas ref={canvasRef} className="adv-fx" aria-hidden />
        {floats.map((f) => (
          <span key={f.id} className={`adv-float adv-float-${f.kind || "hit"}`} style={{ left: f.x, top: f.y }} aria-hidden>{f.text}</span>
        ))}
        {flash > 0 && <span key={flash} className="adv-flash" aria-hidden />}
      </div>

      <div className="adv-panel">
        <button type="button" className="adv-text" onClick={() => (skip.current = true)} aria-live="polite">{text}</button>
        {!busy && !battle.over && (
          <div className="adv-menu">
            {menu === "root" && !battle.needSwap && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="tap adv-cmd adv-cmd-fight" onClick={() => setMenu("fight")}>싸우기</button>
                <button type="button" className="tap adv-cmd" onClick={() => setMenu("bag")}>가방</button>
                <button type="button" className="tap adv-cmd" onClick={() => setMenu("swap")}>교체</button>
                <button type="button" className="tap adv-cmd" onClick={() => void act({ kind: "run" })} disabled={!battle.wild}>도망</button>
              </div>
            )}
            {menu === "fight" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {me.mon.moves.map((m, i) => {
                    const mv = MOVES[m.id];
                    const eff = mv.power > 0 ? effectiveness(mv.type, foeType) : 1;
                    const tags = moveTags(mv);
                    return (
                      <button key={m.id} type="button" disabled={m.pp <= 0} className="tap adv-move" style={{ borderColor: TYPE_COLOR[mv.type] }} onClick={() => void act({ kind: "move", i })}>
                        <span className="adv-move-name">
                          {mv.name}
                          {eff > 1 && <em className="adv-eff adv-eff-good">효과 굉장</em>}
                          {eff < 1 && <em className="adv-eff adv-eff-bad">별로</em>}
                        </span>
                        <span className="adv-move-meta"><i style={{ background: TYPE_COLOR[mv.type] }}>{mv.type}</i>{mv.power ? `위력 ${mv.power}` : "변화"} · {m.pp}/{mv.pp}</span>
                        {tags.length > 0 && <span className="adv-move-tags">{tags.join(" · ")}</span>}
                      </button>
                    );
                  })}
                </div>
                {me.mon.moves.every((m) => m.pp <= 0) && <button type="button" className="tap adv-cmd mt-2 w-full" onClick={() => void act({ kind: "move", i: -1 })}>버둥거리기</button>}
                <button type="button" className="tap adv-back" onClick={() => setMenu("root")}>뒤로</button>
              </>
            )}
            {menu === "bag" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(BALLS) as BallKey[]).map((k) => (
                    <button key={k} type="button" className="tap adv-item" disabled={!battle.wild || bag.balls[k] <= 0} onClick={() => { setPendingBall(k); setMenu("aim"); }}>
                      <BallIcon k={k} /> {BALLS[k].name} <b>×{bag.balls[k]}</b>
                      {battle.wild && <small>{Math.round(catchChance(foe, k, 0.6) * 100)}%</small>}
                    </button>
                  ))}
                  {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
                    <button key={k} type="button" className="tap adv-item" disabled={bag.items[k] <= 0} onClick={() => void act({ kind: "item", item: k, target: battle.sides[0].active })}>
                      {ITEMS[k].name} <b>×{bag.items[k]}</b>
                    </button>
                  ))}
                </div>
                <button type="button" className="tap adv-back" onClick={() => setMenu("root")}>뒤로</button>
              </>
            )}
            {menu === "aim" && (
              <>
                <p className="adv-hint">고리가 가장 작을 때 던지면 잘 잡혀요</p>
                <button type="button" className="tap adv-cmd adv-cmd-fight w-full" onClick={() => void act({ kind: "ball", ball: pendingBall, aim: aimValue })}>던지기!</button>
                <button type="button" className="tap adv-back" onClick={() => setMenu("bag")}>뒤로</button>
              </>
            )}
            {menu === "swap" && (
              <>
                <div className="grid gap-1.5">
                  {battle.sides[0].team.map((f, i) => {
                    const max = f.stats.hp;
                    return (
                      <button key={f.mon.id} type="button" disabled={f.mon.hp <= 0 || i === battle.sides[0].active} className="tap adv-swap" onClick={() => void act({ kind: "swap", to: i })}>
                        <MonArt species={f.mon.species} size={40} />
                        <span className="min-w-0 flex-1 text-left">
                          <b>{SPECIES[f.mon.species].name}</b> <small>Lv.{f.mon.level}</small>
                          <HpBar hp={f.mon.hp} max={max} />
                        </span>
                        {i === battle.sides[0].active && <small>싸우는 중</small>}
                      </button>
                    );
                  })}
                </div>
                {!battle.needSwap && <button type="button" className="tap adv-back" onClick={() => setMenu("root")}>뒤로</button>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HpCard({ side, d, xp }: { side: 0 | 1; d: Disp; xp?: { level: number; xp: number } }) {
  const sp = SPECIES[d.species[side]];
  const st = d.status[side];
  return (
    <div className={`adv-hpcard ${side === 1 ? "adv-hpcard-foe" : "adv-hpcard-me"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <b className="truncate">{sp.name}</b>
        <span className="shrink-0 text-[12px]">Lv.{d.level[side]}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <i className="adv-type" style={{ background: TYPE_COLOR[sp.type] }}>{sp.type}</i>
        {st && <i className={`adv-status adv-status-${st}`}>{STATUS_LABEL[st]}</i>}
      </div>
      <HpBar hp={d.hp[side]} max={d.max[side]} />
      {side === 0 && <p className="mt-0.5 text-right text-[12px] tabular-nums">{d.hp[0]} / {d.max[0]}</p>}
      {xp && side === 0 && <XpBar level={xp.level} xp={xp.xp} />}
    </div>
  );
}

/** 체력바 — 앞 막대는 바로, 뒤 잔상은 조금 늦게 따라 준다(얼마나 깎였는지 보이게) */
export function HpBar({ hp, max }: { hp: number; max: number }) {
  const r = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const color = r > 0.5 ? "#3ccf6a" : r > 0.2 ? "#f2b833" : "#ef5a4c";
  return (
    <span className="adv-hpbar" role="meter" aria-label="체력" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <span className="adv-hpbar-lag" style={{ width: `${r * 100}%` }} />
      <span className="adv-hpbar-now" style={{ width: `${r * 100}%`, background: color }} />
    </span>
  );
}

export function XpBar({ level, xp }: { level: number; xp: number }) {
  const a = xpFor(level);
  const b = xpFor(level + 1);
  const r = b > a ? (xp - a) / (b - a) : 1;
  return (
    <span className="adv-xpbar" aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(1, r)) * 100}%` }} />
    </span>
  );
}

/** 공 — 도토리 모양 씨앗 공(이 앱 것). ⚠ 위아래 두 색 + 가운데 띠 + 단추 모양의 공은 원작 게임의 상징이라 쓰지 않는다. */
export function BallIcon({ k, size = 18 }: { k: BallKey; size?: number }) {
  const body = k === "basic" ? "#6cbf4a" : k === "great" ? "#3f8fd8" : "#8a5ad8";
  const dark = k === "basic" ? "#3f8a2e" : k === "great" ? "#2763a3" : "#5d38a6";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="inline-block align-[-3px]">
      <path d="M10 1.2v2.6" stroke="#6b4a2b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10.6c0 4.4 2.7 7.9 6 7.9s6-3.5 6-7.9z" fill={body} stroke={dark} strokeWidth="1.3" />
      <path d="M6.2 12c.3 2.2 1.4 3.9 2.8 4.6" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M2.6 10.8C2.6 6.6 6 3.6 10 3.6s7.4 3 7.4 7.2z" fill="#a8743f" stroke="#6b4a2b" strokeWidth="1.3" />
      <path d="M5 8.2h10M4 10h12M7 5.6l-1.6 4.6M10 4.4v6M13 5.6l1.6 4.6" stroke="#6b4a2b" strokeOpacity=".55" strokeWidth=".8" />
      {k === "star" && <path d="M10 11.6l.8 1.7 1.8.2-1.4 1.2.5 1.8-1.7-1-1.7 1 .5-1.8-1.4-1.2 1.8-.2z" fill="#ffe27a" />}
      {k === "great" && <circle cx="10" cy="14" r="1.6" fill="#fff" fillOpacity=".85" />}
    </svg>
  );
}
