# 우리 섬 픽셀 마을 디자인 QA

**비교 조건**

- source visual truth path: `C:\Users\kdy78\.codex\generated_images\01a05cf2-b96c-7473-aa5f-1c0e02c6499c\exec-adfd9a2d-6135-42e2-856f-9609143158b0.png`
- implementation screenshot path: `C:\Users\kdy78\our-days\.qa\island-final\implementation-mobile.png`
- combined comparison path: `C:\Users\kdy78\our-days\.qa\island-final\comparison.png`
- viewport: 인앱 브라우저 1265×712, 앱 소유 영역 430×712 CSS px
- source pixels: 853×1834. 상단 853×1413 영역을 430×712로 정규화
- implementation pixels: 430×712, device scale factor 1
- state: 로그인 사용자, 게임 → 우리 섬 → 펫, 가을, 픽셀 모드

**전체 화면 비교 증거**

- 같은 430×712 크기로 정규화한 두 화면을 하나의 비교 이미지에 배치해 확인했다.
- 시안의 고해상도 가을 마을, 어두운 목재 HUD, 금색 테두리, 초록색 선택 탭을 실제 화면에 재현했다.
- 구현은 기존 게임 기능을 보존하기 위해 전역 자원 HUD와 5개 탭을 장면 위에 유지했다. 시안보다 장면 시작 위치가 낮지만, 모바일 앱의 즉시 탐색성과 상태 가시성을 위한 의도적 제품 제약으로 수용했다.

**세부 비교 증거**

- 히어로 영역을 확대 확인했다. 1195×1316 원본 배경을 슬롯에 맞춰 cover 처리해 늘어짐 없이 선명하며, 기존 `PetPixel`은 배경과 같은 픽셀 렌더링으로 유지된다.
- 정원·공방·꾸미기 탭을 각각 실제 클릭해 선택 상태, 내용 전환, 스크롤 영역을 확인했다.
- 접근성 트리에서 닫기 버튼, `우리 섬 메뉴`, 각 탭의 pressed 상태, 주요 행동 버튼 이름이 유지됨을 확인했다.

**필수 충실도 표면**

- Fonts and typography: 기존 앱의 픽셀 표시 서체와 본문 폴백을 유지했다. 작은 HUD 글자도 10px 이상, 제목·수치 위계와 줄바꿈이 정상이다.
- Spacing and layout rhythm: 데스크톱에서도 앱 소유 영역을 최대 430px로 제한했다. 헤더·탭·장면 테두리와 간격이 일관되고 지속 GNB를 가리지 않는다.
- Colors and visual tokens: 목재 갈색, 짙은 청록 패널, 양피지, 선택 초록, 금색 선을 시안에서 가져와 상태 토큰에 일관되게 적용했다.
- Image quality and asset fidelity: 생성한 1195×1316 고해상도 픽셀 배경을 실제 이미지 자산으로 사용했다. CSS 도형이나 임시 이미지로 대체하지 않았다.
- Copy and content: 우리 섬, 자원, 계절, 펫 상태, 다음 진화, 돌봄, 정원·공방·꾸미기 기능 문구를 그대로 보존했다.

**Findings**

- P0/P1/P2 잔여 이슈 없음.
- P3: 시안은 장면 아래 탭이지만 구현은 기능 접근성을 위해 장면 위 고정 순서를 유지한다. 추후 몰입형 전용 홈 화면을 별도로 만들 때 재검토할 수 있다.

**Comparison history**

1. 첫 비교에서 데스크톱 브라우저에서 우리 섬이 전체 폭으로 확장되어 모바일 앱 프레임과 불일치하는 P1을 발견했다.
2. 루트 셸에 `max-width: 430px`, 중앙 정렬, 전용 그림자를 적용하고 장면 비율을 39:34로 보정했다.
3. 재캡처에서 430px 앱 프레임, 고해상도 장면, 탭 및 하단 GNB가 정상 범위에 유지됨을 확인했다.

**Implementation Checklist**

- [x] 고해상도 가을 픽셀 마을 배경 적용
- [x] 모바일 앱 폭 고정과 데스크톱 중앙 정렬
- [x] 펫 탭 반응 및 다음 진화 정보 보존
- [x] 정원·공방·꾸미기 탭 전환 확인
- [x] 회귀 테스트 추가

final result: passed

### 정원 기능·작물 아트 후속 검증 (2026-09-04)

- 정원 상단에 재배 중·수확 가능·물 필요 수치를 묶은 현황판을 추가했다.
- `모두 물주기`는 작물이 심긴 마른 밭만 처리하며, 이미 촉촉한 밭·빈 밭·스프링클러 사용 중에는 비활성화된다.
- 무등산수박·천도복숭아·불로초의 수확기 아이콘에 해상도 독립적인 광채와 반짝임을 추가해 일반 작물과 희귀도 차이가 즉시 보인다.
- 383px 모바일 앱 폭에서 현황판 4열이 잘림 없이 표시되고, 24칸 밭의 진행도와 수확 표식도 유지됨을 확인했다.
- 브라우저 console error 0건.

