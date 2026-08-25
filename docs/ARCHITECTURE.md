# 아키텍처

최종 갱신: 2026-08-25

## 실행 구조

```
GitHub Pages (Next.js static export)
  └─ React 클라이언트
       ├─ localStorage: 초안·테마·캐시·연동 전 시작일
       ├─ Open-Meteo: 선택 도시 현재 날씨
       └─ Supabase
            ├─ Auth: 이메일·비밀번호·복구
            ├─ PostgreSQL + RLS: 공유 정본
            ├─ Realtime: 커플 데이터·활동함 갱신
            ├─ private Storage: 사진·일기 사진·로그 영상
            └─ Edge Functions: 푸시·알림·계정 삭제·미디어 점검
```

프론트는 서버 렌더링 런타임 없이 `output: export`로 빌드한다. 동적 데이터는 로그인 뒤 브라우저가
Supabase에 직접 요청하며, 모든 권한은 클라이언트 UI가 아니라 RLS/RPC에서 다시 강제한다.

## 정보구조

| 상위 탭 | 책임 |
|---|---|
| 홈 | 오늘 상태, 빠른 행동, 다가오는 일정 3개 |
| 기록 | 오늘 로그 / 일기 / 사진 |
| 계획 | 일정 / 버킷리스트 |
| 함께 | 연결·초대, 활동함, 장거리 카드, 무드, 질문, 추억 |
| 게임 | 섬과 아케이드 |

설정은 프로필 / 화면 / 알림 / 데이터 / 도움말로 나눈다. 홈은 요약과 진입점만 책임지고 전체 목록은
각 목적 화면에 둔다.

## 인증

- 이메일+비밀번호 로그인이 필수다. 이메일은 정규화하고 비밀번호 정책은 UI와 Auth 호출 전에 검증한다.
- 비밀번호 재설정은 GitHub Pages의 `/our-days/reset-password/`로 돌아오며 PKCE `code`와
  implicit hash 토큰을 모두 처리한다.
- 로그아웃·계정 전환 때 서명 URL 캐시 등 기기 내 민감 캐시를 제거한다.

## 데이터 위치

| 데이터 | 위치 | 정본 규칙 |
|---|---|---|
| 로그인 전 시작일 | localStorage | 서버 커플이 생기면 서버 값을 채택 |
| 초안·테마·서명 URL 캐시 | localStorage | 기기 한정, 언제든 초기화 가능 |
| 커플·구성원·도시·시간대 | `couples`, `couple_members` | 서버 정본 |
| 일정·버킷 | `couple_events`, `couple_bucket` | 공유 계획, 저장 뒤 행 read-back |
| 사진·일기·로그 | 메타 테이블 + private Storage | DB 경로가 미디어 참조 정본 |
| 기분·질문·쿡 | 각 기능 테이블 | RLS + Realtime |
| 활동함·읽음 상태 | `activity_events`, `activity_reads` | DB 트리거가 생성, 읽음 상태 영속 |
| 푸시·알림 설정 | `push_subscriptions`, `notify_prefs` | 사용자별 서버 정본 |

오프라인에서 새 서버 레코드를 성공으로 가장하지 않는다. 작성 폼은 기기 초안을 보존하고,
온라인 복귀 뒤 사용자가 저장을 다시 완료한다. 공통 상태 호스트가 오프라인·성공·실패를 접근 가능한
live region으로 알린다.

## 커플과 초대

- `create_couple`·`join_couple` RPC가 멤버 수와 동시 합류를 잠근다.
- 초대코드는 6자리이고 기본 7일 뒤 만료한다. 링크·QR은 같은 `?invite=` 값을 사용한다.
- `rotate_invite_code`는 기존 코드를 즉시 폐기하고 새 만료 시각을 만든다.
- 각 멤버는 자신의 애칭·시간대·도시만 수정할 수 있다.

## RLS·Realtime

- `is_couple_member(couple_id)`가 커플 범위 접근의 공통 판별 함수다.
- `couples`는 행 RLS에 더해 업데이트 가능 컬럼을 `start_date, cover_path, hung_paths`로 제한한다.
- 비공개 일기는 행·반응·댓글·Storage 다운로드 모두 작성자만 허용한다.
- `activity_events`는 주요 테이블의 insert/update 트리거가 만든다. 비공개 일기는 활동 이벤트를
  만들지 않는다. 클라이언트의 best-effort 이벤트 발행에 의존하지 않는다.
- Realtime은 표시 속도를 위한 것이며, 쓰기 성공 판정은 API 결과와 서버 재조회 행을 기준으로 한다.

## 일정과 알림

`couple_events`는 `none | monthly | yearly` 반복, 메모, 알림 오프셋을 가진다. 월말 반복은 해당
월의 마지막 날로 clamp한다. `daily-reminders`는 멤버 시간대, 일정별 오프셋, 알림 카테고리,
조용시간을 서버에서 확인하고 404/410 푸시 구독을 제거한다.

## 데이터 수명주기

- JSON 내보내기는 현재 로그인 사용자가 RLS로 조회 가능한 테이블을 수집한다.
- 미디어 ZIP은 DB가 참조하는 경로만 서명해 가져오며 250MB 상한이 있다.
- 계정 삭제는 Edge Function에서 JWT를 검증한 뒤 Storage → DB RPC → Auth 순서로 처리한다.
- 상대가 남은 경우 삭제 사용자의 개인 콘텐츠·식별자는 지우고 공유 계획은 상대에게 남긴다.
  혼자 남은 커플이면 커플 행 cascade로 공간 전체를 지운다.
- `media-gc`는 CRON_SECRET 보호, 기본 dry-run, 24시간 보호, 삭제 전 참조 재조회, 회당 200개 상한,
  삭제 후 부재 확인을 강제한다. 자동 스케줄은 두지 않는다.

## 스키마 운영

- 새 빈 프로젝트만 `supabase/schema.sql`을 한 번 실행한다.
- 기존 프로젝트는 `supabase/migrations/`의 미적용 파일만 순서대로 적용한다.
- `20260825010000_product_trust_and_ia.sql`은 현재 제품 신뢰 기능의 데이터 보존형 변경이며,
  동일 블록이 신규 bootstrap 끝에도 복사되어 있다. 회귀 테스트가 둘의 동기화를 잠근다.

## 배포 경계

운영 프론트는 `https://doyeonkr.github.io/our-days/` 한 곳이다. `main` push 뒤 GitHub Actions가
타입·테스트·정적 빌드를 통과해야 Pages에 배포한다. 별도 호스팅 도메인으로 배포하지 않는다.
