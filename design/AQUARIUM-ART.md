# 우리 수조 그림 목록 · 프롬프트

> 이 파일은 `scripts/aqua-art-prompts.mjs` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다.
> 모두 **115장**: 치어 · 어린 물고기 24 · 최종 물고기 48 · 악세사리 37 · 수조 배경 6.

## 넣는 법

1. 파일 이름을 **key** 로 저장한다(예: `fry_guppy.png`, `treasure.png`, `tank_1.png`). 한 폴더에 모아도 되고 나눠도 된다.
2. `node scripts/aqua-art-sync.mjs <그림 폴더>` — 투명 여백을 자르고 원본(512) · 사본(192)을 `public/aqua/` 에 굽고 그림 목록을 다시 쓴다. 수조 배경은 1024×1280.
3. 일부만 그려도 된다 — 없는 그림은 임시 그림으로 나온다. 스크립트가 아직 없는 목록을 알려 준다.

## 꼭 지킬 것

- **물고기 머리는 전부 오른쪽**(게임이 좌우로 뒤집어 헤엄치게 한다). 가오리 · 해파리는 표에 적힌 대로.
- 실제 게임 · 애니메이션 캐릭터를 따라 그리지 않는다. 실존 품종은 실제 무늬를 찾아보고 그린다.
- 같은 계열의 네 형태는 **무늬와 실루엣이 한눈에 달라야 한다**. 색만 바꾼 그림은 안 된다.
- 등급이 높을수록 더 화려하게: 흔함 · 보통은 소박하게 → 전설은 반짝임 → 신화는 은은한 빛 → 태초는 빛무리.

## 공통 프롬프트

각 그림의 프롬프트 = **공통 문장 + 표의 설명**.

**물고기 공통**

```
Premium hand-painted mobile game collectible art, cute but believable, glossy rich shading, soft rim light, clean readable silhouette at small size. Single subject in exact side view, HEAD POINTING RIGHT, whole body and all fins inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No water, no bubbles unless stated, no scenery, no ground, no cast shadow, no text, no border, no watermark. 1024x1024.
```

**악세사리 공통**

```
Premium hand-painted mobile game aquarium decoration, cute but believable, glossy rich shading, soft light from the upper left, clean readable silhouette at small size. Single object seen from a slight front three-quarter angle, base at the bottom so it can sit on aquarium sand, whole object inside the image with 10% empty padding on all sides. True transparent background (PNG alpha). No water, no sand, no fish, no scenery, no cast shadow, no text, no border, no watermark. 1024x1024.
```

**수조 배경 공통**

```
Premium hand-painted mobile game background, portrait 4:5 (1024x1280). Empty underwater interior filling the entire frame edge to edge: bright water upper area, soft light rays from above, sandy floor in the bottom 18% of the image. NO fish, NO movable decorations in the middle, keep the center open because fish and decorations are placed on top in the game. No text, no UI, no border, no glass-front reflections covering the center.
```

## 치어 · 어린 물고기 (24장)

