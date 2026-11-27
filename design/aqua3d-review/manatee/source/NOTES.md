# West Indian Manatee (Trichechus manatus) 3D Handoff Notes

## 1. 산출물 목록

- `reference.png` — 기준 이미지 (1920 × 1288 px, 순백색 배경, 정확한 옆모습, 머리 오른쪽)
- `manatee.glb` — 3D 메시 모델 (단일 메시, 닫힌 표면, 150,000 triangles, 2.86 MB)
- `render-side.png` — GLB 측면 렌더
- `render-top.png` — GLB 상단 렌더
- `render-front.png` — GLB 정면(머리 쪽) 렌더
- `render-bottom.png` — GLB 하단 렌더

---

## 2. 사용한 도구

- **실제 사진 베이스 검색**: `gsk image_search` (서인도매너티 `Trichechus manatus latirostris` 수중 실사 사진)
- **기준 이미지 생성 (Image-to-Image)**: `gsk image_generation` (`nano-banana-2-flash-lite`) + Pillow 후처리(머리 오른쪽 정렬 좌우 반전 및 Lanczos 1920×1288 업스케일)
- **3D 모델 생성 (Image-to-3D)**: `gsk threed_generation` (`tripo3d/h3.1`)
- **메시 정리 및 단순화**: Python (`trimesh`, `fast-simplification`) — UV 심 정점 용접(`merge_vertices`), 1,457,208 → 150,000 triangles 단순화, 단일 연결 덩어리 및 닫힌 표면(`watertight`) 검증
- **4방향 검수 렌더링**: Playwright + Three.js (`GLTFLoader`)

---

## 3. 생성 프롬프트

### 기준 이미지 (`reference.png`)
```text
Photorealistic adult West Indian manatee (Trichechus manatus), exact side view, head facing right,
floating horizontally underwater in a relaxed straight pose, plump fusiform body, no neck, small rounded head,
large drooping bristly upper-lip pad with short dense whiskers, two nostrils on top of the snout tip,
tiny dark eye, no external ears, two small paddle-shaped front flippers with three rounded fingernails,
large flat rounded spoon-shaped horizontal tail paddle, no dorsal fin, no hind limbs,
grey-brown wrinkled rough skin with faint scars and light algae patches,
plain pure white background, no shadow, no water surface, no text, no watermark, full body visible with margin,
high detail, studio lighting, 1536px
```

### 3D 모델 (`manatee.glb`)
- 입력 이미지: `reference.png`
- 캡션:
```text
Adult West Indian manatee (Trichechus manatus), realistic 3D model, straight horizontal swimming pose, plump fusiform body, rounded flat horizontal spoon-shaped tail paddle, two small front paddle flippers separated from body, drooping bristly upper-lip pad, no dorsal fin, no hind limbs
```

---

## 4. GLB 스펙 및 방향

- **머리 방향**: **`-Z` 가 머리, `+Y` 가 위** (`+Z` 가 꼬리)
- **메시 수**: 1개 (단일 덩어리, 연결 요소 1개)
- **삼각형 수**: `150,000` (정점 `75,002`, 요구 범위 3만~30만 충족)
- **닫힌 표면 (Watertight)**: `True` (구멍 없음, 떠 있는 조각 없음)
- **뼈 / 애니메이션**: 없음 (`Skins: 0`, `Animations: 0`)
- **바운딩 박스**:
  - X (폭): `-0.1543 ~ +0.1542` (길이 `0.3085`)
  - Y (높이): `-0.1804 ~ +0.1800` (길이 `0.3604`)
  - Z (몸길이): `-0.5000 ~ +0.5002` (길이 `1.0002`)

---

## 5. 검수 체크 결과

### 기준 이미지 (`reference.png`)
- [x] 정확한 옆모습, 머리가 오른쪽
- [x] 수평으로 곧게 편 자세, 단색 흰색 배경(그림자·물결·텍스트·워터마크 없음)
- [x] 해상도 1920×1288 (긴 변 1536px 이상), 몸 전체 여백 포함
- [x] 굵은 방추형 몸, 목 거의 없음, 아래로 처진 두툼한 주둥이 패드와 짧은 수염, 콧구멍, 작은 검은 눈, 귓바퀴 없음
- [x] 작은 노 모양 가슴지느러미 2개 및 끝부분 둥근 손톱
- [x] 크고 납작한 둥근 수평 주걱 꼬리, 등지느러미·뒷다리 없음
- [x] 회갈색 주름진 피부, 옅은 긁힌 자국 및 녹조 얼룩

### GLB 모델 (`manatee.glb` / 4방향 렌더)
- [x] 꼬리 주걱이 수평이고 위/아래에서 보면 둥근 주걱 모양 (`render-top.png`, `render-bottom.png`)
- [x] 가슴지느러미 두 개가 몸에 붙지 않고 밖으로 분리되어 보임 (`render-side.png`, `render-front.png`, `render-bottom.png`)
- [x] 주둥이가 아래로 꺾인 두툼한 패드 형태 (`render-side.png`, `render-front.png`)
- [x] 등지느러미 없음, 뒷다리 없음 (`render-side.png`, `render-top.png`)
- [x] 몸이 좌우로 휘지 않은 곧은 수평 자세 (`render-top.png`, `render-bottom.png`)
- [x] 떠 있는 조각 없음 (`components = 1`), 구멍 없음 (`watertight = True`)

---

## 6. 알려진 문제 / 후속 작업자 참고 사항

- **색상 방식 (Vertex Color)**: Tripo 원본 텍스처의 회갈색 피부·녹조·상처 색상을 15만 삼각형 모델의 각 정점(`COLOR_0`, 무광 PBR 머티리얼 `metallicFactor=0.0`, `roughnessFactor=0.88`)에 전사해 두었습니다. UV 심 없이 단일 닫힌 메시(`watertight=True`)를 유지하기 위한 구성이며, 게임용 리토폴로지·UV 전개·텍스처 베이킹은 후속 공정에서 진행해 주세요.
- **스케일**: Z축 기준 전체 길이 `1.0` 단위로 정규화되어 있으므로, 실제 성체 크기(약 3 m)에 맞춰 3배 스케일링 및 축 회전(`-Z` → 작업 엔진의 전방 축)이 필요합니다.
