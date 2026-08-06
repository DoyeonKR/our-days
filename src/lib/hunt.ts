// 사냥 — 방치형(idle/incremental) 순수 엔진.
//
// [사용자 요청 2026-08-06 "저 무기로 몬스터를 사냥하는 키우기류 게임 …
//  우리가 사는 무기에 따라 공격력이 달라지는거야"]
//
// 방치형의 정의는 "안 보고 있어도 진행된다"이다. 그래서 이 엔진의 중심은 전투 연출이 아니라
// **경과 시간 → 결과**를 계산하는 settle() 이다. 화면은 그 결과를 예쁘게 보여줄 뿐이고,
// 앱을 껐다 켜도 같은 함수가 같은 답을 낸다.
//
// 설계 규칙(이 저장소 공통)
//  · 순수 함수 — 상태 → 새 상태. `now` 는 주입받고 Date.now() 를 부르지 않는다.
//  · 랜덤 금지 — 커플 두 명이 같은 상태를 공유하므로, 한쪽에서만 다른 값이 나오면 갈린다.
//    드랍/크리티컬은 **결정적 해시**(killIndex 기반)로만 굴린다.
//  · 상태는 couple_island.state 안 `s.hunt` 에 얹는다 → **DB 마이그레이션이 없다**.
//    옵셔널 필드라 예전 저장 상태와도 호환된다(hero 와 같은 방식).

/** 시간 상수 — 화면(1초 틱)과 오프라인 정산이 **같은 수식**을 쓰게 한다. */
export const SEC = 1000;
/** 오프라인 정산 상한. 하루 종일 안 켜도 12시간까지만 쳐준다.
 *  상한이 없으면 한 달 방치 후 접속 한 번으로 게임이 끝난다. */
export const OFFLINE_CAP_MS = 12 * 60 * 60 * SEC;
/** 오프라인은 실시간보다 효율이 낮다 — 켜두고 보는 사람이 손해면 안 된다. */
export const OFFLINE_RATE = 0.6;

export type HuntState = {
  /** 현재 스테이지(1부터). 처치 수가 차면 오른다. */
  stage: number;
  /** 이번 스테이지에서 처치한 수. */
  kills: number;
  /** 현재 몬스터가 받은 누적 피해(스테이지 이동 시 0). */
  dmg: number;
  /** 마지막 정산 시각(ms). */
  at: number;
  /** 누적 총 처치 — 업적/표시용. */
  total: number;
  /** 도달한 최고 스테이지. */
  best: number;
};

export const HUNT_KILLS_PER_STAGE = 10;

export function createHunt(now: number): HuntState {
  return { stage: 1, kills: 0, dmg: 0, at: now, total: 0, best: 1 };
}

/* ── 수치 곡선 ────────────────────────────────────────────────
 * 방치형은 "조금씩 벽에 부딪히고, 장비를 하나 사면 뚫린다"의 반복이다.
 * 그래서 몬스터 HP 는 지수로 오르고, 무기는 계단으로 오른다(2 → 8 → 30).
 * 곱이 아니라 **계단**이라 새 무기를 산 순간이 확실히 체감된다. */

/** 스테이지 몬스터 최대 HP. */
export function monsterHp(stage: number): number {
  const s = Math.max(1, Math.floor(stage));
  return Math.round(20 * Math.pow(1.18, s - 1) + (s - 1) * 6);
}

/** 보스 스테이지(10 단위) — HP 3배. 벽이 있어야 장비를 사러 간다. */
export const isBoss = (stage: number): boolean => Math.floor(stage) % 10 === 0;
export const stageHp = (stage: number): number => monsterHp(stage) * (isBoss(stage) ? 3 : 1);

/** 처치 보상 코인. 스테이지에 비례하되 HP 보다 완만하게 — 무한 인플레 방지. */
export function killReward(stage: number): number {
  const s = Math.max(1, Math.floor(stage));
  return Math.round((4 + s * 1.6) * (isBoss(s) ? 5 : 1));
}

