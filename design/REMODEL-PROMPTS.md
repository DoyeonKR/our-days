# 3D 다시 만들기 — 이미지 생성 프롬프트

> 이 파일은 `scripts/remodel-prompts.mjs` 가 만든다 — 고칠 땐 스크립트를 고치고 다시 돌린다(`node scripts/remodel-prompts.mjs mammal cephalopod`).
> 모두 **33개**: 해양 포유류 21 · 두족류 12. 한 key 마다 한 장(3/4 시점)과 네 방향 시트 두 가지 — 3D 생성기에는 시트를 쓸 수 있으면 시트를 넣는다.

## 그림 세션(Codex)에 붙여 넣을 지시

```
design/aqua3d-review/remodel-prompts.json 의 items 를 처음부터 끝까지 돌려 줘. 항목마다 built-in image_gen 으로
single 프롬프트 → out.single, sheet 프롬프트 → out.sheet 에 PNG 로 저장한다(1024px 이상, 시트는 가로로 넓게).
게임 코드(src/ · supabase/ · package.json)와 public/ 은 건드리지 말고 커밋하지 마.
다 그리면 카테고리별로 한 장에 모은 검수 시트 design/aqua3d-review/remodel-<카테고리>.webp 를 만들고,
어색한 key(지느러미 · 팔이 겹침, 그림자 · 반사가 들어감, 종이 틀림)를 한 줄씩 알려 줘.
```

## 해양 포유류

### `fry_spotted_seal` — 점박이물범 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Phoca largha: newborn pup with thick fluffy white lanugo coat, round body, large dark eyes, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Phoca largha: newborn pup with thick fluffy white lanugo coat, round body, large dark eyes, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_spotted_seal` — 점박이물범 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Phoca largha: yearling with fresh silver-grey spotted coat, slimmer than the adult, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Phoca largha: yearling with fresh silver-grey spotted coat, slimmer than the adult, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `spotted_seal` — 점박이물범

한 장:
```
Photorealistic natural-history reference of ONE adult Phoca largha: earless true seal, plump spindle body, silver-grey coat with dense dark spots, small fore-flippers, hind flippers paired backward like a tail, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Phoca largha: earless true seal, plump spindle body, silver-grey coat with dense dark spots, small fore-flippers, hind flippers paired backward like a tail, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_fur_seal` — 물개 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Callorhinus ursinus: newborn pup with jet-black natal fur, short muzzle, oversized flippers, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Callorhinus ursinus: newborn pup with jet-black natal fur, short muzzle, oversized flippers, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_fur_seal` — 물개 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Callorhinus ursinus: juvenile with grey-brown coat, slender body, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Callorhinus ursinus: juvenile with grey-brown coat, slender body, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fur_seal` — 물개

한 장:
```
Photorealistic natural-history reference of ONE adult Callorhinus ursinus: eared seal with small external ears, dense dark brown fur, long wing-like fore-flippers, hind flippers that can rotate forward, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Callorhinus ursinus: eared seal with small external ears, dense dark brown fur, long wing-like fore-flippers, hind flippers that can rotate forward, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_steller_sea_lion` — 큰바다사자 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Eumetopias jubatus: newborn pup with dark chocolate-brown fur, round head, big flippers, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Eumetopias jubatus: newborn pup with dark chocolate-brown fur, round head, big flippers, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_steller_sea_lion` — 큰바다사자 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Eumetopias jubatus: juvenile with lighter tan coat, no mane yet, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Eumetopias jubatus: juvenile with lighter tan coat, no mane yet, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `steller_sea_lion` — 큰바다사자

한 장:
```
Photorealistic natural-history reference of ONE adult Eumetopias jubatus: huge eared sea lion, tawny-blond to light brown coat, massive neck and shoulders with a slight mane, long fore-flippers, blunt muzzle, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Eumetopias jubatus: huge eared sea lion, tawny-blond to light brown coat, massive neck and shoulders with a slight mane, long fore-flippers, blunt muzzle, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_japanese_sea_lion` — 독도 강치 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Zalophus japonicus (extinct, museum-specimen accurate reconstruction): newborn pup with dark brown natal fur, round body, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Zalophus japonicus (extinct, museum-specimen accurate reconstruction): newborn pup with dark brown natal fur, round body, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_japanese_sea_lion` — 독도 강치 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Zalophus japonicus (extinct, museum-specimen accurate reconstruction): juvenile with grey-brown coat, low forehead, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Zalophus japonicus (extinct, museum-specimen accurate reconstruction): juvenile with grey-brown coat, low forehead, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `japanese_sea_lion` — 독도 강치

