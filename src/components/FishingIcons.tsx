"use client";

/* 낚시 아이콘 — 미끼 · 꽝 쓰레기 · 낚시 방식. 그림 파일이 오면(FISHING_IMAGE_KEYS) 파일을 쓰고, 그 전엔 여기 벡터로 그린다.
 * 픽셀 서체에 없는 이모지가 네모로 나오는 일을 겪어서(README §10.8) 글자로 때우지 않는다. */
import { asset } from "@/lib/base";
import { FISHING_IMAGE_KEYS } from "@/lib/fishingimages";
import type { MethodKey } from "@/lib/fishing";
import { moonLitPath } from "@/lib/fishtide";
import type { ReactNode } from "react";

const L = "#0f172a";
const stroke = { stroke: L, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const BAIT_ART: Record<string, ReactNode> = {
  bait_worm: <path {...stroke} fill="#f0a3a0" d="M10 32c-4-8 6-12 10-8s12 6 14-2-6-12 2-14c6-1 8 5 4 8-3 2-1 8-2 12-2 8-14 10-20 6-3-2-6 4-8-2z" />,
  bait_shrimp: <><path {...stroke} fill="#fca5a5" d="M38 12C24 6 8 14 10 28c1 8 10 12 16 8-6-2-8-8-4-12 5-5 12-4 16-12z" /><path {...stroke} fill="none" d="M36 12l6-6M38 15l7-3M13 34l-4 5M20 37l-1 5" /><circle cx="32" cy="14" r="2" fill={L} /></>,
  bait_squid: <><path {...stroke} fill="#fde8d7" d="M24 4c8 6 11 14 9 24H15C13 18 16 10 24 4z" /><path {...stroke} fill="none" d="M17 28c-2 6-4 8-6 14M22 28c0 6-1 10-3 16M27 28c1 6 2 10 3 16M31 28c2 6 4 8 6 14" /><circle cx="20" cy="20" r="2" fill={L} /><circle cx="28" cy="20" r="2" fill={L} /></>,
  bait_paste: <><path {...stroke} fill="#fbbf24" d="M8 30c0-12 8-20 16-20s16 8 16 20c0 6-8 10-16 10S8 36 8 30z" /><path fill="#fef3c7" d="M15 22c3-4 6-6 10-6-2 3-6 5-7 10z" /><circle cx="30" cy="27" r="2" fill="#b45309" /><circle cx="20" cy="32" r="2" fill="#b45309" /><circle cx="32" cy="34" r="1.5" fill="#b45309" /></>,
  bait_glow: <><circle cx="24" cy="24" r="20" fill="#22d3ee" opacity=".22" /><path {...stroke} fill="#67e8f9" d="M24 8c8 8 12 14 12 20a12 12 0 0 1-24 0c0-6 4-12 12-20z" /><path fill="#ecfeff" d="M18 28c0-5 3-9 6-12 0 6 2 8 2 12s-8 6-8 0z" /></>,
  bait_pearl: <><path {...stroke} fill="#c4b5fd" d="M6 28c6 12 30 12 36 0-4 2-8 2-10 0H16c-2 2-6 2-10 0z" /><circle cx="24" cy="20" r="11" fill="#fdf4ff" stroke={L} strokeWidth="2.5" /><circle cx="20" cy="16" r="3" fill="#fff" /><path fill="#f0abfc" d="M28 26a8 8 0 0 0 5-8c1 5-1 9-5 8z" /></>,
  bait_star: <><path {...stroke} fill="#fde047" d="M24 5l5.5 12 13 1.5-9.7 8.8 2.7 13-11.5-6.6-11.5 6.6 2.7-13-9.7-8.8 13-1.5z" /><circle cx="42" cy="8" r="1.8" fill="#fff" stroke={L} strokeWidth="1" /><circle cx="6" cy="10" r="1.3" fill="#fff" stroke={L} strokeWidth="1" /><circle cx="9" cy="42" r="1.5" fill="#fff" stroke={L} strokeWidth="1" /></>,
};

const JUNK_ART: Record<string, ReactNode> = {
  junk_buoy: <><path {...stroke} fill="#f1f5f9" d="M10 20c0-7 6-12 14-12s14 5 14 12v8c0 7-6 12-14 12s-14-5-14-12z" /><path {...stroke} fill="none" stroke="#2563eb" d="M10 24c8 4 20 4 28 0M24 40v5" /></>,
  junk_basket: <><path {...stroke} fill="#d6a55c" d="M8 20h32l-4 22H12z" /><path {...stroke} fill="none" d="M14 20c0-14 20-14 20 0M12 28h24M13 35h22M20 20l-1 22M28 20l1 22" /></>,
  junk_oar: <><path {...stroke} fill="#b7814a" d="M8 42l6-11 5 4-6 10z" /><path {...stroke} fill="#c99a63" d="M17 30L35 8l5 4-18 22z" /><path {...stroke} fill="none" d="M19 26l5 4" /></>,
  junk_ring: <><circle {...stroke} cx="24" cy="24" r="17" fill="#fb923c" /><circle {...stroke} cx="24" cy="24" r="8" fill="#0f172a" /><path fill="#fff" d="M21 7h6v9h-6zM21 32h6v9h-6zM7 21h9v6H7zM32 21h9v6h-9z" /></>,
  junk_pole: <><path {...stroke} fill="#94a3b8" d="M31 12l4 2-17 28-3-1z" /><path {...stroke} fill="#334155" d="M30 5l8 4-3 6-8-4z" /><path {...stroke} fill="none" d="M31 6c5-4 11 0 8 5" /></>,
  junk_stool: <><path {...stroke} fill="#ef4444" d="M9 15h30l-3 8H12z" /><path {...stroke} fill="none" stroke="#64748b" d="M14 23l20 19M34 23L14 42M12 42h6M30 42h6" /></>,
  junk_helmet: <><path {...stroke} fill="#facc15" d="M8 28C8 15 16 8 25 8s15 8 15 20v4H8z" /><path {...stroke} fill="#1e293b" d="M22 21h18v9H22z" /><path {...stroke} fill="none" d="M14 32c0 6 6 9 12 8" /></>,
  junk_probe: <><circle {...stroke} cx="23" cy="23" r="15" fill="#cbd5e1" /><circle {...stroke} cx="23" cy="23" r="6" fill="#0ea5e9" /><path {...stroke} fill="none" stroke="#ef4444" d="M34 33c4 2 3 6 7 7" /><path {...stroke} fill="none" stroke="#eab308" d="M31 36c1 4 0 6 2 8" /></>,
  junk_can: <><path {...stroke} fill="#94a3b8" d="M13 11h22l-2 12 3 7-2 11H15l-3-12 3-6z" /><ellipse {...stroke} cx="24" cy="11" rx="11" ry="3.5" fill="#cbd5e1" /><path fill="#e11d48" d="M15 20l19 2-1 8-20-2z" /></>,
  junk_boot: <path {...stroke} fill="#ca8a04" d="M16 5h14l-1 22 13 7c3 2 2 8-2 8H14c-2-12 3-22 2-37z" />,
  junk_bottle: <><path {...stroke} fill="#a5f3fc" fillOpacity=".8" d="M20 4h8v7c5 4 7 7 7 12v17c0 3-2 4-4 4H17c-2 0-4-1-4-4V23c0-5 2-8 7-12z" /><rect x="19.5" y="3" width="9" height="5" fill="#2563eb" stroke={L} strokeWidth="2" rx="1" /><path fill="#60a5fa" d="M13 26h22v9H13z" /></>,
  junk_bag: <path {...stroke} fill="#e2e8f0" d="M12 16c-1-5-2-9 0-11 2 0 3 4 4 8h16c1-4 2-8 4-8 2 2 1 6 0 11 5 8 4 22-1 27-3 1-5-2-7 0-3 2-5-1-8 0-3 1-5-1-7 0-5-5-6-19-1-27z" />,
  junk_sock: <><path {...stroke} fill="#fb7185" d="M17 4h14v18l-1 6 8 6c4 3 2 9-3 9-8 0-17-3-19-9-1-3 1-6 1-9z" /><path fill="#fff" d="M17 4h14v6H17z" /><circle cx="29" cy="37" r="3.5" fill="#0f172a" /></>,
  junk_tire: <><circle {...stroke} cx="24" cy="24" r="20" fill="#334155" /><circle {...stroke} cx="24" cy="24" r="9" fill="#7dd3fc" /><path fill="none" stroke="#64748b" strokeWidth="2" d="M24 7v5M24 36v5M7 24h5M36 24h5M12 12l4 4M32 32l4 4M36 12l-4 4M12 36l4-4" /></>,
  junk_umbrella: <><path {...stroke} fill="#a78bfa" d="M5 25C7 13 15 7 24 7s17 6 19 18l-6-3-5 5-7-5-6 5-5-5z" /><path {...stroke} fill="none" d="M24 24v14c0 6-8 6-8 1M31 27l6 9" /></>,
  junk_duck: <><path {...stroke} fill="#fde047" d="M8 28c6 2 10-1 15-2-5-3-5-14 5-15s11 9 8 13c5 0 7-3 8-5 2 10-3 22-16 22C15 41 8 37 8 28z" /><path {...stroke} fill="#fb923c" d="M36 15l8-2-6 6z" /><circle cx="31" cy="15" r="2" fill={L} /></>,
  junk_slipper: <><path {...stroke} fill="#1e293b" d="M15 3c9-1 16 5 17 18l1 18c0 4-5 6-9 5-8-1-11-7-11-14z" /><path fill="#fff" d="M13 20l19-2 .3 3-19 2zM13 25l19-2 .3 3-19 2zM13 30l19-2 .3 3-19 2z" /></>,
  junk_coin: <><circle {...stroke} cx="24" cy="24" r="18" fill="#fbbf24" /><circle cx="24" cy="24" r="13" fill="none" stroke="#b45309" strokeWidth="2" /><path fill="#b45309" d="M24 15l2.6 6 6.4.6-4.8 4.3 1.4 6.3-5.6-3.3-5.6 3.3 1.4-6.3-4.8-4.3 6.4-.6z" /></>,
  junk_hat: <><path {...stroke} fill="#d6b77a" d="M4 32c8-4 9-2 10-4 1-8 3-16 10-16s9 8 10 16c1 2 2 0 10 4-8 6-32 6-40 0z" /><path fill="#78350f" d="M14 25c6 3 14 3 20 0l.6 4c-7 3-14 3-21 0z" /></>,
  junk_glasses: <><circle {...stroke} cx="14" cy="24" r="9" fill="#1e293b" /><circle {...stroke} cx="34" cy="24" r="9" fill="#1e293b" /><path {...stroke} fill="none" d="M22 22c2-2 2-2 4 0M5 21L1 17M43 21l4-4M31 18l3 6-4 2 3 5" /></>,
  junk_letter: <><path {...stroke} fill="#bbf7d0" fillOpacity=".75" d="M6 26c0-6 4-9 9-9h12l6-4h7v14h-7l-6-4v0c0 8-4 11-9 11H15c-5 0-9-3-9-8z" /><rect x="11" y="21" width="15" height="9" rx="1" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" /><rect x="39" y="12" width="4" height="16" rx="1" fill="#92400e" /></>,
  junk_bill: <><path {...stroke} fill="#fef3c7" d="M10 5h24l4 6v32H10z" /><path fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" d="M15 15h18M15 21h18M15 27h12" /><circle cx="31" cy="35" r="5" fill="#dc2626" /></>,
  junk_satellite: <><rect {...stroke} x="18" y="17" width="13" height="13" fill="#cbd5e1" transform="rotate(-20 24 24)" /><path {...stroke} fill="#2563eb" d="M3 16l13-4 3 9-13 5zM31 24l13-5 2 9-12 5z" /><path {...stroke} fill="none" d="M26 15c2-4 5-6 9-6M24 34l-4 8 5-2" /></>,
};

const METHOD_ART: Record<MethodKey, ReactNode> = {
  float: <><path d="M4 32h40" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" /><path {...stroke} fill="#ef4444" d="M24 14c5 0 8 4 8 9s-3 9-8 9-8-4-8-9 3-9 8-9z" /><path fill="#fff" d="M16 22h16v4H16z" /><path {...stroke} fill="none" d="M24 14V6" /></>,
  lure: <><path {...stroke} fill="#22d3ee" d="M42 22c-6-8-16-10-26-4l-9-6 2 12-2 12 9-6c10 6 20 4 26-4 1-1 1-3 0-4z" /><circle cx="34" cy="21" r="2.4" fill={L} /><path {...stroke} fill="none" d="M24 31v7a4 4 0 0 1-7 2" /></>,
  scoop: <><ellipse {...stroke} cx="20" cy="19" rx="15" ry="12" fill="#f8fafc" fillOpacity=".5" /><path fill="none" stroke={L} strokeWidth="1.5" d="M10 11l20 16M16 8l18 15M6 17l18 14M30 11L10 27M24 8L6 23M34 17L16 31" /><path {...stroke} fill="none" strokeWidth="4" d="M31 28l13 14" /></>,
  deep: <><circle {...stroke} cx="24" cy="24" r="17" fill="#38bdf8" /><circle {...stroke} cx="24" cy="24" r="6" fill="#0c4a6e" /><path {...stroke} fill="none" strokeWidth="4" d="M24 24l13-12" /><circle {...stroke} cx="38" cy="10" r="4" fill="#fde047" /></>,
  // 집어등 — 밤물 위에 매단 등불과 번지는 빛(이모지 없이 직접 그린다)
  light: <><ellipse cx="24" cy="38" rx="19" ry="6" fill="#fde68a" fillOpacity=".45" /><path d="M5 38h38" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" /><path {...stroke} fill="none" d="M24 4v6" /><path {...stroke} fill="#3f2a12" d="M17 10h14v4H17z" /><path {...stroke} fill="#fff1b8" d="M18 14h12l2 14H16z" /><path {...stroke} fill="#3f2a12" d="M15 28h18v4H15z" /><path fill="#f59e0b" d="M24 17c2 3 3 5 0 8-3-3-2-5 0-8z" /></>,
};

function Pic({ k, art, label }: { k: string; art: ReactNode; label?: string }) {
  if (FISHING_IMAGE_KEYS.has(k)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset(`/fishing/${k}.webp`)} alt={label ?? ""} className="fish-icon-img" draggable={false} decoding="async" />;
  }
  return <svg viewBox="0 0 48 48" className="fish-icon-svg" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{art}</svg>;
}