/** 초당 피해(DPS). **무기 공격력이 주역**이고 레벨은 보조다.
 *  atk=0(맨손)이어도 1 은 나온다 — 시작하자마자 아무것도 못 하면 게임이 아니다. */
export function dps(weaponAtk: number, heroLevel: number): number {
  const base = Math.max(1, weaponAtk);
  return Math.round(base * (1 + Math.max(0, heroLevel - 1) * 0.12) * 10) / 10;
}

/** 지금 몬스터를 잡는 데 남은 시간(초). DPS 가 0 일 수 없으므로 항상 유한하다. */
export function secsToKill(s: HuntState, atk: number, lv: number): number {
  const left = Math.max(0, stageHp(s.stage) - s.dmg);
  return left / dps(atk, lv);
}

export type HuntGain = {
  /** 처치 수. */
  kills: number;
  /** 얻은 코인. */
  coins: number;
  /** 오른 스테이지 수. */
  stageUp: number;
  /** 실제로 반영한 시간(ms) — 상한에 걸리면 경과보다 작다. */
  usedMs: number;
  /** 상한에 걸렸는지(UI 가 "12시간까지만 쌓여요"를 띄운다). */
  capped: boolean;
};

/**
 * 경과 시간을 전투 결과로 바꾼다 — **이 게임의 심장**.
 * 화면이 켜져 있든(1초마다 호출) 껐다 켰든(몇 시간을 한 번에) 같은 함수를 쓴다.
 * 그래야 "보고 있을 때만 이득"이나 "껐을 때만 이득"이 생기지 않는다.
 *
 * @param offline true 면 OFFLINE_RATE 를 곱하고 상한을 건다.
 */
export function settle(
  s0: HuntState,
  now: number,
  atk: number,
  lv: number,
  offline: boolean,
): { hunt: HuntState; gain: HuntGain } {
  const elapsed = Math.max(0, now - s0.at);
  const capped = offline && elapsed > OFFLINE_CAP_MS;
  const usedMs = offline ? Math.min(elapsed, OFFLINE_CAP_MS) : elapsed;
  const power = dps(atk, lv) * (offline ? OFFLINE_RATE : 1);
  // 이 구간에 넣을 수 있는 총 피해량. 여기서부터는 '몇 마리를 잡았나' 계산이다.
  let pool = (usedMs / SEC) * power;

  const s: HuntState = { ...s0, at: now };
  const gain: HuntGain = { kills: 0, coins: 0, stageUp: 0, usedMs, capped };
  if (pool <= 0) return { hunt: s, gain };

  /* ⚠ 루프 상한 — 장비가 아주 세지면 한 번에 수만 마리가 나올 수 있다. 상한이 없으면
     오프라인 복귀 한 번에 프레임이 멈춘다. 상한에 닿으면 남은 pool 은 버린다
     (버려진 만큼은 '너무 강해서 넘친 몫'이라 손해로 느껴지지 않는다). */
  const MAX_KILLS = 5000;
  while (pool > 0 && gain.kills < MAX_KILLS) {
    const need = stageHp(s.stage) - s.dmg;
    if (pool < need) {
      s.dmg += pool;
      pool = 0;
      break;
    }
    pool -= need;
    s.dmg = 0;
    s.kills += 1;
    s.total += 1;
    gain.kills += 1;
    gain.coins += killReward(s.stage);
    if (s.kills >= HUNT_KILLS_PER_STAGE) {
      s.kills = 0;
      s.stage += 1;
      s.best = Math.max(s.best, s.stage);
      gain.stageUp += 1;
    }
  }
  s.dmg = Math.round(s.dmg * 10) / 10;
  return { hunt: s, gain };
}

/* ── 몬스터 도감 ──────────────────────────────────────────────
 * 스테이지가 올라도 같은 슬라임만 나오면 '진행하고 있다'가 안 느껴진다.
 * 종류는 스테이지에서 **결정적으로** 파생한다(랜덤 금지 — 두 사람이 같은 걸 봐야 한다). */
