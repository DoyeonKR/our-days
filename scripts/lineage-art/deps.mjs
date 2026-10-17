// 앱 소스(.ts)에서 도트 규약 함수(ramp · paint · feet)를 읽어 온다.
//   · Node 22.18+ : .ts 를 바로 읽는다(type stripping).
//   · Node 20     : TS 를 못 읽는다 → `node .claude/striptypes.mjs <사본폴더> build` 로 만든 .mjs 사본을 SIMLIB 환경변수로 가리킨다.
//     예) SIMLIB=/tmp/simlib bash scripts/lineage-art/build.sh
// 도구가 앱과 같은 규약(48×48 · 팔레트 글자 · 공용 다리)을 쓰도록 복사본을 두지 않고 앱 소스를 그대로 부른다.
import { pathToFileURL } from "node:url";

const lib = process.env.SIMLIB
  ? pathToFileURL(process.env.SIMLIB.replace(/[\\/]+$/, "") + "/")
  : new URL("../../src/lib/", import.meta.url);
const ext = process.env.SIMLIB ? ".mjs" : ".ts";

const { ramp } = await import(new URL(`pixel${ext}`, lib).href);
const { paint, feet } = await import(new URL(`pixelpet48${ext}`, lib).href);

const { LINEAGES } = await import(new URL(`lineages${ext}`, lib).href);

export { ramp, paint, feet, LINEAGES };
