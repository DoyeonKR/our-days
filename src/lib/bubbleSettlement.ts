import { finishBubble, type IslandState } from "./island.ts";

export type BubbleRun = { stage: number; score: number; coins: number };

export type SettlementRow = {
  state: IslandState;
  version: number;
};

type SettlementPorts<T extends SettlementRow> = {
  load: (coupleId: string | null) => Promise<T | null>;
  save: (coupleId: string | null, version: number, state: IslandState) => Promise<T>;
};

export type BubbleSettlement<T extends SettlementRow> = {
  row: T;
  reward: number;
  changed: boolean;
};

/** 40001 이 재시도 상한까지 반복된 경우 — 미저장이 **확정**이라 이중 지급 없이 다시 시도해도 된다. */
export class SettlementConflictError extends Error {
  readonly code = "40001";
  constructor() {
    super("상대의 섬 활동과 계속 겹치고 있어요. 다시 시도해 주세요.");
  }
}

/**
 * 보글보글 한 판을 정확히 한 번 정산한다.
 * 40001은 서버가 쓰기를 거절했다는 **확정** 신호라 최신 행으로 재계산해 재시도한다
 * (상대가 연달아 커밋하는 동안을 견디게 소횟수 반복 — 한 번만 하고 그대로 전파하면
 * '불명확 오류'와 같은 경로로 떨어져 판 보상이 소멸했다 [리뷰 2026-08-26]).
 * 결과가 불명확한 다른 오류는 재지급하지 않고 호출부로 전달한다.
 */
export async function persistBubbleSettlement<T extends SettlementRow>(
  coupleId: string | null,
  current: T,
  run: BubbleRun,
  ports: SettlementPorts<T>,
): Promise<BubbleSettlement<T>> {
  const reward = Math.max(0, Math.round(run.coins));
  let base: T | null = current;
  for (let attempt = 0; attempt < 4 && base; attempt++) {
    const next = finishBubble(base.state, run);
    if (next === base.state) return { row: base, reward: 0, changed: false };
    try {
      const row = await ports.save(coupleId, base.version, next);
      return { row, reward, changed: true };
    } catch (error) {
      if ((error as { code?: string })?.code !== "40001") throw error;
    }
    base = await ports.load(coupleId);
  }
  if (!base) throw new Error("최신 섬 상태를 불러오지 못했어요.");
  // 여기 도달 = 40001 만 4연속. 미저장 확정이므로 재시도 가능한 전용 오류로 알린다.
  throw new SettlementConflictError();
}
