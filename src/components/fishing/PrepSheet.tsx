"use client";

/* 낚시 준비 시트의 내용(2026-11-21 리뷰 ⑨ — FishingGame.tsx 에서 옮겼다): 방식 · 미끼 · 만든 미끼 · 낚시터 · 레벨.
 * 판정 · 저장은 부모(FishingGame)가 한다 — 여기는 그리기와 고른 것을 알리기뿐. 바깥 틀(대화 상자 · 포커스 가두기)도 부모에 있다. */
import { ActionButton } from "@/components/AppButtons";
import { Coin } from "@/components/island/UiIcon";
import { BaitIcon, MethodIcon } from "@/components/FishingIcons";
import { CraftBaitIcon } from "@/components/FishCraft";
import { GRADES, fishCount, tankOf, type AquaState } from "@/lib/aquarium";
import { BAITS, MAX_LEVEL, METHODS, SPOTS, WATER_NAME, baitStock, castMaxMeters, poolFor, xpNeed, type FishBait, type FishMethod, type FishSpot, type FishingState, type MethodKey } from "@/lib/fishing";
import { CRAFT_BAITS, craftLeft, craftTier, type CraftBait } from "@/lib/fishcraft";
import { spotStars } from "@/lib/fishmastery";
import { josa } from "@/lib/josa";
import type { IslandState } from "@/lib/island";



export type PrepSheetProps = {
  st: IslandState; fs: FishingState; aq: AquaState; spot: FishSpot; today: string; busy: boolean; couple: boolean; night: boolean; blocked: string | null;
  method: MethodKey; how: FishMethod; bait: FishBait; shown: FishBait; shownLeft: number; craft: CraftBait | null; craftNote: CraftBait | null | undefined; baitLeft: number;
  eff: { catch: number; power: number; line: number; luck: number }; buff: number;
  onMethod: (k: MethodKey) => void; onBait: (k: string) => void; onCraft: (k: string | null) => void; onBuyBait: () => void; onSpot: (k: string) => void;
};

