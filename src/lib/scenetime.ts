// 홈 월드의 시간대/하늘 팔레트 — 순수 파생(테스트 가능, 렌더 안전).
// [2026-07-28 v2] 사용자 "낮/밤 2테마라 단조롭고 허접" → **8단계 시간대**로 확장하고
// 하늘을 5-스톱 그라데이션 + 대기 원근(먼 언덕이 시간대 조명색에 섞임) + 광원(해/달) 궤도 +
// 구름 채색(윗면 광원색/아랫면 그늘색) + 별 밝기 연속값으로 표현한다.
// 시각은 KST(계절 판정과 동일 기준). 모든 값은 시각의 순수 함수 — 렌더 순수성 보장.

// ⚠ 상대 경로 + .ts — CI 의 node --test 는 별칭(@/)을 못 푼다. type 만 가져와도 예외가 아니다
//    (타입은 지워지지만 테스트가 이 파일에 닿는 순간 lock 이 잡는다 — tsimports.test.ts).
import type { Season } from "./island.ts";

export type SkyPhase =
  | "night" // 깊은 밤 (21~4)
  | "blueHour" // 여명 전 블루아워 (4~5:30)
  | "sunrise" // 일출 (5:30~7)
  | "morning" // 아침 (7~10)
  | "day" // 한낮 (10~15)
  | "golden" // 황금빛 오후 (15~17:30)
  | "sunset" // 노을 (17:30~19)
  | "twilight"; // 땅거미 (19~21)

