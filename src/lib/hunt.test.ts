// 사냥(방치형) 엔진 lock. [사용자 요청 2026-08-06 "무기로 몬스터를 사냥하는 키우기류 게임"]
//
// 방치형에서 실제로 사고가 나는 자리는 전투 연출이 아니라 **시간 계산**이다.
// 이 파일이 잠그는 것:
//  1) 온라인/오프라인이 **같은 수식**인가 (한쪽만 이득이면 방치형이 아니다)
//  2) 무기가 **주역**인가 (사용자 요청의 핵심)
//  3) 오래 방치해도 **터지지 않는가** (루프 상한 · 오프라인 캡)
//  4) 진행이 **사라지지 않는가** (커밋을 놓쳐도 시간이 다시 센다)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HUNT_KILLS_PER_STAGE,
  OFFLINE_CAP_MS,
  OFFLINE_RATE,
  SEC,
  createHunt,
  dps,
  hpPct,
  isBoss,
  killReward,
  monsterAt,
  monsterHp,
  settle,
  stageHp,
  KILL_REWARD_CAP,
  HUNT_DAILY_MAX,
  dailyCap,
  kstDayOf,
  type HuntState,
} from "./hunt.ts";
import { GEARS } from "./island.ts";

const T0 = Date.UTC(2026, 7, 6, 3, 0, 0);

test("★ 무기가 공격력의 주역이다 — 사용자 요청의 핵심", () => {
  const weapons = GEARS.filter((g) => g.slot === "weapon");
  assert.ok(weapons.length >= 5, `무기가 ${weapons.length}종 — 5단계는 있어야 목표가 안 끊긴다`);
  // 무기마다 atk 가 있고, 등급이 오르면 확실히(1.5배 이상) 세진다 — 계단이어야 체감된다
  const atks = weapons.map((w) => w.atk ?? 0);
  assert.ok(atks.every((a) => a > 0), `무기에 atk 가 없다: ${atks}`);
  for (let i = 1; i < atks.length; i++) {
    assert.ok(atks[i] >= atks[i - 1] * 1.5, `${weapons[i].name} ${atks[i]} vs 이전 ${atks[i - 1]} — 계단이 얕다`);
  }
  // 같은 레벨에서 무기만 바꿔도 DPS 가 그만큼 오른다
  const lv = 5;
  const top = atks[atks.length - 1];
  assert.ok(dps(top, lv) > dps(atks[0], lv) * 5, "최고 무기가 첫 무기의 5배는 되어야 한다");
});

test("★ 맨손이어도 진행은 된다 — 시작하자마자 막히면 게임이 아니다", () => {
  assert.ok(dps(0, 1) >= 1, "무기가 없어도 DPS ≥ 1");
  const { gain } = settle(createHunt(T0), T0 + 60 * SEC, 0, 1, false);
  assert.ok(gain.kills > 0, "맨손 1분이면 최소 한 마리는 잡아야 한다");
});

test("★ 레벨도 기여하지만 무기를 못 이긴다 — 무기가 주역이라는 서열", () => {
  const noWeaponHighLv = dps(0, 30);
  const bestWeaponLowLv = dps(30, 1);
  assert.ok(bestWeaponLowLv > noWeaponHighLv, `맨손 Lv30 ${noWeaponHighLv} ≥ 전설무기 Lv1 ${bestWeaponLowLv}`);
});

