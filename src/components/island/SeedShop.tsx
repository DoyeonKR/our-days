"use client";

/* 씨앗 가게 — 정원 빈 칸을 탭하면 뜬다. [2026-09-23 개편]
 *
 * 예전 시트는 작물 11종을 2열로 늘어놓고 씨앗값·성장시간만 보여 줬다. 작물이 27종이 되면
 * 그 방식으론 고를 수가 없다(스크롤 세 화면). 그리고 **무엇을 기준으로 골라야 하는지**가
 * 화면에 없었다 — 지금 제철인가, 하루에 얼마 버나, 옆 칸과 궁합이 맞나, 어디에 쓰이나.
 * 그 넷을 카드에 올리고, 분류 칩과 '이 칸에 추천' 정렬로 고르는 시간을 줄인다. */

import { useMemo, useState } from "react";
import {
  CROPS,
  CROP_CAT_LABEL,
  COMPANIONS,
  COMPANION_GRACE,
  FARM_COLS,
  PRODUCTS,
  SEASON_LABEL,
  companionsOf,
  cropCat,
  cropOf,
  farmSkill,
  plotUnderGlass,
  seasonOf,
  type Crop,
  type CropCat,
  type CropKey,
  type IslandState,
} from "@/lib/island";
import { CropIcon } from "@/components/island/CropIcon";
import { SheetShell, FilterChips, dur } from "@/components/island/IslandSheet";

type Filter = "pick" | "season" | CropCat | "regrow" | "legend";

/** 한 포기의 하루 수익(다시 열리는 작물은 일생 전체로). 씨앗값은 빼지 않는다 — 비교용 지표다. */
export function perDay(c: Crop): number {
  if (!c.regrow) return c.sell / c.growDays;
  return (c.sell * (1 + c.regrow.times)) / (c.growDays + c.regrow.days * c.regrow.times);
}

/** 이 칸의 4방향 이웃 작물(방금 거둔 것 포함 — 엔진의 궁합 판정과 같은 규칙). */
function neighborCrops(s: IslandState, plotId: number, now: number): CropKey[] {
  const x = plotId % FARM_COLS;
  const y = Math.floor(plotId / FARM_COLS);
  const out: CropKey[] = [];
  for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
    if (nx < 0 || nx >= FARM_COLS || ny < 0) continue;
    const n = s.farm.plots[ny * FARM_COLS + nx];
    const k = n?.crop ?? (n?.prev && now - n.prev.at < COMPANION_GRACE ? n.prev.crop : null);
    if (k) out.push(k);
  }
  return out;
}

