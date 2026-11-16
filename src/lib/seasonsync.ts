/* 시즌 미션 — 모험 수를 섬에 올리기 (2026-11-13)
 *
 * 모험은 사람마다 따로 저장되고(adventure_saves · 내 행만 보인다) 섬 행과 다른 곳이라, 모험 판 하나로 섬을 같이 저장할 수 없다.
 * 그래서 이 기기에 '이번 달 내가 센 수'를 먼저 적고(판이 끝난 그 틱 · 동기 — 끊겨도 남는다), 섬의 s.season.adv[내 id] 에
 * '큰 값으로' 올린다(seasonAdvMerge). 더하기가 아니라서 응답을 잃고 다시 보내도 · 오프라인 뒤에 보내도 두 번 세지 않는다.
 * 대가: 같은 사람이 두 기기에서 모험을 하면 두 기기 수가 더해지지 않고 큰 쪽만 남는다(덜 세는 쪽 — 두 번 세지는 않는다).
 *
 * ⚠ 모험 탭 · 게임 허브가 부른다 — 이 파일은 정적으로 couple.ts(이미 첫 화면 그래프에 있다) · season.ts 만. 섬 엔진은 안 부른다.
 *   모험 탭은 이 기기 수(lib/seasontally — 가볍다)만 정적으로 부르고, 이 파일은 판이 끝날 때 동적 import 로 받는다. */
import { loadIsland, saveIsland } from "./couple.ts";
import { islandSnapshot } from "./islandstore.ts";
import { seasonAdvMerge, seasonOf, type AdvStat, type AdvTally } from "./season.ts";
import { readAdvTally } from "./seasontally.ts";

const ADV: readonly AdvStat[] = ["advBoss", "advCatch", "advWin"];

/** 섬에 이미 있는 내 값이 이 기기 수 이상인가 */
function upToDate(state: object, uid: string, tally: AdvTally): boolean {
  const v = seasonOf(state, tally.m);
  if (v.month !== tally.m) return false;
  const mine = v.adv[uid] ?? {};
  return ADV.every((k) => (mine[k] ?? 0) >= (tally[k] ?? 0));
}

let running: Promise<void> | null = null;

/** 이 기기 수를 섬에 올린다 — 이미 올라가 있으면 아무것도 안 한다. 버전 충돌이면 다시 읽어 두 번까지.
 *  실패는 삼킨다(다음 판 · 다음에 탭을 열 때 다시 올린다 — 값이 큰 값이라 늦어도 맞다). */
export function syncAdvTally(coupleId: string | null, uid: string | null, tally?: AdvTally | null): Promise<void> {
  if (!uid) return Promise.resolve();
  const run = async () => {
    const t = tally ?? readAdvTally(uid);
    if (!t) return;
    let row = islandSnapshot(coupleId).row;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!row || attempt > 0) row = await loadIsland(coupleId).catch(() => null);
      if (!row) return; // 섬이 없다(아직 시작 전) — 섬이 생긴 뒤에 올린다
      if (upToDate(row.state, uid, t)) return;
      const next = seasonAdvMerge(row.state, uid, t);
      if (next === row.state) return; // 이미 지난 달 · 사람 칸이 가득 — 올릴 수 없다
      try {
        await saveIsland(coupleId, row.version, next);
        return;
      } catch {
        /* 상대가 그 사이 저장했다 · 응답을 잃었다 — 다시 읽어 이미 들어갔는지부터 본다 */
      }
    }
  };
  // 한 번에 하나씩 — 연달아 끝난 판이 같은 버전으로 겹쳐 보내지 않게
  const p = (running ?? Promise.resolve()).then(run, run).catch(() => undefined);
  running = p;
  return p;
}
