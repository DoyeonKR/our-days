// 부루마블(실시간 커플 보드게임) 순수 룰 엔진 + 보드 데이터.
// ⚠ 순수 함수만: 모든 함수는 상태를 받아 '새 상태'를 반환(입력 불변). 주사위/카드 랜덤은
//   호출부(UI)가 뽑아 인자로 넘긴다 → 결정적이라 유닛테스트 가능, 서버 JSONB 상태와 정합.
// 정통 룰: 도시 매입·별장/빌딩/호텔(3단계) 건설·통행료(그룹 독점 시 land 통행료 ×2)·
//   황금열쇠(찬스)·무인도(감옥)·우주여행(임의 이동)·사회복지기금·세금·더블(한번 더, 3연속=감옥).

export type TileType =
  | "start"
  | "city"
  | "chance"
  | "tax"
  | "island"
  | "space"
  | "fund";

export type BoardTile = {
  idx: number;
  type: TileType;
  name: string;
  emoji: string;
  group?: string; // 도시 색 그룹(독점 판정)
  price?: number; // 매입가(땅)
  tolls?: number[]; // [땅,별장,빌딩,호텔] 레벨별 통행료
  buildCost?: number; // 건물 1단계 비용(단계마다 동일)
};

/** 새 판 seed(32-bit 양수). 비순수 — 모듈 스코프라 react-hooks/purity 규칙 제외. */
export function newBoardSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export const BG_START_CASH = 2000;
export const BG_SALARY = 300; // 출발 통과/도착 시 월급
export const BG_TAX = 200; // 세금칸
export const BG_ISLAND_FEE = 200; // 무인도 탈출 비용
export const BG_MAX_LEVEL = 4; // 0=땅,1=별장,2=빌딩,3=호텔,4=랜드마크(최상급)
/** 건물 단계 이름/아이콘 — index=level(0=땅=건물없음). 단계 오를수록 통행료 급등, 4=랜드마크. */
export const LEVEL_NAMES = ["땅", "별장", "빌딩", "호텔", "랜드마크"];
export const LEVEL_EMOJI = ["", "🏡", "🏢", "🏨", "🏰"];
export const BG_MAX_LAPS = 4; // 이 바퀴 수를 둘 다 채우면 자산 비교로 종료
export const BG_ISLAND_IDX = 7;
export const BG_START_IDX = 0;

// 그룹별 가격/통행료/건설비 (A 저렴 → H 고가). tolls=[땅,별장,빌딩,호텔,랜드마크] 5단계.
const G = {
  A: { price: 100, tolls: [10, 40, 100, 200, 460], buildCost: 60 },
  B: { price: 150, tolls: [15, 60, 150, 300, 700], buildCost: 90 },
  C: { price: 220, tolls: [22, 90, 220, 440, 1000], buildCost: 130 },
  D: { price: 300, tolls: [30, 120, 300, 600, 1400], buildCost: 180 },
  E: { price: 380, tolls: [40, 150, 380, 760, 1750], buildCost: 220 },
  F: { price: 450, tolls: [45, 180, 450, 900, 2100], buildCost: 260 },
  H: { price: 550, tolls: [55, 220, 550, 1100, 2600], buildCost: 320 },
} as const;

const city = (idx: number, name: string, emoji: string, g: keyof typeof G): BoardTile => ({
  idx,
  type: "city",
  name,
  emoji,
  group: g,
  price: G[g].price,
  tolls: [...G[g].tolls],
  buildCost: G[g].buildCost,
});

/** 28칸 링(모서리 0/7/14/21). 세계여행 테마 — 도시 19(나라 국기+도시명, A 저렴→H 프리미엄)
 *  + 황금열쇠 4 + 여행세 1 + 모서리 4(출발/무인도/우주여행/사회복지기금). 국기=나라, 이름=도시.
 *  ⚠ 실제 지명(사실)일 뿐 특정 보드게임 보드 복제 아님 — 가격/배치는 자체 구성. */