한 장:
```
Photorealistic natural-history reference of ONE adult Zalophus japonicus (extinct, museum-specimen accurate reconstruction): eared sea lion, dark grey-brown coat, sagittal crest giving a raised forehead in males, long fore-flippers, sleek body; strictly scientific reconstruction, no mystical styling, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Zalophus japonicus (extinct, museum-specimen accurate reconstruction): eared sea lion, dark grey-brown coat, sagittal crest giving a raised forehead in males, long fore-flippers, sleek body; strictly scientific reconstruction, no mystical styling, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_sea_otter` — 해달 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Enhydra lutris: newborn pup with very fluffy golden-brown buoyant fur, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Enhydra lutris: newborn pup with very fluffy golden-brown buoyant fur, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_sea_otter` — 해달 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Enhydra lutris: juvenile with brown fur and lighter head, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Enhydra lutris: juvenile with brown fur and lighter head, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `sea_otter` — 해달

한 장:
```
Photorealistic natural-history reference of ONE adult Enhydra lutris: heavy-bodied otter, dense dark brown fur with a pale grizzled head, short forelimbs with paws, broad webbed flipper-like hind feet, short flattened tail, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Enhydra lutris: heavy-bodied otter, dense dark brown fur with a pale grizzled head, short forelimbs with paws, broad webbed flipper-like hind feet, short flattened tail, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_otter` — 수달 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Lutra lutra: young cub with soft grey-brown fur, short muzzle, small body, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Lutra lutra: young cub with soft grey-brown fur, short muzzle, small body, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_otter` — 수달 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Lutra lutra: juvenile with sleek brown coat, slightly shorter tail than the adult, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Lutra lutra: juvenile with sleek brown coat, slightly shorter tail than the adult, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `otter` — 수달

한 장:
```
Photorealistic natural-history reference of ONE adult Lutra lutra: long slender freshwater otter, sleek brown fur with paler throat, short legs with webbed feet, long thick tapering tail, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Lutra lutra: long slender freshwater otter, sleek brown fur with paler throat, short legs with webbed feet, long thick tapering tail, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_orca` — 범고래 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn calf Orcinus orca: newborn calf, short body with relatively large head and flippers, white areas tinted pale orange-peach, small curved dorsal fin, faint fetal fold lines, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn calf Orcinus orca: newborn calf, short body with relatively large head and flippers, white areas tinted pale orange-peach, small curved dorsal fin, faint fetal fold lines, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_orca` — 범고래 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Orcinus orca: juvenile about one third grown, clean white patches, small upright dorsal fin, faint grey saddle, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Orcinus orca: juvenile about one third grown, clean white patches, small upright dorsal fin, faint grey saddle, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `orca` — 범고래

한 장:
```
Photorealistic natural-history reference of ONE adult Orcinus orca: powerful streamlined black body, white oval eye patch above and behind a tiny dark eye, white lower jaw and belly with sweeping flank marking, grey saddle patch behind a tall dorsal fin, broad paddle-shaped pectoral flippers, horizontal tail flukes, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Orcinus orca: powerful streamlined black body, white oval eye patch above and behind a tiny dark eye, white lower jaw and belly with sweeping flank marking, grey saddle patch behind a tall dorsal fin, broad paddle-shaped pectoral flippers, horizontal tail flukes, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. body straight and level as if gliding underwater, flippers or legs spread away from the body and clearly separated, tail or hind flippers extended straight back, mouth closed, natural small eyes, whiskers short and close to the muzzle. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

## 두족류

### `fry_octopus` — 문어 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Enteroctopus dofleini: tiny paralarva-like hatchling, translucent body with scattered orange chromatophores, short arms, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Enteroctopus dofleini: tiny paralarva-like hatchling, translucent body with scattered orange chromatophores, short arms, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_octopus` — 문어 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Enteroctopus dofleini: juvenile octopus, smaller mantle, arms proportionally shorter, mottled reddish skin, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Enteroctopus dofleini: juvenile octopus, smaller mantle, arms proportionally shorter, mottled reddish skin, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `octopus` — 문어