test("★ 온라인과 오프라인이 같은 수식이다 — 효율 계수만 다르다", () => {
  /* ⚠ 처치 수는 피해량에 **비례하지 않는다** — 스테이지가 오르면 HP 가 지수로 뛰므로
     오래 돌릴수록 '피해 60%'가 '처치 60%'보다 큰 비율이 된다(첫 판 테스트가 여기서 틀렸다).
     그래서 비율은 **스테이지가 안 바뀌는 짧은 구간**에서 잰다. */
  const s = createHunt(T0);
  const short = 10 * SEC;
  const on = settle(s, T0 + short, 8, 5, false);
  const off = settle(s, T0 + short, 8, 5, true);
  assert.equal(on.hunt.stage, 1, "전제: 이 구간에선 스테이지가 안 바뀐다");
  assert.equal(off.hunt.stage, 1);
  // 이 구간의 누적 피해 = 처치 × HP + 남은 dmg. 이게 정확히 OFFLINE_RATE 배여야 한다.
  const dealt = (r: typeof on) => r.gain.kills * stageHp(1) + r.hunt.dmg;
  const ratio = dealt(off) / dealt(on);
  assert.ok(
    Math.abs(ratio - OFFLINE_RATE) < 0.02,
    `오프라인/온라인 피해 = ${ratio.toFixed(3)} — ${OFFLINE_RATE} 여야 한다`,
  );
});

test("★ 켜두고 본 사람이 손해면 안 된다 — 긴 구간에서도 온라인이 앞선다", () => {
  const s = createHunt(T0);
  const ms = 30 * 60 * SEC;
  const on = settle(s, T0 + ms, 8, 5, false).gain;
  const off = settle(s, T0 + ms, 8, 5, true).gain;
  assert.ok(on.kills > off.kills, `온라인 ${on.kills} ≤ 오프라인 ${off.kills}`);
  /* ⚠ 코인은 **일일 한도**가 생긴 뒤로 둘 다 천장에 닿으면 같아진다(2026-08-07).
     그건 손해가 아니다 — 온라인은 처치·스테이지가 더 많이 오르고, 한도 자체가
     도달 스테이지에 비례하므로 **내일의 한도**가 올라간다. 그래서 '뒤처지지 않는다'로 잰다. */
  assert.ok(on.coins >= off.coins, "코인이 온라인에서 더 적으면 안 된다");
});

test("★ 쪼개서 정산해도 한 번에 정산한 것과 비슷하다 — 커밋 타이밍이 이득을 바꾸면 안 된다", () => {
  // 화면은 1초마다, 오프라인은 한 번에 정산한다. 둘이 크게 다르면 '켜두면 손해'가 생긴다.
  const once = settle(createHunt(T0), T0 + 600 * SEC, 8, 5, false).gain;
  let s = createHunt(T0);
  let kills = 0;
  let coins = 0;
  for (let i = 1; i <= 600; i++) {
    const r = settle(s, T0 + i * SEC, 8, 5, false);
    s = r.hunt;
    kills += r.gain.kills;
    coins += r.gain.coins;
  }
  assert.equal(kills, once.kills, `쪼갠 ${kills} vs 한번 ${once.kills}`);
  assert.equal(coins, once.coins, `코인 ${coins} vs ${once.coins}`);
});

test("★ 오프라인 상한이 걸린다 — 한 달 방치 후 접속 한 번으로 끝나면 안 된다", () => {
  const s = createHunt(T0);
  const month = 30 * 24 * 60 * 60 * SEC;
  const r = settle(s, T0 + month, 8, 5, true);
  assert.equal(r.gain.capped, true, "상한 플래그가 켜져야 UI 가 안내한다");
  assert.equal(r.gain.usedMs, OFFLINE_CAP_MS, "상한만큼만 반영");
  const capExact = settle(s, T0 + OFFLINE_CAP_MS, 8, 5, true);
  assert.equal(r.gain.kills, capExact.gain.kills, "상한을 넘겨도 더 주지 않는다");
});

test("★ 아주 강해도 한 번에 폭주하지 않는다 — 프레임이 멈추면 안 된다", () => {
  const t = Date.now();
  const r = settle(createHunt(T0), T0 + OFFLINE_CAP_MS, 999_999, 50, true);
  assert.ok(Date.now() - t < 500, "정산이 0.5초 안에 끝나야 한다");
  assert.ok(r.gain.kills <= 5000, `처치 상한 초과: ${r.gain.kills}`);
  assert.ok(Number.isFinite(r.hunt.stage) && r.hunt.stage > 1);
});

