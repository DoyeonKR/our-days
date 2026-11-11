/* 앱 CSS 파일 목록 — 소스 테스트가 '앱 스타일 전체'를 읽을 때 쓴다(테스트 전용, 앱은 부르지 않는다).
 *
 * 2026-11-11 첫 화면 다이어트로 게임 화면 규칙을 globals.css 에서 나눴다 — 게임 탭(GameArcade)이 받는 styles/games.css,
 * 모험 탭(AdventureTab)이 받는 styles/adventure.css. 클래스 이름 · 규칙 내용은 그대로라, 예전에 globals.css 를 읽던
 * 테스트는 셋을 이어 붙인 글을 본다. 순서는 실제로 실리는 순서(globals 가 먼저, 게임 파일이 뒤)다.
 * 첫 화면에 실리는 것만 보려면 GLOBAL_CSS 를 읽는다. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");

export const GLOBAL_CSS = join(SRC, "app", "globals.css");
export const GAME_CSS = [join(SRC, "styles", "games.css"), join(SRC, "styles", "adventure.css")];

/** globals.css + 게임 화면 CSS 를 실리는 순서대로 이어 붙인다. */
export function appCss(): string {
  return [GLOBAL_CSS, ...GAME_CSS].map((f) => readFileSync(f, "utf8")).join("\n");
}