한 장:
```
Photorealistic natural-history reference of ONE adult Enteroctopus dofleini: large octopus, reddish-brown skin with fine papillae and wrinkles, rounded mantle, eight long arms with two rows of pale suckers, web between arm bases, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Enteroctopus dofleini: large octopus, reddish-brown skin with fine papillae and wrinkles, rounded mantle, eight long arms with two rows of pale suckers, web between arm bases, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_squid` — 살오징어 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Todarodes pacificus: tiny hatchling, mostly transparent with few chromatophores, short arms, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Todarodes pacificus: tiny hatchling, mostly transparent with few chromatophores, short arms, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_squid` — 살오징어 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Todarodes pacificus: juvenile with shorter mantle, fins smaller, pale reddish skin, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Todarodes pacificus: juvenile with shorter mantle, fins smaller, pale reddish skin, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `squid` — 살오징어

한 장:
```
Photorealistic natural-history reference of ONE adult Todarodes pacificus: slender torpedo-shaped mantle with a pair of triangular fins at the tip, reddish-brown translucent skin with chromatophores, eight arms and two longer tentacles with clubs, large eyes, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Todarodes pacificus: slender torpedo-shaped mantle with a pair of triangular fins at the tip, reddish-brown translucent skin with chromatophores, eight arms and two longer tentacles with clubs, large eyes, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_giant_squid` — 대왕오징어 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young Architeuthis dux: tiny hatchling, translucent body, small reddish spots, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young Architeuthis dux: tiny hatchling, translucent body, small reddish spots, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_giant_squid` — 대왕오징어 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile Architeuthis dux: juvenile with shorter tentacles, pale reddish mantle, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile Architeuthis dux: juvenile with shorter tentacles, pale reddish mantle, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `giant_squid` — 대왕오징어

한 장:
```
Photorealistic natural-history reference of ONE adult Architeuthis dux: enormous squid, long muscular reddish mantle with small rear fins, very large eyes, eight thick arms and two extremely long feeding tentacles with toothed sucker clubs, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult Architeuthis dux: enormous squid, long muscular reddish mantle with small rear fins, very large eyes, eight thick arms and two extremely long feeding tentacles with toothed sucker clubs, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `fry_kraken` — 크라켄 새끼

한 장:
```
Photorealistic natural-history reference of ONE newborn young mythical giant cephalopod, live-action creature VFX realism: small young kraken, same anatomy but smooth unscarred skin and shorter arms, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE newborn young mythical giant cephalopod, live-action creature VFX realism: small young kraken, same anatomy but smooth unscarred skin and shorter arms, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `juv_kraken` — 크라켄 어린 개체

한 장:
```
Photorealistic natural-history reference of ONE juvenile mythical giant cephalopod, live-action creature VFX realism: half-grown kraken, fewer scars, tentacles not yet full length, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE juvenile mythical giant cephalopod, live-action creature VFX realism: half-grown kraken, fewer scars, tentacles not yet full length, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```

### `kraken` — 크라켄

한 장:
```
Photorealistic natural-history reference of ONE adult mythical giant cephalopod, live-action creature VFX realism: colossal cephalopod combining a massive octopus-like head and mantle with long squid-like tentacles, deep red-violet scarred skin, huge suckers with hooks, ancient and menacing; realistic anatomy and skin like a film creature, never cartoon, full body, three-quarter front view from slightly above (about 30° elevation, 45° yaw). relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
네 방향:
```
Photorealistic natural-history reference sheet of ONE adult mythical giant cephalopod, live-action creature VFX realism: colossal cephalopod combining a massive octopus-like head and mantle with long squid-like tentacles, deep red-violet scarred skin, huge suckers with hooks, ancient and menacing; realistic anatomy and skin like a film creature, never cartoon, the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views, clear spacing between views. relaxed natural resting pose, all arms clearly separated and spread around the body without overlapping or tangling, arm tips gently curled, mantle and head fully visible, eyes on both sides of the head visible, siphon visible. Even flat studio lighting, no cast shadows, no specular highlights, no rim light, no glare. Plain light-grey background, no water, no bubbles, no ground, no props. Whole animal in frame with 10% margin on every side, crisp clean silhouette, sharp realistic skin, fur or scale texture, accurate species colors and markings. Not cartoon, not a character, no text, no labels, no watermark.
```
