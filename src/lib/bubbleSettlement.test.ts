import assert from "node:assert/strict";
import test from "node:test";
import { createIsland, type IslandState } from "./island.ts";
import { persistBubbleSettlement } from "./bubbleSettlement.ts";

type TestRow = {
  couple_id: string;
  state: IslandState;
  version: number;
  updated_by: string | null;
};

function row(version = 1): TestRow {
  return {
    couple_id: "couple",
    state: createIsland("테스트", null, new Date("2026-08-25T00:00:00+09:00").getTime()) as IslandState,
    version,
    updated_by: "user",
  };
}

const run = { stage: 2, score: 900, coins: 13 };

test("첫 저장 성공 결과만 보상 저장 완료로 반환한다", async () => {
  const current = row();
  let writes = 0;
  const result = await persistBubbleSettlement("couple", current, run, {
    load: async () => null,
    save: async (_id, version, state) => {
      writes += 1;
      return { ...current, state, version: version + 1 };
    },
  });
  assert.equal(writes, 1);
  assert.equal(result.reward, 13);
  assert.equal(result.row.version, 2);
});

test("40001 충돌만 최신 행으로 한 번 재시도하고 그 결과 행을 반환한다", async () => {
  const current = row();
  const fresh = row(8);
  let writes = 0;
  const result = await persistBubbleSettlement("couple", current, run, {
    load: async () => fresh,
    save: async (_id, version, state) => {
      writes += 1;
      if (writes === 1) throw { code: "40001" };
      return { ...fresh, state, version: version + 1 };
    },
  });
  assert.equal(writes, 2);
  assert.equal(result.row.version, 9);
  assert.equal(result.reward, 13);
});

test("불명확한 저장 오류를 성공으로 삼거나 재지급하지 않는다", async () => {
  let writes = 0;
  await assert.rejects(
    persistBubbleSettlement("couple", row(), run, {
      load: async () => row(2),
      save: async () => {
        writes += 1;
        throw new Error("network lost");
      },
    }),
    /network lost/,
  );
  assert.equal(writes, 1);
});

test("충돌 후 두 번째 저장 실패도 호출부에 전달한다", async () => {
  let writes = 0;
  await assert.rejects(
    persistBubbleSettlement("couple", row(), run, {
      load: async () => row(3),
      save: async () => {
        writes += 1;
        if (writes === 1) throw { code: "40001" };
        throw new Error("retry failed");
      },
    }),
    /retry failed/,
  );
  assert.equal(writes, 2);
});
