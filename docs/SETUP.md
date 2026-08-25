# 커플 연동 세팅 지침서 (Supabase)

커플 연동·쿡찌르기를 켜는 절차. 소요 약 2분. 이 과정 없이도 앱은 로컬 모드로 동작한다.

> 표기 규칙: 이 문서와 앱의 모든 예시/플레이스홀더 이름은 중립 예시명 `유진` 을 쓴다.
> 실제 지인·파트너의 실명은 민감 정보이므로 코드/문서/스크린샷 어디에도 넣지 않는다.

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

### 2. 이메일 로그인 설정 (필수)

- Dashboard > Authentication > Sign In / Providers > **Email** 을 Enable.
- 개인 프로젝트에서 확인 메일 없이 즉시 가입시키려면 Confirm email을 끈다. 앱은 이메일+비밀번호로
  로그인하며, 같은 계정은 어느 기기에서나 같은 커플 데이터를 사용한다.

### 3. 스키마 실행

1. Dashboard > SQL Editor > New query.
2. **새로 만든 빈 프로젝트에서만** 저장소의 `supabase/schema.sql` 전체를 붙여넣고 Run.
3. 오류 없이 `Success` 확인. 기존 프로젝트를 업데이트할 때는 `schema.sql`이 아니라
   `supabase/migrations/`의 미적용 파일만 시간순으로 실행한다.

> `schema.sql`은 bootstrap 전용이다. 핵심 테이블이 하나라도 있으면 DROP 전에
> `BOOTSTRAP_ONLY` 오류로 중단되며, 가드를 제거해서 재실행하면 안 된다.

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

배포(GitHub Pages): 레포 Settings > Secrets and variables > Actions 에 두 값을 Secret 으로
추가 → main 에 push(또는 Actions 재실행)하면 자동 빌드·배포.
또는 CLI:

```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://<ref>.supabase.co"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "sb_publishable_..."
git commit --allow-empty -m "redeploy" && git push   # Actions 트리거
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
| 스키마 변경 원복 | 운영 백업을 복원하거나 해당 변경만 되돌리는 검토된 역마이그레이션을 실행 |
| 이메일 로그인 끄기 | Authentication > Providers > Email Disable(로그인이 전부 중단되므로 운영에서는 사용 금지) |
| 데이터 초기화 | 운영 프로젝트에서 실행하지 말고, 폐기 가능한 별도 개발 프로젝트를 다시 생성 |

`schema.sql`은 빈 프로젝트 초기화 전용이고 재실행 경로가 아니다. 운영 변경은 항상
`supabase/migrations/`에 데이터 보존형 SQL로 추가하고, 백업·대상 project ref·적용 결과를 확인한다.

## 자주 막히는 지점

| 증상 | 원인/조치 |
|---|---|
| 커플 만들기 시 `로그인이 필요합니다` | 이메일 세션 만료 또는 Email provider 설정 → 재로그인 후 2단계 확인 |
| `permission denied` / RLS 오류 | 누락된 migration과 실제 정책을 확인해 해당 migration만 적용. bootstrap 재실행 금지 |
| 쿡찌르기 배너 안 뜸 | realtime 미등록 → `alter publication supabase_realtime add table public.pokes;` 확인, 두 기기 모두 같은 커플인지 확인 |
| 초대코드 못 찾음 | 대소문자 무관 처리되지만 공백/오타 확인, 코드 만료 아님(영구) |
| 배포에서만 안 됨 | GitHub Actions Secret 미등록 또는 Pages 배포 미완료 |
