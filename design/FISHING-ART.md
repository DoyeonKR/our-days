# 낚시 그림 목록 · 프롬프트

> 이 파일은 `node scripts/fishing-art.mjs prompts` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다.
> **이 문서의 그림은 전부 2D 다.** 수조 내부의 3D 모델은 별도 제작·검수하며(`design/aqua3d-review/`), 이 문서의 낚시터 · 장비 · 미끼 · 쓰레기를 대체하지 않는다.
> 낚시 결과 카드 · 게임 탭 카드의 물고기는 2D 그림(`public/aqua/fish`, design/AQUARIUM-ART.md)을 그대로 쓴다 — 수조가 3D 가 돼도 지우지 않는다.
>
> 모두 **79장**: 낚시터 배경 15 · 장비 12 · 미끼 7 · 꽝 쓰레기 23 · 유물 18 · 만든 미끼 4. 미끼 · 쓰레기 · 유물 · 만든 미끼는 없으면 화면이 벡터 아이콘으로 그린다.
> **아직 안 그린 것**은 `node scripts/fishing-art.mjs sync` 가 끝에 '아직 없음'으로 알려 준다. 최신 지침서는 `design/ART-GUIDE.md`.

## 넣는 법

1. 파일 이름을 **key** 로 저장한다(예: `spot_brook.png`, `rod_carbon.png`).
2. `node scripts/fishing-art.mjs sync <그림 폴더>` — `public/fishing/` 에 굽고 그림 목록을 다시 쓴다. 일부만 그려도 된다(없는 그림은 임시 그림).

## 공통 프롬프트

각 그림의 프롬프트 = **공통 문장 + 표의 설명**. 실제 게임 화면을 따라 그리지 않는다. 3D 렌더풍(CG · 플라스틱 질감)이 아니라 전부 손으로 칠한 그림체로 맞춘다.

**낚시터 공통**

```
Premium hand-painted mobile fishing game background, portrait 4:5 (1024x1280), viewed from the shore looking out over the water. Horizon at about 34% from the top: scenery and sky above it, a wide calm open water surface filling the lower 66%. The water surface must stay open and uncluttered because the bobber, fishing line and fish shadow are drawn on top in the game. No people, no fishing rod, no boats in the middle, no fish, no text, no UI, no border, no watermark.
```

**장비 공통**

```
Premium hand-painted mobile game item icon, cute but believable, glossy rich shading, soft light from the upper left, clean readable silhouette at 52 pixels. Single object drawn diagonally, whole object inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No hands, no water, no scenery, no cast shadow, no text, no border, no watermark. 1024x1024.
```

## 낚시터 (15장)

