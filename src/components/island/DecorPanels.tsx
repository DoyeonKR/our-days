"use client";

/* 꾸미기 하위 화면 — 생산 · 상점 · 빠른 고르기 · 테마 세트 · 이웃 조합 도감. [2026-09-23 개편]
 *
 * 예전 꾸미기는 '장식 가로 줄 하나 + 3열 상점'이 전부였고, 놓으면 평점이 오르는 것 말고는 할 일이
 * 없었다[사용자: "기능도 없고 반복적인 것만 있어"]. 장식 58종 · 세트 12 · 이웃 조합 49 · 생산 장식이
 * 붙으면 한 줄로는 못 고른다 — 섬 · 상점 · 세트·조합 세 칸으로 나눴다(칸은 IslandGame 이 그린다).
 *
 * ⚠ 가격·잠금·생산 판정은 전부 엔진(decorPrice · decorLockReason · produceStatus)을 부른다.
 *   화면이 따로 계산하면 버튼은 켜졌는데 placeDecor 가 무반응인 죽은 버튼이 된다(2026-08-25 성 사고). */

import { useState } from "react";
import {
  DECORS,
  DECOR_COMBOS,
  DECOR_SETS,
  PRODUCE_CAP,
  RARITY_RATING,
  activeCombos,
  combosWith,
  decorDef,
  decorLockReason,
  decorPrice,
  goodsOf,
  knownCombos,
  produceStatus,
  type DecorDef,
  type IslandState,
  type Rarity,
} from "@/lib/island";
import DecorIcon from "@/components/island/DecorIcon";
import { ProductIcon } from "@/components/island/CropIcon";
import { FilterChips } from "@/components/island/IslandSheet";

const won = (v: number) => v.toLocaleString();
const left = (ms: number) => (ms >= 3_600_000 ? `${Math.ceil(ms / 3_600_000)}시간` : `${Math.max(1, Math.ceil(ms / 60_000))}분`);

export const RARITY_LABEL: Record<Rarity, string> = { common: "일반", rare: "희귀", epic: "영웅", legendary: "전설" };
const RARITY_TONE: Record<Rarity, string> = {
  common: "bg-white/[0.05] ring-white/10",
  rare: "bg-sky-400/[0.08] ring-sky-300/25",
  epic: "bg-purple-400/10 ring-purple-300/30",
  legendary: "bg-amber-400/10 ring-amber-300/40",
};

/** 상점·빠른 고르기가 함께 쓰는 필터 — "can"(지금 살 수 있는) · "all" · 세트 id. */
export type DecorFilter = string;

const canBuy = (s: IslandState, d: DecorDef) => !decorLockReason(s, d) && s.coins >= decorPrice(d);
const inFilter = (s: IslandState, d: DecorDef, f: DecorFilter) =>
  f === "can" ? canBuy(s, d) : f === "all" ? true : d.set === f;
const placedCount = (s: IslandState, key: string) => s.decor.filter((p) => p.key === key).length;
/** 생산 장식의 이웃 부스트 대상 이름 — "튤립·장미·해바라기" */
const boostNames = (d: DecorDef) => (d.produce ? d.produce.boostBy.map((k) => decorDef(k).name).join("·") : "");

function filterOptions(s: IslandState) {
  return [
    { k: "can", label: "💗 지금 살 수 있는", n: DECORS.filter((d) => canBuy(s, d)).length },
    { k: "all", label: "전체", n: DECORS.length },
    ...DECOR_SETS.map((set) => ({
      k: set.id,
      label: `${set.emoji} ${set.name}`,
      n: DECORS.filter((d) => d.set === set.id).length,
    })),
  ];
}

/* ── 생산 ─────────────────────────────────────────────────────── */

