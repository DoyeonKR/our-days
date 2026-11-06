/* 월간 카드 공유 — 추억 탭과 매달 팝업이 같은 길을 쓴다. */
import { listMonthPhotos, photoInteractionCounts, signedPhotoUrls } from "@/lib/couple";
import type { MonthlyRecap } from "@/lib/memories";
import { bestPhotos } from "@/lib/photoalbum";

/** photoUrls — 이미 받은 사진 주소(매달 팝업). 있으면 사진 목록 · 하트 수 · 서명을 다시 받지 않는다. */
export async function shareMonthCard(coupleId: string, recap: MonthlyRecap, photoUrls?: readonly string[]): Promise<"shared" | "saved"> {
  const [{ renderRecapCard, shareOrDownload }, urls] = await Promise.all([
    import("@/lib/recapcard"),
    photoUrls ? Promise.resolve([...photoUrls]) : monthCardPhotos(coupleId, recap.monthKey),
  ]);
  const blob = await renderRecapCard(recap, urls);
  if (!blob) throw new Error("card");
  return shareOrDownload(blob, `haru-${recap.monthKey}.png`);
}

/** 카드에 실을 사진 — 하트 · 댓글이 많은 순(bestPhotos)의 썸네일 서명 주소 */
async function monthCardPhotos(coupleId: string, month: string): Promise<string[]> {
  const photos = await listMonthPhotos(coupleId, month);
  const { hearts, comments } = await photoInteractionCounts(photos.map((p) => p.id));
  const best = bestPhotos(photos, hearts, comments);
  const urls = await signedPhotoUrls(best.map((p) => p.thumbPath || p.path));
  return best.map((p) => urls[p.thumbPath || p.path]).filter(Boolean);
}
