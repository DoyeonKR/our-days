// 3D 다시 만들기용 그림 프롬프트(2026-11-14) [사용자: "모든 개체 glb 파일 다 훑어볼 수 있도록 … 일단 포유류, 두족류 이거 2 카테고리"]
// 지금 수조 모델은 옆모습 그림 한 장의 윤곽을 쌓아 만든 몸이라 위 · 앞에서 보면 납작하다. 범고래처럼 이미지 → 3D 생성기(Tripo 등)로
// 진짜 입체를 만들려면, 생성기에 넣을 그림이 입체 정보를 보여 줘야 한다(3/4 시점 · 네 방향 · 그림자 · 반사 없음).
// 실행: node scripts/remodel-prompts.mjs [카테고리…]   (카테고리: mammal cephalopod — 생략하면 둘 다)
//       → design/REMODEL-PROMPTS.md(사람이 보는 표) · design/aqua3d-review/remodel-prompts.json(그림 세션이 돌리는 목록)
// 카테고리를 늘릴 땐 CATEGORIES 에 계열과 설명을 더한다. 게임 쪽 변환은 design/aqua3d-review/orca-build.mjs 를 일반화해서 쓴다.
import { writeFile } from "node:fs/promises";

const CATEGORIES = {
  mammal: {
    name: "해양 포유류",
    pose: "body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle",
    species: [
      { key: "spotted_seal", name: "점박이물범", sci: "Phoca largha", look: "earless true seal, plump spindle body, silver-grey coat with dense dark spots, small fore-flippers, hind flippers paired backward like a tail",
        fry: "newborn pup with thick fluffy white lanugo coat, round body, large dark eyes", juv: "yearling with fresh silver-grey spotted coat, slimmer than the adult" },
      { key: "fur_seal", name: "물개", sci: "Callorhinus ursinus", look: "eared seal with small external ears, dense dark brown fur, long wing-like fore-flippers, hind flippers that can rotate forward",
        fry: "newborn pup with jet-black natal fur, short muzzle, oversized flippers", juv: "juvenile with grey-brown coat, slender body" },
      { key: "steller_sea_lion", name: "큰바다사자", sci: "Eumetopias jubatus", look: "huge eared sea lion, tawny-blond to light brown coat, massive neck and shoulders with a slight mane, long fore-flippers, blunt muzzle",
        fry: "newborn pup with dark chocolate-brown fur, round head, big flippers", juv: "juvenile with lighter tan coat, no mane yet" },
      { key: "japanese_sea_lion", name: "독도 강치", sci: "Zalophus japonicus (extinct, museum-specimen accurate reconstruction)", look: "eared sea lion, dark grey-brown coat, sagittal crest giving a raised forehead in males, long fore-flippers, sleek body; strictly scientific reconstruction, no mystical styling",
        fry: "newborn pup with dark brown natal fur, round body", juv: "juvenile with grey-brown coat, low forehead" },
      { key: "sea_otter", name: "해달", sci: "Enhydra lutris", look: "heavy-bodied otter, dense dark brown fur with a pale grizzled head, short forelimbs with paws, broad webbed flipper-like hind feet, short flattened tail",
        fry: "newborn pup with very fluffy golden-brown buoyant fur", juv: "juvenile with brown fur and lighter head" },
      { key: "otter", name: "수달", sci: "Lutra lutra", look: "long slender freshwater otter, sleek brown fur with paler throat, short legs with webbed feet, long thick tapering tail",
        fry: "young cub with soft grey-brown fur, short muzzle, small body", juv: "juvenile with sleek brown coat, slightly shorter tail than the adult" },
      { key: "orca", name: "범고래", sci: "Orcinus orca", look: "powerful streamlined black body, white oval eye patch above and behind a tiny dark eye, white lower jaw and belly with sweeping flank marking, grey saddle patch behind a tall dorsal fin, broad paddle-shaped pectoral flippers, horizontal tail flukes",
        fry: "newborn calf, short body with relatively large head and flippers, white areas tinted pale orange-peach, small curved dorsal fin, faint fetal fold lines", juv: "juvenile about one third grown, clean white patches, small upright dorsal fin, faint grey saddle" },
    ],
  },
  cephalopod: {
    name: "두족류",
    pose: "relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible",
    species: [
      { key: "octopus", name: "문어", sci: "Enteroctopus dofleini", look: "large octopus, reddish-brown skin with fine papillae and wrinkles, rounded mantle, eight long arms with two rows of pale suckers, web between arm bases",
        fry: "tiny paralarva-like hatchling, translucent body with scattered orange chromatophores, short arms", juv: "juvenile octopus, smaller mantle, arms proportionally shorter, mottled reddish skin" },
      { key: "squid", name: "살오징어", sci: "Todarodes pacificus", look: "slender torpedo-shaped mantle with a pair of triangular fins at the tip, reddish-brown translucent skin with chromatophores, eight arms and two longer tentacles with clubs, large eyes",
        fry: "tiny hatchling, mostly transparent with few chromatophores, short arms", juv: "juvenile with shorter mantle, fins smaller, pale reddish skin" },
      { key: "giant_squid", name: "대왕오징어", sci: "Architeuthis dux", look: "enormous squid, long muscular reddish mantle with small rear fins, very large eyes, eight thick arms and two extremely long feeding tentacles with toothed sucker clubs",
        fry: "tiny hatchling, translucent body, small reddish spots", juv: "juvenile with shorter tentacles, pale reddish mantle" },
      { key: "kraken", name: "크라켄", sci: "mythical giant cephalopod, live-action creature VFX realism", look: "colossal cephalopod combining a massive octopus-like head and mantle with long squid-like tentacles, deep red-violet scarred skin, huge suckers with hooks, ancient and menacing; realistic anatomy and skin like a film creature, never cartoon",
        fry: "small young kraken, same anatomy but smooth unscarred skin and shorter arms", juv: "half-grown kraken, fewer scars, tentacles not yet full length" },
    ],
  },
};