export const BOARD: BoardTile[] = [
  { idx: 0, type: "start", name: "출발", emoji: "✈️" },
  city(1, "방콕", "🇹🇭", "A"), // 태국
  { idx: 2, type: "chance", name: "황금열쇠", emoji: "🗝️" },
  city(3, "하노이", "🇻🇳", "A"), // 베트남
  city(4, "마닐라", "🇵🇭", "B"), // 필리핀
  city(5, "자카르타", "🇮🇩", "B"), // 인도네시아
  city(6, "타이베이", "🇹🇼", "B"), // 대만
  { idx: 7, type: "island", name: "무인도", emoji: "🏝️" },
  city(8, "뉴델리", "🇮🇳", "C"), // 인도
  { idx: 9, type: "chance", name: "황금열쇠", emoji: "🗝️" },
  city(10, "이스탄불", "🇹🇷", "C"), // 튀르키예
  city(11, "카이로", "🇪🇬", "C"), // 이집트
  { idx: 12, type: "tax", name: "여행세", emoji: "🧾" },
  city(13, "두바이", "🇦🇪", "D"), // 아랍에미리트
  { idx: 14, type: "space", name: "우주여행", emoji: "🚀" },
  city(15, "싱가포르", "🇸🇬", "D"), // 싱가포르
  city(16, "홍콩", "🇭🇰", "D"), // 홍콩
  { idx: 17, type: "chance", name: "황금열쇠", emoji: "🗝️" },
  city(18, "시드니", "🇦🇺", "E"), // 호주
  city(19, "베이징", "🇨🇳", "E"), // 중국
  city(20, "도쿄", "🇯🇵", "F"), // 일본
  { idx: 21, type: "fund", name: "사회복지기금", emoji: "💝" },
  city(22, "베를린", "🇩🇪", "F"), // 독일
  city(23, "로마", "🇮🇹", "H"), // 이탈리아
  { idx: 24, type: "chance", name: "황금열쇠", emoji: "🗝️" },
  city(25, "런던", "🇬🇧", "H"), // 영국
  city(26, "뉴욕", "🇺🇸", "H"), // 미국
  city(27, "파리", "🇫🇷", "H"), // 프랑스
];

export const BG_TILES = BOARD.length; // 28

export type BGPlayer = {
  name: string;
  cash: number;
  pos: number;
  jail: number; // 무인도 남은 턴(0=자유)
  laps: number; // 출발 통과 횟수
  bankrupt: boolean;
};

export type BGCell = { owner: number | null; level: number };

export type BGPending =
  | { kind: "buy"; tile: number }
  | { kind: "toll"; tile: number; amount: number; to: number }
  | { kind: "tax"; amount: number }
  | { kind: "chance"; card: number }
  | { kind: "space" } // 우주여행: 목적지 선택
  | { kind: "fund"; amount: number } // 사회복지기금 수령
  | null;

export type BGState = {
  v: number; // 낙관적 락 버전
  seed: number;
  players: BGPlayer[]; // [0,1]
  cells: BGCell[]; // BOARD 와 병렬
  turn: number; // 0|1
  phase: "roll" | "act" | "over";
  dice: [number, number] | null;
  doubles: number; // 이번 턴 연속 더블 수
  rolledDoubles: boolean; // 직전 굴림이 더블(턴 유지 판단)
  fund: number; // 사회복지기금 누적
  pending: BGPending;
  winner: number | null; // 0|1|null(무 or 진행중)
  over: "bankrupt" | "laps" | null;
  log: string[]; // 최근 이벤트(최신이 앞)
};

