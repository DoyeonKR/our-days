"use client";

/* 펫 탭 하위 화면 — 스탯 판 · 케어 데크(돌봄 + 히어로 기술) · 장비 · 성장. [2026-09-24 개편]
 *
 * [사용자: "펫 탭도 리뷰하고 완전 UI/UX 개편 … 장비는 지금 너무 활용처가 없어 … 케어 데크도 개편"]
 * 예전 펫 탭은 한 장의 카드(무대·스탯·장비 15칩·진화)가 968px 이라 케어 데크가 **두 화면 아래**에 있었다.
 * 무대와 스탯은 늘 보이게 두고, 그 아래를 돌봄 · 장비 · 성장 세 칸으로 나눴다(칸은 IslandGame 이 그린다).
 *
 * ⚠ 누를 수 있는지는 전부 엔진이 정한다(careStatus · heroSkillStatus · gearLockReason). 화면이 따로
 *   판정하면 '켜져 있는데 눌러도 아무 일 없는' 버튼이 된다 — 놀기가 기력 15 미만에서 실제로 그랬다.
 */

import { useEffect, useRef, useState } from "react";
import {
  CARE_ACTS,
  GEARS,
  GEAR_SLOTS,
  GEAR_SLOT_LABEL,
  HERO_SKILLS,
  PET_FORMS,
  STAGE2_BY_STYLE,
  TUNING,
  careStatus,
  gearDef,
  gearLockReason,
  gearPerks,
  gearTier,
  heroAtk,
  heroOf,
  heroSkillStatus,
  heroSkillText,
  heroSkillTier,
  type CareAct,
  type CareKey,
  type GearSlot,
  type HeroSkill,
  type IslandState,
  type PetStats,
} from "@/lib/island";
import { ActionIcon, GearIcon, StatIcon } from "@/components/island/UiIcon";
import PetIcon from "@/components/island/PetIcon";
import { RARITY_LABEL } from "@/components/island/DecorPanels";

const won = (v: number) => v.toLocaleString();
const left = (ms: number) => (ms >= 3_600_000 ? `${Math.ceil(ms / 3_600_000)}시간 뒤` : `${Math.max(1, Math.ceil(ms / 60_000))}분 뒤`);

/* ── 스탯 판 ─────────────────────────────────────────────────── */

/** 스탯 → 그 스탯을 올리는 돌봄(누르면 케어 데크의 그 카드로). */
export const STAT_ROWS: { k: keyof PetStats; label: string; color: string; care: CareKey }[] = [
  { k: "hunger", label: "포만", color: "#fb923c", care: "feed" },
  { k: "happy", label: "행복", color: "#f472b6", care: "play" },
  { k: "energy", label: "기력", color: "#fbbf24", care: "rest" },
  { k: "clean", label: "청결", color: "#38bdf8", care: "clean" },
  { k: "health", label: "건강", color: "#f87171", care: "medicine" },
];

