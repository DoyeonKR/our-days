/* 새 버전 새로고침 뒤 보던 탭으로 — UpdateChip(자동 적용 · 칩) ↔ page.tsx 의 약속(2026-11-11).
 *
 * 새 버전 자동 적용(2026-11-04 사용자 요청 — 그대로 둔다)은 앱으로 돌아오는 순간 새로고침해서, 일기 · 계획 탭을 보던 사람도
 * 늘 홈으로 떨어졌다. page 는 지금 탭을 이 탭의 sessionStorage 에 적어 두고, UpdateChip 은 새로고침 직전에 표식을 남긴다.
 * 다음 부팅에서 표식이 있을 때 **한 번만** 그 탭을 되살린다(평소 새로고침 · 새 창은 늘 홈 — 예전 그대로).
 * 알림 · 링크(?go=)로 갈 곳이 있으면 그쪽이 이긴다. */

const VIEW_KEY = "ourdays:view";
const FLAG_KEY = "ourdays:update-reload";

/** page — 탭이 바뀔 때마다 */
export function rememberView(view: string): void {
  try {
    sessionStorage.setItem(VIEW_KEY, view);
  } catch {
    /* 저장소를 못 쓰면 되살리지 않을 뿐 */
  }
}

/** UpdateChip — 새 버전으로 새로고침하기 직전에 */
export function markUpdateReload(): void {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    /* 저장소를 못 쓰면 홈으로 열린다(예전과 같다) */
  }
}

/** page — 부팅 때 한 번. 업데이트 새로고침 뒤면 그 전 탭(허용 목록 안일 때만), 아니면 null. 표식은 바로 지운다. */
export function takeUpdateReloadView<T extends string>(allowed: readonly T[]): T | null {
  try {
    if (!sessionStorage.getItem(FLAG_KEY)) return null;
    sessionStorage.removeItem(FLAG_KEY);
    const v = sessionStorage.getItem(VIEW_KEY);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  } catch {
    return null;
  }
}