| key | 이름 | 설명 |
|---|---|---|
| `spot_dumulmeori` | 양평 두물머리 | Real Korean place: Dumulmeori in Yangpyeong, where the Namhan and Bukhan rivers meet. Wide calm river at dawn, a huge old zelkova tree and a traditional wooden sail boat on the far bank, soft misty layered mountains behind, reeds along the far edge. |
| `spot_soyang` | 춘천 소양호 | Real Korean place: Soyang Lake in Chuncheon in winter dawn. Broad dam lake between steep forested mountains, mist on still dark water, a small ferry far away. |
| `spot_hwacheon` | 화천 화천천 | Real Korean place: Hwacheon stream in winter. Frozen river with ice-fishing holes and small figures far away, snow-covered hills, pale clear sky. |
| `spot_bonghwa` | 봉화 계곡 | Real Korean place: a cold mountain valley in Bonghwa, Gyeongbuk. Clear shallow stream over round boulders, thick pine and broadleaf forest on steep slopes, soft morning light. |
| `spot_sanriver` | 단양 남한강 | Real Korean place: the Namhan River at Danyang. Tall limestone peaks rising from the water (Dodamsambong-like rock pillars), a small pavilion far away, emerald water. |
| `spot_abyss` | 울릉분지 심해 | First-person view above a deep ocean trench at night, faint bioluminescent glow from far below, a few drifting lights, calm black open water in the lower 70%, no boat across the foreground, no text. |
| `spot_harbor` | 통영 항구 | Real Korean place: Tongyeong harbour on the south coast (Hallyeosu waterway). Colourful low hillside village on the far left, small fishing boats along the far quay only, a small red lighthouse on a breakwater, many green islands fading into the distance behind calm blue water. |
| `spot_brook` | 서울 청계천 | Real Korean place: Cheonggyecheon stream in downtown Seoul. A clear shallow urban stream between stone walkways, stepping stones across the water, low stone walls with willows and reeds, modern city buildings and an old stone bridge in the distance, soft evening light. |
| `spot_pond` | 창녕 우포늪 | Real Korean place: Upo Wetland in Changnyeong, the largest natural inland wetland in Korea. Vast shallow marsh in morning mist, mats of water chestnut and prickly water lily along the far edge, willow trees standing in the water, a small flat wooden punt with a long pole far away, low hills, no buildings. |
| `spot_seomjin` | 하동 섬진강 | Real Korean place: Seomjin River in Hadong. Wide clean river with pale sand bars along the far bank, green tea terraces and pine forest on the slopes, the long ridge of Jirisan in the distance, clear jade-green water. Temperate Korean landscape, no palm trees and no jungle. |
| `spot_jungle` | 서천 국립생태원 열대관 | Real Korean place: the tropical house inside the Ecorium of the National Institute of Ecology in Seocheon. A huge glass greenhouse dome overhead, lush tropical plants and hanging vines, a wide indoor pool of deep green water, a wooden visitor walkway far away. |
| `spot_reef` | 서귀포 문섬 | Real Korean place: off Seogwipo on Jeju Island looking at Munseom islet. Black volcanic basalt shore on the far side, a steep green-topped rock islet in the distance, the gentle silhouette of Hallasan mountain behind, clear blue-turquoise water with hints of soft coral under the far shallows. No white sand beach. |
| `spot_ocean` | 울릉도 앞바다 | Real Korean place: the East Sea off Ulleungdo island. Steep volcanic cliffs and rock pillars rising straight from deep indigo water in the distance, dense green on the cliff tops, a tall sea stack, one small squid-fishing boat far away, bright clear sky. |
| `spot_palace` | 기장 용궁사 앞바다 | Real Korean place: the coast at Haedong Yonggungsa temple in Gijang, Busan. A traditional Korean Buddhist temple with curved tiled roofs built on rugged seaside rocks in the far distance, stone lanterns, sunrise sky of violet and pink over open East Sea. Real landscape, not a fantasy underwater palace. |
| `spot_starsea` | 고성 거진항 | Real Korean place: Geojin fishing port in Goseong, Gangwon, on the East Sea at night. A small working harbor with a low breakwater and a little red lighthouse and white lighthouse far away, moored squid boats, a line of bright green-white squid-boat lamps on the dark horizon, the faint silhouette of Seorak mountains behind, many clear stars in a deep navy sky, calm dark water with soft reflections. |

## 장비 (12장)

**낚싯대 규칙** — 그림이 낚시터에 그대로 나온다. 프로그램이 그림을 세운 뒤 띠로 잘라 휘게 하므로:
- 낚싯대 전체가 **대각선 한 줄**로 곧게 놓여야 한다(손잡이 끝이 아래쪽 모서리, 끝이 반대쪽 위 모서리). 그림 안에서 많이 휘면 휜 채로 또 휜다.
- 줄을 늘어뜨리지 않는다 — 줄과 찌는 게임이 그린다. 끝에 매달린 장식도 작게.
- ⚠ 낚싯대를 다시 그리면 `src/lib/fishingfx.ts` 의 `FX_ROD_ART`(손잡이 끝 · 낚싯대 끝 · 릴 자리)를 그 그림에 맞춰 다시 잰다. 안 재면 줄이 낚싯대 끝에서 떨어진다.

**뜰채 규칙** — 뜰채 낚시에서 물 위로 내리꽂히고 조준 원과 겹친다. 둥근 테가 위쪽 절반에, 자루가 오른쪽 아래로 오게 그린다.