/** 다섯 스탯을 한 줄로 — 도트 아이콘 + 숫자 + 10칸 막대. 낮은 스탯(30 미만)은 깜빡인다. */
export function StatHud({ stats, onPick }: { stats: PetStats; onPick: (care: CareKey) => void }) {
  return (
    <div className="pet-hud" aria-label="펫 상태">
      {STAT_ROWS.map((st) => {
        const v = Math.round(stats[st.k]);
        const on = Math.round(v / 10);
        return (
          <button
            key={st.k}
            onClick={() => onPick(st.care)}
            className={`tap pet-hud-cell ${v < 30 ? "is-low" : ""}`}
            aria-label={`${st.label} ${v}, 올리는 돌봄 보기`}
          >
            <span className="pet-hud-top">
              <StatIcon k={st.k} size={24} />
              <b>{v}</b>
            </span>
            <span className="pet-hud-bar" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} style={i < on ? { background: st.color } : undefined} />
              ))}
            </span>
            <span className="pet-hud-label">{st.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── 케어 데크 ───────────────────────────────────────────────── */

const A = TUNING.pet.action;
const CARE_CARDS: { k: CareKey; label: string; effect: string }[] = [
  { k: "feed", label: "밥주기", effect: `포만 +${A.feed.hunger}` },
  { k: "play", label: "놀기", effect: `행복 +${A.play.happy} · 기력 ${A.play.energy}` },
  { k: "clean", label: "씻기기", effect: `청결 +${A.clean.clean}` },
  { k: "hug", label: "안아주기", effect: `행복 +${A.hug.happy}` },
  { k: "rest", label: "재우기", effect: `기력 +${A.rest.energy} · ${A.rest.sleepH}시간 잠` },
  { k: "medicine", label: "약", effect: `건강 +${A.medicine.health}` },
];

/** 추천 돌봄 — 아프면 약, 아니면 가장 낮은 스탯(45 미만)을 올리는 돌봄. 없으면 null. */
export function recommendCare(stats: PetStats, sick: boolean): CareKey | null {
  if (sick) return "medicine";
  const cand: [CareKey, number][] = [
    ["feed", stats.hunger],
    ["play", stats.happy],
    ["rest", stats.energy],
    ["clean", stats.clean],
  ];
  const worst = cand.reduce((a, b) => (b[1] < a[1] ? b : a));
  return worst[1] < 45 ? worst[0] : null;
}

export function CareDeck({
  s,
  now,
  stats,
  busy,
  focus,
  onCare,
  onSkill,
  onLocked,
}: {
  s: IslandState;
  now: number;
  stats: PetStats;
  busy: boolean;
  /** 스탯 판에서 누른 돌봄 — 그 카드를 화면에 보여 주고 잠깐 반짝인다. */
  focus: { k: CareKey; ts: number } | null;
  onCare: (k: CareKey) => void;
  onSkill: (k: HeroSkill) => void;
  /** 잠긴 기술을 누르면 그 슬롯의 장비 칸으로. */
  onLocked: (slot: GearSlot) => void;
}) {
  const reco = recommendCare(stats, s.pet.sick);
  const deckRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focus) return;
    deckRef.current?.querySelector(`[data-care="${focus.k}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);
  return (
    <section className="island-panel care-deck p-3" aria-label="케어 데크">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="island-section-kicker">CARE DECK</p>
          <h2 className="text-sm font-black">오늘의 돌봄</h2>
        </div>
        <p className="text-right text-xs text-white/55">
          정성 {Math.round(s.pet.cq)}
          {reco && (
            <>
              {" · "}추천 <b className="text-amber-200">{CARE_CARDS.find((c) => c.k === reco)!.label}</b>
            </>
          )}
        </p>
      </div>
      <div ref={deckRef} className="grid grid-cols-3 gap-2">
        {CARE_CARDS.map((c) => {
          const st = careStatus(s, c.k, now);
          const cdH = c.k === "medicine" ? 0 : A[c.k].cdH;
          const pct = st.cdLeftMs > 0 && cdH ? 100 - (st.cdLeftMs / (cdH * 3_600_000)) * 100 : 0;
          const foot =
            st.cdLeftMs > 0
              ? left(st.cdLeftMs)
              : st.reason
                ? st.reason
                : c.k === "feed"
                  ? "먹이 고르기"
                  : c.k === "medicine"
                    ? `${A.medicine.cost}💗`
                    : "무료";
          const isReco = reco === c.k && st.ok;
          const isFocus = focus?.k === c.k;
          return (
            <button
              key={c.k}
              data-care={c.k}
              disabled={busy || !st.ok}
              onClick={() => onCare(c.k)}
              className={`tap care-card ${isReco ? "is-reco" : ""} ${isFocus ? "is-focus" : ""}`}
              style={isFocus ? { animationName: `care-focus-${focus!.ts % 2}` } : undefined}
            >
              {isReco && <span className="care-card-ribbon">추천</span>}
              <ActionIcon k={c.k === "medicine" && s.pet.sick ? "medicine" : c.k} size={48} />
              <b className="care-card-name">{c.label}</b>
              <span className="care-card-effect">{c.effect}</span>
              <span className={`care-card-foot ${st.reason && !st.cdLeftMs ? "is-warn" : ""} ${c.k === "medicine" && s.pet.sick ? "is-urgent" : ""}`}>
                {c.k === "medicine" && s.pet.sick ? "지금 필요!" : foot}
              </span>
              {pct > 0 && <span className="care-card-cd" style={{ width: `${pct}%` }} aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="island-section-kicker">HERO SKILLS</p>
          <h3 className="text-sm font-black">장비로 여는 기술</h3>
        </div>
        <p className="text-right text-xs text-white/55">낀 장비가 좋을수록 세져요</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {HERO_SKILLS.map((d) => {
          const t = heroSkillTier(s, d.key);
          const st = heroSkillStatus(s, d.key, now);
          const gearKey = heroOf(s).equip[d.slot] ?? null;
          const locked = t === 0;
          const pct = st.cdLeftMs > 0 ? 100 - (st.cdLeftMs / (d.cdH * 3_600_000)) * 100 : 0;
          return (
            <button
              key={d.key}
              disabled={busy || (!locked && !st.ok)}
              onClick={() => (locked ? onLocked(d.slot) : onSkill(d.key))}
              className={`tap care-card is-skill ${locked ? "is-locked" : ""}`}
            >
              <ActionIcon k={d.key} size={48} />
              {gearKey && (
                <span className="care-card-gear" aria-hidden>
                  <GearIcon k={gearKey} size={24} />
                </span>
              )}
              <b className="care-card-name">
                {d.name}
                {t > 0 && <span className="ml-1 text-amber-200">Lv.{t}</span>}
              </b>
              <span className="care-card-effect">{heroSkillText(d.key, t)}</span>
              <span className={`care-card-foot ${st.reason && !locked ? "is-warn" : ""}`}>
                {locked ? `${GEAR_SLOT_LABEL[d.slot]} 보러 가기` : st.cdLeftMs > 0 ? left(st.cdLeftMs) : st.reason ?? `기력 ${d.energy} · 포만 ${d.hunger}`}
              </span>
              {pct > 0 && <span className="care-card-cd" style={{ width: `${pct}%` }} aria-hidden />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ── 장비 ───────────────────────────────────────────────────── */

export function GearView({
  s,
  now,
  busy,
  slot,
  onSlot,
  onBuy,
  onEquip,
  onGoFarm,
}: {
  s: IslandState;
  now: number;
  busy: boolean;
  slot: GearSlot;
  /** 전설 무기의 농사 레벨 조건 — 레벨이 오르는 곳(정원)으로 */
  onGoFarm?: () => void;
  onSlot: (slot: GearSlot) => void;
  onBuy: (key: string) => void;
  onEquip: (key: string, slot: GearSlot) => void;
}) {
  const hero = heroOf(s);
  const perks = gearPerks(s);
  const atk = heroAtk(s);
  const skill = HERO_SKILLS.find((x) => x.slot === slot)!;
  const effects = [
    atk > 0 && `공격력 ${atk}`,
    perks.careXpPct > 0 && `성장 경험치 +${perks.careXpPct}%`,
    perks.quality > 0 && `수확 품질 +${perks.quality}`,
    perks.happyKeepPct > 0 && `행복이 ${perks.happyKeepPct}% 천천히 줄어요`,
  ].filter(Boolean);
  return (
    <div className="space-y-3">
      {/* 세 칸 — 지금 낀 것 · 여는 기술 */}
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="장비 칸">
        {GEAR_SLOTS.map((sl) => {
          const key = hero.equip[sl] ?? null;
          const g = key ? gearDef(key) : null;
          const sk = HERO_SKILLS.find((x) => x.slot === sl)!;
          const t = key ? gearTier(key) : 0;
          return (
            <button
              key={sl}
              role="tab"
              aria-selected={slot === sl}
              onClick={() => onSlot(sl)}
              className={`tap gear-slot ${slot === sl ? "is-open" : ""} ${g ? "" : "is-empty"}`}
            >
              <span className="gear-slot-frame">{g ? <GearIcon k={g.key} size={48} title={g.name} /> : <span className="gear-slot-hole" aria-hidden />}</span>
              <b className="text-xs">{GEAR_SLOT_LABEL[sl]}</b>
              <span className="max-w-full truncate text-xs text-white/60">{g ? g.name : "비어 있음"}</span>
              <span className={`text-xs font-bold ${t ? "text-sky-200" : "text-white/35"}`}>
                {sk.name} {t ? `Lv.${t}` : "잠김"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="island-subpanel p-2.5 text-xs">
        <p className="font-bold text-white/80">지금 효과</p>
        <p className="mt-0.5 text-emerald-200">{effects.length ? effects.join(" · ") : "아직 아무것도 안 꼈어요 — 장비를 끼면 기술이 열려요"}</p>
      </div>

      <div className="space-y-2" aria-label={`${GEAR_SLOT_LABEL[slot]} 목록`}>
        {GEARS.filter((g) => g.slot === slot).map((g) => {
          const t = gearTier(g.key);
          const owned = hero.owned.includes(g.key);
          const worn = hero.equip[slot] === g.key;
          const lock = owned ? null : gearLockReason(s, g.key, now);
          return (
            <div key={g.key} className={`gear-row ${worn ? "is-worn" : ""}`} data-rarity={g.rarity}>
              <span className="gear-row-icon">
                <GearIcon k={g.key} size={48} title={g.name} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 text-sm font-extrabold">
                  {g.name}
                  <span className="rounded-full bg-white/10 px-1.5 text-xs font-bold text-white/60">{RARITY_LABEL[g.rarity]}</span>
                  {worn && <span className="rounded-full bg-amber-300/25 px-1.5 text-xs font-bold text-amber-200">착용 중</span>}
                </p>
                <p className="mt-0.5 text-xs text-white/65">{g.perk}</p>
                <p className="mt-0.5 text-xs font-bold text-sky-200">
                  {skill.name} Lv.{t} · {heroSkillText(skill.key, t)}
                </p>
                {lock && (
                  <p className="mt-0.5 text-xs font-bold text-rose-300">
                    🔒 {lock}
                    {onGoFarm && g.minSkill != null && lock.startsWith("농사") && (
                      <button onClick={onGoFarm} className="tap ml-1 font-bold text-emerald-200 underline underline-offset-2">
                        정원에서 올려요 →
                      </button>
                    )}
                  </p>
                )}
              </div>
              <button
                disabled={busy || (!owned && lock !== null)}
                onClick={() => (owned ? onEquip(g.key, slot) : onBuy(g.key))}
                className={`tap shrink-0 self-center rounded-lg px-3 py-2 text-xs font-extrabold disabled:bg-white/10 disabled:text-white/40 ${
                  worn ? "bg-white/15 text-white/85" : owned ? "bg-sky-300 text-[var(--ink-on-light)]" : "bg-amber-300 text-[var(--ink-on-light)]"
                }`}
              >
                {worn ? "벗기" : owned ? "끼기" : (
                  <>
                    사기
                    <span className="block">{won(g.price)}💗</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 성장 — 돌봄 손버릇 ─────────────────────────────────────── */

const CARE_ACT_LABEL: Record<CareAct, string> = { feed: "밥", play: "놀기", clean: "씻기", hug: "안기", rest: "재우기" };

/** 알 · 아기 때 — 어떤 돌봄을 많이 해 주는지가 성장기 모습을 정한다(2026-09-22 분기 규칙).
 *  숫자로만 있던 규칙을 막대로 보여 준다: 가장 많이 한 돌봄 → 그 모습. */
export function CareStyleChart({ s }: { s: IslandState }) {
  const care = s.pet.care ?? {};
  const max = Math.max(1, ...CARE_ACTS.map((a) => care[a] ?? 0));
  const [open, setOpen] = useState(false);
  return (
    <div className="island-subpanel p-2.5">
      <button onClick={() => setOpen((v) => !v)} className="tap flex w-full items-center justify-between text-left text-xs font-bold text-white/80" aria-expanded={open}>
        <span>돌봄 손버릇 · 성장기 모습을 정해요</span>
        <span className="text-white/45">{open ? "접기" : "보기"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {CARE_ACTS.map((a) => {
            const n = care[a] ?? 0;
            const form = STAGE2_BY_STYLE[a];
            return (
              <div key={a} className="flex items-center gap-2 text-xs">
                <span className="w-10 shrink-0 font-bold text-white/70">{CARE_ACT_LABEL[a]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-sm bg-white/10">
                  <span className="block h-full bg-amber-300" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="w-6 shrink-0 text-right text-white/60">{n}</span>
                <span className="flex w-16 shrink-0 items-center gap-1 text-white/55">
                  <PetIcon form={form} size={20} face active={false} />
                  <span className="truncate">{PET_FORMS[form]?.name ?? form}</span>
                </span>
              </div>
            );
          })}
          <p className="text-xs text-white/40">한 가지를 확실히 많이 해 주면 그 모습으로, 고르게 해 주면 비슷한 것들 중에서 자라요.</p>
        </div>
      )}
    </div>
  );
}
