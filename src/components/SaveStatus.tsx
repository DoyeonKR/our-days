import Icon from "@/components/Icon";

export type SavePhase = "idle" | "saving" | "saved" | "restored" | "error";

export type SaveFeedback = {
  phase: SavePhase;
  message?: string;
};

const DEFAULT_MESSAGE: Record<Exclude<SavePhase, "idle">, string> = {
  saving: "저장 중…",
  saved: "저장 완료",
  restored: "기존 값으로 복원했어요",
  error: "저장을 확인해 주세요",
};

/**
 * 서버 저장 결과를 숨기지 않는 공용 상태 라벨.
 * `saved`는 실제 쓰기가 확인된 뒤에만 사용하고, 실패 후 로컬 롤백은 `restored`로 구분한다.
 */
export default function SaveStatus({
  feedback,
  dark = false,
  className = "",
}: {
  feedback: SaveFeedback;
  dark?: boolean;
  className?: string;
}) {
  if (feedback.phase === "idle") return null;

  const { phase } = feedback;
  const icon =
    phase === "saving"
      ? "clock"
      : phase === "saved"
        ? "circleCheck"
        : phase === "restored"
          ? "refresh"
          : "circleX";
  const palette = dark
    ? phase === "error"
      ? "bg-rose-400/15 text-rose-200 ring-white/10"
      : phase === "restored"
        ? "bg-amber-300/15 text-amber-100 ring-white/10"
        : phase === "saving"
          ? "bg-sky-300/15 text-sky-100 ring-white/10"
          : "bg-emerald-300/15 text-emerald-100 ring-white/10"
    : phase === "error"
      ? "bg-rose/10 text-rose-deep ring-rose/20"
      : phase === "restored"
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : phase === "saving"
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span
      role={phase === "error" ? "alert" : "status"}
      aria-live={phase === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${palette} ${className}`}
    >
      <Icon
        name={icon}
        size={12}
        className={phase === "saving" ? "animate-pulse" : undefined}
      />
      <span>{feedback.message ?? DEFAULT_MESSAGE[phase]}</span>
    </span>
  );
}
