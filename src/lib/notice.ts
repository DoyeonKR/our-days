export type NoticeKind = "success" | "error" | "info";
export type AppNotice = {
  id: string;
  kind: NoticeKind;
  message: string;
  durationMs?: number;
};

export const APP_NOTICE_EVENT = "ourdays:notice";

export function showNotice(
  message: string,
  kind: NoticeKind = "info",
  durationMs = kind === "error" ? 5_500 : 3_500,
): void {
  if (typeof window === "undefined") return;
  const notice: AppNotice = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    message,
    durationMs,
  };
  window.dispatchEvent(new CustomEvent<AppNotice>(APP_NOTICE_EVENT, { detail: notice }));
}
