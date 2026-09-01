// 펫 화면의 '죽은 끝' lock.
// [사용자 리포트 2026-09-01 "다음 진화까지 몇 레벨 남았어 라는 문구는 없어진 것 같은데"]
//
// 신화형(stage 5)에 닿은 펫에게 **화면에 남는 선택지가 하나도 없었다**:
//   · 다음 진화 카드 — evolutionPreview 가 stage 5 에 needLevel:null 을 주고,
//     렌더가 `needLevel == null` 이면 통째로 null 을 반환해 카드 자리가 빈칸이 됐다.
//   · 은퇴 버튼 — 엔진(retirePet)은 stage>=4 를 허용하고 mythic.test 가 "신화형도
//     박물관에 갈 수 있다"를 잠가 뒀는데, UI 게이트만 `stage === 4` 였다.
//
// 둘이 겹쳐서 호랑이가 된 순간 **아무것도 못 하는 화면**이 됐다. 하나만 고치면 반쪽이라
// 여기서 둘을 같이 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");
const raw = readFileSync(join(SRC, "components", "IslandGame.tsx"), "utf8");
/** ⚠ 주석을 먼저 지운다 — 이 저장소는 '왜'를 주석에 길게 쓴다. 위 설명문이 그대로
 *  스캔에 걸려 규칙이 아닌 문장을 위반으로 잡는 사고를 이미 겪었다(hscroll.test). */
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("★★ 은퇴 게이트가 엔진과 같은 조건이다 — 신화형도 박물관에 갈 수 있어야 한다", () => {
  const island = readFileSync(join(SRC, "lib", "island.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  // 엔진: petStage(...) < 4 이면 no-op → 4 이상은 전부 허용
  assert.ok(
    /petStage\(s\.pet\.form\)\s*<\s*4/.test(island),
    "retirePet 의 게이트 모양이 바뀌었다 — 이 테스트부터 고쳐라",
  );
  // UI: 같은 조건이어야 한다. `=== 4` 면 신화형에서 버튼이 사라진다.
  assert.ok(
    /stage\s*>=\s*4\s*&&/.test(src),
    "은퇴 버튼이 stage >= 4 가 아니다 — 최종형에서만 뜨면 그 위는 막다른 길이다",
  );
  assert.ok(
    !/\bstage\s*===\s*4\s*&&/.test(src),
    "은퇴 버튼이 아직 stage === 4 로 걸려 있다",
  );
});

test("★★ 진화 사다리 끝에서도 화면이 말을 한다 — 빈칸으로 두지 않는다", () => {
  // needLevel 이 null 인 폼(사다리 끝)에서 렌더가 곧장 null 을 반환하면 카드 자리가
  // 빈칸이 되고, 사용자에겐 '문구가 없어진' 것으로 보인다.
  const i = src.indexOf("evolutionPreview(s)");
  assert.ok(i >= 0, "evolutionPreview 호출부를 못 찾았다");
  const block = src.slice(i, i + 1200);
  const guard = block.indexOf("return null");
  assert.ok(guard >= 0, "가드를 못 찾았다 — 이 테스트부터 고쳐라");
  // 곧장 null 로 가기 **전에** 끝 안내를 내보내는 분기가 있어야 한다
  const endBranch = block.slice(0, guard);
  assert.ok(
    /needLevel\s*==\s*null\s*&&\s*!ev\.target/.test(endBranch),
    "사다리 끝(needLevel·target 둘 다 없음)을 따로 다루지 않는다 — 빈칸이 된다",
  );
  assert.ok(
    /진화의 끝|더 자랄 곳/.test(endBranch),
    "끝에 닿았다는 **문구**가 없다 — 조건만 나누고 아무 말도 안 하면 여전히 빈칸이다",
  );
  assert.ok(
    /박물관/.test(endBranch),
    "끝에서 다음에 뭘 할 수 있는지(박물관) 안내가 없다 — 끝은 알려주되 길은 막는 셈",
  );
});
