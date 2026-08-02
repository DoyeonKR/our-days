// 픽셀 폰트의 **설계 도트 격자**를 실측한다. `node scripts/fontgrid.mjs public/fonts/Galmuri11.woff2`
//
// 왜 필요한가: 픽셀 폰트는 "설계 크기의 정수배"에서만 또렷하다. 그 값을 이름(Galmuri11)에서
// 짐작하면 틀린다 — 실제로 Galmuri11 은 unitsPerEm 1200, advance 최대공약수 100 이라
// **1 도트 = em/12** 다. 즉 또렷한 크기는 11px 이 아니라 **12 의 배수**다.
// 눈으로는 "약간 흐린데?" 정도로만 보여 놓치기 쉬우므로 숫자로 고정한다.
//
// woff2 → brotli 해제 → head/hhea/hmtx 를 직접 읽는다(외부 의존성 0).
import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";

// woff2 표준의 알려진 태그 순서(인덱스로 참조된다)
const KNOWN = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca",
  "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL",
  "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
];

export function fontGrid(path) {
  const b = readFileSync(path);
  if (b.toString("ascii", 0, 4) !== "wOF2") throw new Error(`${path}: woff2 가 아니다`);
  const numTables = b.readUInt16BE(12);
  const compressedLen = b.readUInt32BE(20);
  let o = 48;
  const readBase128 = () => {
    let v = 0;
    for (;;) {
      const x = b[o++];
      v = (v << 7) | (x & 0x7f);
      if (!(x & 0x80)) break;
    }
    return v;
  };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = b[o++];
    const idx = flags & 0x3f;
    const transform = (flags >> 6) & 3;
    let tag;
    if (idx === 0x3f) {
      tag = b.toString("latin1", o, o + 4);
      o += 4;
    } else tag = KNOWN[idx];
    const origLen = readBase128();
    let len = origLen;
    const transformed = tag === "glyf" || tag === "loca" ? transform !== 3 : transform !== 0;
    if (transformed) len = readBase128();
    tables.push({ tag, len });
  }
  const raw = brotliDecompressSync(b.subarray(o, o + compressedLen));
  let off = 0;
  const at = {};
  for (const t of tables) {
    at[t.tag] = off;
    off += t.len;
  }
  const unitsPerEm = raw.readUInt16BE(at.head + 18);
  const ascender = raw.readInt16BE(at.hhea + 4);
  const descender = raw.readInt16BE(at.hhea + 6);
  const numHMetrics = raw.readUInt16BE(at.hhea + 34);
  const gcd = (a, c) => (c ? gcd(c, a % c) : a);
  let g = 0;
  const widths = new Map();
  for (let i = 0; i < numHMetrics; i++) {
    const w = raw.readUInt16BE(at.hmtx + i * 4);
    if (!w) continue;
    widths.set(w, (widths.get(w) ?? 0) + 1);
    g = gcd(g, w);
  }
  return {
    file: path,
    unitsPerEm,
    ascender,
    descender,
    advanceGCD: g,
    /** 1 em 안에 들어가는 설계 도트 수 = 또렷하게 보이는 font-size 의 최소 단위(px). */
    dotsPerEm: g ? unitsPerEm / g : 0,
    topWidths: [...widths.entries()].sort((a, c) => c[1] - a[1]).slice(0, 6),
  };
}

// ⚠ CLI 동작은 **이 파일을 직접 실행했을 때만**. 이 가드가 없으면 테스트가 이 모듈을 import 할 때
//    `process.argv[2]`(= 테스트 러너의 인자)를 폰트 파일로 읽으려다 import 시점에 터진다.
const isEntry = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/fontgrid.mjs");
if (isEntry && process.argv[2]) console.log(JSON.stringify(fontGrid(process.argv[2]), null, 2));