// ── 황금열쇠 카드 ───────────────────────────────────────────────
export type ChanceCard = { text: string; emoji: string };
export const CHANCE_CARDS: ChanceCard[] = [
  { text: "월급 보너스! 은행에서 200을 받아요", emoji: "💰" }, // 0
  { text: "데이트 과소비… 150을 기금에 내요", emoji: "💸" }, // 1
  { text: "출발로 순간이동 (월급 받기)", emoji: "🚩" }, // 2
  { text: "무인도에 표류… 무인도로 이동", emoji: "🏝️" }, // 3
  { text: "우주여행 당첨! 원하는 곳으로", emoji: "🚀" }, // 4
  { text: "상대에게 선물 100을 건네요", emoji: "🎁" }, // 5
  { text: "상대가 나에게 100을 줘요", emoji: "💝" }, // 6
  { text: "택시 타고 세 칸 앞으로", emoji: "🚕" }, // 7
  { text: "사회복지기금을 몽땅 받아요", emoji: "🏆" }, // 8
  { text: "생일 축하! 상대가 150을 줘요", emoji: "🎂" }, // 9
  { text: "복권 당첨! 은행에서 400을 받아요", emoji: "🎫" }, // 10
  { text: "무료 건설! 내 가장 싼 도시가 한 단계 올라가요", emoji: "🏗️" }, // 11
  { text: "환전 손해… 200을 기금에 내요", emoji: "💱" }, // 12
  { text: "공항으로! 여섯 칸 앞으로 이동", emoji: "🛫" }, // 13
  { text: "기념일 선물, 상대가 200을 줘요", emoji: "🎁" }, // 14
  { text: "여행 경비… 상대에게 150을 건네요", emoji: "🧳" }, // 15
];
export const CHANCE_COUNT = CHANCE_CARDS.length;

// ── 헬퍼 ────────────────────────────────────────────────────────
const clone = (s: BGState): BGState => ({
  ...s,
  players: s.players.map((p) => ({ ...p })),
  cells: s.cells.map((c) => ({ ...c })),
  log: [...s.log],
});

const other = (i: number) => (i === 0 ? 1 : 0);

function pushLog(s: BGState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 30);
}

/** 그룹 독점 여부(그 그룹의 모든 도시를 owner 가 소유). */
export function ownsGroup(cells: BGCell[], owner: number, group: string): boolean {
  const idxs = BOARD.filter((t) => t.group === group).map((t) => t.idx);
  return idxs.length > 0 && idxs.every((i) => cells[i].owner === owner);
}

/** 도시 통행료 — 레벨별, 그룹 독점이면 땅(레벨0) 통행료 ×2. */
export function tollOf(cells: BGCell[], tileIdx: number): number {
  const t = BOARD[tileIdx];
  const cell = cells[tileIdx];
  if (t.type !== "city" || cell.owner === null || !t.tolls) return 0;
  const base = t.tolls[Math.min(cell.level, t.tolls.length - 1)];
  if (cell.level === 0 && t.group && ownsGroup(cells, cell.owner, t.group)) return base * 2;
  return base;
}

/** 총 자산 = 현금 + 소유 도시(가격 + 레벨×건설비). */
export function netWorth(s: BGState, idx: number): number {
  let w = s.players[idx].cash;
  for (const t of BOARD) {
    const c = s.cells[t.idx];
    if (t.type === "city" && c.owner === idx) {
      w += (t.price ?? 0) + c.level * (t.buildCost ?? 0);
    }
  }
  return w;
}

/** 소유 도시 중 아직 최고 레벨이 아닌 것(건설 가능 후보). */
export function upgradableTiles(s: BGState, idx: number): number[] {
  return BOARD.filter(
    (t) => t.type === "city" && s.cells[t.idx].owner === idx && s.cells[t.idx].level < BG_MAX_LEVEL,
  ).map((t) => t.idx);
}

// ── 생성 ────────────────────────────────────────────────────────
export function createBoardState(seed: number, names: [string, string]): BGState {
  return {
    v: 1,
    seed,
    players: [0, 1].map((i) => ({
      name: names[i] || (i === 0 ? "나" : "상대"),
      cash: BG_START_CASH,
      pos: 0,
      jail: 0,
      laps: 0,
      bankrupt: false,
    })),
    cells: BOARD.map(() => ({ owner: null, level: 0 })),
    turn: 0,
    phase: "roll",
    dice: null,
    doubles: 0,
    rolledDoubles: false,
    fund: 0,
    pending: null,
    winner: null,
    over: null,
    log: ["게임 시작! 주사위를 굴려보세요 🎲"],
  };
}

// ── 내부: 자산 매각(파산 회피) ──────────────────────────────────
/** payer 가 need 만큼 현금이 부족하면 자산을 반값에 자동 매각해 메운다(건물 먼저 최상급부터,
 *  그다음 도시 싼 것부터). 다 팔아도 부족하면 그대로 두고 호출부가 파산 처리. 매각은 로그로 알림.
 *  → 통행료 한 방에 즉시 파산하던 것을, 팔 수 있으면 버티게 해 급작스런 종료를 막는다. */
