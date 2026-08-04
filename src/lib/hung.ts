// 홈 빨랫줄 선택 규칙 — 순수 로직만(임포트 0). UI 와 데이터 계층이 같은 규칙을 쓴다.
//
// 왜 파일을 나눴나: couple.ts 는 supabase 클라이언트를 끌고 와서 node --test 로 못 읽는다.
// 규칙 자체는 순수하므로 여기 두면 테스트가 된다.

/** 끈에 걸 수 있는 최대 장수. 360px 화면에서 62px 폴라로이드 4장이 들어가는 상한이다. */
export const HUNG_MAX = 4;

/**
 * 걸기/내리기 한 번의 결과.
 *
 * 가득 찼을 때 새로 걸면 **가장 오래 걸린 것이 빠진다(FIFO)**.
 * '4장이 꽉 찼어요' 로 막으면 사용자가 뭘 뺄지 찾으러 되돌아가야 한다 — 그냥 밀어낸다.
 *
 * 순서 = 빨랫줄 왼쪽부터의 자리. 그래서 재정렬 없이 push 만 한다.
 */
export function nextHung(cur: readonly string[], path: string, max: number = HUNG_MAX): string[] {
  if (!path) return [...cur];
  if (cur.includes(path)) return cur.filter((x) => x !== path); // 내리기
  return [...cur, path].slice(-max); // 걸기(넘치면 앞에서 밀려남)
}

/** 저장 직전 정리 — 중복 제거 + 빈 값 제거 + 상한. 서버에 쓰레기를 넣지 않는다. */
export function cleanHung(paths: readonly string[], max: number = HUNG_MAX): string[] {
  return [...new Set(paths.filter(Boolean))].slice(0, max);
}