test("★ 진행이 사라지지 않는다 — 정산 시각이 항상 앞으로 간다", () => {
  // 서버 커밋을 놓쳐도 다음 진입이 at 부터 다시 세므로 시간이 증발하지 않는다.
  let s = createHunt(T0);
  for (const step of [10, 60, 3600]) {
    const next = settle(s, s.at + step * SEC, 4, 3, false).hunt;
    assert.equal(next.at, s.at + step * SEC, "at 은 now 로 갱신된다");
    s = next;
  }
});

test("경과가 0 이거나 음수(시계 되돌림)면 조용히 아무 일도 없다", () => {
  const s = createHunt(T0);
  for (const t of [T0, T0 - 10_000]) {
    const r = settle(s, t, 8, 5, false);
    assert.equal(r.gain.kills, 0);
    assert.equal(r.gain.coins, 0);
  }
});

test("★ 스테이지가 오를수록 어려워지고, 보스가 벽이 된다", () => {
  let prev = 0;
  for (let st = 1; st <= 30; st++) {
    const hp = monsterHp(st);
    assert.ok(hp > prev, `스테이지 ${st} HP 가 안 올랐다`);
    prev = hp;
  }
  assert.equal(isBoss(10), true);
  assert.equal(isBoss(11), false);
  assert.ok(stageHp(10) > monsterHp(10) * 2, "보스는 확실히 두껍다");
  assert.ok(killReward(10) > killReward(9) * 2, "보스는 보상도 크다");
});

test("스테이지가 정해진 처치 수마다 오른다", () => {
  const atk = 100_000; // 즉사 수준 — 처치 수만 본다
  const r = settle(createHunt(T0), T0 + 5 * SEC, atk, 1, false);
  assert.ok(r.gain.kills >= HUNT_KILLS_PER_STAGE);
  assert.equal(r.hunt.stage, 1 + Math.floor(r.gain.kills / HUNT_KILLS_PER_STAGE));
  assert.ok(r.hunt.best >= r.hunt.stage);
});

test("몬스터가 스테이지에 따라 결정적으로 바뀐다 — 두 사람이 같은 걸 본다", () => {
  assert.equal(monsterAt(3).key, monsterAt(3).key);
  assert.equal(monsterAt(10).key, "dragon", "보스 스테이지는 드래곤");
  const kinds = new Set([1, 6, 11, 16, 21].map((s) => monsterAt(s).key));
  assert.ok(kinds.size >= 4, `종류가 안 바뀐다: ${[...kinds]}`);
});

test("체력 게이지가 0~1 을 벗어나지 않는다", () => {
  const s = createHunt(T0);
  assert.equal(hpPct(s), 1);
  const hurt = { ...s, dmg: stageHp(s.stage) * 2 };
  assert.equal(hpPct(hurt), 0);
});

// ── 경제 (2026-08-07 재조정) ──────────────────────────────────────────────
/* [사용자 리포트 "자동사냥하면 하트가 몇천개씩 벌리는데 ; 이거 밸런스 조정좀"]
   실측이 그대로였다 — 맨손 12시간 3,713 / 수박검 27,375. 장비 9종 총액이 51,150 인데
   하루 반이면 다 샀다. 게다가 **온라인 정산에는 상한이 아예 없어** 화면만 켜 두면 무제한이었다.
   여기서 그 셋을 다 잠근다. */

const day = 24 * 60 * 60 * SEC;
/** hours 시간 방치했을 때 실제로 받는 하트(오프라인 정산, 12h 씩 끊어서) */
/* '하루 수입'은 **KST 달력 하루**를 잰다 — T0(KST 정오) 시작이면 창이 자정을 걸쳐
   이틀 한도가 정당하게 열리므로(자정 분할, 2026-08-25) 자정 정렬로 시작한다. */
