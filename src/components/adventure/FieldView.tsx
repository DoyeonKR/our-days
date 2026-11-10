"use client";
/* 모험 필드 화면 — 지역을 걸어 다니며 수풀의 생물을 만난다. 규칙은 lib/adventurefield. README §14.6 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAP_RULES, type MapKey } from "@/lib/arena";
import { REGION_STORY, SPECIES, bossLevel, nextGoal, statsOf, trainersOf, type AdvSave, type Battle, type Region } from "@/lib/adventure";
import { FIELD_H, FIELD_TPS, FIELD_W, afterBattle, nearestThing, newField, stepField, type FieldMon, type FieldState, type Thing } from "@/lib/adventurefield";
import { battleDpr } from "@/lib/battlefx";
import { paintGround, paintPath, paintThicket } from "@/lib/groundpaint";
import { dirOf } from "@/lib/arena";
import { useBackClose } from "@/lib/useBackClose";
import { enterBattleFullscreen, exitBattleFullscreen } from "@/lib/battlefull";
import { CloseButton } from "@/components/AppButtons";
import GameWindowGuard from "@/components/GameWindowGuard";
import MonArt from "@/components/adventure/MonArt";
import { Stick, drawRock } from "@/components/adventure/BattleView";
import { pressProps, shade } from "@/components/adventure/advui";
import { josa } from "@/lib/josa";
import { preloadSprite, spriteOf } from "@/lib/advsprite";
import { frameGate } from "@/lib/advframe";
import { FIELD_COACH_KEY, keptField, minFont, pickMarker, planWalk, resumeField, stepWalk, type Walk } from "@/lib/advmobile";

/** 미니맵 크기 — 손가락으로 표시를 고를 수 있게 56 → 72px(2026-11-09) */
const MAP_W = 72;
const MAP_H = (MAP_W * FIELD_H) / FIELD_W;
const MAP_TOP = 112;

const SPRITE = 84;
/** 원화 아래쪽 여백 — 발이 그림자에 닿게 내린다 */
const FOOT = 12;

type Tuft = { x: number; y: number; s: number; ph: number };
type Mote = { x: number; y: number; v: number; ph: number; s: number };

