/** Visual approval is manual, per form and per model revision, never inferred
 * from geometry tests, family membership or the presence of a reference image. */
// 승인된 key 목록은 style-approvals.json · profiles.json 에서 구운 결과다(scripts/aqua-approved.mjs, aquaapproved.test 가 대조).
// 두 원본을 직접 읽으면 지문 비교 하나 때문에 약 340KB(압축 약 105KB)가 수조 · 낚시 조각에 실렸다(2026-11-11).
import approved from "./approved-fish.json" with { type: "json" };
export const MODEL_REVISION = "source-volume-v3";
export const MIN_VISUAL_SCORE = 9;
export type FishModelReview = {
  revision: string;
  reference: string;
  scores: { silhouette: number; fins: number; markings: number; materials: number; motion: number };
  /** Repo paths to reference-matched front / side / oblique renders and a motion recording. */
  evidence: { front: string; side: string; oblique: string; motion: string };
  reviewedBy: string;
};

// No numerical ratings are claimed. User acceptance of the turtle-style baseline
// is recorded separately in style-approvals.json, per source hash and revision.
export const FISH_MODEL_REVIEWS: Readonly<Record<string, FishModelReview>> = Object.freeze({});

export function passesVisualReview(key: string, review: FishModelReview | undefined): boolean {
  return !!review && review.revision === MODEL_REVISION
    && review.reference === `public/aqua/fish/${key}.webp`
    && !!review.reviewedBy.trim()
    && [review.evidence.front, review.evidence.side, review.evidence.oblique, review.evidence.motion].every(p => !!p.trim())
    && Object.values(review.scores).length === 5
    && Object.values(review.scores).every(n => Number.isFinite(n) && n >= MIN_VISUAL_SCORE && n <= 10);
}

/** 스타일 승인 + 원본 지문이 지금 프로필과 같은 폼(구운 목록). Set 이라 toString · constructor 같은 이름이 새지 않는다. */
const APPROVED_STYLE: ReadonlySet<string> = new Set(approved.revision === MODEL_REVISION ? approved.forms : []);

export function isFishModelApproved(key: string): boolean {
  return APPROVED_STYLE.has(key) || (Object.hasOwn(FISH_MODEL_REVIEWS, key) && passesVisualReview(key, FISH_MODEL_REVIEWS[key]));
}