/** 생산 장식 현황 + 모두 모으기. 생산 장식이 하나도 없으면 '있다는 것'부터 알려 준다. */
export function ProducePanel({
  s,
  now,
  busy,
  onCollect,
  onShop,
}: {
  s: IslandState;
  now: number;
  busy: boolean;
  onCollect: () => void;
  /** 농장 세트 상점으로 */
  onShop: () => void;
}) {
  const list = produceStatus(s, now);
  const ready = list.reduce((a, x) => a + x.ready, 0);
  if (!list.length) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-emerald-400/10 px-3 py-2.5 ring-1 ring-emerald-300/25">
        <span className="flex shrink-0 items-center -space-x-1.5">
          <DecorIcon decorKey="beehive" size={26} />
          <DecorIcon decorKey="henhouse" size={26} />
          <DecorIcon decorKey="cowshed" size={26} />
        </span>
        <p className="min-w-0 flex-1 text-xs text-white/70">
          <b className="text-emerald-200">벌통·닭장·젖소</b>를 놓으면 꿀·달걀·우유가 저절로 쌓여요. 팬케이크·케이크 같은 공방 요리의 재료예요
        </p>
        <button onClick={onShop} className="tap shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold ring-1 ring-white/15">
          보기
        </button>
      </div>
    );
  }
  return (
    <section className="island-panel p-3" aria-label="생산 장식">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="island-section-kicker">PRODUCE</p>
          <p className="text-sm font-bold text-white/85">생산 장식 · 모을 것 {ready}개</p>
        </div>
        <button
          disabled={busy || ready === 0}
          onClick={onCollect}
          className="tap shrink-0 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-extrabold text-[var(--ink-on-light)] disabled:bg-white/10 disabled:text-white/40"
        >
          🧺 모두 모으기
        </button>
      </div>
      <div className="space-y-1.5">
        {list.map((x) => {
          const d = decorDef(x.key);
          const g = goodsOf(x.goods);
          const full = x.ready >= PRODUCE_CAP;
          return (
            <div key={x.id} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5">
              <DecorIcon decorKey={x.key} size={30} title={d.name} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 text-xs font-bold">
                  {d.name}
                  <span className="text-white/40">→</span>
                  <ProductIcon productKey={x.goods} size={16} title={g.name} />
                  {g.name}
                  {x.boosted && <span className="rounded-full bg-amber-300/20 px-1.5 text-amber-200">⚡ 2배</span>}
                </p>
                <p className="text-xs text-white/50">
                  {full ? "가득 찼어요, 모아야 다시 만들어요" : `다음 하나까지 ${left(x.nextMs)}`}
                  {!x.boosted && ` · ${boostNames(d)} 옆에 두면 2배`}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-extrabold ${x.ready ? "text-amber-200" : "text-white/35"}`}>
                {g.emoji} {x.ready}/{PRODUCE_CAP}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── 빠른 고르기(섬 칸) ────────────────────────────────────────── */

/** 섬 밑의 가로 줄 — 세트 칩으로 좁혀 바로 고른다. 설명이 필요하면 상점 칸으로. */
export function DecorPicker({
  s,
  filter,
  onFilter,
  selected,
  onPick,
  onMore,
}: {
  s: IslandState;
  filter: DecorFilter;
  onFilter: (f: DecorFilter) => void;
  selected: string | null;
  onPick: (key: string) => void;
  onMore: () => void;
}) {
  const list = DECORS.filter((d) => inFilter(s, d, filter));
  return (
    <section className="decor-inventory" aria-label="장식 고르기">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="island-section-kicker">PICK</p>
          <h3 className="text-sm font-black">장식 고르기</h3>
        </div>
        <button onClick={onMore} className="tap rounded-lg bg-white/10 px-3 py-2 text-xs font-bold ring-1 ring-white/15">
          자세히 보기
        </button>
      </div>
      <FilterChips value={filter} onChange={onFilter} label="장식 분류" options={filterOptions(s)} />
      {list.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/45">
          {filter === "can" ? "지금 하트로 살 수 있는 장식이 없어요" : "이 분류에 장식이 없어요"}
        </p>
      ) : (
        <div className="decor-inventory-track">
          {list.map((d) => {
            const lock = decorLockReason(s, d);
            const price = decorPrice(d);
            const n = placedCount(s, d.key);
            return (
              <button
                key={d.key}
                data-rarity={d.rarity}
                disabled={lock != null || s.coins < price}
                onClick={() => onPick(d.key)}
                className={`tap decor-inventory-card ${selected === d.key ? "is-selected" : ""}`}
              >
                <DecorIcon decorKey={d.key} size={52} title={d.name} detailed />
                <b className="max-w-[78px] truncate text-xs">{d.name}</b>
                <small className="max-w-[78px] truncate text-xs text-amber-200/70">
                  {lock ?? `${n ? `${n}개 · ` : ""}${won(price)}💗`}
                </small>
                {d.produce && (
                  <span aria-label={`${goodsOf(d.produce.goods).name} 생산`} className="absolute right-1 top-1 text-xs">
                    {goodsOf(d.produce.goods).emoji}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── 상점(자세히) ──────────────────────────────────────────────── */

/** 장식 상점 — 한 줄에 한 장식. 평점·생산·이웃 조합·잠금 이유까지 '이걸 사면 뭐가 되나'를 다 보여 준다. */
export function DecorShop({
  s,
  filter,
  onFilter,
  onPick,
}: {
  s: IslandState;
  filter: DecorFilter;
  onFilter: (f: DecorFilter) => void;
  onPick: (key: string) => void;
}) {
  const known = new Set(knownCombos(s).map((c) => c.id));
  const list = DECORS.filter((d) => inFilter(s, d, filter));
  // '지금 살 수 있는'은 비싼 것부터 — 살 수 있는 것 중 가장 좋은 게 맨 위
  if (filter === "can") list.sort((a, b) => decorPrice(b) - decorPrice(a));
  const set = DECOR_SETS.find((x) => x.id === filter) ?? null;
  const setItems = set ? DECORS.filter((d) => d.set === set.id) : [];
  const setHave = setItems.filter((d) => placedCount(s, d.key) > 0).length;
  return (
    <div>
      <p className="mb-2 text-xs text-white/55">
        가진 하트 <b className="text-amber-200">{won(s.coins)}💗</b> · 놓을 때 값을 내고, 치우면 절반을 돌려받아요
      </p>
      <FilterChips value={filter} onChange={onFilter} label="장식 분류" options={filterOptions(s)} />
      {set && (
        <div
          className={`mb-2 rounded-xl px-3 py-2 text-xs ring-1 ${
            s.sets.includes(set.id) ? "bg-amber-400/15 text-amber-100 ring-amber-300/40" : "bg-white/[0.05] text-white/70 ring-white/10"
          }`}
        >
          <b>
            {set.emoji} {set.name}
          </b>{" "}
          {s.sets.includes(set.id) ? "완성 ✓" : `${setHave}/${setItems.length}`} · 다 놓으면{" "}
          <b className="text-amber-200">{set.perk}</b> · 평점 +{set.bonusRating}
        </div>
      )}
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-white/45">
            {filter === "can" ? "지금 하트로 살 수 있는 장식이 없어요. 사냥·주문으로 모아 와요" : "이 분류에 장식이 없어요"}
          </p>
        )}
        {list.map((d) => {
          const price = decorPrice(d);
          const lock = decorLockReason(s, d);
          const short = !lock && s.coins < price ? price - s.coins : 0;
          const n = placedCount(s, d.key);
          const combos = combosWith(d.key);
          const found = combos.filter((c) => known.has(c.id));
          const home = DECOR_SETS.find((x) => x.id === d.set);
          const g = d.produce ? goodsOf(d.produce.goods) : null;
          return (
            <div key={d.key} className={`rounded-xl p-2.5 ring-1 ${RARITY_TONE[d.rarity]}`}>
              <div className="flex items-start gap-2.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-black/25">
                  <DecorIcon decorKey={d.key} size={48} title={d.name} detailed />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1 text-sm font-extrabold">
                    {d.name}
                    <span className="rounded-full bg-white/10 px-1.5 text-xs font-bold text-white/60">{RARITY_LABEL[d.rarity]}</span>
                    {home && filter !== home.id && (
                      <span className="text-xs font-bold text-white/45">
                        {home.emoji} {home.name}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    평점 +{RARITY_RATING[d.rarity]}
                    {n > 0 && ` · 섬에 ${n}개`}
                  </p>
                  {d.produce && g && (
                    <p className="mt-0.5 text-xs font-bold text-emerald-200">
                      🧺 {d.produce.hours}시간마다 {g.emoji} {g.name} · {boostNames(d)} 옆이면 2배
                    </p>
                  )}
                  {combos.length > 0 && (
                    <p className="mt-0.5 text-xs text-amber-100/75">
                      🤝 이웃 조합 {combos.length}개
                      {found.length ? ` · ${found.map((c) => c.name).join(", ")}` : " · 아직 못 찾았어요"}
                    </p>
                  )}
                  {lock ? (
                    <p className="mt-0.5 text-xs font-bold text-rose-300">🔒 {lock}</p>
                  ) : short > 0 ? (
                    <p className="mt-0.5 text-xs font-bold text-amber-300">💗 {won(short)} 더 모아야 해요</p>
                  ) : null}
                </div>
                <button
                  disabled={lock != null || short > 0}
                  onClick={() => onPick(d.key)}
                  className="tap shrink-0 self-center rounded-lg bg-amber-300 px-3 py-2 text-xs font-extrabold text-[var(--ink-on-light)] disabled:bg-white/10 disabled:text-white/40"
                >
                  놓기
                  <span className="block">{won(price)}💗</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 세트 · 조합 ───────────────────────────────────────────────── */

/** 테마 세트 — 무엇이 모자란지 한눈에, 누르면 그 세트 상점으로. */
export function SetBoard({ s, onOpen }: { s: IslandState; onOpen: (setId: string) => void }) {
  return (
    <section className="island-panel p-3" aria-label="테마 세트">
      <p className="island-section-kicker">SETS</p>
      <p className="mb-2 text-sm font-bold text-white/85">
        테마 세트 {s.sets.length}/{DECOR_SETS.length} · 한 세트를 다 놓으면 효과가 켜져요
      </p>
      <div className="space-y-1.5">
        {DECOR_SETS.map((set) => {
          const items = DECORS.filter((d) => d.set === set.id);
          const have = items.filter((d) => placedCount(s, d.key) > 0).length;
          const on = s.sets.includes(set.id);
          return (
            <button
              key={set.id}
              onClick={() => onOpen(set.id)}
              className={`tap w-full rounded-xl px-3 py-2 text-left ring-1 ${on ? "bg-amber-400/15 ring-amber-300/40" : "bg-white/[0.05] ring-white/10"}`}
            >
              <span className="flex items-center gap-2 text-sm">
                <span aria-hidden>{set.emoji}</span>
                <b className="min-w-0 flex-1 truncate">{set.name}</b>
                <span className={`text-xs ${on ? "font-bold text-amber-300" : "text-white/55"}`}>
                  {on ? "완성 ✓" : `${have}/${items.length}`}
                </span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1">
                {items.map((d) => (
                  <span key={d.key} className={placedCount(s, d.key) > 0 ? "" : "opacity-45 grayscale"}>
                    <DecorIcon decorKey={d.key} size={20} title={d.name} />
                  </span>
                ))}
              </span>
              <span className="mt-1 block text-xs text-white/55">
                {on ? "켜짐" : "완성하면"} · <b className={on ? "text-amber-200" : "text-white/75"}>{set.perk}</b> · 평점 +{set.bonusRating}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type ComboFilter = "live" | "known" | "all";

/** 이웃 조합 도감 — 지금 성립 중 → 발견 → 미발견 순. 미발견도 재료 그림은 보여 준다(다음 목표). */
export function ComboBook({ s }: { s: IslandState }) {
  const known = new Set(knownCombos(s).map((c) => c.id));
  const live = new Set(activeCombos(s).map((c) => c.id));
  const [f, setF] = useState<ComboFilter>(live.size ? "live" : "all");
  const rank = (id: string) => (live.has(id) ? 0 : known.has(id) ? 1 : 2);
  const list = DECOR_COMBOS.filter((c) => (f === "all" ? true : f === "live" ? live.has(c.id) : known.has(c.id))).sort(
    (a, b) => rank(a.id) - rank(b.id),
  );
  return (
    <section className="island-panel p-3" aria-label="이웃 조합">
      <p className="island-section-kicker">COMBOS</p>
      <p className="mb-2 text-sm font-bold text-white/85">
        이웃 조합 · 발견 {known.size}/{DECOR_COMBOS.length}
      </p>
      <FilterChips
        value={f}
        onChange={setF}
        label="조합 보기"
        options={[
          { k: "live", label: "✨ 성립 중", n: live.size },
          { k: "known", label: "발견", n: known.size },
          { k: "all", label: "전체", n: DECOR_COMBOS.length },
        ]}
      />
      {list.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/45">
          {f === "live" ? "지금 붙어 있는 조합이 없어요. 섬에서 장식을 나란히 놓아 보세요" : "아직 발견한 조합이 없어요"}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {list.map((c) => {
            const got = known.has(c.id);
            const on = live.has(c.id);
            return (
              <div
                key={c.id}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ${
                  on ? "bg-amber-400/15 ring-1 ring-amber-300/40" : got ? "bg-white/[0.06]" : "bg-white/[0.03] opacity-55"
                }`}
                title={got ? c.line : "아직 발견하지 않은 조합"}
              >
                <span className="flex shrink-0 items-center -space-x-1">
                  <DecorIcon decorKey={c.a} size={18} />
                  <DecorIcon decorKey={c.b} size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{got ? c.name : "???"}</span>
                <span className={`shrink-0 ${on ? "text-amber-300" : "text-white/40"}`}>{on ? `+${c.rating}` : got ? "떨어짐" : `+${c.rating}`}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-white/40">가로·세로로 맞닿게 놓으면 조합이 성립해요(대각선 ✕). 붙어 있는 동안만 평점에 더해져요.</p>
    </section>
  );
}
