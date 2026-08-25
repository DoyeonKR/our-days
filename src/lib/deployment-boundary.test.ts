import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../../.github/workflows/deploy-pages.yml", import.meta.url),
  "utf8",
);
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

test("프론트 운영 배포는 GitHub Pages 한 곳으로만 잠근다", () => {
  assert.match(workflow, /actions\/deploy-pages@/);
  assert.match(workflow, /name:\s*github-pages/);
  assert.match(readme, /https:\/\/doyeonkr\.github\.io\/our-days\//);
  assert.doesNotMatch(workflow + packageJson, /(?:vercel|netlify|cloudflare).*deploy/i);
});

test("금지된 별도 호스팅 주소를 배포 구성이나 문서에 넣지 않는다", () => {
  const forbiddenHost = ["worxphere", "chatgpt", "site"].join(".");
  assert.ok(!workflow.includes(forbiddenHost));
  assert.ok(!packageJson.includes(forbiddenHost));
  assert.ok(!readme.includes(forbiddenHost));
});