export type MonsterDef = { key: string; name: string; emoji: string };
export const MONSTERS: MonsterDef[] = [
  { key: "slime", name: "슬라임", emoji: "🟢" },
  { key: "bat", name: "박쥐", emoji: "🦇" },
  { key: "mush", name: "독버섯", emoji: "🍄" },
  { key: "ghost", name: "유령", emoji: "👻" },
  { key: "golem", name: "바위골렘", emoji: "🪨" },
];
export const BOSS: MonsterDef = { key: "dragon", name: "드래곤", emoji: "🐲" };

/** 스테이지 → 몬스터. 보스 스테이지는 항상 드래곤. */
export function monsterAt(stage: number): MonsterDef {
  const s = Math.max(1, Math.floor(stage));
  if (isBoss(s)) return BOSS;
  // 5스테이지마다 종류가 바뀐다 — 한 종을 충분히 보고 다음으로 넘어간다
  return MONSTERS[Math.floor((s - 1) / 5) % MONSTERS.length];
}

/** 남은 체력 비율 0~1 (게이지용). */
export const hpPct = (s: HuntState): number =>
  Math.max(0, Math.min(1, 1 - s.dmg / stageHp(s.stage)));

/* ── 휘두르기 모션 ────────────────────────────────────────────
 * [사용자 요청 2026-08-07 "공격하는 모션도없고 검으로 공격하는 모션을 만들라는거야 자연스럽게"]
 *
 * 1차판은 무기 **위치만** 몇 픽셀 흔들었다 — 칼이 떨고 있을 뿐 휘두르는 게 아니었다.
 * 픽셀 아트에서 휘두름은 **자세(포즈)가 바뀌어야** 읽힌다. 세 자세를 순서대로 밟는다:
 *
 *   치켜듦(세로) → 비스듬(45°) → 내려침(가로) → 비스듬 → 복귀
 *
 * 세로·가로는 스프라이트 하나에서 rot90 으로 얻고(격자 손실 0), 45° 만 따로 찍었다.
 * 타이밍은 **뜸 들이고 빠르게 내려치기** — 준비 구간을 길게 잡아야 힘이 실려 보인다.
 * (등속으로 돌리면 시계 초침처럼 보인다 — 애니메이션에서 제일 흔한 실수다.)
 */
export type SwingPose = "up" | "diag" | "flat";
export type Swing = {
  pose: SwingPose;
  /** 무기 추가 오프셋(정수 논리 픽셀). */
  dx: number;
  dy: number;
  /** 히어로가 앞으로 내딛는 정도(정수 px). */
  lunge: number;
  /** 이 프레임이 **타격 순간**인가 — 이펙트/반동을 여기에 맞춘다. */
  impact: boolean;
};

/** 한 번 휘두르는 데 걸리는 시간(ms). */
export const SWING_MS = 780;

/** 위상 0~1 → 자세. 순수 함수라 테스트로 궤적을 잠글 수 있다. */
export function swingAt(p01: number): Swing {
  const p = ((p01 % 1) + 1) % 1;
  // 0.00~0.42 준비 — 칼을 치켜들고 몸을 뒤로 (길게: 힘을 모으는 구간)
  if (p < 0.42) {
    const k = p / 0.42;
    return { pose: "up", dx: -Math.round(k * 2), dy: -Math.round(k * 4), lunge: -Math.round(k * 2), impact: false };
  }
  // 0.42~0.52 내려오는 중 — 비스듬
  if (p < 0.52) return { pose: "diag", dx: 2, dy: 1, lunge: 2, impact: false };
  // 0.52~0.64 **타격** — 가로로 완전히 뻗는다
  if (p < 0.64) return { pose: "flat", dx: 5, dy: 4, lunge: 5, impact: true };
  // 0.64~0.76 여파 — 다시 비스듬(아래쪽)
  if (p < 0.76) return { pose: "diag", dx: 3, dy: 4, lunge: 3, impact: false };
  // 0.76~1.00 복귀
  const k = (p - 0.76) / 0.24;
  return { pose: "up", dx: Math.round((1 - k) * 2), dy: Math.round((1 - k) * 2), lunge: Math.round((1 - k) * 2), impact: false };
}
