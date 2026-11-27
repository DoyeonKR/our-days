// 우리 수조 그림 프롬프트 — 다른 세션이 그릴 목록의 원본. `node scripts/aqua-art-prompts.mjs` 가 design/AQUARIUM-ART.md 를 다시 쓴다.
// key 는 src/lib/aquarium.ts 표와 같아야 한다(aquarium.test 가 대조한다). 물고기를 더하면 여기에도 설명을 더한다.
import { writeFileSync } from "node:fs";
import expansion from "../design/aqua3d-review/expansion-prompts.json" with { type: "json" };
import expansion2 from "../design/aqua3d-review/expansion2-prompts.json" with { type: "json" };
import native from "../design/aqua3d-review/native-prompts.json" with { type: "json" };
import expansion4 from "../design/aqua3d-review/expansion4-prompts.json" with { type: "json" };
import mammals from "../design/aqua3d-review/mammals-prompts.json" with { type: "json" };
import shrimp from "../design/aqua3d-review/shrimp-prompts.json" with { type: "json" };

export const FISH_STYLE = "Photorealistic natural-history aquarium animal photography, scientifically credible anatomy, natural small eyes, real scales and skin microtexture, restrained wet specular highlights and soft upper-left daylight. NOT a character, NOT cartoon, NOT chibi, NOT an illustration, no oversized eyes, no human expressions. Single living animal in a neutral swimming pose, exact side view, HEAD POINTING RIGHT, tail LEFT. Whole body, tail and all fins fully visible, 10% empty padding on every side. True transparent background (PNG alpha), isolated cutout. No water, no bubbles unless stated, no scenery, no ground, no cast shadow, no text, border or watermark. 1024x1024. For mythical species only, use convincing live-action creature VFX anatomy, never cartoon styling.";
export const DECOR_STYLE = "Photorealistic aquarium decoration product photography, physically realistic ceramic, stone, metal or plant textures, soft upper-left light, clean readable silhouette. Single object in slight front three-quarter view, base at the bottom, 10% empty padding all around. True transparent background (PNG alpha). No surrounding water, sand, fish or scenery, no cast shadow, text, border or watermark. 1024x1024. Fantasy decorations should still look like real crafted objects, never cartoon illustrations.";
export const TANK_STYLE = "Photorealistic underwater aquarium interior photography, portrait 4:5 (1024x1280). Empty underwater interior filling the frame edge to edge: bright water upper area, physically believable caustics and soft light shafts, sandy floor in bottom 18%. NO animals, NO movable decorations in the middle; center open for compositing swimming animals and decorations. No text, UI, border, or front-glass reflections covering the center. Natural materials and realistic water, not cartoon or painted illustration; fantasy architecture only as distant realistic scenery.";

