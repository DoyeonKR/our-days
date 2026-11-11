/* 솔로 섬 — 커플 연동 없이 굴리는 로컬 섬. [사용자 리포트 2026-08-12
 * "혼자서라도 할 수 있는게 있었으면 좋겠어 — 같이할 상대방이 없으면 즐길 수 없는 것 같아서"]
 *
 * 섬 엔진(island.ts)은 순수라 상태가 어디 있든 돈다. 서버 행(couple_island)과 같은
 * 모양(IslandRow)을 localStorage 에 두고, 데이터 계층(couple.ts 의 loadIsland/saveIsland/
 * watchIsland)이 coupleId 유무로 서버/로컬을 가른다 — 화면은 저장소를 모른다.
 *
 * 연동하면 **로컬 섬이 우리 섬으로 승격**된다(loadIsland 가 처리): 혼자 키운 알이
 * 연동한다고 사라지면 그건 벌이다. 둘 다 솔로 섬이 있으면 먼저 연동을 완료한 쪽의
 * 섬이 남는다(서버 생성이 커플당 1회) — 나중 쪽의 로컬 섬은 지우지 않고 남겨 둔다
 * (덮어쓰기·삭제보다 보존이 안전하다. 서버 섬이 있으면 어차피 안 읽힌다).
 */

import type { IslandState } from "./island";

/** couple.ts 의 IslandRow 와 같은 모양 — 순환 import 를 피해 여기서 다시 적는다. */
export type SoloIslandRow = {
  couple_id: string;
  state: IslandState;
  version: number;
  updated_by: string | null;
  /** 이 기기에 못 썼다(저장 공간 가득 · 프라이빗 모드) — 화면이 경고를 띄운다. 쓰기에 성공하면 없다. */
  unsaved?: true;
};
/** 로컬 저장이 실패했을 때 쏘는 신호 — 2026-11-11 리뷰: 실패가 조용해서 앱을 닫으면 그동안 한 일이 사라지는 걸 몰랐다. */
export const SOLO_FAIL_EVENT = "ourdays:solo-island-fail";
export const SOLO_FAIL_TEXT = "이 기기에 섬을 저장하지 못했어요 — 저장 공간을 비우거나 개인 정보 보호 모드를 끄지 않으면 앱을 닫을 때 사라져요";
/** 저장 응답이 '이 기기에 못 씀'인가(서버 행에는 없는 표시). */
export const soloSaveFailed = (row: unknown): boolean => !!(row as { unsaved?: unknown } | null)?.unsaved;

const KEY = "ourdays.island.solo.v1";
/** 로컬 행의 couple_id 표식 — 서버 uuid 와 절대 겹치지 않는 값. */
export const SOLO_ID = "solo";
/** 저장 때마다 쏘는 같은-탭 변경 신호 — 서버 realtime 의 로컬 대응물.
 *  (storage 이벤트는 **다른 탭**에만 가서, 게임 화면→홈(HomePet) 갱신이 안 됐다.) */
export const SOLO_EVENT = "ourdays:solo-island";

export function getSoloIsland(): SoloIslandRow | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as SoloIslandRow;
    return r?.state?.pet ? r : null;
  } catch {
    return null;
  }
}

/** 저장(버전 증가). 솔로는 경쟁자가 없어 낙관적 락이 필요 없지만, 화면 코드가
 *  서버와 같은 계약(버전 증가한 행 반환)을 기대하므로 모양을 맞춘다. */
export function saveSoloIsland(state: IslandState): SoloIslandRow {
  const prev = getSoloIsland();
  const row: SoloIslandRow = {
    couple_id: SOLO_ID,
    state,
    version: (prev?.version ?? 0) + 1,
    updated_by: null,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(row));
  } catch {
    /* 저장 실패(프라이빗 모드 · 공간 가득) — 세션 안에서는 화면 상태로 계속 돌되, **조용히 넘기지 않는다** */
    row.unsaved = true;
    try {
      window.dispatchEvent(new CustomEvent(SOLO_FAIL_EVENT, { detail: SOLO_FAIL_TEXT }));
    } catch {
      /* window 없음 */
    }
  }
  try {
    // 홈(HomePet)처럼 이 섬을 구독하는 화면이 같은 탭에서 즉시 갱신되게 알린다
    window.dispatchEvent(new Event(SOLO_EVENT));
  } catch {
    /* SSR/테스트 등 window 없음 — 무해 */
  }
  return row;
}

/** 승격 후 정리 — 서버 업로드가 **확인된 뒤에만** 부른다. */
export function clearSoloIsland(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 못 지워도 무해 — 서버 섬이 있으면 로컬은 안 읽힌다 */
  }
}