final result: passed

### 히어로 간헐 잘림 회귀 검증 (2026-09-04)

- 원인: 눈 깜빡임을 위해 같은 PNG를 머리·눈·몸으로 분할하고 눈 레이어 높이를 축소하던 방식에서 투명한 수평 틈이 발생했다.
- 수정: 히어로 원본 PNG를 단일 `hero-art` 레이어로 유지하고, 눈꺼풀만 독립 오버레이로 애니메이션한다.
- 구조 검증: 렌더링 이미지 1개, `clip-path: none`, `overflow: visible`, 히어로와 아트의 경계 상자가 동일함을 확인했다.
- 메인 피드 실화면에서 고양이 히어로의 귀부터 발끝까지 온전하게 표시되며 브라우저 console error는 0건이다.
- 28종 자산 존재 및 메인·게임·우리 섬 공통 렌더러 연결 회귀 테스트를 통과했다.

final result: passed

### 표정·종별 모션 후속 검증

- `HeroV2`를 머리·눈·몸 3개 이미지 레이어로 분리해 4.7초 주기의 실제 눈 깜빡임을 추가했다.
- 새/부엉이는 빠른 날갯짓 리듬, 고양잇과는 귀 씰룩임, 여우/늑대는 활발한 좌우 반동, 기린은 느린 고개 흔들기, 둥근 동물은 부드러운 호흡으로 분기했다.
- 게임 허브의 작은 초상에서도 `hero-v2-blink`가 활성화되고, 수면 중에는 불필요한 깜빡임과 몸동작이 정지함을 computed style로 확인했다.
- 레이어 clip 경계는 24%/52%(기린 17%/43%)이며 기본 자세에서 이음새나 사각 배경이 보이지 않음을 실제 화면으로 확인했다.

final result: passed

### 터치 모션 후속 검증

- 사각형으로 보이던 브라우저 tap highlight와 각진 충격파를 제거했다.
- 우리 섬에서는 배경 전체가 아니라 `HeroV2`만 `PetTapFx` 안에 들어가도록 구조를 분리했다.
- 기본 호흡은 상하 이동·스쿼시·미세 좌우 기울기로 부드럽게 만들고, 연타는 spring → bounce/wiggle → dash/ricochet → blast/meteor/hyper-hop으로 커진다.
- 메인에서 5회, 우리 섬에서 3회 연속 터치해 히어로만 변형되고 배경 및 투명 사각 영역은 움직이지 않음을 확인했다.
- 브라우저 console warning/error 0건.

final result: passed

---

## 28종 히어로 공통 렌더러 후속 QA

- source visual truth path: `C:\Users\kdy78\our-days\design\hero-redesign-reference.png` (1660×960, 28종)
- implementation screenshots: `C:\Users\kdy78\our-days\.qa\hero-v2\home.png`, `C:\Users\kdy78\our-days\.qa\hero-v2\game-hub.png`
- viewport: 인앱 브라우저 1265×712, 앱 소유 영역 약 430×712 CSS px, density 1
- state: 로그인 사용자, 메인 피드 히어로 및 게임 허브 우리 섬 카드

**Findings and iteration**

1. P1 — 기존 구현은 참조 시안의 28종 이미지를 쓰지 않고 기존 48px 스프라이트에 작은 외곽 장식만 추가했다. 메인과 게임에서 기존 디자인처럼 보이는 직접 원인이었다.
2. 참조 시트에서 28종을 독립 232×232 투명 PNG로 추출하고 `HeroV2` 공통 렌더러를 추가했다.
3. `PetIcon`, `PetYard`, `IslandGame`을 공통 렌더러로 연결해 메인·게임 허브·우리 섬·도감/진화 UI에 동시에 적용했다.
4. 재캡처에서 메인 아기 히어로의 알껍질 실루엣과 게임 카드 초상이 참조 디자인으로 교체된 것을 확인했다. 브라우저 console warning/error는 0건이다.

**필수 충실도 표면**

- Fonts/typography: 기존 UI 위계와 이름·단계 텍스트를 유지했다.
- Spacing/layout: 232px 정사각 자산을 contain 배치해 작은 초상과 큰 무대 모두 잘림이 없다.
- Colors/tokens: 참조의 종별 팔레트와 광채를 이미지 자체에서 보존했다.
- Image quality: 28개 모두 고해상도 투명 PNG이며 이웃 캐릭터 침범 제거와 테두리 확인을 완료했다.
- Copy/content: 이름, 진화형, 레벨, 상태 문구는 변경하지 않았다.

- P0/P1/P2 잔여 이슈 없음.
- focused region comparison: 메인 히어로 무대와 게임 허브 54px 초상을 각각 확대 확인했으며 중요한 세부가 충분히 읽혀 별도 추가 크롭은 불필요했다.

final result: passed
