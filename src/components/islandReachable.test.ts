// '엔진엔 있는데 UI 에서 부를 수 없는 죽은 기능' 금지 lock. [2026-08-02]
//
// 이 프로젝트에서 반복된 실패 유형이다:
//  · fertilize() 는 있는데 밭 UI 에 버튼이 없어 비료 18개가 쌓임 (2026-07-27)
//  · buyFertilizer(_, true)(골드비료) 를 부르는 곳이 없어, 밭 시트가 "★5는 골드비료가
//    필요해요"라고 안내하면서 정작 살 수가 없었음 (2026-08-02)
//  · unlockAch(s,"dday_year") 가 100일 루프 안에 있어 전원 도달 불가 (2026-08-02)
//
// 규칙: 플레이어가 쓰라고 만든 엔진 액션은 반드시 UI 호출부가 하나 이상 있어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const compDir = import.meta.dirname;

/** components 이하 모든 .tsx 를 이어붙인 소스(호출부 탐색용). */
function allUiSource(): string {
  const parts: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.name.endsWith(".tsx")) parts.push(readFileSync(join(d, e.name), "utf8"));
    }
  };
  walk(compDir);
  return parts.join("\n");
}

const ui = allUiSource();

/** 플레이어가 직접 실행하는 섬 액션 — 전부 UI 에서 도달 가능해야 한다. */
const PLAYER_ACTIONS = [
  "feedPet", "feedPetWith", "petPet", "cleanPet", "playPet", "hugPet", "restPet", "wakePet",
  "medicinePet", "evolve", "retirePet", "coopStart", "coopConfirm",
  "plant", "waterPlot", "fertilize", "harvest", "expandPlots",
  "startCraft", "collectCraft", "buyTool", "buyFertilizer",
  "placeDecor", "moveDecor", "removeDecor", "claimDecorWish",
  "claimQuest", "giftPartner",
];

test("모든 플레이어 액션이 UI 에서 호출된다(죽은 기능 금지)", () => {
  // 호출(fn(...))뿐 아니라 참조 전달(예: `{ k:"clean", fn: cleanPet }`)도 도달 경로다
  // → 괄호를 요구하지 않고 식별자 존재로 검사한다(거짓 실패 방지).
  const dead = PLAYER_ACTIONS.filter((fn) => !new RegExp(`\\b${fn}\\b`).test(ui));
  assert.deepEqual(dead, [], `UI 호출부가 없는 엔진 액션: ${dead.join(", ")}`);
});

test("골드비료 — 사는 곳과 쓰는 곳이 모두 있다", () => {
  // 사기: buyFertilizer(_, true) · 쓰기: 밭 시트의 onFert(true)
  // (fertilize 자체는 gold 를 변수로 받으므로, 두 갈래가 UI 에 다 있는지는 onFert 로 본다)
  assert.ok(/buyFertilizer\([^)]*,\s*true\)/.test(ui), "골드비료를 살 수 있는 UI 가 없다");
  assert.ok(/onFert\(true\)/.test(ui), "골드비료를 쓸 수 있는 UI 가 없다");
});

test("일반 비료 — 사는 곳과 쓰는 곳이 모두 있다", () => {
  assert.ok(/buyFertilizer\([^)]*,\s*false\)/.test(ui), "일반 비료 구매 UI 가 없다");
  assert.ok(/onFert\(false\)/.test(ui), "일반 비료 사용 UI 가 없다");
});

test("공방 3택 — 팔기/간식/선물이 모두 UI 에서 도달 가능", () => {
  for (const use of ["sell", "treat", "gift"])
    assert.ok(ui.includes(`"${use}"`), `공방 수령 방식 '${use}' 가 UI 에 없다`);
});