const fry = (kind, look) => `Biologically plausible newborn ${kind}, authentic larval or hatchling proportions, small natural eyes, translucent skin where appropriate, delicate developing fins, ${look}. A real newborn animal, not a baby cartoon.`;
const juv = (kind, look) => `Juvenile ${kind}: young teenage fish, body starting to take adult shape, fins half grown, ${look}. Clearly not yet fully grown, less ornate than the adult.`;
// 새우 프롬프트는 공통 화풍까지 한 문장이라 — 표엔 화풍 뒤의 설명만 싣는다(2026-11-14)
const shrimpSubject = (key) => { const p = shrimp.items.find(i => i.key === key).prompt; return p.startsWith(FISH_STYLE) ? p.slice(FISH_STYLE.length).trim() : p; };
const SHRIMP_GRADE = { cherry_shrimp: "흔함", fleshy_prawn: "고급", dokdo_shrimp: "희귀" };
// 게(2026-11-18) — 그림 세션이 그리지 않았다. Claude 세션이 NOAA Fisheries 등쪽 일러스트(퍼블릭 도메인)를 머리 오른쪽으로 돌려 썼다(design/aqua3d-review/crabs/make-art.mjs).
//   다시 그릴 때 쓰는 설명을 남긴다
const CRAB = {
  // 남극 10종(2026-11-25) — Claude 세션이 부위로 지은 모델을 찍었다(design/aqua3d-review/polar). 다시 그릴 때 쓰는 설명
  // 북극곰(2026-11-25) — Claude 세션이 부위로 지은 모델을 찍었다(design/aqua3d-review/polarbear). 기준 사진은 polarbear/reference/SOURCES.md
  polar_bear: ["북극곰","태초","Real adult polar bear (Ursus maritimus) swimming underwater: long body, long neck and narrow head stretched forward, straight Roman-nosed muzzle, small rounded ears, small dark eyes, black nose and lips, creamy white fur with soft yellowish belly and legs, huge front paws paddling, hind legs trailing. Exact side view, head RIGHT. Transparent background, no text.","Real polar bear cub (Ursus maritimus): round fluffy bright white body, big head, short muzzle, large round ears, dark eyes, black nose, short stubby legs. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile polar bear: slimmer white body, head a little large, muzzle shorter than adult, rounded ears, paddling front paws. Exact side view, head RIGHT. Transparent background, no text."],
  gentoo_penguin: ["젠투펭귄","고급","Real gentoo penguin (Pygoscelis papua) swimming underwater: slate-black back, white belly, white triangular patch over each eye joined by a thin white band across the crown, bright orange-red bill with black ridge, orange feet. Exact side view, head RIGHT. Transparent background, no text.","Real gentoo penguin chick: fluffy grey down on the back, white belly, small dull orange bill. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile gentoo penguin: sleek grey-black back, white belly, greyish chin, smaller white eye patches, dull orange bill. Exact side view, head RIGHT. Transparent background, no text."],
  chinstrap_penguin: ["턱끈펭귄","희귀","Real chinstrap penguin (Pygoscelis antarcticus) swimming underwater: black cap and back, white face and throat, a thin black strap running under the chin from ear to ear, black bill, pink feet. Exact side view, head RIGHT. Transparent background, no text.","Real chinstrap penguin chick: pale silver-grey fluffy down, slightly darker head, black bill. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile chinstrap penguin: black back, dusky grey face, faint chin strap, black bill. Exact side view, head RIGHT. Transparent background, no text."],
  adelie_penguin: ["아델리펭귄","고급","Real Adelie penguin (Pygoscelis adeliae) swimming underwater: all-black head and back, white belly, bold white eye-ring, short black bill half covered by feathers, pink feet. Exact side view, head RIGHT. Transparent background, no text.","Real Adelie penguin chick: dark grey-brown fluffy down, darker head, small black bill. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile Adelie penguin: black back and crown, white chin and throat, no white eye-ring yet. Exact side view, head RIGHT. Transparent background, no text."],
  toothfish: ["메로","전설","Real Antarctic toothfish (Dissostichus mawsoni): large heavy dark grey-brown body with faint blotches, big head and wide mouth with protruding lower jaw, large eyes, two dorsal fins, long anal fin, broad pectoral fins, straight-edged tail. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile Antarctic toothfish larva: small pale brown body, large head and big eyes, mottled. Exact side view, head RIGHT. Transparent background, no text.","Real young Antarctic toothfish: grey-brown mottled body, big head and eyes, two dorsal fins. Exact side view, head RIGHT. Transparent background, no text."],
  icefish: ["남극빙어","희귀","Real blackfin icefish (Chaenocephalus aceratus): ghostly translucent white body without red blood, long flat crocodile-like snout, large eyes, tall black first dorsal fin, long second dorsal and anal fins, big pale fan-shaped pectoral fins, faint grey vertical bands. Exact side view, head RIGHT. Transparent background, no text.","Real icefish larva: tiny translucent white body, long flat snout, big eyes. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile icefish: translucent white slender body, flat long snout, small black first dorsal fin. Exact side view, head RIGHT. Transparent background, no text."],
  clione: ["클리오네","영웅","Real sea angel (Clione limacina antarctica): transparent gelatinous body, two small head horns, two wing-like flaps at the neck, orange-red gut visible inside, orange tail tip. Exact side view, head RIGHT. Transparent background, no text.","Real tiny sea angel larva: transparent body with orange gut, small wing flaps. Exact side view, head RIGHT. Transparent background, no text.","Real young sea angel: transparent body, orange gut, wing flaps. Exact side view, head RIGHT. Transparent background, no text."],
  sea_pig: ["바다돼지","희귀","Real sea pig (Scotoplanes, deep-sea sea cucumber): plump pink translucent body, five pairs of stubby tube-feet legs underneath, two pairs of long papillae rising from the top front, ring of short tentacles around the mouth. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile sea pig: small plump pale pink body, short legs and papillae. Exact side view, head RIGHT. Transparent background, no text.","Real young sea pig: plump pink body, stubby legs, long papillae on top. Exact side view, head RIGHT. Transparent background, no text."],
  giant_isopod: ["남극 대왕등각류","고급","Real Antarctic giant isopod (Glyptonotus antarcticus): flattened oval armored body with seven segments, triangular tail plate, long antennae, compound eyes on top, seven pairs of walking legs, grey-brown with orange mottling. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile Antarctic isopod: small pale tan segmented body, long antennae. Exact side view, head RIGHT. Transparent background, no text.","Real young Antarctic giant isopod: segmented armored body, brown with orange mottling. Exact side view, head RIGHT. Transparent background, no text."],
  antarctic_urchin: ["남극성게","흔함","Real Antarctic sea urchin (Sterechinus neumayeri): slightly flattened round purple-green test covered in short pale purple spines, bits of shell and algae carried on top. Exact side view, head RIGHT. Transparent background, no text.","Real juvenile Antarctic sea urchin: tiny pale purple test with short spines. Exact side view, head RIGHT. Transparent background, no text.","Real young Antarctic sea urchin: purple test, short pale spines, a shell fragment on top. Exact side view, head RIGHT. Transparent background, no text."],
  salp: ["살프 사슬","전설","Real salp chain (Salpa thompsoni aggregate): eight transparent barrel-shaped zooids linked in a zigzag chain, white muscle bands on each barrel, small orange-brown nucleus inside each. Exact side view, head RIGHT. Transparent background, no text.","Real short salp chain: four transparent barrels with orange-brown nuclei. Exact side view, head RIGHT. Transparent background, no text.","Real salp chain: six transparent barrels with white muscle bands and orange-brown nuclei. Exact side view, head RIGHT. Transparent background, no text."],
  // 고래 5종 · 톱상어(2026-11-18) — 같은 방식(Claude 세션 · NOAA 고래 일러스트 · Pristiophorus 옛 채색 도판, 퍼블릭 도메인 · design/aqua3d-review/whales)
  minke_whale: ["밍크고래", "영웅", "Real minke whale (Balaenoptera acutorostrata) side view, head RIGHT: slim streamlined body, pointed snout, dark grey back, white belly, white band on each flipper, small curved dorsal fin far back. Natural-history illustration, transparent background.", "Newborn minke whale calf side view, head RIGHT: short rounded body, paler grey, small flippers.", "Juvenile minke whale side view, head RIGHT: slimmer, grey back, white belly, flipper band visible."],
  gray_whale: ["귀신고래", "전설", "Real gray whale (Eschrichtius robustus) side view, head RIGHT: mottled grey body covered in pale barnacle and scar patches, narrow arched head, knuckled ridge instead of a dorsal fin. Natural-history illustration, transparent background.", "Newborn gray whale calf side view, head RIGHT: smooth dark grey skin with few pale marks.", "Juvenile gray whale side view, head RIGHT: grey with first pale barnacle patches."],
  humpback_whale: ["혹등고래", "전설", "Real humpback whale (Megaptera novaeangliae) side view, head RIGHT: black stocky body, knobby head with tubercles, very long white-edged pectoral flippers, ventral throat grooves, small hump dorsal fin. Natural-history illustration, transparent background.", "Newborn humpback whale calf side view, head RIGHT: grey rounded body, long pale flippers.", "Juvenile humpback whale side view, head RIGHT: darker body, long white-edged flippers."],
  sperm_whale: ["향유고래", "신화", "Real sperm whale (Physeter macrocephalus) side view, head RIGHT: huge square block head one third of the body, narrow underslung lower jaw, wrinkled dark brownish-grey skin, low rounded hump instead of a dorsal fin. Natural-history illustration, transparent background.", "Newborn sperm whale calf side view, head RIGHT: smaller square head, smooth grey skin.", "Juvenile sperm whale side view, head RIGHT: growing block head, wrinkled grey skin."],
  blue_whale: ["흰수염고래", "태초", "Real blue whale (Balaenoptera musculus) side view, head RIGHT: enormous long slender body, broad flat U-shaped head, mottled blue-grey skin, tiny dorsal fin far back, slim flippers. Natural-history illustration, transparent background.", "Newborn blue whale calf side view, head RIGHT: paler mottled blue-grey, short body.", "Juvenile blue whale side view, head RIGHT: long slender mottled blue-grey body."],
  walrus: ["바다코끼리", "전설", "Real Pacific walrus (Odobenus rosmarus) swimming side view, head RIGHT: huge wrinkled cinnamon-pink body, small head with broad bristly whisker pad, two long ivory tusks hanging down from the upper jaw, small eyes, fore and hind flippers. Natural colors. Transparent background, no text.", "Real newborn walrus calf (Odobenus rosmarus): rounded plump body, grey-brown fine fur, large dark eyes, bristly whisker pad, no tusks yet. Exact side view swimming, head RIGHT. Transparent background, no text.", "Real juvenile walrus about one third grown: wrinkled cinnamon skin, short stubby tusks just showing below the whisker pad. Exact side view swimming, head RIGHT. Transparent background, no text."],
  emperor_penguin: ["황제펭귄", "영웅", "Real emperor penguin (Aptenodytes forsteri) swimming underwater side view, head RIGHT: streamlined torpedo body, blue-black back and head, white belly, golden-yellow ear patch fading to pale yellow chest, long slim bill with orange stripe on lower mandible, narrow black flippers. Transparent background, no text.", "Real emperor penguin chick (Aptenodytes forsteri): round fluffy silver-grey down, black head with a white face mask around the eyes, small black bill. Exact side view, head RIGHT. Transparent background, no text.", "Real juvenile emperor penguin: sleek grey-black back, white belly, whitish chin, pale ear patch without yellow, shorter bill without orange. Exact side view swimming, head RIGHT. Transparent background, no text."],
  kappa: ["갓파", "신화", "Kappa river spirit swimming, head RIGHT: big round head with large white eyes and big black pupils, wide flat yellow-green beak, shaggy brown hair covering the head with a pale green dish on top, green skin with dark green stripes, thin limbs with webbed three-fingered hands and feet. Transparent background, no text.", "Baby kappa: bigger head, shorter limbs, same face, hair and dish. Transparent background, no text.", "Young kappa: same look as the adult, slightly smaller limbs. Transparent background, no text."],
  yujin: ["유진", "태초", "A young Korean woman standing, full body, three-quarter front view: long straight black hair, natural face, black fleece high-neck zip jacket, light-wash wide straight jeans, cream quilted crossbody bag with small black dots, dark sneakers. Made from the 3D model (design/aqua3d-review/yujin) — do not redraw. Transparent background, no text.", "Same person (identical card — the model has one look).", "Same person (identical card — the model has one look)."],
  manatee: ["매너티", "전설", "Photorealistic adult West Indian manatee (Trichechus manatus) swimming side view, head RIGHT: plump fusiform grey-brown body, no neck, small rounded head, large drooping bristly upper-lip pad with whiskers, tiny dark eye, two small paddle front flippers with rounded nails, large flat rounded spoon-shaped horizontal tail, no dorsal fin, wrinkled skin with faint scars and light algae patches. Transparent background, no text.", "Real newborn manatee calf: darker smooth grey skin, chubby, no algae. Transparent background, no text.", "Real juvenile manatee: grey skin with few algae patches, same shape as the adult. Transparent background, no text."],
  bottlenose_dolphin: ["큰돌고래", "전설", "Real common bottlenose dolphin (Tursiops truncatus) swimming side view, head RIGHT: sleek streamlined body, dark blue-grey back cape, lighter grey flanks, pale white belly and lower jaw, short stubby beak under a rounded melon, small dark eye, tall curved dorsal fin, pointed pectoral flippers, wide horizontal flukes. Transparent background, no text.", "Real newborn bottlenose dolphin calf: lighter grey, slightly plump, faint pale vertical fetal fold stripes on the flank. Transparent background, no text.", "Real juvenile bottlenose dolphin: same pattern as the adult, slightly lighter and smaller. Transparent background, no text."],
  beluga: ["벨루가", "태초", "Real beluga whale (Delphinapterus leucas) swimming side view, head RIGHT: stout creamy-white body, large rounded bulbous melon forehead over a short beak, upturned smiling mouth line, small dark eye, no dorsal fin (low dorsal ridge), broad rounded paddle flippers, wide flukes. Transparent background, no text.", "Real newborn beluga calf: plump dark slate-grey body, smaller melon, short beak. Transparent background, no text.", "Real juvenile beluga: light grey body, rounded melon, short beak, smiling mouth line. Transparent background, no text."],
  sawshark: ["톱상어", "영웅", "Real Japanese sawshark (Pristiophorus japonicus) side view, head RIGHT: slim brownish shark body, long flat saw-like snout lined with teeth, a pair of long barbels under the saw, two dorsal fins, no anal fin. Natural-history illustration, transparent background.", "Newborn sawshark pup side view, head RIGHT: short saw, pale tan body.", "Juvenile sawshark side view, head RIGHT: saw half grown, tan body."],
  snow_crab: ["대게", "희귀", "Real snow crab (Chionoecetes opilio) seen exactly from above, head RIGHT: round orange-red carapace with fine bumps, long slender flattened walking legs spread wide, two slim claws. Natural-history illustration, transparent background.", "Newborn-sized young snow crab seen from above, head RIGHT: pale peach shell, short legs, tiny claws.", "Juvenile snow crab seen from above, head RIGHT: lighter orange shell, legs not yet full length."],
  lobster: ["바닷가재", "고급", "Real American lobster (Homarus americanus) seen from above at a slight angle, head RIGHT: dark red-brown mottled shell, two big unequal claws, long red antennae, segmented tail ending in a fan. Natural-history illustration, transparent background.", "Newborn-sized young lobster, head RIGHT: pale translucent orange-brown, thin claws.", "Juvenile lobster, head RIGHT: lighter red-brown, claws not yet full size."],
  king_crab: ["킹크랩", "영웅", "Real red king crab (Paralithodes camtschaticus) seen exactly from above, head RIGHT: spiny heart-shaped red carapace, thick spiny walking legs with white undersides, right claw larger than the left. Natural-history illustration, transparent background.", "Newborn-sized young red king crab seen from above, head RIGHT: pale pinkish shell, spines just starting, short legs.", "Juvenile red king crab seen from above, head RIGHT: lighter red shell, legs not yet full length."],
};
const ORCA_FRY = "Real newborn killer whale calf (Orcinus orca): short rounded body, proportionally large head and flippers, small curved dorsal fin, the white areas tinged pale orange-peach as in real newborn calves, black elsewhere, faint fetal fold lines on the flank. Exact side view, head RIGHT.";
const ORCA_JUV = "Real juvenile killer whale (Orcinus orca), about one third grown: longer body than the calf, white patches now clean white, small upright dorsal fin not yet tall, faint grey saddle. Exact side view, head RIGHT.";