export default function PrepSheet({ st, fs, aq, spot, today, busy, couple, night, blocked, method, how, bait, shown, shownLeft, craft, craftNote, baitLeft, eff, buff, onMethod, onBait, onCraft, onBuyBait, onSpot }: PrepSheetProps) {
  return (
    <>
    {blocked && <p className="aqua-msg" aria-live="polite">{blocked}</p>}

    <h3 className="fish-sheet-title">방식</h3>
    <div className="fish-methods" role="radiogroup" aria-label="낚시 방식">
      {METHODS.map((m) => {
        const off = fs.level < m.minLevel;
        // 집어등 — 레벨이 되면 고를 수는 있다(왜 지금 못 켜는지 위 칸에 뜬다). 밤 · 바다가 아니면 작은 글씨로 미리 알린다
        const shut = !off && m.night ? (spot.water !== "sea" ? "바다에서만" : !night ? "밤에만 · 19~5시" : null) : null;
        return (
          <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`tap ${method === m.key ? "is-on" : ""} ${m.night ? "is-night" : ""}`} disabled={off} onClick={() => onMethod(m.key)}>
            <MethodIcon k={m.key} />
            <strong>{m.name}</strong>
            <small>{off ? `Lv.${m.minLevel}` : shut ?? m.good}</small>
          </button>
        );
      })}
    </div>
    <p className="fish-how">{how.how}</p>

    <h3 className="fish-sheet-title">미끼 <small>높을수록 귀한 물고기가 물고, 횟수도 많아요 · 도감용은 하트보다 귀한 물고기를 노릴 때</small></h3>
    <div className="fish-baits">
      {BAITS.map((b) => {
        const left = baitStock(fs, b.key, today);
        const fits = poolFor(spot, b.maxGrade).length > 0;
        return (
          <button key={b.key} type="button" aria-pressed={!craft && shown.key === b.key} className={`tap ${!craft && shown.key === b.key ? "is-on" : ""} ${fits ? "" : "is-off"}`} disabled={!fits} onClick={() => onBait(b.key)}>
            <span className="fish-bait-pic"><BaitIcon k={b.key} /></span>
            <strong>{b.name}</strong>
            <small>{GRADES[b.maxGrade]}까지 · {left}회</small>
            {b.collect && <small className="fish-bait-collect">도감용</small>}
          </button>
        );
      })}
    </div>
    {CRAFT_BAITS.some((c) => craftLeft(st, c.key) > 0) && (
      <>
        <h3 className="fish-sheet-title">만든 미끼 <small>같은 단계 미끼처럼 물고, 덤이 붙어요 · 장비 탭에서 만들어요</small></h3>
        <div className="fish-baits">
          {CRAFT_BAITS.filter((c) => craftLeft(st, c.key) > 0).map((c) => {
            const left = craftLeft(st, c.key), tier = craftTier(c);
            const fits = poolFor(spot, tier.maxGrade).length > 0;
            const on = craft?.key === c.key;
            return (
              <button key={c.key} type="button" aria-pressed={on} className={`tap ${on ? "is-on" : ""} ${fits ? "" : "is-off"}`} disabled={!fits} onClick={() => onCraft(on ? null : c.key)}>
                <span className="fish-bait-pic"><CraftBaitIcon k={c.key} /></span>
                <strong>{c.name}</strong>
                <small>{GRADES[tier.maxGrade]}까지 · {left}회</small>
              </button>
            );
          })}
        </div>
      </>
    )}
    {craft ? (
      <div className="fish-bait-now">
        <p>{craft.name} {baitLeft}회 남음 <small>{craft.effect}{method === "lure" && craft.key === "craft_scent" ? " · 루어는 기다림이 없어 덤이 없어요" : ""}{method === "scoop" && craft.key !== "craft_sticky" ? " · 뜰채엔 이 덤이 없어요" : ""}{craft.key === "craft_shine" && !couple ? " · 혼자 하는 섬엔 상대의 병이 없어요" : ""}</small></p>
      </div>
    ) : (
      <div className="fish-bait-now">
        <p>{shown.name} {shownLeft}회 남음 <small>{craftNote ? `${josa(craftNote.name, "이/가")} ${craftLeft(st, craftNote.key) > 0 ? "여기서는 안 맞아서" : "다 떨어져서"} 지금은 ${bait.name} 사용` : bait.key !== shown.key ? `떨어져서 지금은 ${bait.name} 사용` : shown.desc}</small></p>
        <ActionButton disabled={busy || st.coins < shown.price} onClick={onBuyBait}>
          +{shown.uses}회 <span className="aqua-price"><Coin /> {shown.price.toLocaleString()}</span>
        </ActionButton>
      </div>
    )}

    <h3 className="fish-sheet-title">낚시터</h3>
    <div className="fish-spots">
      {SPOTS.map((x) => {
        const locked = x.minLevel > fs.level, stars = locked ? 0 : spotStars(st, x.key);
        return (
          <button key={x.key} type="button" className={`tap ${x.key === spot.key ? "is-on" : ""}`} disabled={locked} aria-label={stars ? `${x.name} 숙련도 별 ${stars}개` : undefined} onClick={() => onSpot(x.key)}>
            {x.name} <small>{locked ? `Lv.${x.minLevel}` : stars ? `★${stars} · ${WATER_NAME[x.water]}` : WATER_NAME[x.water]}</small>
          </button>
        );
      })}
    </div>

    <h3 className="fish-sheet-title">낚시 Lv.{fs.level} <small>수조 {fishCount(aq)}/{tankOf(aq).fish}</small></h3>
    <div className="fish-xp" aria-hidden><b style={{ width: fs.level >= MAX_LEVEL ? "100%" : `${Math.min(100, (fs.xp / xpNeed(fs.level)) * 100)}%` }} /></div>
    <p className="aqua-note mt-2">포획 {eff.catch} · 힘 {eff.power}{buff > 0 ? ` (도시락 힘 +${buff}%)` : ""} · 줄 다루기 {eff.line} · 행운 {eff.luck}</p>
    <p className="aqua-note">캐스팅 최대 {Math.round(castMaxMeters(fs.rod, fs.stats.power))}m · 내 기록 {fs.bestCast.toFixed(1)}m — 좋은 낚싯대 · 힘을 올리면 더 멀리 가요</p>

    </>
  );
}
