/* 모험 전투 — 들어가면 전체 화면(2026-11-08 [사용자: "전투 들어가면 무조건 풀스크린 되도록"]). README §14.6
 * 브라우저의 전체 화면은 사용자의 탭 안에서만 열리므로, 전투를 여는 버튼의 클릭에서 먼저 부른다(enterBattleFullscreen).
 * ⚠ 아이폰 사파리엔 일반 요소의 전체 화면 기능 자체가 없다 — 거기선 fixed 창이 보이는 화면을 꽉 채우는 데서 멈춘다(홈 화면에 추가한 앱은 원래 전체 화면이다).
 * 실패해도 판은 그대로 돈다. 우리가 켠 전체 화면만 끈다(사용자가 이미 켜 둔 것은 건드리지 않는다). */

type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type Orient = ScreenOrientation & { lock?: (o: string) => Promise<void> };

let entered = false;

const current = () => document.fullscreenElement ?? (document as FsDoc).webkitFullscreenElement ?? null;

export function enterBattleFullscreen(): void {
  try {
    if (current()) return;
    const el = document.documentElement as FsEl;
    const done = () => {
      entered = true;
      (screen.orientation as Orient | undefined)?.lock?.("portrait")?.catch(() => {});
    };
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: "hide" }).then(done).catch(() => {});
    else if (el.webkitRequestFullscreen) {
      void el.webkitRequestFullscreen();
      done();
    }
  } catch {
    /* 지원하지 않는 브라우저 — fixed 창으로 충분하다 */
  }
}

export function exitBattleFullscreen(): void {
  if (!entered) return;
  entered = false;
  try {
    screen.orientation?.unlock?.();
    if (!current()) return;
    const d = document as FsDoc;
    if (d.exitFullscreen) void d.exitFullscreen().catch(() => {});
    else void d.webkitExitFullscreen?.();
  } catch {
    /* 이미 나왔다 */
  }
}
