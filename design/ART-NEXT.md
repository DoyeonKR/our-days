# 그림 세션 다음 일 — 주인 13마리 · 범고래 새끼 · 두족류 (2026-11-15)

> [사용자: "2순위는 모두 진행해"] — 코드로 할 수 있는 것(수면 위 하늘 · 범고래 새끼 비율)은 끝냈고, 새 그림 · 3D 모델이 필요한 것을 여기 모았다.
> 결과물이 올라오면 Claude 가 게임에 연결한다(`fishingworld.ts` 의 `BOSSES.art` · `aquaimages.ts` 의 `BOSS_IMAGE_KEYS` · `aqua3d/bosslook.ts` 의 `LOOKS` · `model-revisions.ts` 의 `BOSS_MODEL_REVISIONS`).

## 그림 세션(Codex)에 붙여 넣을 지시

```
design/ART-NEXT.md 를 처음부터 끝까지 진행해 줘. 게임 코드(src/ · supabase/ · package.json)는 건드리지 말고 커밋하지 마.
1부(주인 13마리)는 산호 여왕 · 검은 파도 때와 똑같은 길이다:
  ① 전용 그림 2D — built-in image_gen, 512×512 투명 WebP + 192px sm, 머리 오른쪽, 그림자 · 반사 · 글자 없음
     → public/aqua/fish/boss_<key>.webp · public/aqua/fish/sm/boss_<key>.webp
  ② 네 방향 그림(옆 · 앞 · 위 · 뒤 한 장) → design/aqua3d-review/boss-refs/boss_<key>-sheet.png
  ③ 3D 모델 — design/aqua3d-review/boss-*.mjs 파이프라인(네 방향 → 복셀 윤곽 → 마칭 큐브 → Taubin → meshoptimizer → 텍스처 투영)
     → public/aqua/models/boss/boss_<key>.glb
     계약: +X 머리 · Y 위 · 몸길이 2 · 뼈 10개 이름 그대로(spine_0 머리 → spine_5 꼬리, fin_L · fin_L_tip · fin_R · fin_R_tip)
           · 512px baseColor WebP 한 장 · 삼각형 5,000 안 · 압축 뒤 300KB 안
  ④ 검수 — 기존 종 모델과 위 · 앞 · 옆 · 비스듬히 나란히 → design/aqua3d-review/boss13-models-review.webp
     + boss13-models-validation.json(삼각형 · 바이트 · sha256 · 뼈 이름 · Khronos 오류 수)
2부 · 3부도 같은 검수 시트를 만든다. 어색한 key 는 한 줄씩 적어 줘.
```

## 1부 — 주인 13마리 전용 그림 · 3D 모델

공통 꼬리말(모든 그림 프롬프트 끝에 붙인다):
`Photorealistic natural-history illustration, exact side view, head RIGHT, whole animal in frame with 10% margin, crisp clean silhouette. Even flat studio lighting, no cast shadows, no specular highlights, no glare. Transparent background, no water, no bubbles, no props, no crown, no text, no watermark. Realistic anatomy, not cartoon, not a monster.`

네 방향 그림은 맨 앞을 `Photorealistic natural-history reference sheet of ONE … the same individual shown in four views on one plain light-grey background: left side view, front view, top view, back view. Identical colors and markings in all views.` 로 바꾼다.