function liquidate(s: BGState, payer: number, need: number): void {
  const p = s.players[payer];
  let guard = 0;
  while (p.cash < need && guard++ < 200) {
    // 1) 건물 있으면 최상급 건물부터 반값 매각(도시 소유는 유지)
    let bIdx = -1;
    let bLevel = 0;
    for (const t of BOARD) {
      const c = s.cells[t.idx];
      if (t.type === "city" && c.owner === payer && c.level > bLevel) {
        bIdx = t.idx;
        bLevel = c.level;
      }
    }
    if (bIdx >= 0) {
      const t = BOARD[bIdx];
      const refund = Math.floor((t.buildCost ?? 0) / 2);
      const soldName = LEVEL_NAMES[s.cells[bIdx].level];
      s.cells[bIdx].level -= 1;
      p.cash += refund;
      pushLog(s, `${p.name} ${t.name} ${soldName} 매각 +${refund} 💸`);
      continue;
    }
    // 2) 건물 없으면 도시(땅) 반값 매각 — 싼 것부터
    let cIdx = -1;
    let cPrice = Infinity;
    for (const t of BOARD) {
      const c = s.cells[t.idx];
      if (t.type === "city" && c.owner === payer && (t.price ?? 0) < cPrice) {
        cIdx = t.idx;
        cPrice = t.price ?? 0;
      }
    }
    if (cIdx >= 0) {
      const t = BOARD[cIdx];
      const refund = Math.floor((t.price ?? 0) / 2);
      s.cells[cIdx] = { owner: null, level: 0 };
      p.cash += refund;
      pushLog(s, `${p.name} ${t.name} 매각 +${refund} 💸`);
      continue;
    }
    break; // 팔 게 없음
  }
}

// ── 내부: 지불/파산 ─────────────────────────────────────────────
// payer 가 amount 를 낸다. to=상대idx(통행료) | "fund"(세금) | "bank"(사라짐).
// 현금 부족이면 자산 매각으로 버티고, 다 팔아도 부족하면 파산 → 상대 승리, 게임 종료.
function charge(
  s: BGState,
  payer: number,
  amount: number,
  to: number | "fund" | "bank",
): void {
  const p = s.players[payer];
  if (amount <= 0) return;
  if (p.cash < amount) liquidate(s, payer, amount); // 부족하면 자산 매각으로 메우기
  if (p.cash >= amount) {
    p.cash -= amount;
    if (to === "fund") s.fund += amount;
    else if (typeof to === "number") s.players[to].cash += amount;
    return;
  }
  // 다 팔아도 부족 → 파산: 남은 현금을 채권자에게 넘기고 종료
  const remain = p.cash;
  p.cash = 0;
  if (to === "fund") s.fund += remain;
  else if (typeof to === "number") s.players[to].cash += remain;
  p.bankrupt = true;
  s.winner = other(payer);
  s.over = "bankrupt";
  s.phase = "over";
  pushLog(s, `${p.name} 파산 😵 — ${s.players[other(payer)].name} 승리!`);
}

/** 현재 위치 타일에 따른 pending 산출(이동 직후 호출). 파산/종료면 그대로. */
function settleLanding(s: BGState): void {
  if (s.phase === "over") return;
  const me = s.turn;
  const pos = s.players[me].pos;
  const t = BOARD[pos];
  const cell = s.cells[pos];

  if (t.type === "city") {
    if (cell.owner === null) {
      // 살 수 있으면 buy pending, 돈 없으면 그냥 통과
      if (s.players[me].cash >= (t.price ?? 0)) s.pending = { kind: "buy", tile: pos };
      else {
        s.pending = null;
        pushLog(s, `${t.name} — 살 돈이 부족해요`);
      }
    } else if (cell.owner === me) {
      s.pending = null; // 내 땅
    } else {
      const amount = tollOf(s.cells, pos);
      s.pending = { kind: "toll", tile: pos, amount, to: cell.owner };
      pushLog(s, `${t.name} 통행료 ${amount} — ${s.players[cell.owner].name}에게`);
    }
  } else if (t.type === "tax") {
    s.pending = { kind: "tax", amount: BG_TAX };
  } else if (t.type === "chance") {
    s.pending = { kind: "chance", card: -1 }; // 카드번호는 draw 시 결정
  } else if (t.type === "space") {
    s.pending = { kind: "space" };
    pushLog(s, "우주여행 🚀 — 목적지를 골라요");
  } else if (t.type === "fund") {
    const amount = s.fund;
    s.pending = { kind: "fund", amount };
    if (amount > 0) pushLog(s, `사회복지기금 ${amount} 도착 💝`);
  } else {
    s.pending = null; // start
  }
}

