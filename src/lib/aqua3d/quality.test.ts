import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FISH_IMAGE_KEYS } from "../aquaimages.ts";
import { MODEL_REVISION, FISH_MODEL_REVIEWS, isFishModelApproved, passesVisualReview, type FishModelReview } from "./quality.ts";

// Synthetic review for validation tests only; NOT a real approval or visual rating.
const fixture = (): FishModelReview => ({
  revision: MODEL_REVISION, reference: "public/aqua/fish/test.webp",
  scores: { silhouette: 9, fins: 9, markings: 9, materials: 9, motion: 9 },
  evidence: { front: "test/front.png", side: "test/side.png", oblique: "test/oblique.png", motion: "test/motion.webm" }, reviewedBy: "test-fixture",
});

test("visual gate requires every criterion >=9, current revision, matching reference and evidence", () => {
  assert.equal(passesVisualReview("test", fixture()), true);
  for (const criterion of Object.keys(fixture().scores) as (keyof FishModelReview["scores"])[]) {
    for (const value of [8.99, NaN, Infinity, 10.1]) {
      const review = fixture(); review.scores[criterion] = value;
      assert.equal(passesVisualReview("test", review), false);
    }
  }
  const stale = fixture(); stale.revision = "old"; assert.equal(passesVisualReview("test", stale), false);
  const wrong = fixture(); wrong.reference = "public/aqua/fish/other.webp"; assert.equal(passesVisualReview("test", wrong), false);
  for (const view of ["front", "side", "oblique", "motion"] as const) {
    const missing = fixture(); missing.evidence[view] = " "; assert.equal(passesVisualReview("test", missing), false);
  }
  const anonymous = fixture(); anonymous.reviewedBy = " "; assert.equal(passesVisualReview("test", anonymous), false);
  assert.equal(passesVisualReview("test", undefined), false);
});

test("only user-accepted forms are enabled; newly authored forms stay pending without invented ratings", () => {
  assert.equal(Object.keys(FISH_MODEL_REVIEWS).length, 0);
  const accepted = JSON.parse(readFileSync("src/lib/aqua3d/style-approvals.json", "utf8")).forms;
  for (const key of FISH_IMAGE_KEYS) assert.equal(isFishModelApproved(key), Object.hasOwn(accepted, key), key);
  for (const key of ["unknown", "toString", "constructor"]) assert.equal(isFishModelApproved(key), false, key);
});

test("live tank filters models, not saved fish, and explains pending models", () => {
  const scene = readFileSync("src/lib/aqua3d/scene.ts", "utf8");
  assert.match(scene, /const approvedFish=next.aquarium.fish.filter\(f=>isFishModelApproved\(fishArtKey\(f\)\)\)/);
  assert.match(scene, /for\(const f of approvedFish\)/);
  assert.match(scene, /new Set\(approvedFish.map/);
  assert.doesNotMatch(scene, /aquarium.fish\s*=|fish.splice|saveIsland/);
  const component = readFileSync("src/components/Aquarium3D.tsx", "utf8");
  assert.match(component, /pendingCount > 0/);
  assert.match(component, /보유 물고기는 그대로/);
  assert.match(component, /view.aquarium.fish.length===0/);
});