| key | 이름 | 설명 |
|---|---|---|
| `fry_guppy` | 구피 치어 | Baby fry of a guppy: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, pale silver body with a faint hint of color in the tail. Adorable, clearly a newborn, simple. |
| `juv_guppy` | 구피 어린 물고기 | Juvenile guppy: young teenage fish, body starting to take adult shape, fins half grown, slim silver-grey body, small fan tail beginning to show orange and blue flecks. Clearly not yet fully grown, less ornate than the adult. |
| `fry_tetra` | 테트라 치어 | Baby fry of a tetra: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, clear glassy body with a thin faint blue line. Adorable, clearly a newborn, simple. |
| `juv_tetra` | 테트라 어린 물고기 | Juvenile tetra: young teenage fish, body starting to take adult shape, fins half grown, small torpedo body, one thin glowing blue stripe, faint red near the tail. Clearly not yet fully grown, less ornate than the adult. |
| `fry_goldfish` | 금붕어 치어 | Baby fry of a goldfish: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, dull bronze-grey body, round belly. Adorable, clearly a newborn, simple. |
| `juv_goldfish` | 금붕어 어린 물고기 | Juvenile goldfish: young teenage fish, body starting to take adult shape, fins half grown, rounded body changing from bronze to orange in patches, short double tail. Clearly not yet fully grown, less ornate than the adult. |
| `fry_betta` | 베타 치어 | Baby fry of a betta: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, plain brown-grey body, tiny pointed fins. Adorable, clearly a newborn, simple. |
| `juv_betta` | 베타 어린 물고기 | Juvenile betta: young teenage fish, body starting to take adult shape, fins half grown, slender dusky body with blue sheen, fins starting to lengthen, short tail. Clearly not yet fully grown, less ornate than the adult. |
| `fry_angel` | 엔젤피시 치어 | Baby fry of a angelfish: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, tiny diamond-shaped silver body, thin fin threads. Adorable, clearly a newborn, simple. |
| `juv_angel` | 엔젤피시 어린 물고기 | Juvenile angelfish: young teenage fish, body starting to take adult shape, fins half grown, small triangular silver body, faint dark vertical bars, short fin streamers. Clearly not yet fully grown, less ornate than the adult. |
| `fry_clown` | 흰동가리 치어 | Baby fry of a clownfish: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, pale orange body with one faint white band. Adorable, clearly a newborn, simple. |
| `juv_clown` | 흰동가리 어린 물고기 | Juvenile clownfish: young teenage fish, body starting to take adult shape, fins half grown, orange oval body with two soft white bands and thin dark edges, rounded fins. Clearly not yet fully grown, less ornate than the adult. |
| `fry_discus` | 디스커스 치어 | Baby fry of a discus: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, small coin-shaped brown body with faint vertical bars. Adorable, clearly a newborn, simple. |
| `juv_discus` | 디스커스 어린 물고기 | Juvenile discus: young teenage fish, body starting to take adult shape, fins half grown, round flat disc body, brownish with first turquoise wavy lines around the face. Clearly not yet fully grown, less ornate than the adult. |
| `fry_koi` | 비단잉어 치어 | Baby fry of a koi carp: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, plain olive-gold body, two tiny whiskers. Adorable, clearly a newborn, simple. |
| `juv_koi` | 비단잉어 어린 물고기 | Juvenile koi carp: young teenage fish, body starting to take adult shape, fins half grown, long sturdy body, pale cream with the first patchy orange spots, small whiskers. Clearly not yet fully grown, less ornate than the adult. |
| `fry_ray` | 민물가오리 치어 | Baby fry of a freshwater stingray, shown from above at a slight angle so the round disc is visible: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, tiny round brown disc with thin tail, big cute eyes. Adorable, clearly a newborn, simple. |
| `juv_ray` | 민물가오리 어린 물고기 | Juvenile freshwater stingray, shown from above at a slight angle so the round disc is visible: young teenage fish, body starting to take adult shape, fins half grown, round dark disc with the first pale spots, thin short tail. Clearly not yet fully grown, less ornate than the adult. |
| `fry_arowana` | 아로와나 치어 | Baby fry of a arowana: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, long thin silver body, upturned mouth, tiny whiskers, small yolk belly. Adorable, clearly a newborn, simple. |
| `juv_arowana` | 아로와나 어린 물고기 | Juvenile arowana: young teenage fish, body starting to take adult shape, fins half grown, long blade-shaped silver body, large forming scales, upturned mouth with two chin whiskers. Clearly not yet fully grown, less ornate than the adult. |
| `fry_rising` | 등용어 치어 | Baby fry of a mythical Korean 'rising carp' that will one day become a dragon: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, pale gold body, one tiny glowing pearl-like dot on the forehead, soft sparkles around it. Adorable, clearly a newborn, simple. |
| `juv_rising` | 등용어 어린 물고기 | Juvenile mythical Korean 'rising carp' that will one day become a dragon: young teenage fish, body starting to take adult shape, fins half grown, strong gold-and-jade carp body with tiny nub horns starting, faint dragon-like whiskers, soft glow. Clearly not yet fully grown, less ornate than the adult. |
| `fry_astral` | 별무리어 치어 | Baby fry of a cosmic star fish spirit: tiny round big-eyed baby fish, translucent body, oversized head, stubby little fins, translucent deep-indigo body filled with tiny stars, soft glow, little comet tail. Adorable, clearly a newborn, simple. |
| `juv_astral` | 별무리어 어린 물고기 | Juvenile cosmic star fish spirit: young teenage fish, body starting to take adult shape, fins half grown, indigo-violet translucent body with a small swirl of galaxy inside, wispy glowing fins. Clearly not yet fully grown, less ornate than the adult. |

