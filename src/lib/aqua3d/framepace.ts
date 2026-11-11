/* 수조 렌더 해상도 조절 (2026-11-02) [사용자: "3d 엔진을 도입하면서 프레임이 조금 떨어지는 것 같아 최대한 프레임을 높여줘 부드럽게 보고싶어"]
 * 프레임이 모자라면 해상도를 먼저 내린다 — 부드러움을 그림 선명도보다 앞에 둔다. 여유가 생기면 천천히 되돌린다.
 * ⚠ iPhone 저전력 모드는 rAF 자체를 30Hz 로 묶는다. 그때 해상도를 내려도 빨라지지 않으니, 내린 뒤 좋아지지 않으면 되돌리고 한동안 시도하지 않는다.
 * ⚠ 2026-11-05 — '느리다'를 고정 21ms 로 재면 90Hz(그리는 간격 22ms) · 144Hz 화면이 영원히 느린 기기로 보여 30초마다 화면이 흐려졌다.
 *   이제 화면 주사율(vsync)을 재고, 그 주사율에서 기대하는 간격(vsync × 몇 번에 한 번 그리나)보다 25% 이상 느릴 때만 느리다고 본다.
 * ⚠ 2026-11-11 — 해상도가 바닥(DPR 2 이상은 CSS 1:1)에 닿아도 느린 폰은 거기서 멈췄다. 그 아래로는 후처리를 한 칸씩 덜어 낸다(POST_LEVELS):
 *   1 색 갈라짐 끔 → 2 빛 번짐 끔 → 3 장면 그림 0.75배(화면 그림과 따로). 해상도와 같은 시험 · 되돌리기 규칙을 쓴다 — 30Hz 로 묶인 화면에선 효과를 헛되이 잃지 않는다.
 *   되돌릴 땐 거꾸로(후처리를 먼저 되찾고, 그다음 해상도), 해상도와 같은 점점 드문 오르기(upWait 두 배)로.
 * 순수 함수 — 기기 없이 시험한다(framepace.test). */

/** 그리는 최소 간격 — 60Hz · 90Hz 는 모든 프레임, 120Hz 는 격 프레임(60), 144Hz 는 격 프레임(72).
 *  15 로 두었을 때 90Hz 가 45fps, 144Hz 가 48fps 로 떨어졌다. 10.5 는 90Hz(11.1ms)를 통과시키고 120Hz(8.3ms)는 거른다. */
export const MIN_FRAME_MS = 10.5;
const SLOW_RATIO = 1.25;
const FAST_RATIO = 1.08;
const SETTLE_MS = 1500;
const STEP_DOWN = 0.2;
const STEP_UP = 0.1;
const FIRST_HOLD_MS = 30000;
const MAX_HOLD_MS = 300000;

/** 몇 번의 vsync 마다 한 번 그리게 되나 — scene 의 tick 과 같은 판단(MIN_FRAME_MS 를 넘는 첫 vsync) */
export const framesPerDraw = (vsyncMs: number) => Math.max(1, Math.ceil((MIN_FRAME_MS - 0.5) / Math.max(1, vsyncMs)));

/** 기기 배율에 맞춘 해상도 바닥 — CSS 픽셀 0.75배(DPR 2 에서 기기 픽셀의 37%)까지 내리면 실측 255×320 으로 뭉개졌다.
 *  DPR 2 이상은 CSS 픽셀 1:1 을 바닥으로 둔다. 그 아래로는 채우기 비용이 줄어도 장면이 그리기 호출 위주라 빨라지는 몫이 작다. */
export const ratioFloor = (dpr: number) => Math.max(0.75, Math.min(1, dpr * 0.5));
/** 해상도 바닥 아래의 후처리 계단 수 — post.ts 의 setLevel 과 같은 뜻(0 전부 · 1 색 갈라짐 끔 · 2 빛 번짐 끔 · 3 장면 그림 0.75배) */
export const POST_LEVELS = 3;

export type Pacer = {
  ratio: () => number;
  /** 화면이 그려지지 않은 rAF 간격도 넣는다 — 주사율을 잰다 */
  observe: (rawMs: number) => void;
  /** 그린 프레임 간격(ms)과 그 직전 rAF 간격을 넣으면, 해상도를 바꿀 때만 새 값을 돌려준다 */
  feed: (intervalMs: number, rawMs?: number) => number | null;
  /** 지금 재고 있는 주사율 간격(ms) */
  vsync: () => number;
  /** 후처리 계단(0 = 전부) — feed 가 바꾸면 scene 이 다음 프레임에 post.setLevel 로 옮긴다 */
  level: () => number;
};