| key | 주인 | 종(기존 그림) | 이 주인만의 모습 |
|---|---|---|---|
| `boss_dolsoe` | 돌쇠 | 풀레드 구피(`fullred_guppy`) | ONE unusually large, stocky old male full-red guppy (Poecilia reticulata), deep blood-red body and a huge tattered fan tail with a few nicks along the edge, slightly hunched thick body, stubborn heavy jaw, tiny scars near the gill |
| `boss_neuti` | 느티나무 잉어 | 잉어(`common_carp`) | ONE enormous ancient common carp (Cyprinus carpio), bronze-olive scales edged dark like old tree bark, a few moss-green algae patches on the back, thick barbels, calm heavy body, one scale near the dorsal fin missing |
| `boss_hongryeon` | 홍련 할멈 | 쇼와 비단잉어(`showa_koi`) | ONE very old giant showa koi, faded red and black pattern with ivory patches, slightly cloudy aged eye, long flowing fins frayed at the tips, a lotus-pink tint on the head |
| `boss_dammit` | 댐 밑의 쏘가리 | 쏘가리(`mandarin_fish`) | ONE large battle-scarred mandarin fish (Siniperca scherzeri), vivid leopard rosettes on golden-olive skin, spiny dorsal fin fully raised, big predatory jaw with a healed hook scar, intense eye |
| `boss_gwihyang` | 돌아온 은빛 | 연어(`salmon`) | ONE huge spawning-run chum salmon male (Oncorhynchus keta), bright silver flanks with faint purple-red spawning bars, slightly hooked kype jaw, worn fins from a long journey, powerful humped back |
| `boss_eunjasa` | 계곡의 은둔자 | 열목어(`lenok`) | ONE large shy lenok (Brachymystax lenok), coppery-gold body with small dark spots, reddish ring around the eye, clean cold-water look, slender powerful body |
| `boss_geurimja` | 밀림의 그림자 | 알툼 엔젤(`altum_angel`) | ONE very tall dark altum angelfish (Pterophyllum altum), smoky charcoal body with faint deep-brown vertical bars, extremely long trailing dorsal and anal fins, ghostly pale edge on the fins |
| `boss_eoreum` | 얼음 밑 산천어 | 산천어(`masu_salmon`) | ONE large landlocked masu salmon (Oncorhynchus masou), silver body with clear dark oval parr marks, faint frost-blue sheen along the back, cold clear eye |
| `boss_baetmeori` | 뱃머리 영감 | 줄전갱이(`striped_jack`) | ONE big old striped jack (Pseudocaranx dentex), wide yellow lateral stripe faded with age, thick deep body, a few old line scars on the flank, heavy blunt head |
| `boss_dodam` | 도담 가물치 | 가물치(`snakehead`) | ONE huge northern snakehead (Channa argus), dark mottled python-like blotches, wide flat head with a gaping mouth slightly open showing small teeth, long cylindrical body |
| `boss_munji` | 용궁 문지기 | 황금 용어(`golden_dragonfish`) | ONE majestic golden dragonfish (Asian arowana, Scleropages formosus) guardian of an undersea palace, large bright gold mirror scales edged in deep red, two chin barbels, long sweeping fins with faint jade-green rims — still a real fish shape, no horns, no wings |
| `boss_byeol` | 별을 삼킨 자 | 창세어(`genesis_fish`) | the same mythic species as public/aqua/fish/genesis_fish.webp but older and larger, deep navy body with tiny glowing star-like points scattered along the flank, faint violet nebula sheen on the fins (keep the original body shape) |
| `boss_simyeon` | 심연의 크라켄 | 크라켄(`kraken`) | the same creature as public/aqua/fish/kraken.webp but colossal and ancient, darker red-violet skin covered in pale sucker scars and barnacles, one torn arm tip, huge cold eye (keep the original anatomy) |

⚠ 크라켄(`boss_simyeon`)은 3부(두족류)와 같은 몸이라 3D 모델은 3부 계약(팔마다 뼈 사슬)으로 만든다.

## 2부 — 범고래 새끼 · 어린 개체 3D 모델

- 지금은 다 큰 범고래 모델(`public/aqua/models/fish/orca.glb`)을 몸통만 통통하게 늘려 쓴다(코드 임시 처리). 전용 모델이 오면 지운다.
- 그림은 `design/ART-GUIDE.md` 의 F 절 그대로(새끼: 흰 무늬가 연한 주황빛 · 몸이 짧고 머리 · 지느러미가 크다 / 어린 개체: 흰 무늬 깨끗 · 작은 등지느러미).
- 1부와 같은 네 방향 → 3D 길로 `public/aqua/models/fish/fry_orca.glb` · `juv_orca.glb` 를 덮어쓴다(같은 10뼈 계약 · 삼각형 3,000).
  2D 그림도 `public/aqua/fish/fry_orca.webp` · `juv_orca.webp`(+ sm)를 함께 덮어쓴다.

## 3부 — 두족류 12개 입체로 다시

- 지금 문어 · 오징어 · 대왕오징어 · 크라켄(각 새끼 · 어린 · 다 큰)은 옆 그림 한 장을 세운 판이라 위 · 앞에서 보면 납작하다.
- 계약은 `design/ART-GUIDE.md` 의 C 절(외투막 · 머리 · 팔마다 뼈 사슬 6개 `arm_<a>_<j>` · `mantle` 뼈). 팔은 한 평면에 펼치지 말고 입체로 아래 · 옆으로 늘어뜨린다(V3 때 판처럼 펼친 팔은 옆에서 막대로 보여 채택하지 않았다).
- 결과 → `public/aqua/models/ceph-v4/<key>.glb`(덮어쓰지 말고 새 폴더 — 게임 연결 · 팔 움직임 코드 손질은 Claude 가 한다).
