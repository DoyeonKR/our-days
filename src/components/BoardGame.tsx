"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  BOARD,
  BG_FESTIVAL_BONUS,
  BG_ISLAND_FEE,
  BG_ISLAND_TURNS,
  BG_MAX_LEVEL,
  BG_MAX_LAPS,
  BG_SALARY,
  BG_TAX,
  BG_TAX_MAX,
  BG_TILES,
  LEVEL_EMOJI,
  LEVEL_NAMES,
  type BGState,
  applyRoll,
  autoResolve,
  boardRecord,
  buildUp,
  buyTile,
  chooseSpace,
  createBoardState,
  endTurn,
  netWorth,
  newBoardSeed,
  payIsland,
  salaryFor,
  skipBuy,
  upgradableTiles,
} from "@/lib/boardgame";
import {
  type BoardGameRow,
  type GameProfile,
  commitBoardAction,
  createBoardGame,
  getBoardGame,
  getBoardResults,
  getGameProfile,
  getPlayerTokens,
  resignBoardGame,
  subscribeBoardGame,
  subscribeBoardPresence,
  upsertGameProfile,
} from "@/lib/couple";
import { sendEventPush } from "@/lib/notify";
import { confirmDialog } from "@/lib/confirm";
import Icon from "@/components/Icon";

// 주사위 눈(pip) 위치 — 100×100 뷰박스 기준 좌표.
const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 30], [70, 30], [30, 50], [70, 50], [30, 70], [70, 70]],
};

/** 멋진 SVG 주사위 — 둥근 흰 몸체(그라데이션·그림자) + 로즈색 눈. 굴리는 중엔 흔들림. */
function Die({ face, rolling }: { face: number; rolling?: boolean }) {
  const gid = useId();
  const n = Math.min(6, Math.max(1, face || 1));
  const pips = DIE_PIPS[n];
  return (
    <span className={`inline-grid place-items-center ${rolling ? "animate-bg-dice" : ""}`}>
      <svg
        width="44"
        height="44"
        viewBox="0 0 100 100"
        aria-hidden
        style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))" }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dde1ee" />
          </linearGradient>
        </defs>
        <rect
          x="7"
          y="7"
          width="86"
          height="86"
          rx="24"
          fill={`url(#${gid})`}
          stroke="rgba(15,10,18,0.18)"
          strokeWidth="2.5"
        />
        {pips.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="9.5" fill="#c0356a" />
        ))}
      </svg>
    </span>
  );
}
const PLAYER_COLOR = ["#ec4899", "#38bdf8"]; // p0 핑크, p1 하늘
const DEFAULT_TOKEN = "🚗";
// 말 스킨 상점 — 포인트로 잠금 해제(0=기본 보유). ⚠ 기본 보유(cost 0)는 game_profile.owned
//   기본값 ["🚗","🐰"] 과 반드시 일치. 등급(tier)이 높을수록 비싸고 링/가격이 화려해짐.
type TokenTier = "basic" | "rare" | "epic" | "legend";
const TOKENS: { e: string; cost: number; tier: TokenTier }[] = [
  { e: "🚗", cost: 0, tier: "basic" },
  { e: "🐰", cost: 0, tier: "basic" },
  { e: "🐱", cost: 60, tier: "basic" },
  { e: "🐶", cost: 60, tier: "basic" },
  { e: "🦊", cost: 130, tier: "rare" },
  { e: "🐼", cost: 130, tier: "rare" },
  { e: "🐧", cost: 200, tier: "rare" },
  { e: "🦉", cost: 280, tier: "rare" },
  { e: "🎩", cost: 380, tier: "epic" },
  { e: "🏎️", cost: 480, tier: "epic" },
  { e: "🚀", cost: 600, tier: "epic" },
  { e: "🤖", cost: 720, tier: "epic" },
  { e: "🦁", cost: 860, tier: "epic" },
  { e: "🔥", cost: 1000, tier: "legend" },
  { e: "🦄", cost: 1250, tier: "legend" },
  { e: "👑", cost: 1500, tier: "legend" },
  { e: "🐉", cost: 1800, tier: "legend" },
  { e: "💎", cost: 2200, tier: "legend" },
];
// 등급별 색(희귀할수록 화려) — 링(테두리)과 가격 텍스트에 적용해 '퀄리티'를 시각화.
const TIER_RING: Record<TokenTier, string> = {
  basic: "ring-white/15",
  rare: "ring-sky-400/60",
  epic: "ring-fuchsia-400/60",
  legend: "ring-amber-400/70",
};
const TIER_COST_COLOR: Record<TokenTier, string> = {
  basic: "text-white/60",
  rare: "text-sky-300",
  epic: "text-fuchsia-300",
  legend: "text-amber-300",
};
const TIER_LABEL: Record<TokenTier, string> = {
  basic: "일반",
  rare: "레어",
  epic: "에픽",
  legend: "레전드",
};
const GROUP_HUE: Record<string, string> = {
  A: "#f9a8d4",
  B: "#fca5a5",
  C: "#fcd34d",
  D: "#86efac",
  E: "#5eead4",
  F: "#93c5fd",
  H: "#c4b5fd",
};

// 승리 꽃가루 — 모듈 스코프(purity 규칙 제외). 위치·속도·이모지 고정 생성.
const CONFETTI = Array.from({ length: 42 }, (_, i) => ({
  left: Math.round(Math.random() * 100),
  delay: +(Math.random() * 0.7).toFixed(2),
  dur: +(1.5 + Math.random() * 1.7).toFixed(2),
  size: 12 + Math.round(Math.random() * 14),
  emoji: ["🎉", "✨", "💗", "⭐", "🎊", "💛"][i % 6],
}));

/** 칸 배경 — 소유 시 owner 색 그라데이션, 아니면 도시 그룹색 은은하게(위쪽 하이라이트로 입체감). */
function tileBg(owner: number | null, group?: string): string {
  if (owner !== null) {
    const c = PLAYER_COLOR[owner];
    return `linear-gradient(160deg, ${c}55, ${c}1a 55%, rgba(0,0,0,0.14))`;
  }
  if (group)
    return `linear-gradient(160deg, ${GROUP_HUE[group]}3a, rgba(255,255,255,0.05) 55%, rgba(0,0,0,0.14))`;
  return "linear-gradient(160deg, rgba(255,255,255,0.09), rgba(0,0,0,0.14))";
}