const TM = Date.UTC(2026, 7, 6, 15, 0, 0); // KST 2026-08-07 00:00
function earned(atk: number, lv: number, hours: number): number {
  let h = createHunt(TM);
  let coins = 0;
  const chunkH = 12;
  for (let done = 0; done < hours; done += chunkH) {
    const r = settle(h, TM + (done + chunkH) * 3600 * SEC, atk, lv, true);
    h = r.hunt;
    coins += r.gain.coins;
  }
  return coins;
}

test("★ 마리당 보상에 천장이 있다 — 스테이지가 올라도 수입이 무한히 안 커진다", () => {
  /* 1차판은 `4 + stage*1.6` 이라 스테이지가 오르면 보상이 **선형으로 끝없이** 커졌다.
     스테이지에 상한이 없으니 결국 수입에도 상한이 없었다. */
  let prev = 0;
  for (let st = 1; st <= 500; st++) {
    const r = killReward(st);
    if (!isBoss(st)) {
      assert.ok(r >= prev || prev === 0, `스테이지 ${st}: 보상이 줄었다`);
      assert.ok(r <= KILL_REWARD_CAP, `스테이지 ${st}: 보상 ${r} 이 천장 ${KILL_REWARD_CAP} 을 넘었다`);
      prev = r;
    }
  }
  // 초반엔 오르는 게 보여야 한다(완전히 평평하면 스테이지를 올릴 이유가 없다)
  assert.ok(killReward(20) > killReward(1) * 2, "초반 성장이 안 느껴진다");
});

test("★ 하루 획득 한도가 온·오프라인 모두에 걸린다", () => {
  // 자정 정렬 시작(TM) — 한 달력 하루만 재야 '하루 한도 1개'가 정확한 상한이다
  const s = createHunt(TM);
  /* ⚠ 한도는 **정산 중에 오른 스테이지까지 반영**한다(그래야 첫 정산이 유독 짜지 않다).
     그래서 기준은 시작 시점 best 가 아니라 **끝났을 때의 best** 다. */
  const on = settle(s, TM + day, 999, 99, false);
  const off = settle(s, TM + day, 999, 99, true);
  assert.ok(on.gain.coins <= dailyCap(on.hunt.best), `온라인 ${on.gain.coins} > 한도`);
  assert.ok(off.gain.coins <= dailyCap(off.hunt.best), `오프라인 ${off.gain.coins} > 한도`);
  assert.ok(on.gain.coins <= HUNT_DAILY_MAX, `천장 ${HUNT_DAILY_MAX} 을 넘었다: ${on.gain.coins}`);
  assert.ok(on.gain.dayCapped, "한도에 닿았으면 UI 가 알 수 있어야 한다");
});

test("★ 한도에 닿아도 처치·스테이지는 계속 오른다 — 진행까지 멈추면 그건 벌이다", () => {
  const r = settle(createHunt(T0), T0 + day, 999, 99, false);
  assert.ok(r.gain.dayCapped, "이 조건이면 한도에 닿아야 한다");
  assert.ok(r.gain.kills > 0, "한도에 닿았다고 처치까지 0 이면 안 된다");
  assert.ok(r.hunt.stage > 1, "스테이지도 올라야 한다");
});

test("★ 한도는 진행도를 따라 오른다 — 안 그러면 비싼 무기를 살 이유가 없다", () => {
  /* 1차 조정에서 고정 한도로 뒀더니 나무막대와 수박검의 하루 수입이 둘 다 1,800 으로
     **똑같아졌다**. 그러면 12,000 짜리 무기를 살 이유가 사라진다. */
  assert.ok(dailyCap(50) > dailyCap(1), "스테이지를 올려도 한도가 그대로다");
  let prev = 0;
  for (const best of [1, 10, 30, 60, 100, 500]) {
    const c = dailyCap(best);
    assert.ok(c >= prev, "한도가 줄었다");
    assert.ok(c <= HUNT_DAILY_MAX, `한도 ${c} 가 천장 ${HUNT_DAILY_MAX} 을 넘었다`);
    prev = c;
  }
  assert.equal(dailyCap(99999), HUNT_DAILY_MAX, "천장이 있어야 무한 인플레가 안 생긴다");
});

