// 우리 수조 그림 프롬프트 — 다른 세션이 그릴 목록의 원본. `node scripts/aqua-art-prompts.mjs` 가 design/AQUARIUM-ART.md 를 다시 쓴다.
// key 는 src/lib/aquarium.ts 표와 같아야 한다(aquarium.test 가 대조한다). 물고기를 더하면 여기에도 설명을 더한다.
import { writeFileSync } from "node:fs";

export const FISH_STYLE = "Premium hand-painted mobile game collectible art, cute but believable, glossy rich shading, soft rim light, clean readable silhouette at small size. Single subject in exact side view, HEAD POINTING RIGHT, whole body and all fins inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No water, no bubbles unless stated, no scenery, no ground, no cast shadow, no text, no border, no watermark. 1024x1024.";
export const DECOR_STYLE = "Premium hand-painted mobile game aquarium decoration, cute but believable, glossy rich shading, soft light from the upper left, clean readable silhouette at small size. Single object seen from a slight front three-quarter angle, base at the bottom so it can sit on aquarium sand, whole object inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No water, no sand, no fish, no scenery, no cast shadow, no text, no border, no watermark. 1024x1024.";
export const TANK_STYLE = "Premium hand-painted mobile game background, portrait 4:5 (1024x1280). Empty underwater interior filling the entire frame edge to edge: bright water upper area, soft light rays from above, sandy floor in the bottom 18% of the image. NO fish, NO movable decorations in the middle, keep the center open because fish and decorations are placed on top in the game. No text, no UI, no border, no glass-front reflections covering the center.";

const fry = (kind, look) => `Baby fry of a ${kind}: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, ${look}. Adorable, clearly a newborn, simple.`;
const juv = (kind, look) => `Juvenile ${kind}: young teenage fish, body starting to take adult shape, fins half grown, ${look}. Clearly not yet fully grown, less ornate than the adult.`;

// [계열 key, 한국어, 치어 설명, 어린 물고기 설명]
export const YOUNG = [
  ["guppy", "구피", fry("guppy", "pale silver body with a faint hint of color in the tail"), juv("guppy", "slim silver-grey body, small fan tail beginning to show orange and blue flecks")],
  ["tetra", "테트라", fry("tetra", "clear glassy body with a thin faint blue line"), juv("tetra", "small torpedo body, one thin glowing blue stripe, faint red near the tail")],
  ["goldfish", "금붕어", fry("goldfish", "dull bronze-grey body, round belly"), juv("goldfish", "rounded body changing from bronze to orange in patches, short double tail")],
  ["betta", "베타", fry("betta", "plain brown-grey body, tiny pointed fins"), juv("betta", "slender dusky body with blue sheen, fins starting to lengthen, short tail")],
  ["angel", "엔젤피시", fry("angelfish", "tiny diamond-shaped silver body, thin fin threads"), juv("angelfish", "small triangular silver body, faint dark vertical bars, short fin streamers")],
  ["clown", "흰동가리", fry("clownfish", "pale orange body with one faint white band"), juv("clownfish", "orange oval body with two soft white bands and thin dark edges, rounded fins")],
  ["discus", "디스커스", fry("discus", "small coin-shaped brown body with faint vertical bars"), juv("discus", "round flat disc body, brownish with first turquoise wavy lines around the face")],
  ["koi", "비단잉어", fry("koi carp", "plain olive-gold body, two tiny whiskers"), juv("koi carp", "long sturdy body, pale cream with the first patchy orange spots, small whiskers")],
  ["ray", "민물가오리", fry("freshwater stingray, shown from above at a slight angle so the round disc is visible", "tiny round brown disc with thin tail, big cute eyes"), juv("freshwater stingray, shown from above at a slight angle so the round disc is visible", "round dark disc with the first pale spots, thin short tail")],
  ["arowana", "아로와나", fry("arowana", "long thin silver body, upturned mouth, tiny whiskers, small yolk belly"), juv("arowana", "long blade-shaped silver body, large forming scales, upturned mouth with two chin whiskers")],
  ["rising", "등용어", fry("mythical Korean 'rising carp' that will one day become a dragon", "pale gold body, one tiny glowing pearl-like dot on the forehead, soft sparkles around it"), juv("mythical Korean 'rising carp' that will one day become a dragon", "strong gold-and-jade carp body with tiny nub horns starting, faint dragon-like whiskers, soft glow")],
  ["astral", "별무리어", fry("cosmic star fish spirit", "translucent deep-indigo body filled with tiny stars, soft glow, little comet tail"), juv("cosmic star fish spirit", "indigo-violet translucent body with a small swirl of galaxy inside, wispy glowing fins")],
];

