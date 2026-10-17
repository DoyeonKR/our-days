import { readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { style, jobs } from "./hero-art-prompts.mjs";
import { guardians, guardianStyle, jobs as upper } from "./hero-upper-prompts.mjs";

const taskCodexRoot = resolve(process.env.CODEX_HOME || join(homedir(), ".codex"));
const existing = JSON.parse(await readFile("design/hero-v3-sources.json", "utf8"));
for (const name of (await readdir(".qa/hero-art/sources")).sort()) {
  if (name.endsWith(".json")) existing.push(JSON.parse(await readFile(`.qa/hero-art/sources/${name}`, "utf8")));
}
const byKey = new Map(existing.map((r) => [r.key, r]));
const expected = [...guardians, ...jobs, ...upper];
if (byKey.size !== expected.length) throw new Error(`Expected ${expected.length} originals, found ${byKey.size}`);
const sourcePath = (value) => {
  const absolute = isAbsolute(value) ? resolve(value) : resolve(taskCodexRoot, value);
  if (!absolute.startsWith(taskCodexRoot + sep)) throw new Error("Original must remain within the generated image archive");
  return { absolute, portable: relative(taskCodexRoot, absolute).split(sep).join("/") };
};
const manifest = [];
for (const spec of expected) {
  const record = byKey.get(spec.key);
  if (!record) throw new Error(`Missing source: ${spec.key}`);
  const source = sourcePath(record.source);
  const prefix = guardians.some((g) => g.key === spec.key) ? guardianStyle : style;
  const prompt = record.prompt?.startsWith("Use case:") ? record.prompt : `${prefix}\nSubject: ${record.prompt ?? spec.subject}`;
  manifest.push({
    key: spec.key,
    source: source.portable,
    sourceSha256: createHash("sha256").update(await readFile(source.absolute)).digest("hex"),
    kind: record.kind ?? "generate",
    prompt,
    ...(record.reference ? { reference: sourcePath(record.reference).portable } : {}),
  });
}
await writeFile("design/hero-v3-sources.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`Finalized ${manifest.length} originals with full prompts and portable archive paths.`);
