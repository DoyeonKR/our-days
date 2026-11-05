/* 월간 카드 공유 — 추억 탭과 매달 팝업이 같은 길을 쓴다. */
import { listMonthPhotos, photoInteractionCounts, signedPhotoUrls } from "@/lib/couple";
import type { MonthlyRecap } from "@/lib/memories";
import { bestPhotos } from "@/lib/photoalbum";

export async function shareMonthCard(coupleId: string, recap: MonthlyRecap): Promise<"shared" | "saved"> {
  const [{ renderRecapCard, shareOrDownload }, photos] = await Promise.all([import("@/lib/recapcard"), listMonthPhotos(coupleId, recap.monthKey)]);
  const { hearts, comments } = await photoInteractionCounts(photos.map((p) => p.id));
  const best = bestPhotos(photos, hearts, comments);
  const urls = await signedPhotoUrls(best.map((p) => p.thumbPath || p.path));
  const blob = await renderRecapCard(recap, best.map((p) => urls[p.thumbPath || p.path]).filter(Boolean));
  if (!blob) throw new Error("card");
  return shareOrDownload(blob, `haru-${recap.monthKey}.png`);
}