// [key, 한국어, 등급, 설명]
export const FINALS = [
  ["cobra_guppy", "코브라 구피", "흔함", "Adult male cobra guppy: snakeskin-patterned olive body, large fan tail with green-yellow net pattern."],
  ["tuxedo_guppy", "턱시도 구피", "보통", "Adult tuxedo guppy: front half pale silver, rear half deep black like a tuxedo, broad blue fan tail."],
  ["mosaic_guppy", "모자이크 구피", "고급", "Adult mosaic guppy: blue-grey body, huge rounded delta tail with an intricate red and blue mosaic pattern."],
  ["fullred_guppy", "풀레드 구피", "희귀", "Adult full-red albino guppy: entire body and giant flowing delta tail solid ruby red, ruby-pink eye, elegant shine."],
  ["neon_tetra", "네온 테트라", "흔함", "Adult neon tetra: slim fish, glowing electric-blue line along the upper body, red stripe only on the rear half, silvery belly."],
  ["cardinal_tetra", "카디널 테트라", "보통", "Adult cardinal tetra: glowing blue line, vivid red stripe running the FULL body length, slightly deeper body."],
  ["glowlight_tetra", "글로라이트 테트라", "고급", "Adult glowlight tetra: translucent peach-gold body with one luminous orange-red line from nose to tail, gentle glow."],
  ["diamond_tetra", "다이아몬드 테트라", "희귀", "Adult diamond tetra: deep silver-violet body covered in sparkling diamond-like glitter scales, long sail-like dorsal fin, lilac fins."],
  ["comet_gold", "코멧 금붕어", "보통", "Adult comet goldfish: slim streamlined orange body with white accents, one long deeply forked flowing tail."],
  ["ryukin_gold", "류킨 금붕어", "고급", "Adult ryukin goldfish: high humped back, short deep body, red and white patches, long flowing double tail."],
  ["oranda_gold", "오란다 금붕어", "희귀", "Adult oranda goldfish: round body, plump bumpy raspberry-like wen hood on the head, red cap on pearl-white body, flowing double tail."],
  ["ranchu_gold", "란추 금붕어", "영웅", "Adult ranchu goldfish: egg-shaped body with NO dorsal fin, thick boxy wen head, metallic red and gold scales, short elegant spread tail."],
  ["veil_betta", "베일테일 베타", "보통", "Adult veiltail betta: deep royal-blue body, long drooping veil tail and flowing fins."],
  ["crown_betta", "크라운테일 베타", "고급", "Adult crowntail betta: dark crimson body, fins and tail split into long spiky crown-like rays with black-red webbing."],
  ["halfmoon_betta", "하프문 베타", "희귀", "Adult halfmoon betta: tail spread in a perfect 180-degree half circle like a silk fan, gradient turquoise to violet, fully flared fins."],
  ["koi_betta", "코이 베타", "영웅", "Adult koi-pattern betta: pearl white body with vivid orange, black and red koi-like patches, huge flowing patterned fins."],
  ["silver_angel", "실버 엔젤", "고급", "Adult silver angelfish: tall triangular flat body, silver with four dark vertical bars, long trailing fin streamers."],
  ["marble_angel", "마블 엔젤", "희귀", "Adult marble angelfish: tall triangular body with swirling black and silver-white marble pattern, long streamers."],
  ["platinum_angel", "플래티넘 엔젤", "영웅", "Adult platinum angelfish: tall triangular body, solid pearly platinum white with soft iridescent shine, very long graceful streamers."],
  ["altum_angel", "알툼 엔젤", "전설", "Adult altum angelfish: extremely tall majestic body, silver-gold with bold dark bars and red-tinted fins, dramatically long dorsal and anal fins, regal."],
  ["ocellaris_clown", "오셀라리스 흰동가리", "고급", "Adult ocellaris clownfish: bright orange oval body, three white bands with thin black edges, rounded fins."],
  ["percula_clown", "퍼큘라 흰동가리", "희귀", "Adult percula clownfish: vivid red-orange body, three white bands with THICK black borders, black-tipped fins."],
  ["snowflake_clown", "스노우플레이크 흰동가리", "영웅", "Adult snowflake clownfish: orange body with wide irregular white snowflake-like bands merging together, black fin tips."],
  ["blackice_clown", "블랙 아이스 흰동가리", "전설", "Adult black ice clownfish: deep black-chocolate body with large icy-white jagged bands and orange only on the face, striking contrast."],
  ["blue_discus", "블루 디스커스", "희귀", "Adult blue discus: round flat disc body, cobalt blue with wavy turquoise lines, red eye."],
  ["pigeon_discus", "피전 블러드 디스커스", "영웅", "Adult pigeon blood discus: round disc, creamy white-yellow body with fine orange-red pepper speckles, red fin edge, red eye."],
  ["leopard_discus", "레오파드 디스커스", "영웅", "Adult leopard discus: round disc, turquoise body covered in many round red-orange leopard spots."],
  ["turquoise_discus", "터콰이즈 디스커스", "전설", "Adult solid turquoise discus: large round disc, luminous solid turquoise with a jewel-like metallic sheen and thin golden edge."],
  ["kohaku_koi", "홍백 비단잉어", "희귀", "Adult kohaku koi: long sturdy carp, pure white body with crisp vivid red patches, two whiskers."],
  ["sanke_koi", "대정삼색 비단잉어", "영웅", "Adult sanke koi: white body, red patches and small sumi-black spots, elegant."],
  ["showa_koi", "소화삼색 비단잉어", "전설", "Adult showa koi: mostly black body with dramatic flame-like red and white patches, powerful."],
  ["ogon_koi", "황금 비단잉어", "전설", "Adult ogon koi: entire long carp body metallic pure gold, each scale edged in bright shine, luxurious."],
  ["motoro_ray", "모토로 가오리", "영웅", "Adult motoro freshwater stingray, seen from above at a slight angle so the round disc is fully visible, tail pointing LEFT: brown disc covered in orange ring-shaped eye spots."],
  ["polka_ray", "폴카닷 가오리", "전설", "Adult polka-dot freshwater stingray, seen from above at a slight angle, tail pointing LEFT: jet-black disc with clean white polka dots."],
  ["black_ray", "블랙 다이아몬드 가오리", "전설", "Adult black diamond stingray, seen from above at a slight angle, tail pointing LEFT: glossy black disc with sparkling silver-white dots and a bright white rim."],
  ["pearl_ray", "펄 가오리", "신화", "Adult pearl stingray, seen from above at a slight angle, tail pointing LEFT: dark disc densely covered in pearly white mother-of-pearl rosettes that softly shimmer."],
  ["silver_arowana", "실버 아로와나", "영웅", "Adult silver arowana: long blade-shaped body, large silver scales with a pink edge, upturned mouth, two chin whiskers."],
  ["golden_arowana", "골든 아로와나", "전설", "Adult golden arowana: long body with huge polished gold scales, upturned mouth, chin whiskers, glinting."],
  ["red_arowana", "슈퍼 레드 아로와나", "전설", "Adult super red arowana: long body, huge glowing crimson-red scales framed in gold, red fins, fierce."],
  ["platinum_arowana", "플래티넘 아로와나", "신화", "Adult platinum arowana: long body entirely luminous platinum-white, mirror-like scales, soft silver aura, sacred looking."],
  ["pearl_carp", "여의주 잉어", "전설", "Mythical carp carrying a glowing wish-granting pearl in its mouth, gold and jade scales, flowing fins, small golden sparkles. Korean folklore feel."],
  ["imugi_fish", "이무기어", "신화", "Mythical Korean imugi fish: long serpent-like body, dark teal scales, small budding horns, whisker barbels, pale glowing belly, on the verge of becoming a dragon."],
  ["azure_dragonfish", "청룡어", "신화", "Mythical azure dragon-fish: long turquoise-blue scaled body, antler horns, flowing silver whiskers, aquamarine fin mane, soft cyan glow, half fish half Eastern dragon."],
  ["golden_dragonfish", "황룡어", "태초", "Supreme golden dragon-fish: magnificent long gold scaled body, branching ivory antlers, flowing white-gold whiskers and mane, jewel pearl glow, radiant aura. Most prestigious look."],
  ["moon_jelly", "달빛 해파리", "신화", "Mythical moonlight jellyfish, bell at the top with long tentacles trailing down (ignore head-right rule): translucent pearly bell with a crescent moon glowing inside, silver thread tentacles, soft moonlit glow."],
  ["aurora_ray", "오로라 가오리", "신화", "Mythical aurora ray, seen from above at a slight angle, tail pointing LEFT: translucent wide wings shimmering with green, violet and pink aurora ribbons."],
  ["galaxy_fish", "은하수어", "태초", "Cosmic galaxy fish: elegant body like a window into deep space, spiral galaxy and stars inside, long fins fading into stardust trails, radiant."],
  ["genesis_fish", "태초의 물고기", "태초", "The primordial first fish: majestic ancient body of flowing rainbow light and gold, ornate sacred patterns, huge veil fins, halo of light, awe-inspiring. The single rarest creature in the game."],
];

