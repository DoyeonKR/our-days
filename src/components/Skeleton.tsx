/** 로딩 스켈레톤 (실제 카드 형태를 모사 → 체감 대기시간·레이아웃 시프트 감소). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-shimmer rounded-lg ${className}`} />;
}

/** 리스트 행 스켈레톤 (아이콘 원 + 2줄 텍스트). */
export function SkeletonRow() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-line"
    >
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
    </div>
  );
}

/** N개 리스트 스켈레톤. role=status 로 스크린리더에 로딩 알림. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="불러오는 중">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