/** 지정 목적지로 순간이동. 전진하며 출발을 지나치거나(인덱스 감소) 출발에 도착하면 월급 1회. */
function moveTo(s: BGState, dest: number, allowSalary = true): void {
  const me = s.players[s.turn];
  if (dest === me.pos) return;
  const wrapped = dest < me.pos; // 앞으로 가다 출발을 지나침
  me.pos = dest;
  if (allowSalary && (wrapped || dest === BG_START_IDX)) {
    me.laps += 1;
    me.cash += BG_SALARY;
    pushLog(s, `${me.name} 출발 +${BG_SALARY} 💵`);
  }
}

// ── 액션: 주사위 ────────────────────────────────────────────────
/** 주사위 굴림(d1,d2 는 UI 가 1~6 랜덤으로 넘김). 무인도/더블/이동/착지 처리. */
export function applyRoll(s0: BGState, d1: number, d2: number): BGState {
  const s = clone(s0);
  if (s.phase !== "roll" || s.winner !== null) return s0;
  const me = s.turn;
  const p = s.players[me];
  const isDouble = d1 === d2;
  s.dice = [d1, d2];

  // 무인도: 더블 나오면 탈출+이동, 아니면 한 턴 소비
  if (p.jail > 0) {
    if (isDouble) {
      p.jail = 0;
      pushLog(s, `${p.name} 더블! 무인도 탈출 🏝️→`);
      s.rolledDoubles = false; // 탈출 턴엔 추가 턴 없음
      advance(s, d1 + d2);
      settleLanding(s);
      s.phase = "act";
    } else {
      p.jail -= 1;
      pushLog(s, `${p.name} 무인도… (${p.jail}턴 남음)`);
      s.dice = [d1, d2];
      s.pending = null;
      s.phase = "act"; // 바로 endTurn 만 가능
      s.rolledDoubles = false;
      s.doubles = 0; // 무인도 진입 시 쌓인 연속더블 카운터 초기화(잔존 방지)
    }
    return s;
  }

  // 3연속 더블 → 무인도
  if (isDouble) {
    s.doubles += 1;
    if (s.doubles >= 3) {
      pushLog(s, `${p.name} 더블 3연속! 무인도로 🏝️`);
      sendToIsland(s, me);
      s.rolledDoubles = false;
      s.phase = "act";
      return s;
    }
  } else {
    s.doubles = 0;
  }
  s.rolledDoubles = isDouble;

  advance(s, d1 + d2);
  settleLanding(s);
  s.phase = "act";
  return s;
}

/** 앞으로 n칸(모듈러, 출발 통과 월급). */
function advance(s: BGState, n: number): void {
  const p = s.players[s.turn];
  const before = p.pos;
  const dest = (before + n) % BG_TILES;
  if (dest < before) {
    p.laps += 1;
    p.cash += BG_SALARY;
    pushLog(s, `${p.name} 출발 통과 +${BG_SALARY} 💵`);
  }
  p.pos = dest;
}

function sendToIsland(s: BGState, idx: number): void {
  s.players[idx].pos = BG_ISLAND_IDX;
  s.players[idx].jail = 2; // 최대 2턴 갇힘
  s.doubles = 0;
  s.pending = null;
}

// ── 액션: pending 해소 ──────────────────────────────────────────
export function buyTile(s0: BGState): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "buy") return s0;
  const me = s.turn;
  const t = BOARD[s.pending.tile];
  const price = t.price ?? 0;
  if (s.players[me].cash < price) return s0;
  s.players[me].cash -= price;
  s.cells[s.pending.tile] = { owner: me, level: 0 };
  pushLog(s, `${s.players[me].name} ${t.name} 매입 (${price}) 🏠`);
  s.pending = null;
  return s;
}