// [key, 한국어, 설명]
export const DECORS = [
  ["filter_1", "스펀지 여과기", "Small aquarium sponge filter: black sponge cylinder on a little base with a thin clear air tube and a few bubbles."],
  ["filter_2", "외부 여과기", "Sleek hang-on aquarium filter box in clear and silver with water flowing out in a small curtain."],
  ["filter_3", "생명의 샘 여과기", "Magical spring-of-life filter: small carved stone fountain with luminous blue-green water, tiny leaves and sparkles."],
  ["heater_1", "작은 히터", "Small glass aquarium tube heater with a suction cup and a little orange indicator light."],
  ["heater_2", "정온 히터", "Modern thermostat aquarium heater: metallic cylinder with small digital temperature display glowing blue."],
  ["heater_3", "용암석 히터", "Fantasy lava stone heater: dark volcanic rock with glowing molten orange cracks and gentle heat shimmer."],
  ["feeder_1", "타이머 급이기", "Small automatic fish feeder with a round dial timer and a little food drum."],
  ["feeder_2", "스마트 급이기", "Sleek white smart fish feeder with a tiny screen and a glowing ring light."],
  ["feeder_3", "풍요의 조개 급이기", "Magical giant open golden shell overflowing with sparkling fish food flakes."],
  ["moss_ball", "모스 볼", "Fluffy round marimo moss ball, rich green, a small cluster of two."],
  ["vallisneria", "발리스네리아", "Tall ribbon-like vallisneria aquatic grass, bunch of long thin green blades swaying upward."],
  ["java_fern", "자바 펀", "Java fern aquatic plant with broad bumpy dark-green leaves growing from a small rhizome."],
  ["anubias", "아누비아스", "Anubias aquatic plant with thick round glossy leaves, compact bush."],
  ["red_rotala", "붉은 로탈라", "Rotala aquatic plant bush with many thin stems and fiery red-pink leaves."],
  ["water_lily", "수련", "Aquatic water lily plant: long stem rising from a bulb, round pads and one pink lotus blossom on top."],
  ["coral", "산호", "Colorful branching coral cluster in pink, orange and purple tones."],
  ["glow_kelp", "빛나는 해초", "Fantasy bioluminescent kelp: tall wavy fronds glowing soft cyan and violet with tiny light motes."],
  ["pebbles", "조약돌", "Small pile of smooth rounded river pebbles in warm grey and white."],
  ["driftwood", "유목", "Gnarled aquarium driftwood branch with twisting arms, weathered brown."],
  ["stone_arch", "돌 아치", "Natural stone arch big enough for fish to swim through, grey layered rock with moss."],
  ["lava_rock", "용암석", "Porous dark red-black lava rock formation with small holes."],
  ["crystal", "수정 군락", "Cluster of pointed amethyst and clear quartz crystals, softly glowing inside."],
  ["moon_stone", "달의 돌", "Smooth pale moonstone boulder with a crescent glow and silver shimmer."],
  ["mailbox", "수중 우체통", "Cute red Korean-style postbox on a short post, slightly barnacled, a heart-shaped letter sticking out."],
  ["diver", "잠수부 인형", "Toy deep-sea diver figure in a brass helmet and suit, with a tiny treasure map, chubby proportions."],
  ["heart_bubbler", "하트 기포기", "Pink ceramic heart ornament with a small opening releasing little heart-shaped bubbles."],
  ["sand_castle", "모래성", "Cute sand castle with three towers, little flags and shell decorations."],
  ["windmill", "수중 풍차", "Miniature wooden underwater windmill with four sails, cozy village style, moss at the base."],
  ["treasure", "보물상자", "Open wooden pirate treasure chest overflowing with gold coins and gems, iron bands."],
  ["pearl_clam", "진주 조개", "Large open giant clam shell, iridescent inside, holding one big luminous pearl."],
  ["stone_pagoda", "석탑", "Traditional Korean multi-tiered stone pagoda, weathered granite with soft moss."],
  ["sunken_ship", "난파선", "Small sunken wooden ship tilted on one side, broken mast, tattered sail, barnacles."],
  ["hanok", "수중 한옥", "Miniature traditional Korean hanok house with curved tiled roof and wooden pillars, warm lantern light inside."],
  ["mermaid", "인어 동상", "Elegant marble mermaid statue sitting on a rock, tasteful and fully modest, soft moss."],
  ["turtle_ship", "거북선", "Miniature Korean Joseon-era turtle ship with a spiked armored roof and dragon head prow, resting on its keel."],
  ["dragon_palace", "용궁", "Fantasy Korean Dragon King undersea palace: grand multi-roof palace with jade and gold, glowing lanterns, coral pillars. Ornate and prestigious."],
  ["star_gate", "별의 문", "Fantasy gate of stars: a tall stone ring arch with a swirling starry galaxy portal inside, glowing runes. The rarest decoration."],
];