## 최종 물고기 (48장)

| key | 이름 | 등급 | 설명 |
|---|---|---|---|
| `cobra_guppy` | 코브라 구피 | 흔함 | Adult male cobra guppy: snakeskin-patterned olive body, large fan tail with green-yellow net pattern. |
| `tuxedo_guppy` | 턱시도 구피 | 보통 | Adult tuxedo guppy: front half pale silver, rear half deep black like a tuxedo, broad blue fan tail. |
| `mosaic_guppy` | 모자이크 구피 | 고급 | Adult mosaic guppy: blue-grey body, huge rounded delta tail with an intricate red and blue mosaic pattern. |
| `fullred_guppy` | 풀레드 구피 | 희귀 | Adult full-red albino guppy: entire body and giant flowing delta tail solid ruby red, ruby-pink eye, elegant shine. |
| `neon_tetra` | 네온 테트라 | 흔함 | Adult neon tetra: slim fish, glowing electric-blue line along the upper body, red stripe only on the rear half, silvery belly. |
| `cardinal_tetra` | 카디널 테트라 | 보통 | Adult cardinal tetra: glowing blue line, vivid red stripe running the FULL body length, slightly deeper body. |
| `glowlight_tetra` | 글로라이트 테트라 | 고급 | Adult glowlight tetra: translucent peach-gold body with one luminous orange-red line from nose to tail, gentle glow. |
| `diamond_tetra` | 다이아몬드 테트라 | 희귀 | Adult diamond tetra: deep silver-violet body covered in sparkling diamond-like glitter scales, long sail-like dorsal fin, lilac fins. |
| `comet_gold` | 코멧 금붕어 | 보통 | Adult comet goldfish: slim streamlined orange body with white accents, one long deeply forked flowing tail. |
| `ryukin_gold` | 류킨 금붕어 | 고급 | Adult ryukin goldfish: high humped back, short deep body, red and white patches, long flowing double tail. |
| `oranda_gold` | 오란다 금붕어 | 희귀 | Adult oranda goldfish: round body, plump bumpy raspberry-like wen hood on the head, red cap on pearl-white body, flowing double tail. |
| `ranchu_gold` | 란추 금붕어 | 영웅 | Adult ranchu goldfish: egg-shaped body with NO dorsal fin, thick boxy wen head, metallic red and gold scales, short elegant spread tail. |
| `veil_betta` | 베일테일 베타 | 보통 | Adult veiltail betta: deep royal-blue body, long drooping veil tail and flowing fins. |
| `crown_betta` | 크라운테일 베타 | 고급 | Adult crowntail betta: dark crimson body, fins and tail split into long spiky crown-like rays with black-red webbing. |
| `halfmoon_betta` | 하프문 베타 | 희귀 | Adult halfmoon betta: tail spread in a perfect 180-degree half circle like a silk fan, gradient turquoise to violet, fully flared fins. |
| `koi_betta` | 코이 베타 | 영웅 | Adult koi-pattern betta: pearl white body with vivid orange, black and red koi-like patches, huge flowing patterned fins. |
| `silver_angel` | 실버 엔젤 | 고급 | Adult silver angelfish: tall triangular flat body, silver with four dark vertical bars, long trailing fin streamers. |
| `marble_angel` | 마블 엔젤 | 희귀 | Adult marble angelfish: tall triangular body with swirling black and silver-white marble pattern, long streamers. |
| `platinum_angel` | 플래티넘 엔젤 | 영웅 | Adult platinum angelfish: tall triangular body, solid pearly platinum white with soft iridescent shine, very long graceful streamers. |
| `altum_angel` | 알툼 엔젤 | 전설 | Adult altum angelfish: extremely tall majestic body, silver-gold with bold dark bars and red-tinted fins, dramatically long dorsal and anal fins, regal. |
| `ocellaris_clown` | 오셀라리스 흰동가리 | 고급 | Adult ocellaris clownfish: bright orange oval body, three white bands with thin black edges, rounded fins. |
| `percula_clown` | 퍼큘라 흰동가리 | 희귀 | Adult percula clownfish: vivid red-orange body, three white bands with THICK black borders, black-tipped fins. |
| `snowflake_clown` | 스노우플레이크 흰동가리 | 영웅 | Adult snowflake clownfish: orange body with wide irregular white snowflake-like bands merging together, black fin tips. |
| `blackice_clown` | 블랙 아이스 흰동가리 | 전설 | Adult black ice clownfish: deep black-chocolate body with large icy-white jagged bands and orange only on the face, striking contrast. |
| `blue_discus` | 블루 디스커스 | 희귀 | Adult blue discus: round flat disc body, cobalt blue with wavy turquoise lines, red eye. |
| `pigeon_discus` | 피전 블러드 디스커스 | 영웅 | Adult pigeon blood discus: round disc, creamy white-yellow body with fine orange-red pepper speckles, red fin edge, red eye. |
| `leopard_discus` | 레오파드 디스커스 | 영웅 | Adult leopard discus: round disc, turquoise body covered in many round red-orange leopard spots. |
| `turquoise_discus` | 터콰이즈 디스커스 | 전설 | Adult solid turquoise discus: large round disc, luminous solid turquoise with a jewel-like metallic sheen and thin golden edge. |
| `kohaku_koi` | 홍백 비단잉어 | 희귀 | Adult kohaku koi: long sturdy carp, pure white body with crisp vivid red patches, two whiskers. |
| `sanke_koi` | 대정삼색 비단잉어 | 영웅 | Adult sanke koi: white body, red patches and small sumi-black spots, elegant. |
| `showa_koi` | 소화삼색 비단잉어 | 전설 | Adult showa koi: mostly black body with dramatic flame-like red and white patches, powerful. |
| `ogon_koi` | 황금 비단잉어 | 전설 | Adult ogon koi: entire long carp body metallic pure gold, each scale edged in bright shine, luxurious. |
| `motoro_ray` | 모토로 가오리 | 영웅 | Adult motoro freshwater stingray, seen from above at a slight angle so the round disc is fully visible, tail pointing LEFT: brown disc covered in orange ring-shaped eye spots. |
| `polka_ray` | 폴카닷 가오리 | 전설 | Adult polka-dot freshwater stingray, seen from above at a slight angle, tail pointing LEFT: jet-black disc with clean white polka dots. |
| `black_ray` | 블랙 다이아몬드 가오리 | 전설 | Adult black diamond stingray, seen from above at a slight angle, tail pointing LEFT: glossy black disc with sparkling silver-white dots and a bright white rim. |
| `pearl_ray` | 펄 가오리 | 신화 | Adult pearl stingray, seen from above at a slight angle, tail pointing LEFT: dark disc densely covered in pearly white mother-of-pearl rosettes that softly shimmer. |
| `silver_arowana` | 실버 아로와나 | 영웅 | Adult silver arowana: long blade-shaped body, large silver scales with a pink edge, upturned mouth, two chin whiskers. |
| `golden_arowana` | 골든 아로와나 | 전설 | Adult golden arowana: long body with huge polished gold scales, upturned mouth, chin whiskers, glinting. |
| `red_arowana` | 슈퍼 레드 아로와나 | 전설 | Adult super red arowana: long body, huge glowing crimson-red scales framed in gold, red fins, fierce. |
| `platinum_arowana` | 플래티넘 아로와나 | 신화 | Adult platinum arowana: long body entirely luminous platinum-white, mirror-like scales, soft silver aura, sacred looking. |
| `pearl_carp` | 여의주 잉어 | 전설 | Mythical carp carrying a glowing wish-granting pearl in its mouth, gold and jade scales, flowing fins, small golden sparkles. Korean folklore feel. |
| `imugi_fish` | 이무기어 | 신화 | Mythical Korean imugi fish: long serpent-like body, dark teal scales, small budding horns, whisker barbels, pale glowing belly, on the verge of becoming a dragon. |
| `azure_dragonfish` | 청룡어 | 신화 | Mythical azure dragon-fish: long turquoise-blue scaled body, antler horns, flowing silver whiskers, aquamarine fin mane, soft cyan glow, half fish half Eastern dragon. |
| `golden_dragonfish` | 황룡어 | 태초 | Supreme golden dragon-fish: magnificent long gold scaled body, branching ivory antlers, flowing white-gold whiskers and mane, jewel pearl glow, radiant aura. Most prestigious look. |
| `moon_jelly` | 달빛 해파리 | 신화 | Mythical moonlight jellyfish, bell at the top with long tentacles trailing down (ignore head-right rule): translucent pearly bell with a crescent moon glowing inside, silver thread tentacles, soft moonlit glow. |
| `aurora_ray` | 오로라 가오리 | 신화 | Mythical aurora ray, seen from above at a slight angle, tail pointing LEFT: translucent wide wings shimmering with green, violet and pink aurora ribbons. |
| `galaxy_fish` | 은하수어 | 태초 | Cosmic galaxy fish: elegant body like a window into deep space, spiral galaxy and stars inside, long fins fading into stardust trails, radiant. |
| `genesis_fish` | 태초의 물고기 | 태초 | The primordial first fish: majestic ancient body of flowing rainbow light and gold, ornate sacred patterns, huge veil fins, halo of light, awe-inspiring. The single rarest creature in the game. |

