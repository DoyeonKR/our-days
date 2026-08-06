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
} from "./hunt.ts";
import { GEARS } from "./island.ts";

const T0 = Date.UTC(2026, 7, 6, 3, 0, 0);

test("★ 무기가 공격력의 주역이다 — 사용자 요청의 핵심", () => {
  const weapons = GEARS.filter((g) => g.slot === "weapon");
  assert.equal(weapons.length, 3);
  // 무기마다 atk 가 있고, 등급이 오르면 확실히(1.5배 이상) 세진다 — 계단이어야 체감된다
  const atks = weapons.map((w) => w.atk ?? 0);
  assert.ok(atks.every((a) => a > 0), `무기에 atk 가 없다: ${atks}`);
  for (let i = 1; i < atks.length; i++) {
    assert.ok(atks[i] >= atks[i - 1] * 1.5, `${weapons[i].name} ${atks[i]} vs 이전 ${atks[i - 1]} — 계단이 얕다`);
  }
  // 같은 레벨에서 무기만 바꿔도 DPS 가 그만큼 오른다
  const lv = 5;
  assert.ok(dps(atks[2], lv) > dps(atks[0], lv) * 5, "전설 무기가 첫 무기의 5배는 되어야 한다");
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
  assert.ok(on.coins > off.coins, "코인도 온라인이 앞서야 한다");
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
