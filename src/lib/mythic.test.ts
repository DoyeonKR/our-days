// 신화형(stage 5) 회귀 lock. [사용자 요청 2026-08-11 "레벨 50 위 단계 — 호랑이·
// 무등산호랑이·뱅갈호랑이·사자·기린, 퀄리티 맞춰서"]
//
// 분기 자체는 island.test 의 nextEvolution 케이스가 잠근다. 여기서는 **여정과 흔적**을
// 잠근다 — 게이트가 실제로 열리는가, 수박 흔적이 남는가, 은퇴가 막히지 않는가,
// 구버전 저장분이 도는가.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MYTHIC_FORMS,
  PET_FORMS,
  TUNING,
  createIsland,
  evolve,
  petLevel,
  retirePet,
  type IslandState,
} from "./island.ts";

const T = Date.UTC(2026, 7, 11, 3, 0, 0);
const fresh = (): IslandState => createIsland("콩", null, T);

test("신화 게이트 — Lv.70 은 최종형 XP(8300)보다 한참 멀다", () => {
  assert.equal(TUNING.pet.evoLevel[5], 70, "신화 진입 레벨");
  assert.equal(petLevel(8300), 50, "최종형 앵커는 그대로(기존 저장분 레벨 불변)");
  assert.equal(petLevel(15000), 70, "새 앵커에서 70 도달");
  assert.ok(petLevel(11650) < 70 && petLevel(11650) > 50, "50~70 사이가 구간선형으로 이어진다");
  // 마지막 관문이 제일 좁아야 한다 — 신화 CQ 임계 > 최종형 임계
  assert.ok(TUNING.pet.branch.s5Hi > TUNING.pet.branch.s4Hi, "s5Hi 는 s4Hi 보다 높다");
});

test("신화 진화 — 최종형이 Lv.70 에 pendingEvolve 가 서고, evolve 로 넘어간다", () => {
  const s = fresh();
  s.pet.form = "royal_cat";
  s.pet.careXp = 15000;
  s.pet.cq = 90;
  s.pet.pendingEvolve = true; // refreshEvolveFlag 는 액션 경유 — 여기선 직접 세팅
  const after = evolve(s, T);
  const f = PET_FORMS[after.pet.form];
  assert.equal(f.stage, 5, `최종형 Lv.70 → 신화형 (${after.pet.form})`);
  assert.ok(after.achievements.includes(`pet_${after.pet.form}`), "신화 업적 해금");
  assert.equal(after.pet.pendingEvolve, false, "신화형은 더 갈 곳이 없다");
});

test("무등산수박을 먹인 흔적(legendFed)이 남고, 그 펫만 무등산호랑이가 된다", () => {
  const s = fresh();
  s.pet.form = "royal_cat";
  s.pet.careXp = 15000;
  s.pet.cq = 95;
  s.pet.neglect = 0;
  s.pet.pendingEvolve = true;
  // 수박 없이 → 뱅갈
  assert.equal(evolve(s, T).pet.form, "bengal_tiger");
  // 수박 흔적 있으면 → 무등산호랑이
  const fed = { ...s, pet: { ...s.pet, legendFed: 2 } };
  assert.equal(evolve(fed, T).pet.form, "mudeung_tiger");
});

test("은퇴 — 최종형(4)도 신화형(5)도 박물관에 갈 수 있다 [계약 확장]", () => {
  // 최종형에서 바로 은퇴(컬렉션 반복)도, 신화까지 키워 은퇴도 둘 다 열려 있어야 한다.
  let s = fresh();
  s.pet.form = "royal_cat";
  s = retirePet(s, "다음", T);
  assert.ok(s.museum.includes("royal_cat"), "최종형 은퇴는 그대로 된다");
  let m = fresh();
  m.pet.form = "mudeung_tiger";
  m = retirePet(m, "다음", T);
  assert.ok(m.museum.includes("mudeung_tiger"), "신화형도 전시된다");
  // 중간형은 여전히 못 한다
  const mid = fresh();
  mid.pet.form = "cat";
  assert.equal(retirePet(mid, "x", T), mid, "중간형 은퇴는 no-op");
});

test("구버전 저장분(legendFed 없음)이 그대로 돈다 — 무마이그레이션", () => {
  const s = fresh();
  s.pet.form = "celestial_fox";
  s.pet.careXp = 15000;
  s.pet.cq = 95;
  s.pet.pendingEvolve = true;
  delete (s.pet as { legendFed?: number }).legendFed;
  const after = evolve(s, T);
  assert.equal(PET_FORMS[after.pet.form].stage, 5, "legendFed 없어도 진화는 된다");
  assert.notEqual(after.pet.form, "mudeung_tiger", "흔적이 없으면 무등산은 아니다");
});

test("신화 5종 전부 PET_FORMS 에 있고 이름·이모지가 서로 다르다", () => {
  assert.equal(MYTHIC_FORMS.length, 5);
  const names = new Set<string>();
  const emojis = new Set<string>();
  for (const k of MYTHIC_FORMS) {
    const f = PET_FORMS[k];
    assert.ok(f, `${k} 가 PET_FORMS 에 없다`);
    assert.equal(f.stage, 5, `${k} stage`);
    names.add(f.name);
    emojis.add(f.emoji);
  }
  assert.equal(names.size, 5, "이름 중복");
  assert.equal(emojis.size, 5, "이모지 중복 — 로그에서 구분이 안 된다");
});