const ONE = (subject) =>
  `Photorealistic natural-history reference of ONE ${subject}, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw).`;
const SHEET = (subject) =>
  `Photorealistic natural-history reference sheet of ONE ${subject}, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views.`;
const COMMON =
  "Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.";

const want = process.argv.slice(2);
const cats = Object.entries(CATEGORIES).filter(([k]) => !want.length || want.includes(k));
const items = [];
for (const [cat, c] of cats) for (const s of c.species) {
  for (const [stage, key, who] of [
    ["fry", `fry_${s.key}`, `newborn ${s.name === "범고래" ? "calf" : "young"} ${s.sci}: ${s.fry}`],
    ["juv", `juv_${s.key}`, `juvenile ${s.sci}: ${s.juv}`],
    ["adult", s.key, `adult ${s.sci}: ${s.look}`],
  ]) {
    items.push({
      category: cat, family: s.key, stage, key, name: s.name + (stage === "fry" ? " 새끼" : stage === "juv" ? " 어린 개체" : ""),
      single: `${ONE(who)} ${c.pose}. ${COMMON}`,
      sheet: `${SHEET(who)} ${c.pose}. ${COMMON}`,
      out: { single: `design/aqua3d-review/remodel-refs/${key}.png`, sheet: `design/aqua3d-review/remodel-refs/${key}-sheet.png` },
    });
  }
}
await writeFile("design/aqua3d-review/remodel-prompts.json", JSON.stringify({ generated: "scripts/remodel-prompts.mjs", categories: cats.map(([k]) => k), items }, null, 2) + "\n");

const md = [
  "# 3D 다시 만들기 — 이미지 생성 프롬프트",
  "",
  "> 이 파일은 `scripts/remodel-prompts.mjs` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다(`node scripts/remodel-prompts.mjs mammal cephalopod`).",
  `> 모두 **${items.length}개**: ${cats.map(([k, c]) => `${c.name} ${items.filter((i) => i.category === k).length}`).join(" · ")}. 한 key 마다 한 장(3/4 시점)과 네 방향 시트 두 가지 — 3D 생성기에는 시트를 쓸 수 있으면 시트를 넣는다.`,
  "",
  "## 그림 세션(Codex)에 붙여 넣을 지시",
  "",
  "```",
  "design/aqua3d-review/remodel-prompts.json 의 items 를 처음부터 끝까지 돌려 줘. 항목마다 built-in image_gen 으로",
  "single 프롬프트 → out.single, sheet 프롬프트 → out.sheet 에 PNG 로 저장한다(1024px 이상, 시트는 가로로 넓게).",
  "게임 코드(src/ · supabase/ · package.json)와 public/ 은 건드리지 말고 커밋하지 마.",
  "다 그리면 카테고리별로 한 장에 모은 검수 시트 design/aqua3d-review/remodel-<카테고리>.webp 를 만들고,",
  "어색한 key(지느러미 · 팔이 겹침, 그림자 · 반사가 들어감, 종이 틀림)를 한 줄씩 알려 줘.",
  "```",
  "",
];
for (const [cat, c] of cats) {
  md.push(`## ${c.name}`, "");
  for (const it of items.filter((i) => i.category === cat)) md.push(`### \`${it.key}\` — ${it.name}`, "", "한 장:", "```", it.single, "```", "네 방향:", "```", it.sheet, "```", "");
}
await writeFile("design/REMODEL-PROMPTS.md", md.join("\n"));
console.log(`remodel prompts: ${items.length} items (${cats.map(([k]) => k).join(", ")})`);
