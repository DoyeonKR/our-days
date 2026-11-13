"use client";
/** 수집 탭의 '보물 · 유물'(2026-11-12) — 세트마다 모은 조각 · 못 찾은 조각(실루엣) · 다 모으면 받는 수조 장식. 엔진은 lib/fishtreasure.
 *  · 조각 그림은 우리가 그린 작은 SVG(24칸) — 같은 굵기의 짙은 갈색 외곽선 · 면 두세 가지 색. 못 찾은 조각은 같은 그림을 검게 눌러 실루엣으로
 *    (모양은 보여 줘서 '무엇을 찾는지'는 알게, 이름은 숨긴다).
 *  · 개발 화면에선 window.__fishForceTreasure("chest" | "relic" | 조각 key) 로 다음 판을 보물로 만들어 혼자서도 볼 수 있다.
 *    수집 탭이 아니라 이 모듈이 실릴 때 걸어 둔다 — 탭을 닫고 낚시하러 가야 쓰는 도구라 탭의 effect 에 두면 던지기 전에 사라진다. */
import type { ReactNode } from "react";
import type { FishTabProps } from "@/components/FishCollect";
import { decorOf } from "@/lib/aquarium";
import { asset } from "@/lib/base";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import { RELIC_SETS, devForceTreasure, relicSetsOf, relicsOf, setHave } from "@/lib/fishtreasure";

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __fishForceTreasure?: (kind?: string) => boolean }).__fishForceTreasure = devForceTreasure;
}

