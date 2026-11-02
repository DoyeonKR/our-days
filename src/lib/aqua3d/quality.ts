/** Visual approval is manual, per form and per model revision, never inferred
 * from geometry tests, family membership or the presence of a reference image. */
import styles from "./style-approvals.json" with { type: "json" };
import profiles from "./profiles.json" with { type: "json" };
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

export function isFishModelApproved(key: string): boolean {
  const style = (styles.forms as Record<string, { sourceHash: string }>)[key];
  const profile = (profiles as Record<string, { sourceHash: string }>)[key];
  const acceptedStyle = styles.revision === MODEL_REVISION && Object.hasOwn(styles.forms, key)
    && !!style && !!profile && style.sourceHash === profile.sourceHash;
  return acceptedStyle || (Object.hasOwn(FISH_MODEL_REVIEWS, key) && passesVisualReview(key, FISH_MODEL_REVIEWS[key]));
}
