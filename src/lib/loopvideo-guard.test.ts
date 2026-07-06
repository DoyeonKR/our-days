// LoopVideo 무한 복구 루프 회귀 lock. [2026-07-03]
// 영상이 실제 삭제되면 재서명해도 매번 새 URL → src 기반 캡이 안 됨.
// onError→onExpired 를 무한 호출하면 evict→재조회→같은 죽은 URL 네트워크 루프가 된다.
// onPlaying 에서 리셋되는 에러 카운터 + MAX 캡이 반드시 있어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(import.meta.dirname, "..", "components", "LoopVideo.tsx"),
  "utf8",
);

test("LoopVideo: onError 재서명 재시도에 캡(누적 카운터) 있음", () => {
  assert.ok(/errCountRef/.test(src), "에러 카운터(errCountRef)가 없음");
  assert.ok(/MAX_RECOVER/.test(src), "재시도 상한(MAX_RECOVER)이 없음");
  // onError 가 무조건 onExpired 를 부르지 않고 카운터 가드를 거쳐야 함
  assert.ok(
    /errCountRef\.current\s*<=?\s*MAX_RECOVER/.test(src),
    "onError 가 MAX_RECOVER 가드 없이 onExpired 를 호출 (무한 루프 위험)",
  );
  // onPlaying 이 카운터를 리셋(성공 재생 시 회복)
  assert.ok(
    /onPlaying=\{[^}]*errCountRef\.current\s*=\s*0/.test(src.replace(/\s+/g, " ")),
    "onPlaying 이 errCountRef 를 리셋하지 않음",
  );
});