## 악세사리 (37장)

| key | 이름 | 설명 |
|---|---|---|
| `filter_1` | 스펀지 여과기 | Small aquarium sponge filter: black sponge cylinder on a little base with a thin clear air tube and a few bubbles. |
| `filter_2` | 외부 여과기 | Sleek hang-on aquarium filter box in clear and silver with water flowing out in a small curtain. |
| `filter_3` | 생명의 샘 여과기 | Magical spring-of-life filter: small carved stone fountain with luminous blue-green water, tiny leaves and sparkles. |
| `heater_1` | 작은 히터 | Small glass aquarium tube heater with a suction cup and a little orange indicator light. |
| `heater_2` | 정온 히터 | Modern thermostat aquarium heater: metallic cylinder with small digital temperature display glowing blue. |
| `heater_3` | 용암석 히터 | Fantasy lava stone heater: dark volcanic rock with glowing molten orange cracks and gentle heat shimmer. |
| `feeder_1` | 타이머 급이기 | Small automatic fish feeder with a round dial timer and a little food drum. |
| `feeder_2` | 스마트 급이기 | Sleek white smart fish feeder with a tiny screen and a glowing ring light. |
| `feeder_3` | 풍요의 조개 급이기 | Magical giant open golden shell overflowing with sparkling fish food flakes. |
| `moss_ball` | 모스 볼 | Fluffy round marimo moss ball, rich green, a small cluster of two. |
| `vallisneria` | 발리스네리아 | Tall ribbon-like vallisneria aquatic grass, bunch of long thin green blades swaying upward. |
| `java_fern` | 자바 펀 | Java fern aquatic plant with broad bumpy dark-green leaves growing from a small rhizome. |
| `anubias` | 아누비아스 | Anubias aquatic plant with thick round glossy leaves, compact bush. |
| `red_rotala` | 붉은 로탈라 | Rotala aquatic plant bush with many thin stems and fiery red-pink leaves. |
| `water_lily` | 수련 | Aquatic water lily plant: long stem rising from a bulb, round pads and one pink lotus blossom on top. |
| `coral` | 산호 | Colorful branching coral cluster in pink, orange and purple tones. |
| `glow_kelp` | 빛나는 해초 | Fantasy bioluminescent kelp: tall wavy fronds glowing soft cyan and violet with tiny light motes. |
| `pebbles` | 조약돌 | Small pile of smooth rounded river pebbles in warm grey and white. |
| `driftwood` | 유목 | Gnarled aquarium driftwood branch with twisting arms, weathered brown. |
| `stone_arch` | 돌 아치 | Natural stone arch big enough for fish to swim through, grey layered rock with moss. |
| `lava_rock` | 용암석 | Porous dark red-black lava rock formation with small holes. |
| `crystal` | 수정 군락 | Cluster of pointed amethyst and clear quartz crystals, softly glowing inside. |
| `moon_stone` | 달의 돌 | Smooth pale moonstone boulder with a crescent glow and silver shimmer. |
| `mailbox` | 수중 우체통 | Cute red Korean-style postbox on a short post, slightly barnacled, a heart-shaped letter sticking out. |
| `diver` | 잠수부 인형 | Toy deep-sea diver figure in a brass helmet and suit, with a tiny treasure map, chubby proportions. |
| `heart_bubbler` | 하트 기포기 | Pink ceramic heart ornament with a small opening releasing little heart-shaped bubbles. |
| `sand_castle` | 모래성 | Cute sand castle with three towers, little flags and shell decorations. |
| `windmill` | 수중 풍차 | Miniature wooden underwater windmill with four sails, cozy village style, moss at the base. |
| `treasure` | 보물상자 | Open wooden pirate treasure chest overflowing with gold coins and gems, iron bands. |
| `pearl_clam` | 진주 조개 | Large open giant clam shell, iridescent inside, holding one big luminous pearl. |
| `stone_pagoda` | 석탑 | Traditional Korean multi-tiered stone pagoda, weathered granite with soft moss. |
| `sunken_ship` | 난파선 | Small sunken wooden ship tilted on one side, broken mast, tattered sail, barnacles. |
| `hanok` | 수중 한옥 | Miniature traditional Korean hanok house with curved tiled roof and wooden pillars, warm lantern light inside. |
| `mermaid` | 인어 동상 | Elegant marble mermaid statue sitting on a rock, tasteful and fully modest, soft moss. |
| `turtle_ship` | 거북선 | Miniature Korean Joseon-era turtle ship with a spiked armored roof and dragon head prow, resting on its keel. |
| `dragon_palace` | 용궁 | Fantasy Korean Dragon King undersea palace: grand multi-roof palace with jade and gold, glowing lanterns, coral pillars. Ornate and prestigious. |
| `star_gate` | 별의 문 | Fantasy gate of stars: a tall stone ring arch with a swirling starry galaxy portal inside, glowing runes. The rarest decoration. |

## 수조 배경 (6장)

| key | 이름 | 설명 |
|---|---|---|
| `tank_1` | 작은 어항 | A small cozy glass bowl interior: warm bright light blue water, plain fine pale sand floor. |
| `tank_2` | 둥근 어항 | A round fishbowl interior: clear blue-green water with soft curved light, white pebble floor. |
| `tank_3` | 가정 수조 | A well-kept home aquarium interior: fresh blue water, subtle soft green plant silhouettes far behind, natural sand floor. |
| `tank_4` | 대형 수조 | A large planted aquarium interior: deep blue water, distant rocky hills and soft plant silhouettes in the far background, golden sand floor. |
| `tank_5` | 유리 수족관 | A grand public aquarium interior: deep teal-blue water, tall faint arches of glass and soft light shafts in the far background, clean white sand floor. |
| `tank_6` | 용궁 수조 | The Dragon King's sea realm: deep indigo-blue magical water, faint silhouettes of Korean palace roofs and glowing coral far in the background, shimmering pearl sand floor, drifting golden light. |
