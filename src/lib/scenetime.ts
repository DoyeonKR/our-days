// 홈 월드의 시간대/하늘 팔레트 — 순수 파생(테스트 가능, 렌더 안전).
// 새벽/낮/노을/밤 × 계절 언덕 톤. 시각은 KST(계절 판정과 동일 기준).

import type { Season } from "@/lib/island";

export type SkyPhase = "dawn" | "day" | "dusk" | "night";

export const kstHourOf = (now: number): number => new Date(now + 9 * 3600_000).getUTCHours();

export function skyPhaseOf(hourKST: number): SkyPhase {
  if (hourKST >= 5 && hourKST < 8) return "dawn";
  if (hourKST >= 8 && hourKST < 17) return "day";
  if (hourKST >= 17 && hourKST < 20) return "dusk";
  return "night";
}

export type SkyLook = {
  top: string;
  mid: string;
  bottom: string;
  hillFar: string;
  hillNear: string;
  night: boolean;
  /** 하늘 위 텍스트가 어두운 배경 위인지(밤/노을) — 대비 전환용 */
  onDark: boolean;
};

const HILLS: Record<Season, [string, string]> = {
  spring: ["#7fce62", "#5cb54a"],
  summer: ["#6ec654", "#4aa63d"],
  autumn: ["#c9ad55", "#a8893c"],
  winter: ["#cfe0e8", "#aec6d2"],
};

export function skyLook(phase: SkyPhase, season: Season): SkyLook {
  const [hillFar, hillNear] = HILLS[season];
  switch (phase) {
    case "dawn":
      return { top: "#8fb7e8", mid: "#ffd9c4", bottom: "#ffeede", hillFar, hillNear, night: false, onDark: false };
    case "day":
      return { top: "#8fd0f5", mid: "#c2e9fb", bottom: "#eef9ff", hillFar, hillNear, night: false, onDark: false };
    case "dusk":
      return { top: "#7a6bd8", mid: "#ff9d76", bottom: "#ffd9a8", hillFar, hillNear, night: false, onDark: true };
    case "night":
      return {
        top: "#171a3d",
        mid: "#2b2a57",
        bottom: "#4a3f6e",
        hillFar: "#31485a",
        hillNear: "#26394a",
        night: true,
        onDark: true,
      };
  }
}
