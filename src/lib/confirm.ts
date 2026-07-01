// 프로미스 기반 공용 확인 다이얼로그 스토어 (window.confirm 대체 — 앱 테마/다크 적용).
// 사용: const ok = await confirmDialog("삭제할까요?"); if (!ok) return;

export type ConfirmReq = {
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
};

let current: ConfirmReq | null = null;
let listeners: ((r: ConfirmReq | null) => void)[] = [];

export function subscribeConfirm(fn: (r: ConfirmReq | null) => void): () => void {
  listeners.push(fn);
  fn(current);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function confirmDialog(
  opts: string | Omit<ConfirmReq, "resolve">,
): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  // 이전 대기 요청이 있으면 취소로 정리(한 번에 하나)
  if (current) current.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...o, resolve };
    listeners.forEach((l) => l(current));
  });
}

/** ConfirmHost 전용 — 버튼 응답. */
export function resolveConfirm(v: boolean): void {
  if (!current) return;
  current.resolve(v);
  current = null;
  listeners.forEach((l) => l(null));
}