export default function SeedShop({
  s,
  plotId,
  now,
  busy,
  onPlant,
  onClose,
}: {
  s: IslandState;
  plotId: number;
  now: number;
  busy: boolean;
  onPlant: (key: CropKey) => void;
  onClose: () => void;
}) {
  const season = seasonOf(now);
  const skill = farmSkill(s.farm.skillXp);
  const near = useMemo(() => neighborCrops(s, plotId, now), [s, plotId, now]);
  /** 이 작물을 여기 심으면 성립하는 궁합(이웃 기준). */
  const matchHere = (k: CropKey) =>
    COMPANIONS.filter((cp) => (cp.a === k && near.includes(cp.b)) || (cp.b === k && near.includes(cp.a)));
  const anyMatch = CROPS.some((c) => matchHere(c.key).length > 0);
  const [filter, setFilter] = useState<Filter>(anyMatch ? "pick" : "season");

  // 온실은 칸마다 다르다(1단계 첫 줄 · 2단계 두 줄 · 3단계 전부) — 이 칸이 온실이면 모든 작물이 제철
  const glass = plotUnderGlass(s, plotId);
  const inSeason = (c: Crop) => glass || c.season === season;
  const list = CROPS.filter((c) => {
    if (filter === "pick") return matchHere(c.key).length > 0 || (inSeason(c) && !c.unique);
    if (filter === "season") return inSeason(c);
    if (filter === "regrow") return !!c.regrow;
    if (filter === "legend") return !!c.unique;
    return !c.unique && cropCat(c) === filter;
  }).sort(
    (a, b) =>
      matchHere(b.key).length - matchHere(a.key).length ||
      Number(inSeason(b)) - Number(inSeason(a)) ||
      Number(!!a.unique) - Number(!!b.unique) ||
      a.seed - b.seed,
  );

  const cats: CropCat[] = ["veg", "fruit", "grain", "herb"];
  const options: { k: Filter; label: string; n?: number }[] = [
    ...(anyMatch ? [{ k: "pick" as const, label: "🤝 이 칸 추천" }] : []),
    { k: "season", label: `제철 ${SEASON_LABEL[season]}`, n: CROPS.filter(inSeason).length },
    ...cats.map((k) => ({ k, label: CROP_CAT_LABEL[k], n: CROPS.filter((c) => !c.unique && cropCat(c) === k).length })),
    { k: "regrow", label: "🌳 다시 열림", n: CROPS.filter((c) => c.regrow).length },
    { k: "legend", label: "✦ 전설", n: CROPS.filter((c) => c.unique).length },
  ];

  return (
    <SheetShell onClose={onClose} title="씨앗 가게" wide>
      {/* 이 칸의 이웃 — 궁합을 고를 근거 */}
      <p className="mb-2 text-xs text-white/55">
        {near.length > 0 ? (
          <>
            이 칸 옆:{" "}
            {near.map((k) => (
              <span key={k} className="mr-1 inline-flex items-center gap-0.5 align-middle font-bold text-white/80">
                <CropIcon cropKey={k} stage={3} size={14} />
                {cropOf(k).name}
              </span>
            ))}
            · 짝이 맞으면 수확 품질이 올라요
          </>
        ) : (
          "옆 칸에 짝이 맞는 작물을 심으면 수확 품질이 올라요(가로·세로)"
        )}
      </p>
      <FilterChips value={filter} onChange={setFilter} options={options} label="작물 분류" />

      <div className="space-y-2">
        {list.length === 0 && <p className="py-6 text-center text-sm text-white/45">이 분류에 맞는 작물이 없어요</p>}
        {list.map((c) => {
          const needSkill = c.minSkill ?? 0;
          const locked = skill < needSkill;
          const poor = s.coins < c.seed;
          // ⚠ 한 포기 제한(unique)도 이유를 띄운다 — plant() 가 조용히 무시하면 버튼이 고장 난 줄 안다
          //   (사용자 리포트 2026-08-12 "전설급 씨앗은 왜 안심어지는거야").
          const uniqueBlocked = !!c.unique && s.farm.plots.some((p) => p.crop === c.key);
          const match = matchHere(c.key);
          const uses = PRODUCTS.filter((p) => c.key in p.recipe);
          const mates = companionsOf(c.key).map((cp) => cropOf(cp.a === c.key ? cp.b : cp.a).name);
          const off = !inSeason(c);
          return (
            <button
              key={c.key}
              disabled={busy || locked || poor || uniqueBlocked}
              onClick={() => onPlant(c.key)}
              className={`tap flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left ring-1 disabled:opacity-40 ${
                match.length
                  ? "bg-emerald-400/10 ring-emerald-300/40"
                  : c.unique
                    ? "bg-amber-300/10 ring-amber-300/30"
                    : "bg-white/[0.06] ring-white/10"
              }`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-black/20">
                <CropIcon cropKey={c.key} stage={3} size={40} title={c.name} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 text-sm font-extrabold">
                  {c.name}
                  {c.unique && <span className="rounded-full bg-amber-300/20 px-1.5 text-xs text-amber-200">✦전설</span>}
                  {c.regrow && <span className="rounded-full bg-sky-300/15 px-1.5 text-xs text-sky-200">🌳 {1 + c.regrow.times}번 수확</span>}
                  {off && <span className="rounded-full bg-rose-400/15 px-1.5 text-xs text-rose-200">비제철</span>}
                  {match.map((cp) => (
                    <span key={cp.id} className="rounded-full bg-emerald-400/20 px-1.5 text-xs text-emerald-200">
                      🤝 {cp.name} +{cp.bonus}
                    </span>
                  ))}
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  씨앗 {c.seed}💗 · {dur(c.growDays)}
                  {c.regrow && ` (이후 ${dur(c.regrow.days)}마다)`} · 판매 {c.sell}💗
                  <span className="whitespace-nowrap text-white/40"> · 하루 ~{Math.round(perDay(c) * (off ? 0.3 : 1))}💗</span>
                </p>
                {(mates.length > 0 || uses.length > 0) && (
                  <p className="mt-0.5 truncate text-xs text-white/45">
                    {mates.length > 0 && `짝: ${mates.join("·")}`}
                    {mates.length > 0 && uses.length > 0 && " · "}
                    {uses.length > 0 &&
                      `요리: ${uses.slice(0, 3).map((p) => p.name).join("·")}${uses.length > 3 ? ` 외 ${uses.length - 3}` : ""}`}
                  </p>
                )}
                {locked ? (
                  <p className="text-xs font-bold text-amber-300">🔒 농사 Lv.{needSkill} 필요 (지금 {skill}) · 수확하면 올라요</p>
                ) : uniqueBlocked ? (
                  <p className="text-xs font-bold text-amber-300">🌱 이미 한 포기 자라는 중, 한 번에 하나만</p>
                ) : poor ? (
                  <p className="text-xs text-rose-300">코인이 {c.seed - s.coins}💗 모자라요</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </SheetShell>
  );
}