export function skipBuy(s0: BGState): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "buy") return s0;
  s.pending = null;
  return s;
}

export function payToll(s0: BGState): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "toll") return s0;
  charge(s, s.turn, s.pending.amount, s.pending.to);
  if (s.phase !== "over") s.pending = null;
  return s;
}

export function payTax(s0: BGState): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "tax") return s0;
  charge(s, s.turn, s.pending.amount, "fund");
  if (s.phase !== "over") s.pending = null;
  return s;
}

export function collectFund(s0: BGState): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "fund") return s0;
  s.players[s.turn].cash += s.fund;
  s.fund = 0;
  s.pending = null;
  return s;
}

/** 우주여행: 목적지 선택 후 이동(월급 규칙 적용) + 착지 처리. 우주여행칸/제자리는 선택 불가(루프 방지). */
export function chooseSpace(s0: BGState, dest: number): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "space") return s0;
  if (dest < 0 || dest >= BG_TILES) return s0;
  if (dest === s.players[s.turn].pos || BOARD[dest].type === "space") return s0;
  s.pending = null;
  moveTo(s, dest, true);
  settleLanding(s);
  return s;
}

/** 무인도: 벌금 내고 즉시 탈출(내 턴, 아직 굴리기 전). 이후 정상 굴림. */
export function payIsland(s0: BGState): BGState {
  const s = clone(s0);
  if (s.phase !== "roll" || s.winner !== null) return s0;
  const me = s.turn;
  const p = s.players[me];
  if (p.jail <= 0 || p.cash < BG_ISLAND_FEE) return s0;
  charge(s, me, BG_ISLAND_FEE, "fund");
  p.jail = 0;
  pushLog(s, `${p.name} 벌금 ${BG_ISLAND_FEE} 내고 무인도 탈출 🏝️→`);
  return s;
}

/** 황금열쇠 뽑기(card 는 UI 가 0..CHANCE_COUNT-1 랜덤으로 넘김). */
export function drawChance(s0: BGState, card: number): BGState {
  const s = clone(s0);
  if (s.pending?.kind !== "chance") return s0;
  const me = s.turn;
  const opp = other(me);
  const p = s.players[me];
  s.pending = null;
  const c = ((card % CHANCE_COUNT) + CHANCE_COUNT) % CHANCE_COUNT;
  pushLog(s, `황금열쇠 🗝️ ${CHANCE_CARDS[c].text}`);
  switch (c) {
    case 0:
      p.cash += 200;
      break;
    case 1:
      charge(s, me, 150, "fund");
      break;
    case 2:
      moveTo(s, BG_START_IDX, true);
      settleLanding(s);
      break;
    case 3:
      sendToIsland(s, me);
      break;
    case 4:
      s.pending = { kind: "space" };
      break;
    case 5:
      charge(s, me, 100, opp);
      break;
    case 6:
      charge(s, opp, 100, me);
      break;
    case 7: {
      advance(s, 3);
      settleLanding(s);
      break;
    }
    case 8:
      p.cash += s.fund;
      s.fund = 0;
      break;
    case 9:
      charge(s, opp, 150, me);
      break;
    case 10:
      p.cash += 400;
      break;
    case 11: {
      // 내 도시 중 가장 싸고 아직 최고레벨 아닌 곳에 무료로 한 단계 건설
      let idx = -1;
      let cheapest = Infinity;
      for (const t of BOARD) {
        const cc = s.cells[t.idx];
        if (t.type === "city" && cc.owner === me && cc.level < BG_MAX_LEVEL && (t.price ?? 0) < cheapest) {
          idx = t.idx;
          cheapest = t.price ?? 0;
        }
      }
      if (idx >= 0) {
        s.cells[idx].level += 1;
        pushLog(s, `${BOARD[idx].name} ${LEVEL_NAMES[s.cells[idx].level]} 무료 건설 🏗️`);
      } else {
        p.cash += 100; // 지을 곳 없으면 소소한 보너스
      }
      break;
    }
    case 12:
      charge(s, me, 200, "fund");
      break;
    case 13:
      advance(s, 6);
      settleLanding(s);
      break;
    case 14:
      charge(s, opp, 200, me);
      break;
    case 15:
      charge(s, me, 150, opp);
      break;
  }
  return s;
}