| key | 이름 | 설명 |
|---|---|---|
| `rod_bamboo` | 대나무 낚싯대 | Simple old bamboo fishing rod with a small wooden reel. |
| `rod_glass` | 유리섬유 낚싯대 | Light fiberglass fishing rod, pale blue, simple silver spinning reel. |
| `rod_carbon` | 카본 낚싯대 | Sleek black carbon fishing rod with red wraps and a modern spinning reel. |
| `rod_titan` | 티타늄 낚싯대 | Premium brushed titanium fishing rod with gold accents and a heavy machined reel. |
| `rod_dragon` | 용골 낚싯대 | Fantasy fishing rod carved from a dragon bone, ivory with jade inlays, small dragon head at the grip, glowing jade reel. |
| `rod_star` | 별빛 낚싯대 | Legendary fishing rod made of starlight: dark indigo shaft filled with stars, glowing silver line, a tiny comet orbiting the tip, crystal reel. |
| `net_bug` | 잠자리채 | Cheap childhood bug-catching net: thin wire hoop, white mesh, short wooden stick. |
| `net_cotton` | 면 뜰채 | Fishing landing net with a wooden hoop and soft cream cotton mesh. |
| `net_rubber` | 고무 뜰채 | Modern landing net with a black aluminum hoop and clear-green rubber mesh. |
| `net_silver` | 은실 뜰채 | Elegant landing net with a polished silver hoop and shimmering silver-thread mesh. |
| `net_gold` | 황금 뜰채 | Luxurious landing net with an ornate gold hoop and fine golden mesh, small gems on the handle. |
| `net_moon` | 달빛 뜰채 | Legendary landing net: hoop shaped like a crescent moon, mesh woven from glowing moonlight, soft silver sparkles. |

## 미끼 (7장) — 장비 공통 프롬프트

| key | 이름 | 설명 |
|---|---|---|
| `bait_worm` | 지렁이 | A plump pink earthworm curled in an S shape, moist highlights. |
| `bait_shrimp` | 민물새우 | A small translucent freshwater shrimp with long feelers, pinkish, curled tail. |
| `bait_squid` | 오징어살 | A tender piece of white squid with a little tentacle tuft, wet glossy shine. |
| `bait_paste` | 황금 떡밥 | A soft round ball of golden fishing paste bait, grainy texture, warm honey glow. |
| `bait_glow` | 심해 발광 미끼 | A teardrop bait from the deep sea that glows cyan from within, with soft light bloom. |
| `bait_pearl` | 용궁 진주 미끼 | A luminous pearl resting in a small violet clam shell, Korean Dragon King's palace treasure. |
| `bait_star` | 별가루 미끼 | A small handful of star dust forming a glowing golden star shape with tiny sparkles orbiting it. |

## 꽝 쓰레기 (23장) — 장비 공통 프롬프트(귀엽게, 더럽지 않게)

| key | 이름 | 설명 |
|---|---|---|
| `junk_buoy` | 스티로폼 부표 | A weathered white styrofoam fishing float buoy with a frayed blue rope tied around it, chipped edges. |
| `junk_basket` | 재첩 바구니 | A small old woven bamboo basket used for gathering river clams, wet, with one tiny clam inside. |
| `junk_oar` | 부러진 나룻배 노 | A broken old wooden boat oar snapped near the middle, worn paddle blade, wet wood grain. |
| `junk_ring` | 유람선 구명환 | An old orange and white ring life buoy from a lake ferry, faded paint, a short rope attached. |
| `junk_pole` | 등산 스틱 | A bent aluminium hiking pole with a worn rubber grip and wrist strap, a little muddy. |
| `junk_stool` | 얼음낚시 의자 | A small folding camp stool used for ice fishing, faded red fabric seat, frost on the metal legs. |
| `junk_helmet` | 패러글라이딩 헬멧 | A scuffed bright yellow paragliding helmet with a chin strap, small scratches. |
| `junk_probe` | 심해 탐사선 부품 | A broken piece of a deep-sea research probe: a scratched metal sphere with a camera lens and two loose cables. |
| `junk_can` | 찌그러진 깡통 | A crumpled drink can with faded red label, dented, a little wet sheen. |
| `junk_boot` | 장화 한 짝 | A single old yellow rubber boot, a bit muddy, slightly bent at the ankle. |
| `junk_bottle` | 페트병 | A scuffed clear plastic bottle with blue cap and a peeling label. |
| `junk_bag` | 비닐봉지 | A limp white plastic shopping bag, soft flowing shape almost like a jellyfish. |
| `junk_sock` | 구멍 난 양말 | A single limp pink striped sock with a big hole at the toe. |
| `junk_tire` | 낡은 타이어 | A worn black car tire with a little seaweed hanging from it. |
| `junk_umbrella` | 살이 부러진 우산 | A broken purple umbrella, bent ribs poking out, half folded. |
| `junk_duck` | 고무 오리 | A faded yellow rubber duck, slightly scuffed, adorable blank stare. |
| `junk_slipper` | 삼선 슬리퍼 | A single black rubber slide sandal with three white stripes, wet. |
| `junk_coin` | 소원 동전 | A shiny old gold wishing coin with a tiny star engraved, a bit of pond algae on it. |
| `junk_hat` | 탐험가 모자 | A worn khaki explorer's pith hat with a brown band, a small leaf stuck on it. |
| `junk_glasses` | 깨진 선글라스 | A pair of black sunglasses with one cracked lens, tiny coral stuck on the frame. |
| `junk_letter` | 유리병 편지 | A corked green glass bottle with a rolled parchment letter inside. |
| `junk_bill` | 용왕의 고지서 | An ancient parchment invoice with a red royal seal and wavy ocean ornament border, no readable text. |
| `junk_satellite` | 인공위성 조각 | A broken piece of a small satellite with one bent blue solar panel, sparkling with stardust. |

