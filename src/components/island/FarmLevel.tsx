"use client";

/* 정원 · 농사 레벨 줄. [2026-09-24]
 *
 * [사용자: "조리대 농사 레벨 농사 기능이 어디있는지도 안나와 있고"] 공방·씨앗 가게·장비가 "농사 Lv.N"을
 * 요구하는데, 그 레벨이 **어디서 무엇으로 오르는지**(정원에서 수확 = 판매가 × ★)도, 오르면 **무엇이
 * 열리는지**도 어디에도 없었다. 정원 머리말 안에 두고, 레벨을 요구하는 곳마다 "정원에서 올려요 →"로 여기를 가리킨다.
 * ⚠ 해금 목록은 엔진의 farmUnlocks(표에서 파생) — 여기서 따로 적으면 레시피를 추가할 때 어긋난다.
 */

import { farmLevelProgress, farmUnlocks, type IslandState } from "@/lib/island";

const won = (v: number) => v.toLocaleString();

export default function FarmLevel({ s }: { s: IslandState }) {
  const p = farmLevelProgress(s.farm.skillXp);
  const upcoming = farmUnlocks()
    .filter((u) => u.level > p.level)
    .slice(0, 2);
  return (
    <div className="farm-level mt-2.5 border-t border-white/10 pt-2.5" role="group" aria-label="농사 레벨">
      <div className="flex items-center gap-2">
        <b className="shrink-0 text-sm font-black text-emerald-200">농사 Lv.{p.level}</b>
        <div
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p.pct * 100)}
          aria-label="다음 농사 레벨까지"
        >
          <div className="h-full bg-emerald-300" style={{ width: `${p.pct * 100}%`, transition: "width .5s" }} />
        </div>
        <span className="shrink-0 text-xs text-white/55">{p.next ? `Lv.${p.next}까지 ${won(p.need)}` : "최고 레벨"}</span>
      </div>
      <p className="mt-1 text-xs leading-snug text-white/60">
        작물을 <b className="text-white/85">수확할 때마다</b> 올라요 — 판매가 × ★만큼
      </p>
      {upcoming.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" aria-label="다음에 열리는 것">
          {upcoming.map((u) => (
            <li key={`${u.level}-${u.label}`}>
              <b className="text-amber-200">Lv.{u.level}</b> <span className="text-white/75">{u.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
