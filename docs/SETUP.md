# 커플 연동 세팅 지침서 (Supabase)

커플 연동·쿡찌르기를 켜는 절차. 소요 약 2분. 이 과정 없이도 앱은 로컬 모드로 동작한다.

## 사전 준비

| 항목 | 내용 |
|---|---|
| 계정 | supabase.com 무료 가입(GitHub 로그인 가능) |
| 비용 | Free 플랜으로 충분(2인 사용) |
| 결과물 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 두 값 |

## 절차

### 1. 프로젝트 생성

1. supabase.com 로그인 → New project.
2. Name/DB password 입력, Region 은 `Northeast Asia (Seoul)` 권장.
3. 생성까지 1~2분 대기.

### 2. 익명 로그인 활성화 (필수)

- Dashboard > Authentication > Sign In / Providers > **Anonymous** 를 Enable.
- 이 앱은 이메일 없이 익명 인증으로 기기별 신원을 만든다. 끄면 연동이 동작하지 않는다.

### 3. 스키마 실행

1. Dashboard > SQL Editor > New query.
2. 저장소의 `supabase/schema.sql` 전체를 붙여넣고 Run.
3. 오류 없이 `Success` 확인. (테이블 3개 + RPC 2개 + RLS + realtime 등록)

### 4. 키 확인

- Dashboard > Project Settings > Data API(또는 API).

| 대시보드 항목 | 환경변수 |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Project API keys > `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

- `service_role` 키는 사용하지 않는다(클라이언트/레포에 절대 넣지 말 것).

### 5. 환경변수 등록

로컬:

```bash
cp .env.local.example .env.local
# .env.local 에 두 값 입력 후
npm run dev
```

배포(Vercel): Project > Settings > Environment Variables 에 두 변수 추가 → Redeploy.
또는 CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod
```

### 6. 동작 확인

1. 앱 > 커플 연동 카드 > 커플 만들기 → 6자리 초대코드 표시.
2. 다른 기기/브라우저에서 코드로 합류.
3. 한쪽에서 쿡 찌르기 → 상대 화면에 즉시 배너 + (알림 허용 시) 브라우저 알림.

## 검증 체크리스트

| 확인 | 기대 |
|---|---|
| 커플 만들기 | 초대코드 6자리 발급, 카드가 '상대를 기다리는 중' |
| 코드 합류 | 두 기기 모두 'N/2명 · D-day 공유 중' |
| 쿡찌르기 | 상대 기기에 실시간 배너(구독 지연 1초 내) |
| D-day 공유 | 한쪽에서 사귄 날 변경 시 상대에도 반영(재진입 시) |
| 미설정 폴백 | 환경변수 제거 시 안내 문구 + 로컬 모드 정상 |

## 원복(rollback)

| 대상 | 방법 |
|---|---|
| 연동 비활성화 | 환경변수 두 개 삭제 후 재배포 → 로컬 모드로 복귀(개인 데이터 영향 없음) |
| 스키마 제거 | `supabase/schema.sql` 상단의 `drop table ... cascade` 3줄 + `drop function` 3줄만 SQL Editor 에서 실행 |
| 익명 로그인 끄기 | Authentication > Providers > Anonymous Disable(기존 세션은 만료까지 유지) |
| 데이터 초기화 | SQL: `truncate public.pokes, public.couple_members, public.couples cascade;` |

`schema.sql` 은 상단에서 기존 객체를 `drop ... cascade` 후 재생성하므로 재실행이 안전하다.
단 운영 중 재실행은 `couples/couple_members/pokes` 데이터를 삭제하므로 주의.

## 자주 막히는 지점

| 증상 | 원인/조치 |
|---|---|
| 커플 만들기 시 `로그인이 필요합니다` | 익명 로그인 미활성 → 2단계 확인 |
| `permission denied` / RLS 오류 | 스키마 미실행 또는 부분 실행 → `schema.sql` 전체 재실행 |
| 쿡찌르기 배너 안 뜸 | realtime 미등록 → `alter publication supabase_realtime add table public.pokes;` 확인, 두 기기 모두 같은 커플인지 확인 |
| 초대코드 못 찾음 | 대소문자 무관 처리되지만 공백/오타 확인, 코드 만료 아님(영구) |
| 배포에서만 안 됨 | Vercel 환경변수 미등록 또는 재배포 안 함 |
