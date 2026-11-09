/* 모험 캔버스 그리기 박자(순수) — 120Hz 화면에서도 초당 60장까지만 그린다(배터리). README §14.6
 * 엔진 틱은 지난 시간으로 따로 돌므로 그림만 거른다. */

export const DRAW_MS = 1000 / 60;

/** 이번 rAF 에 그릴지. acc = 지난 그림 뒤 쌓인 시간(ms). 1ms 여유는 60Hz 의 16.6 · 16.7ms 흔들림 몫 */
export function frameGate(acc: number, dt: number, min = DRAW_MS): { draw: boolean; acc: number } {
  const t = acc + Math.max(0, dt);
  if (t + 1 < min) return { draw: false, acc: t };
  return { draw: true, acc: Math.min(min, t - min > 0 ? t - min : 0) };
}

/** 멈춘 화면(일시정지 · 첫 안내 · 다음 생물 고르기)은 쓰러짐 · 입자가 끝날 만큼만 더 그리고 멈춘다 */
export const FREEZE_AFTER_MS = 800;
export function frozenDraw(frozenFor: number, dirty: boolean): boolean {
  return dirty || frozenFor < FREEZE_AFTER_MS;
}