const INK = "#2b1d12";
const ART: Record<string, ReactNode> = {
  pottery_vase: (
    <>
      <path d="M10 3h4v2c3 1 5 3.6 5 7 0 3-1.4 5.5-3 7.4l.5 1.6h-9l.5-1.6C6.4 17.5 5 15 5 12c0-3.4 2-6 5-7z" fill="#8fbfa6" />
      <path d="M9 12c1-1 2-1 3 0s2 1 3 0M10 15.5c.7-.6 1.4-.6 2 0" fill="none" stroke="#f4f7f0" strokeWidth=".9" />
    </>
  ),
  pottery_jar: (
    <>
      <path d="M9 4h6v2.2c3.2 1 5 3.6 5 6.8 0 4-3.6 7-8 7s-8-3-8-7c0-3.2 1.8-5.8 5-6.8z" fill="#f2efe6" />
      <path d="M8 10.5c1.4-1.2 3-1.6 4.4-1.4" fill="none" stroke="#fff" strokeWidth="1.2" />
    </>
  ),
  pottery_bowl: (
    <>
      <path d="M3 9.5h18c0 5-4 8.5-9 8.5s-9-3.5-9-8.5z" fill="#b9ad94" />
      <rect x="9" y="18" width="6" height="2.4" rx=".6" fill="#9c8f74" />
      <path d="M6 12l2 2.4M10.4 12.2l1.6 2.6M15 12l1.6 2.4" fill="none" stroke="#f4efe2" strokeWidth="1.1" />
    </>
  ),
  pottery_dropper: (
    <>
      <path d="M12 6c4 0 7 2.8 7 7s-3 7-7 7-7-2.8-7-7 3-7 7-7z" fill="#8fbfa6" />
      <path d="M12 6c.6-1.6 2-2.6 3.4-2.4-.4 1.4-1.6 2.4-3.4 2.4z" fill="#6fa58b" />
      <circle cx="8.4" cy="9.6" r="1.4" fill="#6fa58b" />
    </>
  ),
  wreck_plate: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="1.6" fill="#9a6a3a" />
      <rect x="5" y="9" width="14" height="6" rx="1" fill="#d6a85a" />
      <path d="M7.5 12h9" fill="none" stroke="#7a4f24" strokeWidth="1.2" />
      <circle cx="4.6" cy="12" r=".7" fill="#e9c77a" stroke="none" /><circle cx="19.4" cy="12" r=".7" fill="#e9c77a" stroke="none" />
    </>
  ),
  wreck_compass: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#d4a24a" />
      <circle cx="12" cy="12" r="6.2" fill="#f4ead0" />
      <path d="M12 6.6l1.6 5.4h-3.2z" fill="#c9413a" />
      <path d="M12 17.4l-1.6-5.4h3.2z" fill="#2f4a68" />
    </>
  ),
  wreck_bell: (
    <>
      <path d="M12 3a1.5 1.5 0 0 1 1.5 1.5V5c3 .7 4.5 3.5 4.5 7v3l2 2.5H4L6 15v-3c0-3.5 1.5-6.3 4.5-7v-.5A1.5 1.5 0 0 1 12 3z" fill="#c99a3e" />
      <circle cx="12" cy="19.6" r="1.6" fill="#8a6524" />
      <path d="M8.4 10c.4-1.4 1.2-2.4 2.4-3" fill="none" stroke="#f0d08a" strokeWidth="1.1" />
    </>
  ),
  wreck_anchor: (
    <g fill="none" stroke="#5f6b75" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v12M8 9.5h8M5 14c.6 3.4 3.4 5.6 7 5.6s5.4-1.6 6.2-3.6" />
      <path d="M17.6 14.4l1.4 2.2" stroke="#8a96a0" />
    </g>
  ),
  wreck_wheel: (
    <g strokeLinecap="round">
      <path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3L5.3 18.7" fill="none" stroke="#7a4f24" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#9a6a3a" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="1.8" fill="#d6a85a" />
    </g>
  ),
  pirate_coin: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#f0c046" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#b88a1e" strokeWidth="1" />
      <path d="M12 8.2l1.1 2.4 2.6.3-1.9 1.8.5 2.6L12 14l-2.3 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="#fbe39a" />
    </>
  ),
  pirate_glass: (
    <g transform="rotate(-32 12 12)">
      <rect x="2.5" y="9.6" width="7" height="4.8" rx=".8" fill="#6b4a2b" />
      <rect x="9" y="9" width="6.5" height="6" rx=".8" fill="#d4a24a" />
      <rect x="15" y="8.2" width="6.5" height="7.6" rx=".9" fill="#c08a32" />
      <path d="M21.5 9.4v5.2" fill="none" stroke="#f4ead0" strokeWidth="1" />
    </g>
  ),
  pirate_key: (
    <>
      <circle cx="7" cy="8" r="4" fill="#b5652e" />
      <circle cx="7" cy="8" r="1.7" fill="#f3e4c6" />
      <path d="M9.6 10.6l9 9-1.4 1.4-1.6-1.6-1.4 1.4-1.4-1.4 1.4-1.4-1.2-1.2-1.4 1.4-1.4-1.4 1.4-1.4-3.4-3.4z" fill="#b5652e" />
    </>
  ),
  pirate_map: (
    <>
      <path d="M4 5l4.5 1.2L13 4.5l3 1.6L20 5l-.6 6 .8 3-.6 5-4.4-1-4 1.5-4.2-1.4L3.4 19l.8-6.4L3.6 9z" fill="#ecd9a8" />
      <path d="M6.4 15c1.6-1.8 3-1 4.4-2.6s2.4-3 4.6-2.4" fill="none" stroke="#9a6a3a" strokeWidth="1" strokeDasharray="1.4 1.2" />
      <path d="M14.6 8.4l2.6 2.6M17.2 8.4l-2.6 2.6" fill="none" stroke="#c9413a" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  palace_scale: (
    <>
      <path d="M12 3c4.4 2.6 7 5.8 7 9.6A7 7 0 0 1 12 20a7 7 0 0 1-7-7.4C5 8.8 7.6 5.6 12 3z" fill="#3fb39a" />
      <path d="M12 6.6c2.6 1.8 4 3.8 4 6.2" fill="none" stroke="#bff0de" strokeWidth="1.2" />
      <path d="M8.4 15.6c1.2 1.4 2.4 2 3.6 2s2.4-.6 3.6-2" fill="none" stroke="#e9c77a" strokeWidth="1.1" />
    </>
  ),
  palace_pearl: (
    <>
      <path d="M12 2.5c1 2 3.4 2.6 3.4 5 .9-.6 1.4-1.6 1.4-2.6 2 1.6 3.2 4 3.2 6.6a8 8 0 0 1-16 0c0-2.6 1.2-5 3.2-6.6 0 1 .5 2 1.4 2.6 0-2.4 2.4-3 3.4-5z" fill="#f4b740" />
      <circle cx="12" cy="13.4" r="5.4" fill="#fff3d6" />
      <circle cx="10.2" cy="11.6" r="1.4" fill="#fff" stroke="none" />
    </>
  ),
  palace_crown: (
    <>
      <path d="M5 18h14l-.6-3H5.6z" fill="#e9c77a" />
      <path d="M7 15c-1.6-2.6-1.4-5 0-7 .2 1.6.8 2.4 1.6 2.6-.2-2.4.6-4.6 2.4-6.1.2 2 .6 3.4 1 4.1.5-1.4 1.6-2.4 3-2.8-.6 1.6-.2 3 .8 4 .6-.8 1.6-1.2 2.6-1.2-1 2-1.2 4.1-.4 6.4z" fill="#e0574f" />
      <circle cx="12" cy="16.5" r=".9" fill="#5fc2e6" stroke="none" />
    </>
  ),
  palace_tile: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="#7f8fa3" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="#5e6c7e" strokeWidth="1" />
      <path d="M12 7.4c1.2 1.4 1.2 3 0 4.6-1.2-1.6-1.2-3.2 0-4.6zM12 16.6c-1.2-1.4-1.2-3 0-4.6 1.2 1.6 1.2 3.2 0 4.6zM7.4 12c1.4-1.2 3-1.2 4.6 0-1.6 1.2-3.2 1.2-4.6 0zM16.6 12c-1.4 1.2-3 1.2-4.6 0 1.6-1.2 3.2-1.2 4.6 0z" fill="#c9d3df" />
    </>
  ),
  palace_seal: (
    <>
      <rect x="4.5" y="13" width="15" height="7.5" rx="1.2" fill="#d9b25b" />
      <ellipse cx="11" cy="11" rx="5.4" ry="3.6" fill="#5d9b6a" />
      <circle cx="17.6" cy="11" r="1.8" fill="#76b583" />
      <path d="M8.4 9.6l2.6 1.4 2.6-1.4" fill="none" stroke="#3d6e48" strokeWidth=".9" />
    </>
  ),
};

