"use client";

/* 공방 하위 화면 — 레시피북 · 찬장 · 주문 게시판 · 효과 표시줄. [2026-09-23 개편]
 *
 * 예전 공방은 '창고 재료 알약 한 줄 + 조리대'가 전부였다. 만들 수 있는 게 11종이고 결과가
 * 팔기·간식·선물 셋뿐이라 그걸로 충분했지만, 요리가 34종·단계 요리·효과·주문이 붙으면
 * 한 화면에 다 담을 수 없다. 조리대 · 레시피 · 찬장 · 주문 네 칸으로 나눴다(IslandGame 이 탭을 그린다).
 *
 * ⚠ 재료 판정·보상 계산은 전부 엔진(craftCheck·dishPayout·orderReady)을 부른다 — 화면에서 따로
 *   계산하면 '버튼은 켜졌는데 눌러도 아무 일 없는' 사고가 난다(골드비료·전설 씨앗에서 이미 겪었다). */

import { useState } from "react";
import {
  BUFF_LABEL,
  DISH_CAT_LABEL,
  PRODUCTS,
  activeBuffs,
  craftCheck,
  cropOf,
  decorDef,
  dishCat,
  dishPayout,
  effectStarMult,
  effectText,
  farmSkill,
  goodsOf,
  isCropKey,
  isGoodsKey,
  isLegendProduct,
  orderNpc,
  orderReady,
  productOf,
  stockOf,
  todayOrders,
  type BuffKind,
  type DishCat,
  type IslandState,
  type Order,
  type Product,
  type ProductKey,
} from "@/lib/island";
import { CropIcon, ProductIcon } from "@/components/island/CropIcon";
import { FilterChips, dur } from "@/components/island/IslandSheet";

const won = (v: number) => v.toLocaleString();

/** 재료 한 칸(작물 · 생산 재료 · 제품) 아이콘. 생산 재료(꿀·달걀·우유)의 도트는 제품 표에 같이 산다. */
export function ItemIcon({ k, size = 18 }: { k: string; size?: number }) {
  return isCropKey(k) ? (
    <CropIcon cropKey={k} stage={3} size={size} title={cropOf(k).name} />
  ) : (
    <ProductIcon productKey={k} size={size} title={itemName(k)} />
  );
}
export const itemName = (k: string): string =>
  isCropKey(k) ? cropOf(k).name : isGoodsKey(k) ? goodsOf(k).name : productOf(k as ProductKey).name;
/** 모자란 재료를 **어디서** 구하나 — 작물은 정원, 생산 재료는 꾸미기의 생산 장식, 제품은 공방. */
export const itemSource = (k: string): string =>
  isCropKey(k) ? "정원에서 키워요" : isGoodsKey(k) ? `꾸미기의 ${decorDef(goodsOf(k).producer).name}에서 모여요` : "공방에서 먼저 만들어요";

/** 남은 시간 "3시간" / "40분" */
const left = (ms: number) => (ms >= 3_600_000 ? `${Math.ceil(ms / 3_600_000)}시간` : `${Math.max(1, Math.ceil(ms / 60_000))}분`);

/** 켜진 요리 효과 — 섬 어디서든 한 줄로(정원·공방 위). 효과가 없으면 아무것도 그리지 않는다. */
export function BuffStrip({ s, now }: { s: IslandState; now: number }) {
  const list = activeBuffs(s, now);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="켜진 요리 효과">
      {list.map((b) => {
        const l = BUFF_LABEL[b.kind as BuffKind];
        return (
          <span key={b.kind} className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/35">
            {l.emoji} {l.name} {b.kind === "quality" ? `+${b.amount}` : `+${b.amount}%`} · {left(b.leftMs)}
          </span>
        );
      })}
    </div>
  );
}

type RecipeFilter = "can" | "all" | DishCat;