// ── 액션: 건설 / 턴 종료 ────────────────────────────────────────
/** 내 도시 한 곳을 1단계 건설(내 턴, phase=act, pending 없음일 때). */
export function buildUp(s0: BGState, tileIdx: number): BGState {
  const s = clone(s0);
  if (s.phase !== "act" || s.pending) return s0;
  const me = s.turn;
  const t = BOARD[tileIdx];
  const cell = s.cells[tileIdx];
  if (t.type !== "city" || cell.owner !== me || cell.level >= BG_MAX_LEVEL) return s0;
  const cost = t.buildCost ?? 0;
  if (s.players[me].cash < cost) return s0;
  s.players[me].cash -= cost;
  cell.level += 1;
  pushLog(s, `${s.players[me].name} ${t.name} ${LEVEL_NAMES[cell.level]} 건설 (${cost}) 🏗️`);
  return s;
}

/** 턴 종료 — 더블이면 같은 사람 한 번 더, 아니면 상대로. 마지막 바퀴 조건이면 자산 비교 종료. */
export function endTurn(s0: BGState): BGState {
  const s = clone(s0);
  if (s.phase !== "act") return s0;
  if (s.pending) return s0; // 미해결 pending 있으면 종료 불가

  // 바퀴 종료 판정
  if (s.players[0].laps >= BG_MAX_LAPS && s.players[1].laps >= BG_MAX_LAPS) {
    const w0 = netWorth(s, 0);
    const w1 = netWorth(s, 1);
    s.winner = w0 === w1 ? null : w0 > w1 ? 0 : 1;
    s.over = "laps";
    s.phase = "over";
    pushLog(
      s,
      s.winner === null
        ? `${BG_MAX_LAPS}바퀴 완주 — 무승부! 🤝`
        : `${BG_MAX_LAPS}바퀴 완주 — ${s.players[s.winner].name} 승리! 🏆 (자산 ${Math.max(w0, w1)})`,
    );
    return s;
  }

  const keep = s.rolledDoubles && s.players[s.turn].jail === 0;
  if (!keep) s.turn = other(s.turn);
  s.dice = null;
  s.rolledDoubles = false;
  s.doubles = keep ? s.doubles : 0;
  s.pending = null;
  s.phase = "roll";
  if (keep) pushLog(s, `${s.players[s.turn].name} 더블! 한 번 더 🎲`);
  return s;
}

/** 선택이 필요없는 pending(통행료/세금/기금/황금열쇠)을 연쇄 자동 해소. buy/space(선택) 또는
 *  종료/무pending 에서 멈춘다. 카드 뽑기는 roll()(0~1)로 결정 → 호출부가 Math.random 주입.
 *  덕분에 한 '수'가 서버에 1번만 커밋된다(중간 상태 왕복 없음). */
export function autoResolve(s0: BGState, roll: () => number): BGState {
  let s = s0;
  for (let guard = 0; guard < 24; guard += 1) {
    const p = s.pending;
    if (!p || s.phase === "over") break;
    if (p.kind === "buy" || p.kind === "space") break; // 선택 필요 → 멈춤
    if (p.kind === "toll") s = payToll(s);
    else if (p.kind === "tax") s = payTax(s);
    else if (p.kind === "fund") s = collectFund(s);
    else if (p.kind === "chance") s = drawChance(s, Math.floor(roll() * CHANCE_COUNT));
    else break;
  }
  return s;
}

/** 항복(중도 포기) — 상대 승리. */
export function resign(s0: BGState, idx: number): BGState {
  const s = clone(s0);
  if (s.phase === "over") return s0;
  s.players[idx].bankrupt = true;
  s.winner = other(idx);
  s.over = "bankrupt";
  s.phase = "over";
  pushLog(s, `${s.players[idx].name} 항복 — ${s.players[other(idx)].name} 승리!`);
  return s;
}