export const kstHourOf = (now: number): number => new Date(now + 9 * 3600_000).getUTCHours();
/** KST 소수 시각(예: 17.5 = 17시 30분) — 시간대 전환·광원 궤도를 분 단위로 부드럽게. */
export const kstHourFloatOf = (now: number): number => {
  const d = new Date(now + 9 * 3600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
};

export function skyPhaseOf(hourKST: number): SkyPhase {
  if (hourKST >= 4 && hourKST < 5.5) return "blueHour";
  if (hourKST >= 5.5 && hourKST < 7) return "sunrise";
  if (hourKST >= 7 && hourKST < 10) return "morning";
  if (hourKST >= 10 && hourKST < 15) return "day";
  if (hourKST >= 15 && hourKST < 17.5) return "golden";
  if (hourKST >= 17.5 && hourKST < 19) return "sunset";
  if (hourKST >= 19 && hourKST < 21) return "twilight";
  return "night";
}

export type SkyLook = {
  /** 하늘 5-스톱(위→지평선) — 단조로운 3톤 대신 대기층을 표현 */
  top: string;
  upper: string;
  mid: string;
  lower: string;
  bottom: string;
  /** 지평선 헤이즈(대기 산란) — 먼 풍경이 여기에 녹아든다 */
  haze: string;
  hillFar: string;
  hillMid: string;
  hillNear: string;
  /** 광원(해/달) 색·발광 */
  light: string;
  glow: string;
  /** 구름 윗면(광원 받는 쪽)/아랫면(그늘) */
  cloudLit: string;
  cloudShade: string;
  /** 0~1 — 별 밝기(연속값이라 블루아워/땅거미에 은은히 남는다) */
  starOpacity: number;
  /** 달을 그리는가(밤·여명·땅거미) */
  moon: boolean;
  night: boolean;
  /** 중앙(D-day) 텍스트가 어두운 배경 위인지 — 대비 전환용 */
  onDark: boolean;
  /** 상단 헤더(로고/날짜칩)가 어두운 배경 위인지 — top 색 밝기로 자동 판정.
      ⚠ onDark 와 다르다: 일출은 위(파랑)는 어둡고 가운데(주황)는 밝다 */
  headerDark: boolean;
  /** 사람이 읽는 시간대 이름 */
  label: string;
};

const HILLS: Record<Season, [string, string]> = {
  spring: ["#7fce62", "#5cb54a"],
  summer: ["#6ec654", "#4aa63d"],
  autumn: ["#c9ad55", "#a8893c"],
  winter: ["#cfe0e8", "#aec6d2"],
};

/** #rrggbb 두 색을 t(0~1)로 섞음 — 대기 원근(먼 언덕을 조명색 쪽으로)에 사용. */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const k = Math.max(0, Math.min(1, t));
  const c = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** 상대 휘도(0~1) — 헤더 대비 자동 판정용(sRGB 근사). */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 시간대별 하늘 원본(대기 원근 적용 전). 언덕은 계절색을 여기 톤으로 물들인다. */
type PhaseBase = Omit<SkyLook, "hillFar" | "hillMid" | "hillNear" | "headerDark"> & {
  hillTint: string; // 언덕에 입히는 조명색
  hillTintFar: number; // 먼 언덕에 섞는 비율(대기 원근 — 멀수록 크게)
  hillTintNear: number;
};

const PHASES: Record<SkyPhase, PhaseBase> = {
  night: {
    top: "#0b1026", upper: "#141a3a", mid: "#1e2350", lower: "#2c2c5e", bottom: "#3b3566",
    haze: "#4a3f6e",
    light: "#fdf6d8", glow: "#fdf6d8",
    cloudLit: "#3a3f6b", cloudShade: "#232748",
    starOpacity: 1, moon: true, night: true, onDark: true, label: "깊은 밤",
    hillTint: "#141a3a", hillTintFar: 0.72, hillTintNear: 0.6,
  },
  blueHour: {
    top: "#12224e", upper: "#1d3a6e", mid: "#2f5b8f", lower: "#5b7fa8", bottom: "#93aec0",
    haze: "#b6c4cc",
    light: "#e8f0ff", glow: "#e8f0ff",
    cloudLit: "#6a7f9e", cloudShade: "#3e5170",
    starOpacity: 0.55, moon: true, night: false, onDark: true, label: "여명",
    hillTint: "#25405f", hillTintFar: 0.62, hillTintNear: 0.46,
  },
  sunrise: {
    top: "#4d76c4", upper: "#8fa8dd", mid: "#ffc7a6", lower: "#ffd9a8", bottom: "#ffeacb",
    haze: "#ffd9bd",
    light: "#ffd27a", glow: "#ffbe78",
    cloudLit: "#ffd7c0", cloudShade: "#c9a5b4",
    starOpacity: 0.12, moon: false, night: false, onDark: false, label: "일출",
    hillTint: "#e8a074", hillTintFar: 0.58, hillTintNear: 0.42,
  },
  morning: {
    top: "#5fb3ec", upper: "#8fd0f5", mid: "#bce6fb", lower: "#dbf3ff", bottom: "#f2fbff",
    haze: "#e4f4fe",
    light: "#fff3b8", glow: "#fff3b8",
    cloudLit: "#ffffff", cloudShade: "#d6e6f2",
    starOpacity: 0, moon: false, night: false, onDark: false, label: "아침",
    hillTint: "#eafff0", hillTintFar: 0.3, hillTintNear: 0.1,
  },
  day: {
    top: "#3f9fe0", upper: "#77c6f2", mid: "#a9dcf8", lower: "#cfeeff", bottom: "#edfaff",
    haze: "#dff2fd",
    light: "#fff8cf", glow: "#fff8cf",
    cloudLit: "#ffffff", cloudShade: "#cfe0ee",
    starOpacity: 0, moon: false, night: false, onDark: false, label: "한낮",
    hillTint: "#ffffff", hillTintFar: 0.26, hillTintNear: 0.06,
  },
  golden: {
    top: "#57a4d8", upper: "#93c6e6", mid: "#ffdfae", lower: "#ffd08f", bottom: "#ffe3bd",
    haze: "#ffdcb0",
    light: "#ffcf6e", glow: "#ffc46e",
    cloudLit: "#ffe6c4", cloudShade: "#d9b49c",
    starOpacity: 0, moon: false, night: false, onDark: false, label: "황금빛 오후",
    hillTint: "#f0bd7c", hillTintFar: 0.54, hillTintNear: 0.36,
  },
  sunset: {
    top: "#4b3c8f", upper: "#8f5aa8", mid: "#f2748a", lower: "#ff9d6b", bottom: "#ffcf95",
    haze: "#ffb383",
    light: "#ff9d4d", glow: "#ff8c50",
    cloudLit: "#ffb595", cloudShade: "#8a5f80",
    starOpacity: 0.08, moon: false, night: false, onDark: true, label: "노을",
    hillTint: "#5f3a5e", hillTintFar: 0.68, hillTintNear: 0.56,
  },
  twilight: {
    top: "#161a44", upper: "#2a2a63", mid: "#4a3b7c", lower: "#7b4f84", bottom: "#a86a80",
    haze: "#9a6079",
    light: "#fdf3e0", glow: "#fdf3e0",
    cloudLit: "#6b5580", cloudShade: "#3a2f5c",
    starOpacity: 0.75, moon: true, night: false, onDark: true, label: "땅거미",
    hillTint: "#2b2a55", hillTintFar: 0.66, hillTintNear: 0.5,
  },
};

/** (phase, season) → 하늘 팔레트 캐시.
 *  왜 캐시하나: 호출부가 3초 틱마다 이걸 부르는데 매번 **새 객체**가 나오면, 이 값을 effect
 *  의존성으로 쓰는 캔버스(PixelPet)가 3초마다 rAF 정지·재할당·배경 재굽기를 반복한다.
 *  실제 하늘은 시간대와 계절이 바뀔 때만 변하므로 그 조합만 기억하면 된다(조합 수 = 상수).
 *  (이 저장소는 React Compiler 가 꺼져 있어 자동 메모가 없다 — 여기서 직접 만든다.) */
const lookCache = new Map<string, SkyLook>();

export function skyLook(phase: SkyPhase, season: Season): SkyLook {
  const ck = phase + "|" + season;
  const hit = lookCache.get(ck);
  if (hit) return hit;
  const made = buildLook(phase, season);
  lookCache.set(ck, made);
  return made;
}

function buildLook(phase: SkyPhase, season: Season): SkyLook {
  const b = PHASES[phase];
  const [far, near] = HILLS[season];
  // 대기 원근 — 먼 언덕일수록 시간대 조명색에 더 많이 섞인다(깊이감의 핵심)
  return {
    ...b,
    headerDark: luminance(b.top) < 0.55, // 헤더는 하늘 '위쪽' 위에 있으므로 top 기준
    hillFar: mixHex(far, b.hillTint, b.hillTintFar),
    hillMid: mixHex(far, b.hillTint, (b.hillTintFar + b.hillTintNear) / 2),
    hillNear: mixHex(near, b.hillTint, b.hillTintNear),
  };
}

/** 광원(해/달)의 화면 위치 — 시각에 따라 궤도를 돈다. x,y 는 0~1 비율(y 작을수록 위). */
export function lightPos(hourFloat: number): { x: number; y: number } {
  const h = ((hourFloat % 24) + 24) % 24;
  // 해: 5.5시 동쪽 지평선 → 11.75시 정점 → 18시 서쪽 지평선
  // 달: 18시 → 다음날 5.5시 (밤 구간을 같은 궤도로 매핑)
  const isDay = h >= 5.5 && h < 18;
  const t = isDay ? (h - 5.5) / 12.5 : ((h < 5.5 ? h + 24 : h) - 18) / 11.5;
  // ⚠ 궤도 범위는 UI 와의 충돌로 정해진 값이다(예쁘라고 넓히면 회귀):
  //   · 정점 y=0.06 — D-day 타이포(top 17%) 위. 겹치면 둘 다 안 읽힘
  //   · 하한 y=0.46 — 좌우 WorldProp(우편함 bottom 34% / 표지판 35%) 위. 겹치면 아이콘을 가림
  //   · x 는 코사인 매핑(선형 아님) — 고도가 낮을수록 화면 가장자리로 가서
  //     중앙 타이포 대역(x 0.3~0.7)에는 '높이 뜬 상태'로만 진입한다
  return {
    x: 0.5 - Math.cos(Math.PI * t) * 0.44,
    y: 0.46 - Math.sin(Math.PI * t) * 0.4,
  };
}

/** 달 위상 0~1 (0=삭, 0.5=보름) — 실제 날짜 기반. 초승/보름이 화면에 반영된다. */
export function moonPhase(now: number): number {
  const SYNODIC = 29.530588853 * 86400_000;
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // 기준 삭(UTC)
  return ((((now - NEW_MOON) % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
}

/** 달의 밝은 부분 경로 — 오른쪽 반원 + 종결선(terminator) 타원호.
 *
 *  ⚠ 예전 구현은 '같은 반지름의 그림자 원을 좌우로 30 밀기'였는데, 이건 기하학적으로
 *  틀렸다: 상현/하현(phase .25/.75)에서 오프셋이 0 이 되어 **그림자가 달을 통째로 덮었다**
 *  (한 달의 절반은 밤하늘에 달이 없었다). 삭에도 3분의 1만 어두웠다.
 *  올바른 작도는 종결선을 '반지름이 r·|cos| 인 타원호'로 그리는 것 —
 *  cos=+1(삭) 이면 호가 오른쪽 반원과 겹쳐 밝은 면적 0, cos=-1(보름)이면 왼쪽 반원이 되어 원 전체다.
 */
export function moonLitPath(cx: number, cy: number, r: number, phase: number): string {
  const c = Math.cos(phase * Math.PI * 2); // +1 삭 → -1 보름
  // ⚠ 반올림 필수 — cos(π/2) 는 정확히 0 이 아니라 6.1e-17 이라, 그대로 쓰면 경로에
  //   "1.3471114790620886e-15" 같은 지수 표기가 박힌다(파서마다 해석이 갈리는 지뢰).
  const round = (n: number) => Math.round(n * 100) / 100;
  const rx = round(Math.abs(c) * r);
  // 아래→위로 되돌아오는 호의 방향: 초승(볼록 오른쪽)=0, 상현망간(볼록 왼쪽)=1
  const sweep = c > 0 ? 0 : 1;
  const top = `${cx} ${cy - r}`;
  const bot = `${cx} ${cy + r}`;
  return `M ${top} A ${r} ${r} 0 0 1 ${bot} A ${rx} ${r} 0 0 ${sweep} ${top} Z`;
}