/** 레시피북 — 조리대에 올릴 요리를 고른다. slot 이 null 이면 빈 조리대를 알아서 쓴다. */
export function RecipeBook({
  s,
  busy,
  onCook,
}: {
  s: IslandState;
  busy: boolean;
  /** 만들기 — 어느 조리대에 올릴지는 부르는 쪽이 정한다(빈 칸이 없으면 버튼이 꺼진다). */
  onCook: (key: ProductKey) => void;
}) {
  const skill = farmSkill(s.farm.skillXp);
  const freeSlot = s.farm.craft.some((c) => !c.product);
  const can = (p: Product) => craftCheck(s, p).ok;
  const nCan = PRODUCTS.filter(can).length;
  const [filter, setFilter] = useState<RecipeFilter>(nCan > 0 ? "can" : "all");
  const cats: DishCat[] = ["korean", "bakery", "dessert", "drink", "basic", "ingredient", "legend"];
  const list = PRODUCTS.filter((p) =>
    filter === "can" ? can(p) : filter === "all" ? true : dishCat(p) === filter,
  ).sort((a, b) => Number(can(b)) - Number(can(a)) || a.minSkill - b.minSkill || a.sell - b.sell);

  return (
    <div>
      <FilterChips
        value={filter}
        onChange={setFilter}
        label="레시피 분류"
        options={[
          { k: "can", label: "✅ 지금 가능", n: nCan },
          { k: "all", label: "전체", n: PRODUCTS.length },
          ...cats.map((k) => ({ k, label: DISH_CAT_LABEL[k], n: PRODUCTS.filter((p) => dishCat(p) === k).length })),
        ]}
      />
      {!freeSlot && (
        <p className="mb-2 rounded-lg bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200 ring-1 ring-amber-300/25">
          조리대가 다 찼어요, 완성된 요리를 먼저 꺼내요
        </p>
      )}
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-white/45">
            {filter === "can" ? "지금 재료로 만들 수 있는 요리가 없어요. 정원에서 거둬 와요" : "이 분류에 요리가 없어요"}
          </p>
        )}
        {list.map((p) => {
          const chk = craftCheck(s, p);
          const pay = dishPayout(p.key, 3);
          const legend = isLegendProduct(p);
          return (
            <div
              key={p.key}
              className={`rounded-xl p-2.5 ring-1 ${
                chk.ok ? "bg-emerald-400/10 ring-emerald-300/35" : legend ? "bg-amber-300/10 ring-amber-300/30" : "bg-white/[0.05] ring-white/10"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/20">
                  <ProductIcon productKey={p.key} size={36} title={p.name} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1 text-sm font-extrabold">
                    {p.name}
                    <span className="rounded-full bg-white/10 px-1.5 text-xs font-bold text-white/60">{DISH_CAT_LABEL[dishCat(p)]}</span>
                    {legend && <span className="rounded-full bg-amber-300/20 px-1.5 text-xs text-amber-200">✦전설</span>}
                  </p>
                  {/* 재료 — 가진 수/필요 수. 모자라면 붉게 */}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {Object.entries(p.recipe).map(([k, n]) => {
                      const have = stockOf(s, k).qty;
                      const enough = have >= (n ?? 0);
                      return (
                        <span key={k} className={`inline-flex items-center gap-0.5 ${enough ? "text-white/80" : "text-rose-300"}`}>
                          <ItemIcon k={k} size={16} />
                          {itemName(k)} {Math.min(have, n ?? 0)}/{n}
                        </span>
                      );
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {dur(p.days)} · 판매 ~{won(p.sell)}💗 · 간식 성장 +{won(pay.careXp)}
                  </p>
                  {p.effect && <p className="mt-0.5 text-xs font-bold text-emerald-200">먹이면 {effectText(p.effect)}</p>}
                  {p.cat === "ingredient" && <p className="mt-0.5 text-xs text-sky-200">다른 요리의 재료예요(찬장에 보관해 두세요)</p>}
                  {!chk.skill ? (
                    <p className="mt-0.5 text-xs font-bold text-rose-300">🔒 농사 Lv.{p.minSkill}부터 (지금 Lv.{skill})</p>
                  ) : chk.missing ? (
                    <p className="mt-0.5 text-xs font-bold text-amber-300">
                      {itemName(chk.missing.key)} {chk.missing.need}개 더 — {itemSource(chk.missing.key)}
                    </p>
                  ) : null}
                </div>
                <button
                  disabled={busy || !chk.ok || !freeSlot}
                  onClick={() => onCook(p.key)}
                  className="tap shrink-0 self-center rounded-lg bg-amber-300 px-3 py-2 text-xs font-extrabold text-[var(--ink-on-light)] disabled:bg-white/10 disabled:text-white/40"
                >
                  만들기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 찬장 — 창고(작물) + 찬장(요리). 요리는 여기서 먹이기·팔기·선물한다. */
export function PantryView({
  s,
  busy,
  onUse,
}: {
  s: IslandState;
  busy: boolean;
  onUse: (key: ProductKey, use: "sell" | "treat" | "gift") => void;
}) {
  const barn = Object.entries(s.farm.barn).filter(([, v]) => v.qty > 0);
  const pantry = Object.entries(s.farm.pantry ?? {}).filter(([, v]) => v.qty > 0);
  return (
    <div className="space-y-3">
      <section className="island-panel p-3" aria-label="찬장 요리">
        <p className="island-section-kicker">PANTRY</p>
        <p className="mb-2 text-sm font-bold text-white/85">찬장 · 보관한 요리 {pantry.reduce((a, [, v]) => a + v.qty, 0)}</p>
        {pantry.length === 0 ? (
          <p className="text-xs text-white/45">조리대에서 완성된 요리를 “보관”하면 여기 모여요. 주문·단계 요리 재료로 쓸 수 있어요.</p>
        ) : (
          <div className="space-y-2">
            {pantry.map(([k, v]) => {
              const p = productOf(k as ProductKey);
              const pay = dishPayout(p.key, v.star);
              return (
                <div key={k} className="rounded-xl bg-white/[0.05] p-2.5 ring-1 ring-white/10">
                  <div className="flex items-center gap-2">
                    <ProductIcon productKey={k} size={30} title={p.name} />
                    <p className="min-w-0 flex-1 text-sm font-extrabold">
                      {p.name} <span className="text-xs text-amber-300">{"★".repeat(Math.max(1, v.star))}</span>
                      <span className="ml-1 text-xs font-bold text-white/55">×{v.qty}</span>
                    </p>
                  </div>
                  {p.effect && (
                    <p className="mt-1 text-xs text-emerald-200">
                      먹이면 {effectText(p.effect)}
                      {v.star > 1 && ` (★${v.star} ×${effectStarMult(v.star)})`}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <button disabled={busy} onClick={() => onUse(p.key, "treat")} className="tap rounded-lg bg-emerald-400/15 py-1.5 text-xs font-extrabold text-emerald-200 ring-1 ring-emerald-300/30 disabled:opacity-40">
                      먹이기<span className="block font-normal opacity-80">성장 +{won(pay.careXp)}</span>
                    </button>
                    <button disabled={busy} onClick={() => onUse(p.key, "sell")} className="tap rounded-lg bg-amber-300/15 py-1.5 text-xs font-extrabold text-amber-200 ring-1 ring-amber-300/30 disabled:opacity-40">
                      팔기<span className="block font-normal opacity-80">+{won(pay.coins)}💗</span>
                    </button>
                    <button disabled={busy} onClick={() => onUse(p.key, "gift")} className="tap rounded-lg bg-pink-400/15 py-1.5 text-xs font-extrabold text-pink-200 ring-1 ring-pink-300/30 disabled:opacity-40">
                      선물<span className="block font-normal opacity-80">유대 +{won(pay.bondXp)}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="island-panel p-3" aria-label="창고 재료">
        <p className="island-section-kicker">BARN</p>
        <p className="mb-2 text-sm font-bold text-white/85">창고 · 거둔 재료</p>
        {barn.length === 0 ? (
          <p className="text-xs text-white/45">비었어요, 정원에서 수확해요</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {barn.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-1 text-xs font-bold ring-1 ring-white/10">
                <ItemIcon k={k} size={18} />
                {itemName(k)} {v.qty}
                <span className="text-amber-300">{"★".repeat(Math.max(1, v.star))}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** 주문 게시판 — 오늘 손님 세 명의 주문. */
export function OrderBoard({
  s,
  now,
  busy,
  onFulfill,
}: {
  s: IslandState;
  now: number;
  busy: boolean;
  onFulfill: (id: string) => void;
}) {
  const list = todayOrders(s, now);
  const count = s.orderCount ?? 0;
  const every = 5;
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/55">
        손님이 하루 세 건 주문해요. 그냥 팔 때보다 후하게 쳐 주고, {every}건마다 골드비료를 줘요.
        <span className="ml-1 font-bold text-amber-200">처리 {count}건 · 다음 선물까지 {every - (count % every)}건</span>
      </p>
      {list.length === 0 && (
        <p className="rounded-xl bg-white/[0.05] px-3 py-6 text-center text-sm text-white/45">오늘 주문을 받는 중이에요, 섬을 다시 열어 보세요</p>
      )}
      {list.map((o: Order, i) => {
        const npc = orderNpc(o.npc);
        const ready = orderReady(s, o);
        return (
          <div
            key={o.id}
            className={`rounded-xl p-3 ring-1 ${
              o.done ? "bg-white/[0.03] opacity-60 ring-white/10" : ready ? "bg-sky-400/12 ring-sky-300/40" : "bg-white/[0.06] ring-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xl">{npc.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">
                  {npc.name} {i === 2 && <span className="ml-1 rounded-full bg-amber-300/20 px-1.5 text-xs text-amber-200">큰 주문</span>}
                </p>
                <p className="truncate text-xs text-white/50">“{npc.line}”</p>
              </div>
              {o.done && <span className="text-xs font-bold text-emerald-300">완료 ✓</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {o.items.map((it) => {
                const st = stockOf(s, it.key);
                const ok = st.qty >= it.qty && st.star >= it.star;
                return (
                  <span
                    key={it.key}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ring-1 ${
                      ok ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/35" : "bg-white/[0.06] text-white/75 ring-white/10"
                    }`}
                  >
                    <ItemIcon k={it.key} size={18} />
                    {itemName(it.key)} {Math.min(st.qty, it.qty)}/{it.qty}
                    {it.star > 1 && <span className={st.star >= it.star ? "text-amber-300" : "text-rose-300"}>★{it.star}+</span>}
                  </span>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-white/60">
                보상 <b className="text-amber-200">+{won(o.coins)}💗</b> · 섬 경험치 +{o.xp}
                {o.bond > 0 && ` · 유대 +${o.bond}`}
              </p>
              {!o.done && (
                <button
                  disabled={busy || !ready}
                  onClick={() => onFulfill(o.id)}
                  className="tap shrink-0 rounded-lg bg-sky-300 px-3 py-1.5 text-xs font-extrabold text-[var(--ink-on-light)] disabled:bg-white/10 disabled:text-white/40"
                >
                  건네기
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-white/40">요리 주문은 찬장에 “보관”해 둔 것으로 채워요. 작물은 창고에서 꺼내요.</p>
    </div>
  );
}
