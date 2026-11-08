// 모험 엔진을 엣지 함수(adventure-battle)에 넣는 복사본을 만든다. [2026-11-08 온라인 대전]
// 엣지 함수는 src/ 를 못 불러온다 — 질문 · 알림 로직처럼 _shared 에 복사본을 두고, adventurepvp.test 가 이 스크립트의 결과와 글자 단위로 맞춰 본다.
// 엔진을 고치면: node scripts/adventure-shared.mjs → 함수 다시 배포(README §7 배포 절차).
// 바꾸는 것은 하나뿐: island.ts 의 타입 import(섬 엔진 전체를 끌고 온다)를 같은 뜻의 타입 한 줄로.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const SHARED_FILES = ["adventure.ts", "arena.ts", "adventurepvp.ts", "lineages.ts", "uppers.ts", "josa.ts"];
const HEADER = "// 생성 파일 — scripts/adventure-shared.mjs 가 src/lib 에서 만든다. 직접 고치지 마라.\n";

export function sharedContent(root, name) {
  const src = readFileSync(join(root, "src/lib", name), "utf8").replace(/\r\n/g, "\n");
  const body = src
    .replace('import type { CareAct } from "./island.ts";', 'type CareAct = "feed" | "play" | "clean" | "hug" | "rest";')
    // 주석은 뺀다(함수 배포 크기 — 설명은 src/lib 원본에 있다). 줄 전체 주석과 /* */ 덩어리만 — 코드 줄 끝의 // 는 문자열일 수 있어 건드리지 않는다
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "")
    .join("\n");
  return HEADER + body;
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(here, "..");
  const out = join(root, "supabase/functions/_shared/adventure");
  mkdirSync(out, { recursive: true });
  for (const f of SHARED_FILES) writeFileSync(join(out, f), sharedContent(root, f));
  console.log(`${SHARED_FILES.length} files → ${out}`);
}
