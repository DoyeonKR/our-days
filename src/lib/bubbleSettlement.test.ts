import assert from "node:assert/strict";
import test from "node:test";
import { createIsland, type IslandState } from "./island.ts";
import { SettlementConflictError, persistBubbleSettlement } from "./bubbleSettlement.ts";

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

test("40001 충돌은 최신 행으로 재시도하고 그 결과 행을 반환한다", async () => {
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

test("충돌 후 두 번째 저장의 **불명확 오류**는 호출부에 그대로 전달한다", async () => {
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

test("★ 40001 이 계속돼도 판이 소멸하지 않는다 — 재시도 가능한 전용 오류로 알린다 [리뷰 2026-08-26]", () => {
  /* 예전엔 재시도 1회의 두 번째 40001 이 불명확 오류와 같은 경로로 전파돼, 미저장이
     확정인데도 '확인 불가' 문구 + 정산 래치로 판 보상이 그대로 소멸했다.
     지금은 소횟수 반복 후 SettlementConflictError(code 40001)로 구분해 던진다. */
  let writes = 0;
  return assert
    .rejects(
      persistBubbleSettlement("couple", row(), run, {
        load: async () => row(3),
        save: async () => {
          writes += 1;
          throw { code: "40001" };
        },
      }),
      (e: unknown) => e instanceof SettlementConflictError,
    )
    .then(() => {
      assert.ok(writes >= 3, `40001 재시도가 ${writes}회뿐 — 연속 충돌을 못 견딘다`);
    });
});
