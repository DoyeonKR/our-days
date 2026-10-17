// out/*.json(계보별 몸통 44행 + 팔레트) → src/lib/pixellineage.ts 전체를 만든다(머리·꼬리는 templates/).
// 사용법: node gen.mjs > <출력 파일>   (보통은 build.sh 가 부른다)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LINEAGES } from "./deps.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const order = ["ember", "volt", "burr", "puff", "leaf", "beetle", "conch", "snow", "bat", "ghost"];
const NAMES = {
  ember: "불꽃 도롱뇽", volt: "번개 새", burr: "밤송이 고슴도치", puff: "구름 양", leaf: "잎 개구리",
  beetle: "장수풍뎅이", conch: "소라 게", snow: "눈사람", bat: "박쥐", ghost: "이불 유령",
};

/** 48칸 행 하나를 row([x,"문자"],…) 런으로 — 짧은 틈(2칸 이하)은 한 덩어리로 묶는다. */
function rowCode(r) {
  if (!/[^.]/.test(r)) return "EMPTY";
  const segs = [];
  let i = 0;
  while (i < 48) {
    if (r[i] === ".") { i++; continue; }
    let j = i;
    while (j < 48) {
      if (r[j] !== ".") { j++; continue; }
      let k = j;
      while (k < 48 && r[k] === ".") k++;
      if (k < 48 && k - j <= 2) { j = k; continue; }
      break;
    }
    segs.push([i, r.slice(i, j)]);
    i = j;
  }
  return "row(" + segs.map(([x, s]) => `[${x}, ${JSON.stringify(s)}]`).join(", ") + ")";
}

const tri = (t) => `[${t.map((c) => JSON.stringify(c)).join(", ")}]`;
function palCode(p) {
  const parts = [`body: ${tri(p.body)}`];
  if (p.belly) parts.push(`belly: ${tri(p.belly)}`);
  if (p.mark) parts.push(`mark: ${tri(p.mark)}`);
  if (p.a1) parts.push(`a1: ${tri(p.a1)}`);
  if (p.a2) parts.push(`a2: ${tri(p.a2)}`);
  if (p.a3) parts.push(`a3: ${tri(p.a3)}`);
  if (p.beak) parts.push(`beak: ${tri(p.beak)}`);
  if (p.eye) parts.push(`eye: ${JSON.stringify(p.eye)}`);
  return `{ ${parts.join(", ")} }`;
}

const out = [];
for (const k of order) {
  const j = JSON.parse(readFileSync(join(here, "out", `${k}.json`), "utf8"));
  j.stages.forEach((rows, i) => {
    if (rows.length !== 44) throw new Error(`${k}_${i + 2}: 몸통이 ${rows.length}행`);
    out.push(`/** ${NAMES[k]} — ${["성장기", "중간형", "최종형"][i]}(${k}_${i + 2}). */`);
    out.push(`const ${k.toUpperCase()}_${i + 2}: readonly string[] = [`);
    rows.forEach((r, y) => out.push(`  ${rowCode(r)},${y % 10 === 0 ? ` // ${y}` : ""}`));
    out.push("  EMPTY, EMPTY, EMPTY, EMPTY, // 44~47행 — 다리는 feet() 가 채운다", "];");
    out.push("");
  });
}
out.push("export const LINEAGE_ART: Record<string, LineageArt> = {");
for (const k of order) {
  const j = JSON.parse(readFileSync(join(here, "out", `${k}.json`), "utf8"));
  out.push(`  ${k}: {`, `    fur: ${JSON.stringify(j.fur)}, pad: ${JSON.stringify(j.pad)},`, "    forms: [");
  j.stages.forEach((_, i) => out.push(`      { pal: ${palCode(j.pals[i])}, body: ${k.toUpperCase()}_${i + 2} },`));
  out.push("    ],", "  },");
}
out.push("};");
// 머리(규약 주석 · 팔레트 함수) + 그림 표 + 꼬리(수면 · 걷기 조립)를 이어 pixellineage.ts 전체를 낸다.
// 그림이 아직 없는 계보(표에는 있다)는 기존 그림을 색만 돌려 쓰는 임시 그림 — tail 의 PLACEHOLDER 표를 만든다.
const BASES = ["ember", "burr", "leaf", "conch", "bat", "beetle", "volt", "puff", "ghost", "snow"].filter((k) => order.includes(k));
const missing = LINEAGES.map((l) => l.key).filter((k) => !order.includes(k));
const placeholderRows = missing.map((k, i) => `  ${k}: { base: ${JSON.stringify(BASES[i % BASES.length])}, hue: ${(40 + 37 * i) % 360} },`).join(String.fromCharCode(10));
const head = readFileSync(join(here, "templates", "head.ts.txt"), "utf8");
const tail = readFileSync(join(here, "templates", "tail.ts.txt"), "utf8").replace("__PLACEHOLDER_ROWS__", placeholderRows);
process.stdout.write(head + out.join("\n") + "\n" + tail);
