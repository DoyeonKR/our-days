/* 수조 렌더 해상도 조절 (2026-11-02) [사용자: "3d 엔진을 도입하면서 프레임이 조금 떨어지는 것 같아 최대한 프레임을 높여줘 부드럽게 보고싶어"]
 * 프레임이 모자라면 해상도를 먼저 내린다 — 부드러움을 그림 선명도보다 앞에 둔다. 여유가 생기면 천천히 되돌린다.
 * ⚠ iPhone 저전력 모드는 rAF 자체를 30Hz 로 묶는다. 그때 해상도를 내려도 빨라지지 않으니, 내린 뒤 좋아지지 않으면 되돌리고 한동안 시도하지 않는다.
 * 순수 함수 — 기기 없이 시험한다(framepace.test). */

/** 60Hz 프레임은 모두 통과시키고 120Hz 화면에선 격 프레임만 그린다 — 눈에는 부드럽고 배터리를 두 배로 쓰지 않는다 */
export const MIN_FRAME_MS = 15;
const SLOW_MS = 21;
const FAST_MS = 18;
const SETTLE_MS = 1500;
const STEP_DOWN = 0.2;
const STEP_UP = 0.1;

export type Pacer = { ratio: () => number; feed: (intervalMs: number) => number | null };

export function createPacer(max: number, min = 0.75): Pacer {
  const top = Math.max(min, max);
  let ratio = top, avg = 16.7, since = 0, upWait = 6000, hold = 0;
  let trial: { before: number; from: number } | null = null;
  return {
    ratio: () => ratio,
    /** 프레임 간격(ms)을 넣으면, 해상도를 바꿀 때만 새 값을 돌려준다 */
    feed(ms) {
      if (ms <= 0 || ms > 250) return null; // 탭 전환 · 일시 정지는 성능이 아니다
      avg += (ms - avg) * 0.06;
      since += ms;
      if (hold > 0) hold -= ms;
      if (since < SETTLE_MS) return null;
      if (trial) {
        const { before, from } = trial;
        trial = null;
        // 내렸는데 안 빨라졌다 — 화면 쪽 제한(저전력 모드)이다. 되돌리고 오래 쉰다
        if (avg > before * 0.93) {
          ratio = from;
          since = 0;
          hold = 30000;
          return ratio;
        }
      }
      if (hold > 0) return null;
      if (avg > SLOW_MS && ratio > min) {
        trial = { before: avg, from: ratio };
        ratio = Math.max(min, Math.round((ratio - STEP_DOWN) * 100) / 100);
        since = 0;
        return ratio;
      }
      if (avg < FAST_MS && ratio < top && since >= upWait) {
        ratio = Math.min(top, Math.round((ratio + STEP_UP) * 100) / 100);
        since = 0;
        upWait = Math.min(60000, upWait * 2); // 오르내림을 되풀이하지 않게 점점 드물게
        return ratio;
      }
      return null;
    },
  };
}
