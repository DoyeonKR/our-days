# 히어로 원화 v3

이미지 생성 도구로 종마다 독립된 투명 원화를 제작한다. 작은 도트의 색만 바꾸거나 저해상도 그림을 단순 확대하지 않는다.

- 기존 원화 28종: `public/heroes/v2/`.
- 신규 원화: `public/heroes/v3/<form>.webp`, 768×768. 움직임을 위한 투명 여백과 공통 발밑 기준선 포함.
- 작은 슬롯: `public/heroes/v3/<form>-icon.webp`, 192×192. 64px 슬롯의 3배 밀도 화면까지 지원하며, 도감과 배지에서 큰 원화를 받지 않는다.
- 등록과 파일 선택: `src/lib/heroassets.ts`. 알려지지 않은 폼이나 실제 다운로드 실패 시에만 기존 도트로 대체해 오프라인에서도 펫이 사라지지 않게 한다.
- 이미지 URL에는 배포 버전을 붙여, 새 배포 후 이전 원화나 낮은 해상도의 아이콘 캐시가 남지 않게 한다.

## 제작 프롬프트와 원본

`scripts/hero-art-prompts.mjs`의 `style`에 각 `jobs[].subject`를 붙인 것이 계보 90폼과 옛 계보 14폼의 기본 제작 프롬프트다. 성장기·중간형·최종형의 체형과 실루엣을 각각 지정한다. 검수와 재제작까지 반영한 최종 선정본의 실제 전체 프롬프트는 `hero-v3-sources.json`의 각 `prompt`에 기록한다.

`scripts/hero-upper-prompts.mjs`의 `guardians` 7종에는 같은 파일의 `guardianStyle`을 사용한다. `jobs` 12종에는 위의 공통 `style`을 사용한다. 전부 내장 이미지 생성 도구와 실제 투명 배경을 사용했으며, 별도 API나 CLI 생성은 사용하지 않았다.

생성 원본 위치는 `hero-v3-sources.json`에 기록한다. 원본은 생성 이미지 보관 폴더에 그대로 두고, 앱이 참조하는 최종 WebP 파일은 저장소 안에 둔다. 검수 후 수정한 그림은 `kind: "edit"` 항목의 `prompt`가 최종 편집 프롬프트이고, `reference`가 입력 원본이다. 어린 누에·꿀방울·굼벵이는 성체의 날개나 뿔이 생기지 않도록 별도로 다듬었다. 망아지·은갈기말·유니콘은 상위 천마와 구분되도록 날개를 제거했다.

원본 경로는 Codex 보관 폴더 기준 상대 경로이며 원본 SHA-256도 함께 기록한다. `scripts/finalize-hero-sources.mjs`는 제작 중 기록을 최종 프롬프트 목록으로 합치고, `scripts/rebuild-hero-derivatives.mjs`는 그 원본에서 앱용 자산을 다시 만든다.

## 가공과 검수

`node scripts/prepare-hero-asset.mjs <source.png> <form>`은 투명도를 보존해 여백과 크기별 WebP를 만든다. 저해상도 원본은 거부한다.

`node scripts/review-hero-art.mts`는 `.qa/hero-art/`에 이전 도트 / 실제 112px 표시 / 확대 디테일 비교본을 만든다. TypeScript 직접 실행을 지원하는 Node.js가 필요하다.

`heroassets.test.ts`는 모든 PET_FORMS의 원화 등록, 실제 파일, 투명도, 해상도, 파일 크기와 작은 슬롯의 경량 이미지 선택을 검증한다.

## 화면 연결

메인 피드·펫 무대·게임 카드·도감·박물관은 공통 HeroV2/PetIcon 경로를 사용한다. 별도 렌더링 경로였던 꾸미기 섬의 SVG 이미지와 사냥 캔버스도 같은 자산 레지스트리를 사용한다. 사냥의 무기/피격 연출과 기존 터치 모션은 유지한다. 별도 눈 레이어나 눈 깜빡임 합성은 추가하지 않는다.