export const BaitIcon = ({ k }: { k: string }) => <Pic k={k} art={BAIT_ART[k]} />;
export const JunkIcon = ({ k, label }: { k: string; label?: string }) => <Pic k={k} art={JUNK_ART[k]} label={label} />;
export const MethodIcon = ({ k }: { k: MethodKey }) => <svg viewBox="0 0 48 48" className="fish-icon-svg" aria-hidden>{METHOD_ART[k]}</svg>;

/** 달 모양(2026-11-12 물때 · 달) — frac 은 이번 삭망월의 몇 분의 몇(fishtide.moonPhase). 경로는 moonLitPath(순수 · 테스트가 잠근다).
 *  기울 땐 같은 경로를 좌우로 뒤집는다(북반구에서 보는 모양 — 차오를 땐 오른쪽이 밝다).
 *  이모지(🌕 …)는 기기 · 서체마다 모양이 달라 쓰지 않는다(README §10.8). */
export function MoonIcon({ frac, size = 16 }: { frac: number; size?: number }) {
  const f = ((frac % 1) + 1) % 1, d = moonLitPath(f);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="fish-moon-icon" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
      {d && <path d={d} fill="#fef3c7" transform={f < 0.5 ? undefined : "matrix(-1 0 0 1 24 0)"} />}
    </svg>
  );
}
