import Icon from "@/components/Icon";

/** Shared actionable loading/error/empty states; errors must never look like missing data. */
export default function StatePanel({ title, detail, kind = "empty", onRetry, busy = false }: {
  title: string;
  detail?: string;
  kind?: "empty" | "error" | "loading";
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`state-panel-v2 state-panel-${kind}`} role={kind === "error" ? "alert" : "status"} aria-busy={kind === "loading" || busy}>
      <span className="state-panel-icon" aria-hidden="true"><Icon name={kind === "error" ? "circleX" : kind === "loading" ? "clock" : "sparkles"} size={24} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
        {onRetry && <button type="button" disabled={busy} onClick={onRetry} className="tap state-panel-action"><Icon name="refresh" size={14} />{busy ? "확인 중…" : "다시 불러오기"}</button>}
      </div>
    </div>
  );
}