function hashed(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOTE: Record<string, { n: number; color: string; fall: number }> = {
  meadow: { n: 26, color: "#ffc4dc", fall: 26 },
  hill: { n: 34, color: "#ffffff", fall: 8 },
  lake: { n: 26, color: "#cdeeff", fall: -14 },
  swamp: { n: 30, color: "#bfe6a8", fall: -10 },
  cave: { n: 24, color: "#b9a6ff", fall: -8 },
  plateau: { n: 60, color: "#ffffff", fall: 60 },
  temple: { n: 46, color: "#ffe9a6", fall: -18 },
};

export default function FieldView({ region, save, paused, outcome, onEncounter, onBoss, onTrainer, onIntro, onHeal, onChest, onClose, opened, keep, day }: {
  region: Region;
  save: AdvSave;
  /** 전투 · 결과 창이 위에 떠 있다 */
  paused: boolean;
  /** 방금 끝난 전투 — n 이 바뀔 때마다 한 번 처리한다 */
  outcome: { n: number; over: Battle["over"] } | null;
  onEncounter: (species: string, level: number) => void;
  onBoss: () => void;
  onTrainer: (slot: number) => void;
  onIntro: () => void;
  onHeal: () => void;
  onChest: (slot: number) => void;
  onClose: () => void;
  /** 오늘 연 상자 id(`지역:칸`) */
  opened: string[];
  /** 지역마다 걷던 필드(AdventureTab 이 들고 있다) — 나갔다 들어와도 서 있던 자리 · 수풀의 생물이 그대로. 날이 바뀌면 비운다 */
  keep?: { day: string; m: Map<string, FieldState> };
  day?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // 예전엔 열 때마다 새 필드라 '지도로'를 한 번 누르면 시작점으로 돌아갔다(2026-11-09)
  const [state] = useState<FieldState>(() => {
    const old = keep && day ? keptField(keep, day, region.key) : undefined;
    return old && old.map.key === region.key ? resumeField(old) : newField(region, Date.now() & 0xfffffff);
  });
  useEffect(() => {
    if (keep && day) {
      keptField(keep, day, region.key);
      keep.m.set(region.key, state);
    }
  }, [keep, day, region.key, state]);
  // 처음 필드에 온 날 한 번 — 막대 · 조사 · ★ · ! · 미니맵(닫을 때 기억한다)
  const [coach, setCoach] = useState(() => {
    try {
      return !localStorage.getItem(FIELD_COACH_KEY);
    } catch {
      return false;
    }
  });
  const closeCoach = () => {
    try {
      localStorage.setItem(FIELD_COACH_KEY, "1");
    } catch {
      /* 막힌 저장소 — 이번만 닫는다 */
    }
    setCoach(false);
  };
  /** 미니맵을 눌러 걷는 중 — 막대 · 화살표를 건드리면 멈춘다 */
  const walk = useRef<Walk | null>(null);
  const [walking, setWalking] = useState<string | null>(null);
  const [thing, setThing] = useState<Thing | null>(null);
  const [talk, setTalk] = useState<{ who: string; text: string; go?: () => void } | null>(() => (save.intro ?? []).includes(region.key) ? null : { who: region.name, text: REGION_STORY[region.key]?.intro ?? "" });
  const trainers = trainersOf(region);
  const input = useRef({ keys: new Set<string>(), stick: 0 });
  const pending = useRef<number | null>(null);
  const seenOutcome = useRef(outcome?.n ?? 0);
  const wipe = useRef<{ t0: number; m: FieldMon } | null>(null);
  const chestDone = thing?.kind === "chest" && opened.includes(`${region.key}:${thing.slot}`);
  const beaten = (slot: number) => (save.trainers ?? []).includes(trainers[slot]?.id);
  const label = !thing ? null : thing.kind === "spring" ? "쉬기" : thing.kind === "boss" ? "도전" : thing.kind === "guide" ? "읽기" : thing.kind === "trainer" ? (beaten(thing.slot) ? "인사" : "대결") : chestDone ? "빈 상자" : "열기";

  function act() {
    if (!thing || paused) return;
    if (thing.kind === "spring") onHeal();
    else if (thing.kind === "boss") {
      const won = (save.badges ?? []).includes(region.key);
      setTalk({ who: region.boss!.name, text: (won ? REGION_STORY[region.key]?.after : REGION_STORY[region.key]?.boss) ?? "", go: onBoss });
    } else if (thing.kind === "chest") {
      if (!chestDone) onChest(thing.slot);
    } else if (thing.kind === "trainer") {
      const t = trainers[thing.slot];
      const slot = thing.slot;
      if (beaten(slot)) setTalk({ who: t.name, text: t.bye });
      else setTalk({ who: t.name, text: t.hello, go: () => onTrainer(slot) });
    } else setTalk((t) => (t ? null : { who: "안내판", text: `${MAP_RULES[region.key as MapKey]?.tip ?? ""}. ${nextGoal(save).text}.` }));
  }

  // coach = 첫 안내 — 그리기는 그대로 두고 걸음 · 생물만 멈춘다(안내 뒤 지도가 보이게)
  const live = useRef({ paused, coach, save, opened, onEncounter, act });
  useEffect(() => {
    live.current = { paused, coach, save, opened, onEncounter, act };
  });

  /** 미니맵 누름 → 가장 가까운 표시로 길을 따라 걷기(손가락이 아니면 대장 관문으로) */
  function tapMap(e: React.PointerEvent<HTMLButtonElement> | null) {
    if (live.current.paused || live.current.coach) return;
    const map = state.map;
    const marks = [
      { x: map.gate.x, y: map.gate.y, name: "대장 관문" },
      { x: map.spring.x, y: map.spring.y, name: "회복 샘" },
      ...map.chests.filter((_, i) => !opened.includes(`${region.key}:${i}`)).map((c) => ({ x: c.x, y: c.y, name: "상자" })),
      ...map.trainers.flatMap((c, i) => (trainers[i] && !beaten(i) ? [{ x: c.x, y: c.y, name: trainers[i].name }] : [])),
    ];
    let to = marks[0];
    if (e) {
      const r = e.currentTarget.getBoundingClientRect();
      const mk = MAP_W / FIELD_W;
      const got = pickMarker(marks, { x: (e.clientX - r.left - 3) / mk, y: (e.clientY - r.top - 3) / mk }, 20 / mk);
      if (!got) return;
      to = got;
    }
    walk.current = planWalk(map.path, { x: state.x, y: state.y }, to);
    setWalking(`${josa(to.name, "으로/로")} 걷는 중 — 막대를 움직이면 멈춰요`);
  }

  useBackClose(() => {
    onClose();
  }, true);

  useEffect(() => {
    if (!outcome || outcome.n === seenOutcome.current) return;
    seenOutcome.current = outcome.n;
    if (pending.current != null) afterBattle(state, pending.current, outcome.over);
    pending.current = null;
    wipe.current = null;
  }, [outcome, state]);

  useEffect(() => {
    enterBattleFullscreen();
    return () => exitBattleFullscreen();
  }, []);

  // 그리기 · 진행
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = state.map;
    const npcs = trainersOf(region);
    const key = region.key as MapKey;
    let dpr = 1;
    let w = 0;
    let h = 0;
    const fit = () => {
      const r = c.getBoundingClientRect();
      dpr = battleDpr(r.width, r.height);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      w = r.width;
      h = r.height;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    for (const m of live.current.save.party) preloadSprite(m.species);

    const rand = hashed(region.key.length * 991 + region.ground.charCodeAt(2));
    // 바닥 질감 — 지역마다 한 번 굽는다(lib/groundpaint). 예전엔 단색 위에 점 420개를 프레임마다 다시 그렸다
    let groundTex: HTMLCanvasElement | null = null;
    try {
      const gk = Math.min(1.25, Math.sqrt(2_600_000 / (FIELD_W * FIELD_H)));
      const t = document.createElement("canvas");
      t.width = Math.round(FIELD_W * gk);
      t.height = Math.round(FIELD_H * gk);
      const tg = t.getContext("2d");
      if (tg) {
        tg.setTransform(gk, 0, 0, gk, 0, 0);
        paintGround(tg, region.key, FIELD_W, FIELD_H, region.ground);
        for (const gp of map.grass) paintThicket(tg, region.key, gp.x, gp.y, gp.rx, gp.ry, region.ground);
        paintPath(tg, region.key, map.path, 120);
        groundTex = t;
      }
    } catch {
      groundTex = null;
    }
    const tufts: Tuft[] = [];
    for (const g of map.grass) {
      const n = Math.round((g.rx * g.ry) / 560);
      for (let i = 0; i < n; i++) {
        const ang = rand() * Math.PI * 2;
        const q = Math.sqrt(rand());
        tufts.push({ x: g.x + Math.cos(ang) * g.rx * q, y: g.y + Math.sin(ang) * g.ry * q, s: 15 + rand() * 11, ph: rand() * 6 });
      }
    }
    const mo = MOTE[region.key] ?? MOTE.meadow;
    const motes: Mote[] = Array.from({ length: still ? 0 : mo.n }, () => ({ x: rand(), y: rand(), v: 0.6 + rand() * 0.8, ph: rand() * 6, s: 1.6 + rand() * 2.4 }));
    const pal: [string, string, string] = [shade(region.ground, -0.1), shade(region.ground, -0.5), shade(region.ground, 0.32)];
    const cam = { x: state.x, y: state.y };
    // 지도 끝 — 덤불 · 바위로 둘러 경계가 보이게
    const edge: { x: number; y: number; r: number }[] = [];
    for (let x = -20; x <= FIELD_W + 20; x += 74) {
      edge.push({ x, y: -6 + rand() * 18, r: 40 + rand() * 18 });
      edge.push({ x: x + 30, y: FIELD_H + 18 + rand() * 18, r: 42 + rand() * 18 });
      edge.push({ x: x + 12, y: FIELD_H + 110 + rand() * 30, r: 46 + rand() * 18 });
      edge.push({ x: x + 40, y: FIELD_H + 200 + rand() * 30, r: 46 + rand() * 18 });
    }
    for (let y = 40; y <= FIELD_H; y += 70) {
      edge.push({ x: -22 + rand() * 16, y, r: 40 + rand() * 20 });
      edge.push({ x: FIELD_W + 16 + rand() * 16, y: y + 30, r: 40 + rand() * 20 });
    }

    const tick = () => {
      const q = input.current;
      const k = q.keys;
      const kx = (k.has("ArrowRight") || k.has("d") ? 1 : 0) - (k.has("ArrowLeft") || k.has("a") ? 1 : 0);
      const ky = (k.has("ArrowDown") || k.has("s") ? 1 : 0) - (k.has("ArrowUp") || k.has("w") ? 1 : 0);
      let dir = kx || ky ? dirOf(kx, ky) : q.stick;
      // 자동 걷기 — 내가 직접 움직이면 그 순간 끝(막대가 먼저다). 다 왔거나 막히면 멈춘다
      if (walk.current) {
        const auto = dir ? null : stepWalk(walk.current, state);
        if (auto == null) {
          walk.current = null;
          setWalking(null);
        } else dir = auto;
      }
      const canFight = live.current.save.party.some((m) => m.hp > 0);
      const met = stepField(state, region, wipe.current ? 0 : dir, canFight && !wipe.current);
      if (met) {
        pending.current = met.id;
        wipe.current = { t0: performance.now(), m: met };
        walk.current = null;
        setWalking(null);
      }
      const t = nearestThing(state);
      setThing((p) => (JSON.stringify(p) === JSON.stringify(t) ? p : t));
    };

    // 글자는 화면에서 12px 밑으로 안 내려가게 배율로 나눈다(좁은 폰은 배율 0.78 — 11 · 12px 이름표가 9px 였다)
    let scale = 1;
    const bubbleText = (text: string, x: number, y: number, color = "#fff", size0 = 15) => {
      const size = minFont(size0, scale);
      ctx.font = `800 ${Math.round(size)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.3;
      ctx.strokeStyle = "rgba(20,12,30,.8)";
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    const draw = (alpha: number, now: number) => {
      scale = Math.max(0.78, Math.min(1.25, Math.min(w / 420, h / 720)));
      const visW = w / scale;
      const visH = h / scale;
      const px = state.px + (state.x - state.px) * alpha;
      const py = state.py + (state.y - state.py) * alpha;
      const tx = FIELD_W > visW ? Math.min(FIELD_W - visW / 2, Math.max(visW / 2, px)) : FIELD_W / 2;
      const ty = FIELD_H > visH ? Math.min(FIELD_H - visH / 2 + 110, Math.max(visH / 2 - 60, py - 40)) : FIELD_H / 2;
      cam.x += (tx - cam.x) * 0.16;
      cam.y += (ty - cam.y) * 0.16;
      const ox = w / 2 - cam.x * scale;
      const oy = h / 2 - cam.y * scale;
      const vis = (x: number, y: number, m = 120) => x > cam.x - visW / 2 - m && x < cam.x + visW / 2 + m && y > cam.y - visH / 2 - m && y < cam.y + visH / 2 + m;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = shade(region.ground, -0.55);
      ctx.fillRect(0, 0, w, h);
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      g.addColorStop(0, shade(region.ground, 0.08));
      g.addColorStop(0.5, region.ground);
      g.addColorStop(1, shade(region.ground, -0.14));
      ctx.fillStyle = g;
      ctx.fillRect(-500, -500, FIELD_W + 1000, FIELD_H + 1000);

      if (groundTex) ctx.drawImage(groundTex, 0, 0, FIELD_W, FIELD_H);

      // 길 — 구운 바닥(groundTex)에 들어 있다. 못 구운 기기만 예전처럼 그린다
      if (!groundTex) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const [wd, col] of [[140, shade(region.ground, -0.2)], [122, shade(region.ground, 0.22)]] as [number, string][]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = wd;
          ctx.beginPath();
          ctx.moveTo(map.path[0].x, map.path[0].y);
          for (let i = 1; i < map.path.length - 1; i++) {
            const m = map.path[i];
            const n = map.path[i + 1];
            ctx.quadraticCurveTo(m.x, m.y, (m.x + n.x) / 2, (m.y + n.y) / 2);
          }
          const end = map.path[map.path.length - 1];
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      }

      // 물 · 늪
      for (const p of map.pools) {
        if (!vis(p.x, p.y, p.r)) continue;
        const col = region.key === "lake" ? "#4fa9e6" : "#55806a";
        ctx.fillStyle = shade(col, -0.3);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 6, p.r + 6, (p.r + 6) * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.84, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.55)";
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          const k = still ? 0.5 : (now / 2200 + i / 3) % 1;
          ctx.globalAlpha = 0.7 * (1 - k);
          ctx.beginPath();
          ctx.ellipse(p.x + (i - 1) * p.r * 0.4, p.y + ((i % 2) - 0.5) * p.r * 0.5, p.r * 0.34 * (0.3 + k), p.r * 0.14 * (0.3 + k), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // 수풀 바닥 — 구운 바닥에 들어 있다(못 구운 기기만)
      for (const gp of map.grass) {
        if (groundTex || !vis(gp.x, gp.y, gp.rx)) continue;
        ctx.fillStyle = shade(region.ground, region.key === "plateau" ? -0.14 : -0.28);
        ctx.beginPath();
        ctx.ellipse(gp.x, gp.y, gp.rx, gp.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 깊이 순서로 — 바위 · 샘 · 상자 · 생물 · 나 · 풀잎
      type Item = { y: number; d: () => void };
      const items: Item[] = [];
      for (const r of map.rocks) if (vis(r.x, r.y, 100)) items.push({ y: r.y, d: () => drawRock(ctx, r, key, pal) });
      for (const r of edge) if (vis(r.x, r.y, 100)) items.push({ y: r.y, d: () => drawRock(ctx, r, key, pal) });

      // 샘 — 화면 밖이면 건너뛴다(그리기 호출을 프레임마다 쌓지 않게)
      if (vis(map.spring.x, map.spring.y, 140)) items.push({ y: map.spring.y, d: () => {
        const { x, y } = map.spring;
        ctx.fillStyle = shade(region.ground, -0.4);
        ctx.beginPath();
        ctx.ellipse(x, y, 66, 42, 0, 0, Math.PI * 2);
        ctx.fill();
        const gw = ctx.createRadialGradient(x, y - 2, 4, x, y, 58);
        gw.addColorStop(0, "#d8fbff");
        gw.addColorStop(0.6, "#66d6f2");
        gw.addColorStop(1, "#2f9fd0");
        ctx.fillStyle = gw;
        ctx.beginPath();
        ctx.ellipse(x, y, 56, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const k = still ? 0.4 : (now / 1500 + i / 4) % 1;
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x + Math.sin(i * 2.4) * 26, y - k * 70, 3 + i, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        bubbleText("회복 샘", x, y - 52, "#c9f5ff", 14);
      } });

      // 안내인
      if (vis(map.guide.x, map.guide.y, 100)) items.push({ y: map.guide.y, d: () => {
        const { x, y } = map.guide;
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.beginPath();
        ctx.ellipse(x, y + 4, 22, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7a5a3c";
        ctx.fillRect(x - 5, y - 48, 10, 52);
        ctx.fillStyle = "#f0d59f";
        ctx.strokeStyle = "#7a5a3c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - 34, y - 78, 68, 36, 7);
        ctx.fill();
        ctx.stroke();
        ctx.font = `800 ${Math.round(minFont(13, scale))}px sans-serif`;
        ctx.fillStyle = "#54391f";
        ctx.textAlign = "center";
        ctx.fillText("안내판", x, y - 55);
      } });

      // 상자
      map.chests.forEach((ch, i) => {
        if (!vis(ch.x, ch.y, 80)) return;
        const used = live.current.opened.includes(`${region.key}:${i}`);
        items.push({ y: ch.y, d: () => {
          const { x, y } = ch;
          ctx.fillStyle = "rgba(0,0,0,.26)";
          ctx.beginPath();
          ctx.ellipse(x, y + 3, 30, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = used ? "#8b7a64" : "#c9823f";
          ctx.strokeStyle = used ? "#5f5242" : "#6d3f17";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(x - 26, y - 28, 52, 30, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = used ? "#a39177" : "#e0a35c";
          ctx.beginPath();
          if (used) ctx.roundRect(x - 26, y - 44, 52, 14, 5);
          else ctx.roundRect(x - 26, y - 40, 52, 18, [10, 10, 3, 3]);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = used ? "#6b6152" : "#ffe27a";
          ctx.fillRect(x - 5, y - 28, 10, 11);
          if (!used && !still) {
            const k = (now / 900 + i * 0.3) % 1;
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = "#fff2a8";
            ctx.beginPath();
            ctx.arc(x + Math.sin(k * 7 + i) * 24, y - 42 - k * 30, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        } });
      });

      // 트레이너
      map.trainers.forEach((p, i) => {
        const t = npcs[i];
        if (!t || !vis(p.x, p.y)) return;
        const won = (live.current.save.trainers ?? []).includes(t.id);
        items.push({ y: p.y, d: () => {
          const { x, y } = p;
          const COL = ["#e8795f", "#5f9be8", "#6fbf73", "#c77fe0"][(i + region.key.length) % 4];
          ctx.fillStyle = "rgba(0,0,0,.28)";
          ctx.beginPath();
          ctx.ellipse(x, y + 3, 22, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = shade(COL, -0.3);
          ctx.fillRect(x - 11, y - 18, 8, 20);
          ctx.fillRect(x + 3, y - 18, 8, 20);
          ctx.fillStyle = COL;
          ctx.beginPath();
          ctx.roundRect(x - 16, y - 50, 32, 36, 10);
          ctx.fill();
          ctx.fillStyle = "#ffd9b8";
          ctx.beginPath();
          ctx.arc(x, y - 64, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#3a2a24";
          ctx.fillRect(x - 6, y - 66, 3, 4);
          ctx.fillRect(x + 3, y - 66, 3, 4);
          ctx.fillStyle = shade(COL, -0.15);
          ctx.beginPath();
          ctx.arc(x, y - 68, 16, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x - 21, y - 69, 42, 4);
          const pet = spriteOf(t.team[0][0], Math.ceil(56 * scale * dpr));
          if (pet) ctx.drawImage(pet, x + 16, y - 44, 56, 56);
          if (won) bubbleText("✓", x, y - 90, "#a8f0b0", 16);
          else {
            const bob = still ? 0 : Math.abs(Math.sin(now / 260)) * 6;
            bubbleText("!", x, y - 90 - bob, "#ffe27a", 24);
          }
          bubbleText(t.name, x, y + 22, "#fff", 12);
        } });
      });

      // 대장 관문 — 빛 번짐(반지름 170) · 기둥(위로 190)까지 화면 밖이면 그리지 않는다. 예전엔 프레임마다 원화를 그렸다
      if (vis(map.gate.x, map.gate.y - 80, 260)) items.push({ y: map.gate.y, d: () => {
        const { x, y } = map.gate;
        const boss = region.boss!;
        const beaten = (live.current.save.badges ?? []).includes(region.key);
        const glow = ctx.createRadialGradient(x, y - 50, 10, x, y - 50, 170);
        glow.addColorStop(0, beaten ? "rgba(255,226,122,.5)" : "rgba(255,90,70,.5)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y - 50, 170, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(region.ground, -0.45);
        ctx.beginPath();
        ctx.ellipse(x, y + 6, 124, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(region.ground, -0.2);
        ctx.beginPath();
        ctx.ellipse(x, y, 108, 38, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const sign of [-1, 1]) {
          ctx.fillStyle = shade(region.ground, -0.42);
          ctx.fillRect(x + sign * 104 - 15, y - 150, 30, 150);
          ctx.fillStyle = shade(region.ground, -0.15);
          ctx.fillRect(x + sign * 104 - 15, y - 150, 10, 150);
        }
        ctx.fillStyle = shade(region.ground, -0.5);
        ctx.fillRect(x - 134, y - 174, 268, 30);
        const lead = boss.team[boss.team.length - 1][0];
        const im = spriteOf(lead, Math.ceil(150 * scale * dpr));
        if (im) {
          const bob = still ? 0 : Math.sin(now / 380) * 4;
          ctx.drawImage(im, x - 70, y - 140 + bob, 140, 140);
        }
        bubbleText(boss.name, x, y - 182, beaten ? "#ffe27a" : "#ffb7a6", 18);
        bubbleText(beaten ? "뱃지를 얻었어요" : `권장 Lv.${bossLevel(region) + 1}`, x, y + 34, "#fff", 13);
      } });

      // 생물
      for (const m of state.mons) {
        if (!vis(m.x, m.y)) continue;
        items.push({ y: m.y, d: () => {
          const x = m.px + (m.x - m.px) * alpha;
          const y = m.py + (m.y - m.py) * alpha;
          const moving = !still && (m.dx || m.dy);
          const hop = moving ? Math.abs(Math.sin(now / 110 + m.id)) * 8 : 0;
          ctx.fillStyle = "rgba(0,0,0,.26)";
          ctx.beginPath();
          ctx.ellipse(x, y + 3, 26, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          if (m.rare && !still) {
            for (let i = 0; i < 4; i++) {
              const k = (now / 800 + i / 4) % 1;
              ctx.globalAlpha = 1 - k;
              ctx.fillStyle = "#ffe98a";
              ctx.beginPath();
              ctx.arc(x + Math.sin(i * 1.9 + k * 3) * 34, y - 30 - k * 44, 3.4, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          const im = spriteOf(m.species, Math.ceil(SPRITE * scale * dpr));
          ctx.save();
          ctx.translate(x, y - hop);
          ctx.scale(m.dx > 0.1 ? -1 : 1, 1);
          ctx.globalAlpha = m.cool > 0 ? 0.55 : 1;
          if (im) ctx.drawImage(im, -SPRITE / 2, FOOT - SPRITE, SPRITE, SPRITE);
          ctx.restore();
          ctx.globalAlpha = 1;
          const seen = live.current.save.caught.includes(m.species);
          bubbleText(`${m.rare ? "★ " : m.bold ? "! " : ""}Lv.${m.level}`, x, y - SPRITE - hop - 4, m.rare ? "#ffe27a" : m.bold ? "#ffb1a1" : "#fff", 12);
          if (!seen) bubbleText("NEW", x + 34, y - SPRITE + 20, "#8df0ff", 11);
        } });
      }

      // 동료
      const party = live.current.save.party.filter((m) => m.hp > 0);
      const lead = party[0] ?? live.current.save.party[0];
      const buddy = party[1];
      const walking = !still && Math.hypot(state.x - state.px, state.y - state.py) > 0.5;
      if (buddy && state.trail.length) {
        const spot = state.trail[Math.min(state.trail.length - 1, 14)];
        items.push({ y: spot.y, d: () => {
          const hop = walking ? Math.abs(Math.sin(now / 95 + 1)) * 7 : 0;
          const im = spriteOf(buddy.species, Math.ceil(SPRITE * scale * dpr));
          ctx.fillStyle = "rgba(0,0,0,.24)";
          ctx.beginPath();
          ctx.ellipse(spot.x, spot.y + 3, 22, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.translate(spot.x, spot.y - hop);
          ctx.scale(state.fx > 0 ? -0.82 : 0.82, 0.82);
          if (im) ctx.drawImage(im, -SPRITE / 2, FOOT - SPRITE, SPRITE, SPRITE);
          ctx.restore();
        } });
      }
      items.push({ y: py, d: () => {
        const hop = walking ? Math.abs(Math.sin(now / 80)) * 9 : still ? 0 : Math.sin(now / 340) * 1.5;
        const im = spriteOf(lead.species, Math.ceil(SPRITE * 1.1 * scale * dpr));
        ctx.fillStyle = "rgba(0,0,0,.3)";
        ctx.beginPath();
        ctx.ellipse(px, py + 3, 28, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#7ee0ff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(px, py + 3, 33, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.translate(px, py - hop);
        ctx.scale(state.fx > 0 ? -1.1 : 1.1, 1.1);
        ctx.globalAlpha = state.safe > 0 && state.tick % 6 < 3 ? 0.55 : 1;
        if (im) ctx.drawImage(im, -SPRITE / 2, FOOT - SPRITE, SPRITE, SPRITE);
        ctx.restore();
        ctx.globalAlpha = 1;
      } });

      // 풀잎 — 지나가면 몸이 풀 사이로 보인다
      for (const t of tufts) {
        if (!vis(t.x, t.y, 30)) continue;
        items.push({ y: t.y, d: () => {
          const sway = still ? 0 : Math.sin(now / 480 + t.ph) * 3.4;
          ctx.strokeStyle = shade(region.ground, region.key === "plateau" ? -0.32 : -0.42);
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(t.x - 6, t.y);
          ctx.quadraticCurveTo(t.x - 8, t.y - t.s * 0.6, t.x - 10 + sway, t.y - t.s);
          ctx.moveTo(t.x, t.y);
          ctx.quadraticCurveTo(t.x, t.y - t.s * 0.8, t.x + sway, t.y - t.s * 1.35);
          ctx.moveTo(t.x + 6, t.y);
          ctx.quadraticCurveTo(t.x + 8, t.y - t.s * 0.6, t.x + 10 + sway, t.y - t.s);
          ctx.stroke();
          ctx.lineCap = "butt";
        } });
      }
      items.sort((p, q) => p.y - q.y);
      for (const it of items) it.d();

      // 분위기
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (region.key === "cave") {
        const sx = ox + px * scale;
        const sy = oy + (py - 40) * scale;
        const dark = ctx.createRadialGradient(sx, sy, 90, sx, sy, Math.max(w, h) * 0.62);
        dark.addColorStop(0, "rgba(8,4,24,0)");
        dark.addColorStop(1, "rgba(8,4,24,.78)");
        ctx.fillStyle = dark;
        ctx.fillRect(0, 0, w, h);
      } else if (region.key === "swamp") {
        ctx.fillStyle = "rgba(200,220,200,.13)";
        ctx.fillRect(0, 0, w, h);
      } else if (region.key === "temple") {
        ctx.fillStyle = "rgba(30,20,90,.16)";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = mo.color;
      for (const m of motes) {
        const y = (((m.y * h + (now / 1000) * mo.fall * m.v) % h) + h) % h;
        const x = (((m.x * w + Math.sin(now / 900 + m.ph) * 18 + (region.key === "hill" ? (now / 1000) * 90 * m.v : 0)) % w) + w) % w;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, m.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 지도 — 오른쪽 위
      const mw = MAP_W;
      const mh = MAP_H;
      const mx = w - mw - 10;
      const my = MAP_TOP;
      const mk = mw / FIELD_W;
      ctx.fillStyle = "rgba(16,10,28,.5)";
      ctx.beginPath();
      ctx.roundRect(mx - 3, my - 3, mw + 6, mh + 6, 8);
      ctx.fill();
      ctx.fillStyle = "#ff8a7a";
      ctx.fillRect(mx + map.gate.x * mk - 4, my + map.gate.y * mk - 4, 8, 8);
      ctx.fillStyle = "#7de8ff";
      ctx.fillRect(mx + map.spring.x * mk - 2.5, my + map.spring.y * mk - 2.5, 5, 5);
      ctx.fillStyle = "#ffcf6a";
      map.chests.forEach((ch, i) => {
        if (!live.current.opened.includes(`${region.key}:${i}`)) ctx.fillRect(mx + ch.x * mk - 2, my + ch.y * mk - 2, 4, 4);
      });
      ctx.fillStyle = "#ff7ad0";
      map.trainers.forEach((p, i) => {
        if (npcs[i] && !(live.current.save.trainers ?? []).includes(npcs[i].id)) ctx.fillRect(mx + p.x * mk - 2.5, my + p.y * mk - 2.5, 5, 5);
      });
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mx + px * mk, my + py * mk, 3.4, 0, Math.PI * 2);
      ctx.fill();
      const wk = walk.current;
      if (wk) {
        ctx.strokeStyle = "#ffe27a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mx + wk.to.x * mk, my + wk.to.y * mk, 6 + (still ? 0 : Math.sin(now / 160)), 0, Math.PI * 2);
        ctx.stroke();
      }

      // 만남 — 화면이 조여 들며 전투로
      const wp = wipe.current;
      if (wp && !live.current.paused) {
        const k = Math.min(1, (now - wp.t0) / 420);
        const rad = Math.hypot(w, h) * (1 - k);
        const cx = ox + wp.m.x * scale;
        const cy = oy + (wp.m.y - 40) * scale;
        ctx.fillStyle = "#0c0716";
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.arc(cx, cy, Math.max(0.01, rad), 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        if (k >= 1 && pending.current === wp.m.id) {
          wipe.current = null;
          live.current.onEncounter(wp.m.species, wp.m.level);
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let drawAcc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const ms = now - last;
      const dt = Math.min(0.1, ms / 1000);
      last = now;
      if (live.current.paused) return;
      if (document.visibilityState === "visible" && !live.current.coach) acc += dt;
      while (acc >= 1 / FIELD_TPS) {
        acc -= 1 / FIELD_TPS;
        tick();
      }
      // 120Hz 화면에서도 초당 60장(배터리)
      const gate = frameGate(drawAcc, ms);
      drawAcc = gate.acc;
      if (gate.draw) draw(Math.min(1, acc * FIELD_TPS), now);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      // 큰 캔버스를 바로 돌려준다(iOS 는 크기를 0 으로 해야 메모리를 놓는다)
      c.width = c.height = 0;
    };
  }, [state, region]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (live.current.paused || live.current.coach) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k.startsWith("Arrow") || "wasd".includes(k)) {
        input.current.keys.add(k);
        e.preventDefault();
      } else if ((k === "Enter" || k === " ") && !e.repeat) {
        e.preventDefault();
        live.current.act();
      }
    };
    const up = (e: KeyboardEvent) => input.current.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const goal = nextGoal(save);
  const allDown = save.party.every((m) => m.hp <= 0);

  return createPortal(
    <div className="adv-rt adv-field fixed inset-0 z-[78]" role="dialog" aria-modal="true" aria-label={`${region.name} 탐험`} style={{ background: shade(region.ground, -0.55) }}>
      <GameWindowGuard />
      <canvas ref={canvas} className="adv-rt-canvas" aria-hidden />
      <div className="adv-field-top">
        <div className="adv-field-head">
          <CloseButton onClose={onClose} label="지도로" />
          <b>{region.name}</b>
          <span>골드 {save.gold.toLocaleString()}</span>
        </div>
        <p className="adv-field-goal">{goal.text}</p>
      </div>
      <div className="adv-field-team" aria-label="팀 체력">
        {save.party.slice(0, 6).map((m) => {
          const max = statsOf(m).hp;
          return (
            <span key={m.id} className="adv-field-mate">
              <MonArt species={m.species} size={30} mode={m.hp > 0 ? "full" : "faded"} />
              <i><u style={{ width: `${(m.hp / max) * 100}%` }} /></i>
            </span>
          );
        })}
      </div>
      <button
        type="button"
        className="adv-field-map"
        style={{ right: 7, top: MAP_TOP - 3, width: MAP_W + 6, height: MAP_H + 6 }}
        onPointerDown={(e) => {
          e.preventDefault();
          tapMap(e);
        }}
        onClick={(e) => {
          if (e.detail === 0) tapMap(null);
        }}
        aria-label="미니맵 — 누른 곳(관문 · 샘 · 상자 · 트레이너)으로 길을 따라 걸어가요"
      />
      {walking && <p className="adv-field-walk" role="status">{walking}</p>}
      {allDown && <p className="adv-field-warn">팀이 모두 지쳤어요 — 회복 샘에서 쉬어요</p>}
      {talk && (
        <div className="adv-field-talk" role="dialog" aria-label={talk.who}>
          <b>{talk.who}</b>
          <p>{talk.text}</p>
          <div className="adv-field-talkbtns">
            {talk.go && <button type="button" className="tap adv-btn adv-btn-main" onClick={() => { const go = talk.go!; setTalk(null); go(); }}>승부!</button>}
            <button type="button" className="tap adv-btn" onClick={() => { if (!(save.intro ?? []).includes(region.key)) onIntro(); setTalk(null); }}>{talk.go ? "아직" : "알겠어요"}</button>
          </div>
        </div>
      )}
      <div className="adv-field-ctl">
        <Stick onDir={(d) => (input.current.stick = d)} />
        <button type="button" className="adv-field-act" disabled={!thing || !!chestDone} {...pressProps(act)}>
          {label ?? "조사"}
        </button>
      </div>
      {/* 지역 이야기 카드가 먼저 — 둘이 겹치면 '알겠어요'가 두 개 겹쳐 떴다. 이야기를 닫은 뒤에 안내 */}
      {coach && !talk && (
        <div className="adv-field-coach" role="dialog" aria-label="필드 안내">
          <div className="adv-card w-full max-w-sm">
            <p className="adv-h">이렇게 걸어 다녀요</p>
            <ul className="adv-coach">
              <li><b>왼쪽 아래</b> 아무 데나 누르고 끌면 걸어요(화살표 키도 돼요)</li>
              <li><b>조사</b> 상자 · 샘 · 안내판 · 트레이너 · 관문 가까이에서 눌러요</li>
              <li><b>★ 귀한 녀석</b>은 달아나요. 살금살금 다가가요</li>
              <li><b>! 사나운 녀석</b>은 먼저 달려들어요</li>
              <li><b>미니맵</b>(오른쪽 위)을 누르면 그곳으로 길을 따라 걸어가요</li>
            </ul>
            <div className="mt-3 flex">
              <button type="button" className="tap adv-btn adv-btn-main flex-1" onClick={closeCoach}>알겠어요</button>
            </div>
          </div>
        </div>
      )}
      <span className="sr-only">{SPECIES[save.party[0].species].name}와 함께 걷는 중</span>
    </div>,
    document.body,
  );
}