export function createPacer(max: number, min = 0.75): Pacer {
  const top = Math.max(min, max);
  let ratio = top, avg = 16.7, since = 0, upWait = 6000, hold = 0, backoff = FIRST_HOLD_MS;
  // 주사율 — 가장 짧은 간격을 따르되, 더 긴 간격만 이어지면(30Hz 로 묶인 화면) 아주 천천히 따라 올라간다.
  // GPU 가 느려서 길어진 간격은 금방 따라가지 않아야 해상도 시험을 먼저 해 볼 수 있다.
  let vsync = 1000 / 60;
  let level = 0;
  /** 시험 중인 한 칸 — 해상도(from) 또는 후처리 계단(fromLevel) */
  let trial: { before: number; from: number; fromLevel: number } | null = null;
  /** 시험이 실패했던 박자(vsync 의 몇 배) — 그 박자에 그대로 머물면 다시 시험하지 않는다 */
  const failedMultiples = new Set<number>();
  const observe = (raw: number) => {
    if (!(raw > 2 && raw < 250)) return;
    vsync = raw < vsync ? raw : vsync + (raw - vsync) * 0.002;
  };
  const multiple = () => avg / vsync;
  const onMultiple = () => { const m = multiple(), r = Math.round(m); return r >= 2 && Math.abs(m - r) < 0.08 ? r : 0; };
  return {
    ratio: () => ratio,
    vsync: () => vsync,
    level: () => level,
    observe,
    feed(ms, raw = ms) {
      if (ms <= 0 || ms > 250) return null; // 탭 전환 · 일시 정지는 성능이 아니다
      observe(raw);
      avg += (ms - avg) * 0.06;
      since += ms;
      if (hold > 0) hold -= ms;
      if (since < SETTLE_MS) return null;
      if (trial) {
        const { before, from, fromLevel } = trial;
        trial = null;
        // 내렸는데 안 빨라졌다 — 화면 쪽 제한(저전력 모드)이다. 되돌리고 쉰다. 쉬는 시간은 실패할 때마다 두 배(5분까지)
        if (avg > before * 0.93) {
          const ratioTrial = ratio !== from;
          ratio = from;
          level = fromLevel;
          since = 0;
          hold = backoff;
          backoff = Math.min(MAX_HOLD_MS, backoff * 2);
          const m = onMultiple();
          if (m) failedMultiples.add(m);
          // 후처리 계단 시험이었으면 해상도는 그대로 — 캔버스 크기를 다시 잡지 않게 null
          return ratioTrial ? ratio : null;
        }
        backoff = FIRST_HOLD_MS;
      }
      if (hold > 0) return null;
      const expected = vsync * framesPerDraw(vsync);
      // vsync 의 정수 배에 딱 붙어 있고, 그 박자에서 이미 실패했다면 화면이 정한 박자다 — 해상도를 내려도 안 빨라진다
      const blocked = failedMultiples.has(onMultiple());
      if (avg > expected * SLOW_RATIO && !blocked && (ratio > min || level < POST_LEVELS)) {
        trial = { before: avg, from: ratio, fromLevel: level };
        since = 0;
        if (ratio > min) { ratio = Math.max(min, Math.round((ratio - STEP_DOWN) * 100) / 100); return ratio; }
        // 해상도는 바닥 — 후처리를 한 칸 덜어 낸다(해상도는 그대로라 돌려줄 새 비율이 없다)
        level++;
        return null;
      }
      // 되찾기는 거꾸로 — 후처리 계단을 먼저, 다 되찾은 뒤에 해상도
      if (avg < expected * FAST_RATIO && level > 0 && since >= upWait) {
        level--;
        since = 0;
        upWait = Math.min(60000, upWait * 2);
        return null;
      }
      if (avg < expected * FAST_RATIO && ratio < top && since >= upWait) {
        ratio = Math.min(top, Math.round((ratio + STEP_UP) * 100) / 100);
        since = 0;
        upWait = Math.min(60000, upWait * 2); // 오르내림을 되풀이하지 않게 점점 드물게
        return ratio;
      }
      return null;
    },
  };
}