// [key, 한국어, 설명]
export const TANKS = [
  ["tank_1", "작은 어항", "A small cozy glass bowl interior: warm bright light blue water, plain fine pale sand floor."],
  ["tank_2", "둥근 어항", "A round fishbowl interior: clear blue-green water with soft curved light, white pebble floor."],
  ["tank_3", "가정 수조", "A well-kept home aquarium interior: fresh blue water, subtle soft green plant silhouettes far behind, natural sand floor."],
  ["tank_4", "대형 수조", "A large planted aquarium interior: deep blue water, distant rocky hills and soft plant silhouettes in the far background, golden sand floor."],
  ["tank_5", "유리 수족관", "A grand public aquarium interior: deep teal-blue water, tall faint arches of glass and soft light shafts in the far background, clean white sand floor."],
  ["tank_6", "용궁 수조", "The Dragon King's sea realm: deep indigo-blue magical water, faint silhouettes of Korean palace roofs and glowing coral far in the background, shimmering pearl sand floor, drifting golden light."],
];

function table(rows) {
  return rows.join("\n");
}
function build() {
  const fishRows = [];
  for (const [fam, ko, a, b] of YOUNG) {
    fishRows.push(`| \`fry_${fam}\` | ${ko} 치어 | ${a} |`);
    fishRows.push(`| \`juv_${fam}\` | ${ko} 어린 물고기 | ${b} |`);
  }
  return `# 우리 수조 그림 목록 · 프롬프트

> 이 파일은 \`scripts/aqua-art-prompts.mjs\` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다.
> 모두 **${YOUNG.length * 2 + FINALS.length + DECORS.length + TANKS.length}장**: 치어 · 어린 물고기 ${YOUNG.length * 2} · 최종 물고기 ${FINALS.length} · 악세사리 ${DECORS.length} · 수조 배경 ${TANKS.length}.

## 넣는 법

1. 파일 이름을 **key** 로 저장한다(예: \`fry_guppy.png\`, \`treasure.png\`, \`tank_1.png\`). 한 폴더에 모아도 되고 나눠도 된다.
2. \`node scripts/aqua-art-sync.mjs <그림 폴더>\` — 투명 여백을 자르고 원본(512) · 사본(192)을 \`public/aqua/\` 에 굽고 그림 목록을 다시 쓴다. 수조 배경은 1024×1280.
3. 일부만 그려도 된다 — 없는 그림은 임시 그림으로 나온다. 스크립트가 아직 없는 목록을 알려 준다.

## 꼭 지킬 것

- **물고기 머리는 전부 오른쪽**(게임이 좌우로 뒤집어 헤엄치게 한다). 가오리 · 해파리는 표에 적힌 대로.
- 실제 게임 · 애니메이션 캐릭터를 따라 그리지 않는다. 실존 품종은 실제 무늬를 찾아보고 그린다.
- 같은 계열의 네 형태는 **무늬와 실루엣이 한눈에 달라야 한다**. 색만 바꾼 그림은 안 된다.
- 등급이 높을수록 더 화려하게: 흔함 · 보통은 소박하게 → 전설은 반짝임 → 신화는 은은한 빛 → 태초는 빛무리.

## 공통 프롬프트

각 그림의 프롬프트 = **공통 문장 + 표의 설명**.

**물고기 공통**

\`\`\`
${FISH_STYLE}
\`\`\`

**악세사리 공통**

\`\`\`
${DECOR_STYLE}
\`\`\`

**수조 배경 공통**

\`\`\`
${TANK_STYLE}
\`\`\`

## 치어 · 어린 물고기 (${YOUNG.length * 2}장)

| key | 이름 | 설명 |
|---|---|---|
${table(fishRows)}

## 최종 물고기 (${FINALS.length}장)

| key | 이름 | 등급 | 설명 |
|---|---|---|---|
${table(FINALS.map(([k, ko, g, t]) => `| \`${k}\` | ${ko} | ${g} | ${t} |`))}

## 악세사리 (${DECORS.length}장)

| key | 이름 | 설명 |
|---|---|---|
${table(DECORS.map(([k, ko, t]) => `| \`${k}\` | ${ko} | ${t} |`))}

## 수조 배경 (${TANKS.length}장)

| key | 이름 | 설명 |
|---|---|---|
${table(TANKS.map(([k, ko, t]) => `| \`${k}\` | ${ko} | ${t} |`))}
`;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/aqua-art-prompts.mjs")) {
  writeFileSync("design/AQUARIUM-ART.md", build());
  console.log(`design/AQUARIUM-ART.md ${YOUNG.length * 2 + FINALS.length + DECORS.length + TANKS.length}장`);
}