// [계열 key, 한국어, 치어 설명, 어린 물고기 설명]
export const YOUNG = [
  ...native.species.map(({key, name}) => [key, name,
    native.items.find(i => i.key === `fry_${key}`).subject,
    native.items.find(i => i.key === `juv_${key}`).subject]),
  ...expansion2.species.map(({key, name}) => [key, name,
    expansion2.items.find(i => i.key === `fry_${key}`).subject,
    expansion2.items.find(i => i.key === `juv_${key}`).subject]),
  ...mammals.species.map(({key, name}) => [key, name,
    mammals.items.find(i => i.key === `fry_${key}`).subject,
    mammals.items.find(i => i.key === `juv_${key}`).subject]),
  ...shrimp.species.map(({key, name}) => [key, name, shrimpSubject(`fry_${key}`), shrimpSubject(`juv_${key}`)]),
  // 범고래(2026-11-14) — 새끼 · 어린 그림은 아직 없어 다 큰 그림을 쓴다(ART-GUIDE F)
  ["orca", "범고래", ORCA_FRY, ORCA_JUV],
  ...Object.entries(CRAB).map(([key, [name, , , f, j]]) => [key, name, f, j]),
  ...expansion4.species.map(({key, name}) => [key, name,
    expansion4.items.find(i => i.key === `fry_${key}`).subject,
    expansion4.items.find(i => i.key === `juv_${key}`).subject]),
  ...expansion.species.map(([key, name]) => [key, name,
    expansion.items.find(i => i.key === `fry_${key}`).subject,
    expansion.items.find(i => i.key === `juv_${key}`).subject]),
  ["catfish", "메기", fry("Korean Amur catfish (Silurus asotus)", "short delicate translucent olive-brown body, fuller flat head, tiny developing barbels, small natural eyes"), juv("Korean Amur catfish (Silurus asotus)", "slender olive-grey scaleless body, broad flat head, one long maxillary and one short mandibular barbel pair, developing long anal fin")],
  ["sweetfish", "은어", fry("ayu sweetfish (Plecoglossus altivelis)", "tiny translucent slender body, faint silver belly pigment, delicate developing forked tail, no prominent adult yellow patch"), juv("ayu sweetfish (Plecoglossus altivelis)", "slim silver-grey body, olive back, faint yellow patch starting behind the gill, small adipose fin, forked tail")],
  ["jellyfish", "보름달물해파리", "Real newly free-swimming moon jellyfish (Aurelia aurita) ephyra, tiny translucent shallow star-like bell with eight delicately lobed arms and faint radial canals. No long trailing tentacles. Bell uppermost; ignore fish head-right convention, slight side angle.", "Real juvenile moon jellyfish (Aurelia aurita), small shallow translucent bell, faint four horseshoe-shaped gonad rings, short marginal tentacles and short soft oral arms. Bell uppermost, arms down; ignore fish head-right convention. Not a fantasy creature."],
  ["guppy", "구피", fry("guppy", "pale silver body with a faint hint of color in the tail"), juv("guppy", "slim silver-grey body, small fan tail beginning to show orange and blue flecks")],
  ["tetra", "테트라", fry("tetra", "clear glassy body with a thin faint blue line"), juv("tetra", "small torpedo body, one thin glowing blue stripe, faint red near the tail")],
  ["goldfish", "금붕어", fry("goldfish", "dull bronze-grey body, round belly"), juv("goldfish", "rounded body changing from bronze to orange in patches, short double tail")],
  ["betta", "베타", fry("betta", "plain brown-grey body, tiny pointed fins"), juv("betta", "slender dusky body with blue sheen, fins starting to lengthen, short tail")],
  ["angel", "엔젤피시", fry("angelfish", "tiny diamond-shaped silver body, thin fin threads"), juv("angelfish", "small triangular silver body, faint dark vertical bars, short fin streamers")],
  ["clown", "흰동가리", fry("clownfish", "pale orange body with one faint white band"), juv("clownfish", "orange oval body with two soft white bands and thin dark edges, rounded fins")],
  ["discus", "디스커스", fry("discus", "small coin-shaped brown body with faint vertical bars"), juv("discus", "round flat disc body, brownish with first turquoise wavy lines around the face")],
  ["koi", "비단잉어", fry("koi carp", "plain olive-gold body, two tiny whiskers"), juv("koi carp", "long sturdy body, pale cream with the first patchy orange spots, small whiskers")],
  ["ray", "민물가오리", fry("freshwater stingray, shown from above at a slight angle so the round disc is visible", "tiny round brown disc with thin tail, small anatomically correct dorsal eyes"), juv("freshwater stingray, shown from above at a slight angle so the round disc is visible", "round dark disc with the first pale spots, thin short tail")],
  ["bluefin", "참다랑어", fry("Pacific bluefin tuna", "tiny translucent slender larval body, subtle silver pigment, developing forked tail"), juv("Pacific bluefin tuna", "slim metallic blue-silver body, small finlets and narrow crescent tail, juvenile vertical bars")],
  ["sea_turtle", "바다거북", "Real green sea turtle hatchling, small dark oval carapace with authentic scutes, four paddle flippers, small reptilian eyes. Three-quarter dorsal view with head RIGHT, all flippers relaxed and separated from body, tail LEFT.", "Real juvenile green sea turtle, olive-brown scuted shell, cream neck and natural reticulated flipper markings. Three-quarter dorsal view, head RIGHT, all four flippers visible in relaxed glide."],
  ["whale_shark", "고래상어", fry("whale shark", "small slender blue-grey shark, natural white spot-and-stripe lattice, broad flattened head, terminal mouth, five gill slits"), juv("whale shark", "sleek blue-grey body with complete white spot lattice, broad flattened head, five gill slits, asymmetric tail, no whale-like features")],
  ["manta", "만타가오리", "Real newborn oceanic manta ray, small diamond-shaped dark disc, authentic small eyes and two cephalic lobes, full thin tail LEFT, head RIGHT. Oblique dorsal view with both wing-like pectoral fins fully visible, neutral mid-glide pose.", "Real juvenile oceanic manta ray, broad black-and-white diamond disc, two cephalic lobes, wide terminal mouth, long thin tail LEFT, head RIGHT. Oblique dorsal view, both wings fully visible in neutral swimming pose."],
  ["arowana", "아로와나", fry("arowana", "long thin silver body, upturned mouth, tiny whiskers, small yolk belly"), juv("arowana", "long blade-shaped silver body, large forming scales, upturned mouth with two chin whiskers")],
  ["rising", "등용어", fry("mythical Korean 'rising carp' that will one day become a dragon", "pale gold body, one tiny glowing pearl-like dot on the forehead, soft sparkles around it"), juv("mythical Korean 'rising carp' that will one day become a dragon", "strong gold-and-jade carp body with tiny nub horns starting, faint dragon-like whiskers, soft glow")],
  ["astral", "별무리어", fry("cosmic star fish spirit", "translucent deep-indigo body filled with tiny stars, soft glow, little comet tail"), juv("cosmic star fish spirit", "indigo-violet translucent body with a small swirl of galaxy inside, wispy glowing fins")],
];