/** 링(28칸) idx → 8×8 CSS 그리드 위치(1-based). 모서리 0/7/14/21. */
function tileRC(idx: number): { r: number; c: number } {
  if (idx <= 7) return { r: 1, c: idx + 1 }; // 상단
  if (idx <= 14) return { r: idx - 6, c: 8 }; // 우측
  if (idx <= 21) return { r: 8, c: 22 - idx }; // 하단
  return { r: 29 - idx, c: 1 }; // 좌측
}

const won = (v: number) => `₩${v.toLocaleString()}`;

function TileView({
  idx,
  cell,
  highlight,
  onClick,
}: {
  idx: number;
  cell: { owner: number | null; level: number };
  highlight: boolean;
  onClick: () => void;
}) {
  const t = BOARD[idx];
  const rc = tileRC(idx);
  const isCorner =
    t.type !== "city" && t.type !== "chance" && t.type !== "tax" && t.type !== "festival";
  return (
    <button
      onClick={onClick}
      style={{
        gridRow: rc.r,
        gridColumn: rc.c,
        background: tileBg(cell.owner, t.group),
        boxShadow:
          cell.owner !== null
            ? `inset 0 0 0 1.5px ${PLAYER_COLOR[cell.owner]}, inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px rgba(0,0,0,0.45), 0 0 10px -3px ${PLAYER_COLOR[cell.owner]}`
            : "inset 0 1px 0 rgba(255,255,255,0.13), inset 0 0 0 1px rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.4)",
      }}
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[7px] px-0.5 py-0.5 ${
        isCorner ? "" : ""
      } ${highlight ? "z-10 animate-pulse ring-2 ring-white" : ""}`}
    >
      {t.group && (
        <span
          className="absolute inset-x-0 top-0 h-[4px]"
          style={{
            background: `linear-gradient(180deg, ${GROUP_HUE[t.group]}, ${GROUP_HUE[t.group]}77)`,
            boxShadow: `0 0 6px -1px ${GROUP_HUE[t.group]}`,
          }}
        />
      )}
      <span
        className={`leading-none ${isCorner ? "text-[17px]" : "text-[14px]"}`}
        style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }}
      >
        {t.emoji}
      </span>
      <span className="mt-0.5 line-clamp-2 px-px text-center text-[7px] font-bold leading-[1.05] text-white/85">
        {t.name}
      </span>
      {t.type === "city" && cell.owner === null && (
        <span className="text-[6px] font-semibold leading-none tabular-nums text-white/45">
          {t.price}
        </span>
      )}
      {cell.level > 0 && (
        <span
          className="absolute right-px top-px rounded bg-black/45 px-[2px] text-[9px] leading-none"
          title={LEVEL_NAMES[cell.level]}
        >
          {LEVEL_EMOJI[cell.level]}
        </span>
      )}
    </button>
  );
}

/** 말 스킨 상점 시트 — 포인트로 잠금 해제 + 탭해서 선택. 시작화면·보드 양쪽에서 재사용. */
function TokenShop({
  owned,
  selected,
  available,
  onPick,
  onClose,
}: {
  owned: string[];
  selected: string;
  available: number;
  onPick: (emoji: string, cost: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="말 상점"
        className="animate-sheet max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#1a121f] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-white">🐾 말 상점</h3>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
            보유 {available}P
          </span>
        </div>
        <p className="mt-1 text-xs text-white/50">
          게임 포인트로 말을 잠금 해제하고, 탭해서 선택해요. 희귀할수록(레어·에픽·레전드) 비싸요. (대결 승리 +10P)
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {TOKENS.map(({ e, cost, tier }) => {
            const isOwned = owned.includes(e);
            const isSel = selected === e;
            const affordable = available >= cost;
            return (
              <button
                key={e}
                onClick={() => onPick(e, cost)}
                disabled={!isOwned && !affordable}
                title={TIER_LABEL[tier]}
                className={`tap flex flex-col items-center gap-1 rounded-xl py-3 ring-1 disabled:opacity-40 ${
                  isSel
                    ? "bg-white/20 ring-white"
                    : `${isOwned ? "bg-white/[0.06]" : "bg-white/[0.03]"} ${TIER_RING[tier]}`
                }`}
              >
                <span className="text-2xl leading-none">{e}</span>
                {isSel ? (
                  <span className="text-[9px] font-bold text-white">선택됨</span>
                ) : isOwned ? (
                  <span className="text-[9px] text-white/50">보유</span>
                ) : (
                  <span className={`text-[9px] font-bold ${TIER_COST_COLOR[tier]}`}>{cost}P</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="tap mt-4 w-full rounded-xl bg-white/15 py-3 text-sm font-bold text-white"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ── 룰북(자세한 규칙) — 인트로에서 버튼으로 열어 정독하는 전체 규칙 ────────────
// 인트로 '규칙 한눈에'가 요약이라면, 여기는 카테고리별 상세. 상수(급여/세율/무인도 등)에서
// 실제 숫자를 끌어와 규칙과 코드가 어긋나지 않게 한다.
const RULEBOOK_SECTIONS: { icon: string; title: string; body: ReactNode }[] = [
  {
    icon: "🎯",
    title: "게임 목표",
    body: (
      <>
        둘이 번갈아 주사위를 굴려 세계 도시를 사고 건물을 올려요.{" "}
        <b className="text-white">상대를 파산시키면 즉시 승리</b>, 아무도 파산 안 하면 둘 다{" "}
        <b className="text-white">{BG_MAX_LAPS}바퀴</b> 완주 시 <b className="text-white">순자산(현금+도시+건물)</b>이 많은 쪽이 이겨요.
      </>
    ),
  },
  {
    icon: "🎲",
    title: "이동 · 더블",
    body: (
      <>
        두 주사위 <b className="text-white">합만큼</b> 앞으로 이동해요. 두 눈이 같은{" "}
        <b className="text-white">더블</b>이면 이동 후 <b className="text-white">한 번 더</b> 굴려요.
        단 <b className="text-white">더블 3연속</b>이면 과속으로 바로 무인도行!
      </>
    ),
  },
  {
    icon: "🏙️",
    title: "도시 매입",
    body: (
      <>
        주인 없는 도시에 도착하면 표시된 가격에 <b className="text-white">매입</b>할 수 있어요(현금 부족하면 통과).
        내 도시에 상대가 도착하면 <b className="text-white">통행료</b>를 받아요.
      </>
    ),
  },
  {
    icon: "🏨",
    title: "건물 건설 (4단계)",
    body: (
      <>
        내 도시를 탭해 <b className="text-white">별장 → 빌딩 → 호텔 → 🏰랜드마크</b>까지{" "}
        {BG_MAX_LEVEL}단계 올려요. 단계가 오를수록 통행료가 <b className="text-white">급등</b>해요.
      </>
    ),
  },
  {
    icon: "💸",
    title: "통행료 · 독점",
    body: (
      <>
        남의 도시에 도착하면 통행료를 내요. 같은 색(그룹) 도시를 <b className="text-white">모두 소유(독점)</b>하면
        통행료가 올라가요 — <b className="text-white">땅 ×2, 건물 ×1.5</b>.
      </>
    ),
  },
  {
    icon: "🧾",
    title: "관광세",
    body: (
      <>
        관광세 칸에 도착하면 <b className="text-white">순자산의 10%</b>를 기금으로 내요
        (최소 {BG_TAX} ~ 최대 {BG_TAX_MAX}). <b className="text-white">부자일수록 많이</b> 냅니다.
      </>
    ),
  },
  {
    icon: "🎉",
    title: "축제",
    body: (
      <>
        축제 칸에 도착하면 <b className="text-white">두 사람 모두 +{BG_FESTIVAL_BONUS}</b> 보너스를 받아요(커플 이벤트).
      </>
    ),
  },
  {
    icon: "🗝️",
    title: "황금열쇠",
    body: (
      <>
        도착하면 카드를 한 장 뽑아요 — 보너스·복권·상대에게 증여/수령·특정 칸으로 이동 등{" "}
        <b className="text-white">여러 종류</b>의 행운/시련이 나와요.
      </>
    ),
  },
  {
    icon: "🏝️",
    title: "무인도",
    body: (
      <>
        무인도에 <b className="text-white">도착하면 갇혀요</b>. <b className="text-white">더블</b>을 내면 즉시 탈출,
        못 내면 최대 <b className="text-white">{BG_ISLAND_TURNS}턴</b>까지 갇혔다가 벌금 {BG_ISLAND_FEE}을 내고 나와요.
      </>
    ),
  },
  {
    icon: "🚀",
    title: "우주여행",
    body: (
      <>
        도착하면 원하는 도시로 <b className="text-white">순간이동</b>해요. 노리던 도시를 사거나 상대를 압박할 때 유용해요.
      </>
    ),
  },
  {
    icon: "💝",
    title: "사회복지기금",
    body: (
      <>
        그동안 관광세로 쌓인 <b className="text-white">기금 전액</b>을, 기금 칸에 먼저 도착한 사람이 받아요.
      </>
    ),
  },
  {
    icon: "💰",
    title: "월급 (바퀴 가속)",
    body: (
      <>
        출발점을 지날 때마다 월급을 받아요. 기본 <b className="text-white">{BG_SALARY}</b>에서{" "}
        <b className="text-white">바퀴가 늘수록 가속</b>돼요 — 2바퀴 {salaryFor(2)}, 3바퀴 {salaryFor(3)}. 후반 역전의 열쇠!
      </>
    ),
  },
  {
    icon: "💳",
    title: "파산 회피 (매각)",
    body: (
      <>
        통행료·세금을 낼 현금이 부족하면 내 건물·도시를 <b className="text-white">반값에 매각</b>해 버텨요.
        그래도 부족하면 <b className="text-white">파산</b>하고 상대가 승리해요.
      </>
    ),
  },
  {
    icon: "🏆",
    title: "승패 판정",
    body: (
      <>
        <b className="text-white">① 상대 파산</b> → 즉시 승리. <b className="text-white">② {BG_MAX_LAPS}바퀴 완주</b> →
        순자산이 많은 쪽 승리(같으면 무승부). 전적(승·패·무)은 인트로와 게임 탭에서 볼 수 있어요.
      </>
    ),
  },
];

function RuleBook({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[#140e18] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="부루마블 룰북"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <h3 className="text-lg font-black">📖 부루마블 룰북</h3>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="tap grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg text-white/80"
        >
          ✕
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <ol className="space-y-3">
          {RULEBOOK_SECTIONS.map((s, i) => (
            <li
              key={s.title}
              className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{s.icon}</span>
                <h4 className="text-[15px] font-extrabold text-white">
                  <span className="text-white/40">{i + 1}. </span>
                  {s.title}
                </h4>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{s.body}</p>
            </li>
          ))}
        </ol>
        <button
          onClick={onClose}
          className="tap mt-5 w-full rounded-2xl bg-white/15 py-3.5 text-sm font-bold text-white"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function BoardGame({
  coupleId,
  myUserId,
  myName,
  partnerName,
  points,
  onClose,
}: {
  coupleId: string;
  myUserId: string | null;
  myName: string;
  partnerName: string;
  points: number; // 게임 포인트(말 스킨 구매용)
  onClose: () => void;
}) {
  const [row, setRow] = useState<BoardGameRow | null>(null);
  const [record, setRecord] = useState({ wins: 0, losses: 0, draws: 0 }); // 부루마블 총 전적
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildTarget, setBuildTarget] = useState<number | null>(null); // 건설 확인 시트 대상 칸
  const [rolling, setRolling] = useState(false);
  const [rollFace, setRollFace] = useState<[number, number]>([1, 1]);
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onlineRef = useRef<string[]>([]); // 최신 접속목록(커밋 클로저 stale 방지)
  // 말 이동 애니메이션(한 칸씩) — 표시용 위치는 실제 상태 위치를 뒤따라간다.
  const [animPos, setAnimPos] = useState<[number, number]>([0, 0]);
  const [moving, setMoving] = useState(false);
  const animRef = useRef<[number, number]>([0, 0]);
  const initedRef = useRef(false);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 말 스킨
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [rulebook, setRulebook] = useState(false); // 룰북(자세한 규칙) 오버레이
  // 이벤트 배너 + 현금 플로팅
  const [flash, setFlash] = useState<{ text: string; id: number } | null>(null);
  const [cashFx, setCashFx] = useState<{ idx: number; amt: number; id: number }[]>([]);
  const fxSeq = useRef(0);
  const prevLogRef = useRef<string | null>(null);
  const prevCashRef = useRef<[number, number] | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const s: BGState | null = row?.state ?? null;
  const myIdx = row && myUserId ? row.players.indexOf(myUserId) : -1;
  const myTurn = !!row && row.status === "playing" && row.turn_user === myUserId;
  const partnerUid = row?.players.find((u) => u !== myUserId) ?? null;
  const partnerOnline = !!partnerUid && online.includes(partnerUid);
  const spaceMode = myTurn && s?.pending?.kind === "space";
  const myTokenEmoji = profile?.token ?? DEFAULT_TOKEN;

  // 로드 + 실시간 구독 + presence
  useEffect(() => {
    if (!coupleId) return;
    let cancelled = false;
    const load = () =>
      Promise.all([
        getBoardGame(coupleId),
        getBoardResults(coupleId).catch(() => []),
      ])
        .then(([r, results]) => {
          if (cancelled) return;
          setRow(r);
          setRecord(boardRecord(results, myUserId)); // 판 끝나면(구독 재로드) 전적도 갱신
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    load();
    const u1 = subscribeBoardGame(coupleId, load);
    const u2 = myUserId ? subscribeBoardPresence(coupleId, myUserId, setOnline) : () => {};
    return () => {
      cancelled = true;
      u1();
      u2();
    };
  }, [coupleId, myUserId]);

  useEffect(() => () => {
    if (rollTimer.current) clearInterval(rollTimer.current);
    if (moveTimer.current) clearTimeout(moveTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // 접속목록을 ref 에도 미러 → 커밋 완료(비동기) 시점의 최신 값으로 푸시 판단
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  // 내 차례·건설(act)이 아니게 되면 건설모드 자동 해제(잔존 하이라이트 방지)
  useEffect(() => {
    if (!myTurn || s?.phase !== "act") setBuilding(false);
  }, [myTurn, s?.phase]);

  // 내 프로필(말 스킨) 로드
  useEffect(() => {
    getGameProfile()
      .then((p) => p && setProfile(p))
      .catch(() => {});
  }, []);

  // 판이 바뀌면 이동 애니·이벤트 기준 초기화 + 양쪽 말 로드
  useEffect(() => {
    initedRef.current = false;
    prevLogRef.current = null;
    prevCashRef.current = null;
    if (row) getPlayerTokens(row.players).then(setTokens).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  // 이벤트 배너 — 최신 로그가 바뀌면 큰 배너로 잠깐 강조(첫 관측은 스킵)
  useEffect(() => {
    const msg = s?.log?.[0];
    if (!msg) return;
    if (prevLogRef.current === null) {
      prevLogRef.current = msg;
      return;
    }
    if (msg === prevLogRef.current) return;
    prevLogRef.current = msg;
    fxSeq.current += 1;
    setFlash({ text: msg, id: fxSeq.current });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.log?.[0]]);

  // 현금 증감 플로팅(+₩/−₩) — 첫 관측은 스킵
  useEffect(() => {
    if (!s) return;
    const cash: [number, number] = [s.players[0].cash, s.players[1].cash];
    const prev = prevCashRef.current;
    prevCashRef.current = cash;
    if (!prev) return;
    const adds: { idx: number; amt: number; id: number }[] = [];
    for (let i = 0; i < 2; i += 1) {
      const d = cash[i] - prev[i];
      if (d !== 0) {
        fxSeq.current += 1;
        adds.push({ idx: i, amt: d, id: fxSeq.current });
      }
    }
    if (adds.length) {
      setCashFx((c) => [...c, ...adds]);
      const ids = adds.map((a) => a.id);
      setTimeout(() => setCashFx((c) => c.filter((x) => !ids.includes(x.id))), 1300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.players?.[0]?.cash, s?.players?.[1]?.cash]);

  // 말 이동 애니메이션 — 실제 위치가 바뀌면 표시 위치를 한 칸씩 따라간다(더블/텔레포트는 스냅).
  useEffect(() => {
    if (!s) return;
    const targets: [number, number] = [s.players[0].pos, s.players[1].pos];
    if (!initedRef.current) {
      initedRef.current = true;
      animRef.current = targets;
      setAnimPos(targets);
      return;
    }
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const cur = animRef.current;
      const next: [number, number] = [cur[0], cur[1]];
      for (let i = 0; i < 2; i += 1) {
        if (next[i] !== targets[i]) {
          const dist = (targets[i] - next[i] + BG_TILES) % BG_TILES;
          next[i] = dist > 12 ? targets[i] : (next[i] + 1) % BG_TILES; // 텔레포트는 즉시
        }
      }
      animRef.current = next;
      setAnimPos(next);
      if (next[0] !== targets[0] || next[1] !== targets[1]) {
        setMoving(true);
        moveTimer.current = setTimeout(step, 150);
      } else {
        setMoving(false);
      }
    };
    if (animRef.current[0] !== targets[0] || animRef.current[1] !== targets[1]) {
      setMoving(true);
      step();
    }
    return () => {
      cancelled = true;
      if (moveTimer.current) clearTimeout(moveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.players?.[0]?.pos, s?.players?.[1]?.pos]);

  // 상태 커밋(차례자·버전락). 성공 시 서버행 반영 + 상대 오프라인이면 '네 차례' 푸시.
  // 상태 커밋(차례자·버전락). React Compiler 가 메모이즈 — 수동 useCallback 불필요.
  const commit = async (next: BGState) => {
    if (!row || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await commitBoardAction(row.id, row.version, next);
      setRow(updated);
      // 턴이 상대에게 넘어갔고 상대가 오프라인이면 '네 차례' 푸시(ref=최신 접속목록)
      if (updated.turn_user !== myUserId && partnerUid && !onlineRef.current.includes(partnerUid)) {
        sendEventPush(
          coupleId,
          "game",
          "🎲 네 차례야!",
          "부루마블 — 상대가 수를 뒀어요. 얼른 이어서 둬요!",
        ).catch(() => {});
      }
    } catch (e) {
      const code = (e as { code?: string })?.code;
      // stale/차례 아님 → 서버 최신으로 재동기화(누른 수는 버림). 건설모드는 유지(엣지: 재시도).
      getBoardGame(coupleId)
        .then((r) => setRow(r))
        .catch(() => {});
      setErr(
        code === "40001"
          ? "동기화 중이었어요. 최신 상태로 맞췄으니 다시 시도해요."
          : (e as { message?: string })?.message ?? "오류가 났어요.",
      );
    } finally {
      setBusy(false);
    }
  };

  async function startGame() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const seed = newBoardSeed();
      const init = createBoardState(seed, [myName || "나", partnerName || "상대"]);
      const created = await createBoardGame(seed, init);
      setRow(created);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "시작 실패");
    } finally {
      setBusy(false);
    }
  }

  function doRoll() {
    if (!s || !myTurn || busy || rolling || moving) return;
    setRolling(true);
    if (rollTimer.current) clearInterval(rollTimer.current);
    rollTimer.current = setInterval(() => {
      setRollFace([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 80);
    moveTimer.current = setTimeout(() => {
      if (rollTimer.current) clearInterval(rollTimer.current);
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      setRollFace([d1, d2]);
      setRolling(false);
      let next = applyRoll(s, d1, d2);
      next = autoResolve(next, Math.random);
      commit(next);
    }, 560);
  }

  const act = (next: BGState) => commit(next);
  const doBuy = () => s && act(autoResolve(buyTile(s), Math.random));
  const doSkip = () => s && act(autoResolve(skipBuy(s), Math.random));
  const doEndTurn = () => s && act(endTurn(s));
  const doPayIsland = () => s && act(payIsland(s));
  const doBuild = (idx: number) => {
    setBuildTarget(null);
    if (s) act(buildUp(s, idx));
  };

  function onTileClick(idx: number) {
    if (!s || !myTurn || busy || moving) return;
    if (spaceMode) {
      if (idx !== s.players[myIdx].pos && BOARD[idx].type !== "space") {
        act(autoResolve(chooseSpace(s, idx), Math.random));
      }
      return;
    }
    if (building) {
      const cell = s.cells[idx];
      if (BOARD[idx].type === "city" && cell.owner === myIdx && cell.level < BG_MAX_LEVEL) {
        setBuildTarget(idx); // 건설 확인 시트 열기(집/별장/빌딩 단계 표시)
      }
    }
  }

  // ── 말 스킨 상점(포인트로 잠금 해제 · 커플 신뢰 모델이라 클라 계산) ──
  const spent = profile?.points_spent ?? 0;
  const owned = profile?.owned ?? ["🚗", "🐰"];
  const available = Math.max(0, points - spent);

  async function saveProfile(next: { token: string; owned: string[]; points_spent: number }) {
    setProfile({ user_id: myUserId ?? "", ...next });
    try {
      await upsertGameProfile(next);
      if (row) getPlayerTokens(row.players).then(setTokens).catch(() => {});
    } catch {
      /* noop */
    }
  }
  function pickToken(emoji: string, cost: number) {
    if (owned.includes(emoji)) {
      saveProfile({ token: emoji, owned, points_spent: spent }); // 선택만
      return;
    }
    if (available < cost) return; // 포인트 부족
    saveProfile({ token: emoji, owned: [...owned, emoji], points_spent: spent + cost });
  }

  async function doResign() {
    if (!row || myIdx < 0 || busy) return;
    if (
      !(await confirmDialog({
        message: "정말 항복할까요?",
        detail: "상대의 승리로 판이 끝나요.",
        confirmText: "항복",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      // 차례와 무관하게 항복 가능(전용 RPC — 상대 차례에도 포기 가능)
      const updated = await resignBoardGame(row.id);
      setRow(updated);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "오류가 났어요.");
    } finally {
      setBusy(false);
    }
  }

  async function doAbandon() {
    if (!row) {
      onClose();
      return;
    }
    if (
      !(await confirmDialog({
        message: "게임을 나갈까요?",
        detail: "진행 중이면 나중에 이어서 둘 수 있어요.",
        confirmText: "나가기",
      }))
    )
      return;
    onClose();
  }

  // ── 렌더 ─────────────────────────────────────────────────────
  const shell = (inner: ReactNode) => (
    <div
      className="fixed inset-0 z-[75] flex flex-col bg-[#0f0a12] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="부루마블"
    >
      {inner}
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex flex-1 items-center justify-center text-sm text-white/60">
        불러오는 중…
      </div>,
    );
  }

  // 진행중 게임이 없으면 시작 화면
  if (!row || (!s && row.status !== "playing")) {
    const totalGames = record.wins + record.losses + record.draws;
    const winRate = totalGames > 0 ? Math.round((record.wins / totalGames) * 100) : 0;
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="text-6xl">🌍</span>
        <h2 className="mt-4 text-2xl font-black">부루마블 · 세계여행</h2>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
          둘이 번갈아 주사위를 굴려 세계 도시를 사고 별장·빌딩·호텔을 올려요. 상대가 접속 안
          해도 괜찮아요 — 내 차례에 두면 상대에게 알림이 가요.
        </p>
        {/* 부루마블 전적 — 인트로에 항상 노출(첫 판 전엔 안내). 게임 탭 카드에도 동일 표시 */}
        <div className="mt-4 w-full max-w-xs rounded-2xl bg-white/[0.06] p-3.5 ring-1 ring-white/12">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white/55">🏆 부루마블 전적</span>
            {totalGames > 0 && (
              <span className="text-[11px] font-extrabold text-amber-300">승률 {winRate}%</span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center tabular-nums">
            <div>
              <p className="text-xl font-black text-emerald-300">{record.wins}</p>
              <p className="text-[10px] text-white/45">승</p>
            </div>
            <div>
              <p className="text-xl font-black text-rose-300">{record.losses}</p>
              <p className="text-[10px] text-white/45">패</p>
            </div>
            <div>
              <p className="text-xl font-black text-white/70">{record.draws}</p>
              <p className="text-[10px] text-white/45">무</p>
            </div>
          </div>
          {totalGames === 0 && (
            <p className="mt-2 text-center text-[10px] text-white/40">
              첫 대결을 시작하면 여기에 전적이 쌓여요
            </p>
          )}
        </div>
        <div className="mt-4 w-full max-w-xs space-y-1 rounded-2xl bg-white/[0.05] p-3.5 text-left text-[11px] leading-snug text-white/70 ring-1 ring-white/10">
          <p className="mb-1 text-[11px] font-extrabold text-white/90">📜 규칙 한눈에</p>
          <p>🎲 두 주사위 합만큼 이동 · <b className="text-white">더블</b>이면 한 번 더(3연속이면 무인도行)</p>
          <p>🏝️ <b className="text-white">무인도에 도착하면 갇혀요</b> — 더블을 내거나 벌금으로 탈출(최대 {BG_ISLAND_TURNS}턴)</p>
          <p>🏙️ 빈 도시 도착 → 매입. 같은 색을 <b className="text-white">독점</b>하면 통행료 ↑(땅 ×2·건물 ×1.5)</p>
          <p>🏨 내 도시 탭 → 별장→빌딩→호텔→<b className="text-white">🏰랜드마크</b> 건설(통행료 급등)</p>
          <p>💳 통행료 못 내면 내 건물·도시를 반값에 팔아 버텨요(다 팔아도 부족하면 파산)</p>
          <p>🧾 <b className="text-white">관광세</b>는 순자산의 10%(부자일수록 ↑) · 🎉 <b className="text-white">축제</b> 도착 시 둘 다 보너스</p>
          <p>💰 출발 월급 +{BG_SALARY}, <b className="text-white">바퀴가 늘수록 가속</b>(2바퀴 {salaryFor(2)}·3바퀴 {salaryFor(3)})</p>
          <p>🗝️ 황금열쇠 · 💝 기금 · 🚀 우주여행</p>
          <p className="!mt-1.5 border-t border-white/10 pt-1.5 text-white/85">
            🏆 <b className="text-white">승리 조건</b>: 상대를 <b className="text-white">파산</b>시키면 즉시 승! (또는 둘 다 {BG_MAX_LAPS}바퀴 완주 시 <b className="text-white">자산</b> 많은 쪽)
          </p>
        </div>
        <button
          onClick={() => setRulebook(true)}
          className="tap mt-3 flex w-full max-w-xs items-center justify-center gap-1.5 rounded-2xl bg-white/10 py-2.5 text-xs font-bold text-white/85 ring-1 ring-white/15"
        >
          📖 자세한 룰북 보기
        </button>
        <button
          onClick={startGame}
          disabled={busy}
          className="tap mt-7 rounded-2xl bg-white px-8 py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
        >
          {busy ? "만드는 중…" : "새 게임 시작 🎮"}
        </button>
        {err && <p className="mt-4 text-xs text-rose-300">{err}</p>}
        <button
          onClick={() => setShopOpen(true)}
          className="tap mt-6 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 ring-1 ring-white/15"
        >
          {myTokenEmoji} 내 말 바꾸기 (보유 {available}P)
        </button>
        <button onClick={onClose} className="tap mt-3 text-xs text-white/50 underline">
          닫기
        </button>
        {shopOpen && (
          <TokenShop
            owned={owned}
            selected={myTokenEmoji}
            available={available}
            onPick={pickToken}
            onClose={() => setShopOpen(false)}
          />
        )}
        {rulebook && <RuleBook onClose={() => setRulebook(false)} />}
      </div>,
    );
  }

  if (!s) return shell(<div className="flex-1" />);

  const tokenFor = (i: number) => (row && tokens[row.players[i]]) || DEFAULT_TOKEN;
  const me = myIdx >= 0 ? s.players[myIdx] : s.players[0];
  const oppIdx = myIdx === 0 ? 1 : 0;
  const opp = s.players[oppIdx];
  const pending = s.pending;
  const inJail = myIdx >= 0 && me.jail > 0;
  const canBuild = myTurn && !pending && upgradableTiles(s, myIdx).length > 0;
  const upgradeSet = building && myIdx >= 0 ? new Set(upgradableTiles(s, myIdx)) : new Set<number>();

  const playerBar = (idx: number, label: string, online?: boolean) => {
    const p = s.players[idx];
    const active = s.turn === idx && s.phase !== "over";
    const floats = cashFx.filter((f) => f.idx === idx);
    return (
      <div
        className={`relative flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors ${
          active ? "bg-white/15 ring-1 ring-white/40" : "bg-white/[0.06]"
        }`}
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm"
          style={{ background: "#0f0a12", boxShadow: `0 0 0 2px ${PLAYER_COLOR[idx]}` }}
        >
          {tokenFor(idx)}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-bold leading-none">
            <span className="truncate">{p.name || label}</span>
            {online !== undefined && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-white/25"}`}
                title={online ? "접속중" : "오프라인"}
              />
            )}
          </p>
          <p className="mt-0.5 text-xs font-extrabold tabular-nums leading-none text-white">
            {won(p.cash)}
          </p>
          <p className="mt-1 text-[9px] leading-none tabular-nums text-white/55">
            자산 {won(netWorth(s, idx))} · 🏙️{" "}
            {BOARD.filter((t) => t.type === "city" && s.cells[t.idx].owner === idx).length}
          </p>
        </div>
        {p.jail > 0 && <span className="ml-auto text-[10px]">🏝️</span>}
        {floats.map((f) => (
          <span
            key={f.id}
            className={`animate-bg-float pointer-events-none absolute right-3 top-1 text-xs font-extrabold ${
              f.amt > 0 ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {f.amt > 0 ? "+" : "−"}₩{Math.abs(f.amt).toLocaleString()}
          </span>
        ))}
      </div>
    );
  };

  return shell(
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pb-1 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        <span className="glass rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/15">
          🎲 부루마블 · {BG_MAX_LAPS}바퀴
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShopOpen(true)}
            className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15"
          >
            {myTokenEmoji} 말
          </button>
          {s.phase !== "over" && (
            <button
              onClick={doResign}
              className="tap rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/15"
            >
              항복
            </button>
          )}
          <button
            onClick={doAbandon}
            aria-label="닫기"
            className="tap grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      {/* 상대 바 */}
      <div className="px-3 pb-1">{playerBar(oppIdx, "상대", partnerOnline)}</div>

      {/* 보드 */}
      <div className="px-1">
        <div
          className="relative aspect-square w-full rounded-2xl p-1"
          style={{
            background:
              "radial-gradient(130% 100% at 50% -12%, rgba(124,74,222,0.24), rgba(192,53,106,0.13) 50%, rgba(10,7,14,0.55)), #15101c",
            boxShadow:
              "inset 0 0 0 1.5px rgba(255,255,255,0.07), inset 0 2px 22px rgba(0,0,0,0.5), 0 12px 34px -14px rgba(124,74,222,0.55)",
          }}
        >
        <div
          className="absolute inset-1 grid gap-0.5"
          style={{ gridTemplateColumns: "repeat(8,1fr)", gridTemplateRows: "repeat(8,1fr)" }}
        >
          {BOARD.map((t) => (
            <TileView
              key={t.idx}
              idx={t.idx}
              cell={s.cells[t.idx]}
              highlight={
                (spaceMode && t.idx !== me.pos && t.type !== "space") || upgradeSet.has(t.idx)
              }
              onClick={() => onTileClick(t.idx)}
            />
          ))}
          {/* 중앙 패널 */}
          <div
            style={{
              gridColumn: "2 / 8",
              gridRow: "2 / 8",
              background:
                "radial-gradient(85% 85% at 50% 38%, rgba(124,74,222,0.2), rgba(0,0,0,0.34) 72%)",
              boxShadow: "inset 0 0 26px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 text-center"
          >
            {s.phase === "over" ? (
              <>
                <span className="text-4xl">{s.winner === myIdx ? "🏆" : s.winner === null ? "🤝" : "🥲"}</span>
                <p className="text-sm font-black">
                  {s.winner === null
                    ? "무승부!"
                    : `${s.players[s.winner].name} 승리!`}
                </p>
                <p className="text-[10px] font-semibold text-white/55">
                  {s.over === "bankrupt"
                    ? "상대 파산 💥"
                    : s.over === "laps"
                      ? `${BG_MAX_LAPS}바퀴 완주 · 자산 승부 📊`
                      : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-white/60">
                  {myTurn ? "내 차례" : `${opp.name} 차례`}
                </p>
                <div className="flex items-center gap-2 leading-none">
                  <Die face={rolling ? rollFace[0] : s.dice?.[0] ?? 1} rolling={rolling} />
                  <Die face={rolling ? rollFace[1] : s.dice?.[1] ?? 1} rolling={rolling} />
                </div>
                {s.dice && !rolling && (
                  <p className="text-[10px] text-white/50">
                    {s.dice[0]} + {s.dice[1]} = {s.dice[0] + s.dice[1]}
                    {s.dice[0] === s.dice[1] ? " · 더블!" : ""}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-white/70">
                  {s.log[0]}
                </p>
              </>
            )}
          </div>
        </div>

          {/* 말 오버레이 — 칸 사이를 한 칸씩 부드럽게 이동(통통) */}
          <div className="pointer-events-none absolute inset-1">
            {s.players.map((p, i) => {
              if (p.bankrupt) return null;
              const rc = tileRC(animPos[i]);
              const leftPct = ((rc.c - 0.5) / 8) * 100 + (i === 0 ? -1.7 : 1.7);
              const topPct = ((rc.r - 0.5) / 8) * 100;
              const hopping = animPos[i] !== p.pos;
              return (
                <div
                  key={i}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-150 ease-linear"
                >
                  <div
                    className={`grid h-7 w-7 place-items-center rounded-full text-base ${
                      hopping ? "animate-bg-hop" : ""
                    }`}
                    style={{
                      background:
                        "radial-gradient(72% 72% at 34% 26%, #2c2536, #0f0a12 72%)",
                      boxShadow: `0 0 0 2.5px ${PLAYER_COLOR[i]}, inset 0 1px 1px rgba(255,255,255,0.18), 0 4px 9px rgba(0,0,0,0.55)`,
                    }}
                  >
                    <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}>
                      {tokenFor(i)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 이벤트 배너 — 최신 사건을 크게 잠깐 강조 */}
          {flash && (
            <div
              key={flash.id}
              className="pointer-events-none absolute inset-x-2 top-[42%] z-30 flex justify-center"
            >
              <span className="animate-bg-event max-w-full rounded-2xl bg-black/75 px-4 py-2 text-center text-sm font-extrabold text-white shadow-[var(--shadow-lg)] ring-1 ring-white/20 backdrop-blur">
                {flash.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 내 바 */}
      <div className="px-3 pt-1">{playerBar(myIdx >= 0 ? myIdx : 0, "나")}</div>

      {err && <p className="px-4 pt-1 text-center text-[11px] text-rose-300">{err}</p>}

      {/* 액션 영역 */}
      <div className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
        {s.phase === "over" ? (
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="tap rounded-xl bg-white/15 px-4 py-3 text-sm font-bold"
            >
              닫기
            </button>
            <button
              onClick={startGame}
              disabled={busy}
              className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink disabled:opacity-50"
            >
              새 게임 🎮
            </button>
          </div>
        ) : !myTurn ? (
          <p className="py-3 text-center text-sm text-white/60">
            {opp.name} 차례예요 {partnerOnline ? "· 두는 중… 🎲" : "· 알림을 기다려요"}
          </p>
        ) : moving ? (
          <p className="py-3 text-center text-sm font-bold text-white/80">말 이동 중… 🎲</p>
        ) : spaceMode ? (
          <p className="animate-pulse py-3 text-center text-sm font-bold text-white">
            🚀 이동할 곳을 골라 탭하세요
          </p>
        ) : pending?.kind === "buy" ? (
          <div className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/15">
            <p className="text-center text-sm font-bold">
              {BOARD[pending.tile].emoji} {BOARD[pending.tile].name} 살까요?
            </p>
            <p className="mt-0.5 text-center text-[11px] text-white/60">
              매입가 {won(BOARD[pending.tile].price ?? 0)} · 통행료 최대{" "}
              {won((BOARD[pending.tile].tolls ?? [0])[BG_MAX_LEVEL])}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={doSkip}
                disabled={busy}
                className="tap flex-1 rounded-xl bg-white/15 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                안 사기
              </button>
              <button
                onClick={doBuy}
                disabled={busy || me.cash < (BOARD[pending.tile].price ?? 0)}
                className="tap flex-1 rounded-xl bg-white py-2.5 text-sm font-extrabold text-ink disabled:opacity-40"
              >
                사기 🏠
              </button>
            </div>
          </div>
        ) : s.phase === "roll" ? (
          <div className="flex gap-2">
            {inJail && me.cash >= BG_ISLAND_FEE && (
              <button
                onClick={doPayIsland}
                disabled={busy}
                className="tap rounded-xl bg-white/15 px-4 py-3.5 text-sm font-bold disabled:opacity-50"
              >
                벌금 {won(BG_ISLAND_FEE)} 내고 탈출
              </button>
            )}
            <button
              onClick={doRoll}
              disabled={busy || rolling}
              className="tap flex-1 rounded-xl bg-white py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {rolling ? "굴리는 중…" : inJail ? "주사위 (더블 노리기) 🎲" : "주사위 굴리기 🎲"}
            </button>
          </div>
        ) : building ? (
          <button
            onClick={() => setBuilding(false)}
            className="tap w-full rounded-xl bg-white py-3.5 text-sm font-extrabold text-ink"
          >
            건설 완료 · 탭해서 마침
          </button>
        ) : (
          <div className="flex gap-2">
            {canBuild && (
              <button
                onClick={() => setBuilding(true)}
                disabled={busy}
                className="tap rounded-xl bg-white/15 px-4 py-3.5 text-sm font-bold disabled:opacity-50"
              >
                🏗️ 건설
              </button>
            )}
            <button
              onClick={doEndTurn}
              disabled={busy}
              className="tap flex-1 rounded-xl bg-white py-3.5 text-sm font-extrabold text-ink shadow-[var(--shadow-md)] disabled:opacity-50"
            >
              {s.rolledDoubles ? "더블! 한 번 더 🎲" : "턴 종료 →"}
            </button>
          </div>
        )}
        {/* 자산 힌트 */}
        {s.phase !== "over" && myIdx >= 0 && (
          <p className="mt-2 text-center text-[10px] text-white/40">
            내 자산 {won(netWorth(s, myIdx))} · {me.laps}/{BG_MAX_LAPS}바퀴
            {building ? " · 올릴 내 도시를 탭하세요" : ""}
          </p>
        )}
      </div>

      {/* 건설 확인 시트 — 집/별장/빌딩 단계 */}
      {buildTarget !== null && BOARD[buildTarget].type === "city" && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
          onClick={() => setBuildTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="건설"
            className="animate-sheet w-full max-w-md rounded-t-2xl bg-[#1a121f] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <p className="text-center text-sm font-bold text-white">
              {BOARD[buildTarget].emoji} {BOARD[buildTarget].name} 건설
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              {[1, 2, 3].map((lv) => {
                const cur = s.cells[buildTarget].level;
                const next = cur + 1;
                return (
                  <div
                    key={lv}
                    className={`flex w-16 flex-col items-center gap-0.5 rounded-xl px-1 py-2 ring-1 ${
                      lv === next
                        ? "bg-white/15 ring-white/60"
                        : lv <= cur
                          ? "bg-emerald-500/15 ring-emerald-400/40"
                          : "bg-white/[0.05] ring-white/10"
                    }`}
                  >
                    <span className="text-lg leading-none">{LEVEL_EMOJI[lv]}</span>
                    <span className="text-[10px] text-white/70">{LEVEL_NAMES[lv]}</span>
                    <span className="text-[9px] text-white/45">
                      통행료 {won((BOARD[buildTarget].tolls ?? [])[lv] ?? 0)}
                    </span>
                    {lv <= cur && <span className="text-[9px] text-emerald-300">완료</span>}
                  </div>
                );
              })}
            </div>
            {(() => {
              const next = s.cells[buildTarget].level + 1;
              const cost = BOARD[buildTarget].buildCost ?? 0;
              const afford = me.cash >= cost;
              return (
                <>
                  <p className="mt-3 text-center text-xs text-white/60">
                    다음: <b className="text-white">{LEVEL_NAMES[next]}</b> · 비용 {won(cost)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setBuildTarget(null)}
                      className="tap flex-1 rounded-xl bg-white/15 py-3 text-sm font-bold text-white"
                    >
                      취소
                    </button>
                    <button
                      disabled={!afford || busy}
                      onClick={() => doBuild(buildTarget)}
                      className="tap flex-1 rounded-xl bg-white py-3 text-sm font-extrabold text-ink disabled:opacity-40"
                    >
                      {LEVEL_NAMES[next]} 짓기 🏗️
                    </button>
                  </div>
                  {!afford && (
                    <p className="mt-2 text-center text-[11px] text-rose-300">현금이 부족해요</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 말 상점 */}
      {shopOpen && (
        <TokenShop
          owned={owned}
          selected={myTokenEmoji}
          available={available}
          onPick={pickToken}
          onClose={() => setShopOpen(false)}
        />
      )}

      {/* 승리 꽃가루 */}
      {s.phase === "over" && s.winner === myIdx && (
        <div className="pointer-events-none fixed inset-0 z-[78] overflow-hidden">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="animate-bg-confetti absolute top-0"
              style={{
                left: `${c.left}%`,
                fontSize: `${c.size}px`,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.delay}s`,
              }}
            >
              {c.emoji}
            </span>
          ))}
        </div>
      )}
    </>,
  );
}