## 보물 · 유물 조각 (18장) — 장비 공통 프롬프트(물속에서 건진 느낌은 살짝만, 글자 없이)

| key | 이름 | 설명 |
|---|---|---|
| `relic_pottery_vase` | 청자 매병 | A Goryeo celadon maebyeong vase: jade-green glaze with fine crackle, inlaid white-and-black cranes and clouds, narrow neck, broad shoulder, a little river silt at the foot. |
| `relic_pottery_jar` | 백자 달항아리 | A Joseon white porcelain moon jar: large milky-white round body slightly lopsided, soft warm glaze, a faint water stain. |
| `relic_pottery_bowl` | 분청 대접 | A buncheong stoneware bowl: grey clay with quick white slip brush strokes, simple stamped pattern, slightly chipped rim. |
| `relic_pottery_dropper` | 청자 연적 | A small celadon water dropper shaped like a peach with a leaf, jade-green glaze, tiny spout. |
| `relic_wreck_plate` | 배 이름 명판 | A weathered wooden ship nameplate with carved blank border (no readable letters), brass corner studs turned green. |
| `relic_wreck_compass` | 놋쇠 나침반 | An antique brass ship compass in a round case, glass slightly cracked, verdigris on the edges. |
| `relic_wreck_bell` | 뱃종 | A small bronze ship bell with a short rope, green patina, barnacles on one side. |
| `relic_wreck_anchor` | 닻 조각 | A broken old iron anchor fluke and shank, rusty with small shells stuck on it. |
| `relic_wreck_wheel` | 키 손잡이 | A broken wooden ship steering wheel segment with three spokes and brass hub, worn wood. |
| `relic_pirate_coin` | 금화 | A small stack of three old gold coins with worn sun emblems (no letters), shining. |
| `relic_pirate_glass` | 망원경 | An extended brass spyglass telescope with leather grip, a little sea salt crust. |
| `relic_pirate_key` | 녹슨 열쇠 | A large ornate old iron key with a ring bow, rusty, a little seaweed on it. |
| `relic_pirate_map` | 보물 지도 조각 | A torn piece of an old treasure map on parchment: a dotted path, a small red X, a compass rose, no readable text. |
| `relic_palace_scale` | 용의 비늘 | A single large iridescent dragon scale, teal to gold shimmer, shaped like a shield, Korean Dragon King legend. |
| `relic_palace_pearl` | 여의주 | A glowing wish-granting pearl (yeouiju) held in a small swirl of flame-shaped cloud, soft golden light. |
| `relic_palace_crown` | 산호 관 | A small crown made of red coral branches and pearls, Korean undersea palace style. |
| `relic_palace_tile` | 용궁 기와 | A Korean roof-end tile (sumaksae) with a dragon face relief, blue-green glaze with gold edges. |
| `relic_palace_seal` | 거북 인장 | A royal seal stamp with a turtle-shaped handle carved in jade, red ink on the base (no readable characters). |

## 만든 미끼 (4장) — 장비 공통 프롬프트(미끼 7장과 같은 크기 · 같은 톤)

| key | 이름 | 설명 |
|---|---|---|
| `craft_scent` | 향 미끼 | A soft pink fishing bait dough ball with three wavy pink scent wisps rising from it, sweet and fragrant look. |
| `craft_glow` | 빛 미끼 | A golden glowing bait bead with a small four-point star inside and a warm soft halo around it. |
| `craft_shine` | 반짝 미끼 | A pale cyan pearly bait bead with tiny sparkles and a small yellow twinkle above it, attracts floating bottles. |
| `craft_sticky` | 끈끈 미끼 | A green sticky bait blob with a little stretchy drip hanging down, glossy but cute, not gross. |