/** 유물 조각 그림 — 결과 카드(FishSpecial)도 같은 그림을 쓴다 */
export function RelicIcon({ k, className = "fish-relic-icon" }: { k: string; className?: string }) {
  // 그림이 오면 그림을 먼저(scripts/fishing-art.mjs 의 RELIC_ART — relic_<조각 key>), 없으면 아래 벡터
  if (FISHING_IMAGE_KEYS.has(`relic_${k}`)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/fishing/relic_${k}.webp`)} alt="" className={`${className} aqua-img`} draggable={false} decoding="async" aria-hidden />;
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g stroke={INK} strokeWidth="1" strokeLinejoin="round">{ART[k] ?? <circle cx="12" cy="12" r="7" fill="#b9ad94" />}</g>
    </svg>
  );
}
/** 그림이 있는 조각인가(테스트 · 화면이 확인한다) */
export const RELIC_ART_KEYS: readonly string[] = Object.keys(ART);

function ChestMark() {
  return (
    <svg viewBox="0 0 24 24" className="fish-relic-chest" aria-hidden>
      <rect x="3.5" y="10.5" width="17" height="9.5" rx="1.4" fill="#8a5a2b" stroke="#f0c46a" strokeWidth="1.2" />
      <path d="M3.5 12c0-3.6 3.8-6 8.5-6s8.5 2.4 8.5 6z" fill="#a46a33" stroke="#f0c46a" strokeWidth="1.2" />
      <rect x="10.4" y="11.6" width="3.2" height="3.8" rx=".6" fill="#f0c46a" />
    </svg>
  );
}

export default function FishRelics(p: Pick<FishTabProps, "st">) {
  const relics = relicsOf(p.st);
  const done = relicSetsOf(p.st);
  const doneN = RELIC_SETS.filter((s) => done.includes(s.key)).length;
  return (
    <section className="aqua-card fish-relics" aria-label="보물 · 유물">
      <header><strong><ChestMark />보물 · 유물</strong><small>{doneN}/{RELIC_SETS.length} 세트 · 다 모으면 수조 장식</small></header>
      {RELIC_SETS.map((set) => {
        const have = setHave(relics, set);
        const got = done.includes(set.key);
        const decor = decorOf(set.reward)?.name ?? "장식";
        return (
          <div key={set.key} className={`fish-relic-set ${got ? "is-done" : ""}`}>
            <div className="fish-relic-head"><b>{set.name}</b><small>{have}/{set.pieces.length}</small></div>
            <ul className="fish-relic-grid">
              {set.pieces.map((x) => {
                const n = relics[x.key] ?? 0;
                return (
                  <li key={x.key} className={n ? "" : "is-missing"} aria-label={n ? `${x.name}${n > 1 ? ` ${n}번 건짐` : ""}` : "아직 못 찾은 유물"}>
                    <RelicIcon k={x.key} />
                    <small>{n ? x.name : "???"}</small>
                    {n > 1 && <i>×{n}</i>}
                  </li>
                );
              })}
            </ul>
            <p className="aqua-note">{got ? `${decor} — 수조 보관함으로 보냈어요` : `다 모으면 수조 장식 '${decor}'`} · {set.where}</p>
          </div>
        );
      })}
      <p className="aqua-note">찌 · 루어 · 심해 낚시에 드물게 걸려요(뜰채는 바닥까지 닿지 않아요). 이미 모은 유물은 하트 몇 개로 바꿔 드려요</p>
    </section>
  );
}
