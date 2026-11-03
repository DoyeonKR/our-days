# 때 손님 — 새 물고기 그림 · 3D 작업 목록

`lib/fishingworld.ts` 의 때 손님은 지금 **이미 그림과 3D 모델이 있는 품종**만 쓴다.
아래 셋은 새 물고기라서 그림과 모델이 먼저 필요하다. 다른 세션이 만든 뒤 이 순서로 켠다.

1. `scripts/aqua-art-prompts.mjs` 의 `YOUNG` · `FINALS` 에 추가하고 그림을 넣는다(`fry_<계열>` · `juv_<계열>` · 품종, `node scripts/aqua-art-sync.mjs <그림 폴더>`).
2. `public/aqua/models/fish/` 에 GLB 3개를 넣고 `lib/aqua3d/glb.ts` 의 `FISH_GLB` 와 참조 프로필에 올린다. ⚠ 프로필이 없으면 3D 수조가 멈춘다(`makeReferenceAnimal` 이 던진다).
3. `lib/aquarium.ts` 의 `FAMILIES` 에 값 순서대로 끼우고, `lib/fishingworld.ts` 의 `BASE_CM` · `TIMED_FISH` 에 한 줄씩, `lib/fishing.ts` 의 그 낚시터 `pool` 에 낮은 무게로 넣는다.

| 계열 key | 이름 | 등급 | 때 | 낚시터 | 최종 그림 프롬프트 |
|---|---|---|---|---|---|
| `catfish` | 메기 | 고급 | 비 오는 날 | 연꽃 연못 | Real adult Korean bullhead catfish (Silurus asotus), long flat dark-olive body, broad flat head, two pairs of long whiskers, small eyes, side view facing right, transparent background. |
| `sweetfish` | 은어 | 보통 | 새벽 | 동네 개울 | Real adult ayu sweetfish (Plecoglossus altivelis), slim silver body with a soft yellow patch behind the gill, olive back, side view facing right, transparent background. |
| `jellyfish` | 보름달물해파리 | 희귀 | 밤 | 산호초 바다 | Real moon jellyfish (Aurelia aurita), translucent milky bell with four pale horseshoe rings, fine short tentacles, soft inner glow, side view, transparent background. |

치어 · 어린 모습은 같은 종의 작은 개체로, 기존 물고기 프롬프트의 형식을 따른다.