test("★ 자정이 지나면 한도가 초기화된다", () => {
  const first = settle(createHunt(T0), T0 + day, 999, 99, false);
  assert.ok(first.gain.dayCapped);
  // 다음 날 다시 정산하면 또 받을 수 있다
  const next = settle(first.hunt, T0 + day * 2, 999, 99, false);
  assert.ok(next.gain.coins > 0, "다음 날에도 0 이면 한도가 아니라 그냥 정지다");
});

test("★ 자정을 걸친 정산은 날짜별 한도로 갈린다 [리뷰 2026-08-24]", () => {
  /* 통짜로 '지금 날짜'에 귀속시키던 시절엔 밤샘 방치 정산이 어제 남은 한도를 버리고
     오늘 한도까지 미리 태웠다 — 아침에 켰는데 이미 dayCapped. 이제 구간을 KST 자정에서
     갈라 어제 몫은 어제 한도로, 자정 이후 몫만 오늘 한도로 센다. */
  const eve = Date.UTC(2026, 7, 6, 9, 0, 0); // KST 18:00
  const r = settle(createHunt(eve), eve + 12 * 3600 * SEC, 999, 99, false); // → 다음 날 06:00
  const cap = dailyCap(r.hunt.best);
  // 양쪽 다 한도에 닿는 화력 — 합이 '한 날 한도'를 넘어야 앞 몫이 안 버려진 것이다
  assert.ok(r.gain.coins > cap, `자정 앞 몫이 버려졌다: ${r.gain.coins} <= 한도 ${cap}`);
  assert.ok(r.gain.coins <= cap * 2, `이틀 한도 초과: ${r.gain.coins} > ${cap * 2}`);
  // '오늘 쓴 몫'에는 자정 이후 것만 남는다 — 어제 몫이 오늘 한도를 갉아먹으면 안 된다
  assert.ok((r.hunt.dayCoins ?? 0) <= cap, `오늘 귀속 ${r.hunt.dayCoins} > 오늘 한도 ${cap}`);
  assert.ok((r.hunt.dayCoins ?? 0) < r.gain.coins, "어제 몫까지 전부 오늘로 귀속됐다");
  assert.equal(r.hunt.dayKey, kstDayOf(eve + 12 * 3600 * SEC), "dayKey 가 오늘로 안 굴렀다");
});

test("★ 하루 수입이 '몇천 개'가 아니다 — 사용자 리포트의 실제 기준", () => {
  // 맨손 하루(12h 방치 2회)
  assert.ok(earned(0, 1, 24) < 2_000, `맨손 하루 ${earned(0, 1, 24)} — 여전히 너무 많다`);
  // 최고 장비로도 하루에 한도 근처를 크게 못 넘는다
  assert.ok(earned(55, 40, 24) < HUNT_DAILY_MAX * 2.2, `최고 장비 하루 ${earned(55, 40, 24)}`);
  // 그래도 첫 장비(360)는 하루면 산다 — 시작하자마자 막히면 게임이 아니다
  assert.ok(earned(0, 1, 24) >= 360, "첫 무기도 못 사면 너무 조인 것이다");
});

test("★ 구버전 저장분(dayCoins 없음)도 정상 동작한다", () => {
  // 무마이그레이션 원칙 — 옵셔널 필드라 예전 상태가 그대로 들어온다
  const old = { stage: 5, kills: 2, dmg: 0, at: T0, total: 40, best: 5 } as HuntState;
  const r = settle(old, T0 + 3600 * SEC, 8, 5, false);
  assert.ok(r.gain.coins >= 0);
  assert.equal(typeof r.hunt.dayCoins, "number", "정산 뒤엔 채워져야 한다");
});