// [key, 한국어, 등급, 설명]
export const FINALS = [
  ...native.species.map(({key, name, grade, subject}) => [key, name, grade, subject]),
  ...expansion2.species.map(({key, name, grade, subject}) => [key, name, grade, subject]),
  ...expansion4.species.map(({key, name, grade}) => [key, name, grade, expansion4.items.find(i => i.key === key).subject]),
  ...mammals.species.map(({key, name, grade}) => [key, name, grade, mammals.items.find(i => i.key === key).subject]),
  ...shrimp.species.map(({key, name}) => [key, name, SHRIMP_GRADE[key], shrimpSubject(key)]),
  ...Object.entries(CRAB).map(([key, [name, grade, adult]]) => [key, name, grade, adult]),
  ["orca", "범고래", "신화", "Real adult killer whale (Orcinus orca): powerful streamlined black body, rounded blunt head with closed mouth, white oval eye patch behind and above a tiny dark eye, white lower jaw and belly with sweeping flank marking, grey saddle patch behind a tall dorsal fin, broad paddle-shaped pectoral flippers, horizontal tail flukes. Exact side view, head RIGHT, neutral straight swimming pose, matte skin with no white specular streaks."],
  ...expansion.species.map(([key, name, grade]) => [key, name, grade, expansion.items.find(i => i.key === key).subject]),
  ["catfish", "메기", "고급", "Real adult Korean Amur catfish (Silurus asotus), long flat dark-olive scaleless body, broad flattened head, one long maxillary barbel pair and one short mandibular barbel pair, small natural eyes, tiny dorsal fin and long anal fin. Exact side view, head RIGHT, neutral straight swimming pose."],
  ["sweetfish", "은어", "보통", "Real adult ayu sweetfish (Plecoglossus altivelis), slim silver body with a soft yellow patch behind the gill, olive back, small adipose fin, forked tail, small natural eyes. Exact side view, head RIGHT."],
  ["jellyfish", "보름달물해파리", "희귀", "Real adult moon jellyfish (Aurelia aurita), translucent milky bell with four pale horseshoe-shaped gonad rings, fine short marginal tentacles and four soft oral arms. Bell uppermost with arms trailing DOWN, side view at a slight upward angle; ignore fish head-right rule. No crescent moon, stars, fantasy aura or long flowing thread tentacles."],
  ["bluefin_tuna", "참다랑어", "영웅", "Real adult Pacific bluefin tuna (Thunnus orientalis), powerful fusiform body, deep cobalt back and reflective silver belly, small yellow finlets, short pectoral fins, narrow caudal peduncle with keels and a crescent tail. Do not give it the long yellow sickle fins of yellowfin tuna. Exact side view, head RIGHT, neutral straight-body swimming pose."],
  ["green_sea_turtle", "바다거북", "전설", "Real adult green sea turtle (Chelonia mydas), olive-brown oval shell with authentic scute pattern, cream throat, reticulated scales on head and paddle flippers, small natural reptilian eyes. Slight dorsal three-quarter view, head RIGHT and tail LEFT, all four flippers visible and separated in neutral gliding pose, no anthropomorphism."],
  ["whale_shark", "고래상어", "신화", "Real adult whale shark (Rhincodon typus), enormous broad flattened head, wide terminal mouth, small lateral eyes, five gill slits, blue-grey skin with regular white spots and transverse pale stripes, longitudinal body ridges, asymmetric shark tail. Exact side view, head RIGHT, tail LEFT, neutral straight gliding pose. No whale anatomy, no teeth bared, no aura."],
  ["oceanic_manta", "만타가오리", "전설", "Real giant oceanic manta ray (Mobula birostris), broad triangular black wings, subtle white shoulder markings and white underside edge, two curled cephalic fins and wide terminal mouth, tiny natural eyes, complete thin tail LEFT, head RIGHT. Oblique dorsal viewpoint, both wings fully visible in relaxed neutral glide, not a round freshwater stingray, no magical aura."],
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
  ["sea_lettuce", "파래", "Korean sea lettuce (green laver, Ulva): a dense bright-green tuft of thin, translucent ruffled fronds attached to a small grey rock."],
  ["sea_mustard", "미역", "Korean sea mustard (miyeok, Undaria pinnatifida): olive-brown fronds with frilly wavy edges and a central rib, rising from a small rock holdfast."],
  ["dasima", "다시마", "Korean kelp (dasima, Saccharina japonica): a few long, wide, smooth dark olive-brown blades with slightly wavy edges, rising from a rock holdfast."],
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
  ["tank_7", "산호 대수족관", "A vast coral reef aquarium interior: warm turquoise water, huge soft pink and orange coral walls in the distance, pale pink sand floor."],
  ["tank_8", "심해 대수족관", "A vast deep sea aquarium interior: very dark navy water, faint glowing teal bioluminescent shapes far away, grey silt floor."],
  ["tank_9", "천상 수족관", "A heavenly aquarium interior: luminous violet and gold water, faint floating cloud-like shapes and soft star light, pearl white sand floor."],
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
- 기존 관상어 계열의 네 형태는 **무늬와 실루엣이 한눈에 달라야 한다**. 색만 바꾼 그림은 안 된다.
- 참다랑어·바다거북·고래상어·만타가오리는 각각 자기 종 그대로 성장한다(서로 다른 동물로 진화하지 않는다).
- 전체를 **실사 스타일**로 그린다. 큰 눈·웃는 얼굴·캐릭터 비율 금지. 신화 생물도 실사 영화의 생물처럼 표현한다.
- 추가 해양 4종의 성체는 중립 유영 자세 원본과 **4열×2행 8프레임** 수영 시트를 함께 만든다. 머리 위치와 몸 크기를 프레임마다 고정하고, 거북은 앞지느러미·만타는 양 날개·다랑어와 상어는 꼬리 움직임을 구분한다. 시트는 \`public/aqua/motion/<성체 key>.webp\`(1024×512), 프레임은 256×256이며 투명 배경이다. 수조에서만 재생하고 가게·도감은 정지 원본을 쓴다.
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
