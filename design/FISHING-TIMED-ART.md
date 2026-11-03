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

## 제작 상태 · 2026-11-03

- 위 3계열의 치어·어린 개체·성체 그림 9장, 512px 원본과 192px 썸네일, 스킨, GLB 9개를 제작했다.
- `FISH_IMAGE_KEYS`, `FISH_GLB`, 참조 프로필에 등록했다. 누락 프로필 예외를 검사하는 회귀 테스트를 추가했다.
- 실제 WebGL/PBR로 3각도 렌더를 저장했다. `aqua3d-review/timed-fish-models.webp`에서 원화·측면·사선을 대조한다.
- **외형은 사용자 검수 대기다.** 자동 합격이나 수치 평가는 하지 않았다. 특히 해파리 투명 질감과 구완 디테일은 원화보다 단순하다.
- `FAMILIES`, `BASE_CM`, `TIMED_FISH`, 낚시터 `pool`은 아직 변경하지 않았다. 승인되지 않은 새 모델이 수조에서 숨겨지는 일을 막기 위해 외형 승인 뒤 활성화한다.
- 활성화 시 은어는 동네 개울/새벽/보통, 메기는 연꽃 연못/비/고급, 보름달물해파리는 산호초 바다/밤/희귀로 연결한다. 기존 품종의 값 순서를 유지하고 낮은 등장 가중치를 사용한다.

검수 페이지: `aqua3d-review/index.html?set=timed`
