"use client";

/* 홈 '작년 오늘' 한 장 — 지난해들의 오늘 남긴 기록이 있을 때만 뜬다. [2026-09-24 IA 개편]
 *
 * 작년 오늘은 예전에 두 벌이었다(일기장 안의 '지난 오늘의 우리' + 함께 탭의 '그날의 우리'). 전부는
 * 기록 › 추억 칸에 모았고, 홈에는 **있는 날에만** 한 장을 얹어 그리로 보낸다. 대부분의 날은 없다 —
 * 그래서 빈 카드를 그리지 않는다(상시 노출되는 '없어요' 카드는 소음이다).
 * ⚠ 전체 스냅샷(listMemorySnapshot)을 받지 않는다 — 홈은 열 때마다 불리므로 같은 날짜만 고른
 *   가벼운 조회(listOnThisDaySnapshot)를 쓴다. 과거는 오늘 바뀌지 않으니 실시간 구독도 없다.
 */

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { listOnThisDaySnapshot, signedPhotoUrl } from "@/lib/couple";
import { onThisDayMemories, type MemoryItem } from "@/lib/memories";
import { useDayTick } from "@/lib/useDayTick";

export default function MemoryTeaser({ coupleId, onOpen }: { coupleId: string; onOpen: () => void }) {
  const today = useDayTick();
  const [found, setFound] = useState<{ item: MemoryItem; count: number; thumb: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOnThisDaySnapshot(coupleId, today)
      .then(async (snap) => {
        const items = onThisDayMemories(snap, today);
        // 사진이 있는 추억을 먼저 — 한 장만 보여 주므로 눈에 걸리는 쪽으로
        const item = items.find((i) => i.mediaPath) ?? items[0];
        if (!item) {
          if (!cancelled) setFound(null);
          return;
        }
        const thumb = item.mediaPath ? await signedPhotoUrl(item.mediaPath).catch(() => null) : null;
        if (!cancelled) setFound({ item, count: items.length, thumb: thumb ?? null });
      })
      .catch(() => {
        if (!cancelled) setFound(null);
      });
    return () => {
      cancelled = true;
    };
  }, [coupleId, today]);

  if (!found) return null;
  const { item, count, thumb } = found;
  return (
    <button
      onClick={onOpen}
      aria-label={`${item.yearsAgo}년 전 오늘의 추억 보기`}
      className="tap cosmic-feed-card mt-5 flex w-full items-center gap-3 p-3 text-left"
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
      ) : (
        <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-glass2 text-2xl ring-1 ring-line">
          {item.emoji}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-rose-deep">
          {item.yearsAgo}년 전 오늘{count > 1 ? ` · 추억 ${count}개` : ""}
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-ink">{item.title}</span>
        {item.body && <span className="block truncate text-xs text-muted">{item.body}</span>}
      </span>
      <Icon name="chevronRight" size={16} className="shrink-0 text-muted" />
    </button>
  );
}
