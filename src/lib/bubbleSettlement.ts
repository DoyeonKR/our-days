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

/**
 * 보글보글 한 판을 정확히 한 번 정산한다.
 * 40001은 서버가 쓰기를 거절했다는 확정 신호라 최신 행으로 한 번만 재계산하고,
 * 결과가 불명확한 다른 오류는 재지급하지 않고 호출부로 전달한다.
 */
export async function persistBubbleSettlement<T extends SettlementRow>(
  coupleId: string | null,
  current: T,
  run: BubbleRun,
  ports: SettlementPorts<T>,
): Promise<BubbleSettlement<T>> {
  const reward = Math.max(0, Math.round(run.coins));
  const next = finishBubble(current.state, run);
  if (next === current.state) return { row: current, reward: 0, changed: false };

  try {
    const row = await ports.save(coupleId, current.version, next);
    return { row, reward, changed: true };
  } catch (error) {
    if ((error as { code?: string })?.code !== "40001") throw error;
  }

  const fresh = await ports.load(coupleId);
  if (!fresh) throw new Error("최신 섬 상태를 불러오지 못했어요.");
  const retry = finishBubble(fresh.state, run);
  if (retry === fresh.state) return { row: fresh, reward: 0, changed: false };
  const row = await ports.save(coupleId, fresh.version, retry);
  return { row, reward, changed: true };
}
