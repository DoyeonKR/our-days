# 우리의 하루 · 커플 D-day

둘이 함께한 날을 세고, 기념일을 챙기고, 서로 쿡 찔러 알림을 보내는 모바일 웹 앱.

라이브: https://our-days-topaz.vercel.app

---

## 기능

| 기능 | 설명 | 백엔드 필요 |
|---|---|---|
| 함께한 날 카운트 | 사귄 날 기준 한국식 '며칠째'(당일=1일) | 아니오 |
| 기념일 자동 생성 | 100일 단위 + 주년 자동 계산, D-day 표시 | 아니오 |
| 커스텀 기념일 | 생일 등 추가, 매년 반복 옵션 | 아니오 |
| 브라우저 알림 | D-DAY 당일 알림(앱 열었을 때) | 아니오 |
| PWA 설치 | 홈 화면 추가, 오프라인 앱 셸 | 아니오 |
| **커플 연동** | 초대코드로 두 사람을 하나로, D-day 공유 | 예 (Supabase) |
| **쿡찌르기** | 상대에게 실시간 알림 전송(콕/보고싶어/사랑해/자유메시지) | 예 (Supabase) |

백엔드(Supabase) 없이도 앱은 '로컬 모드'로 완전히 동작한다. 커플 연동·쿡찌르기만
Supabase 연결 시 활성화되며, 미연결 상태에서는 안내 문구만 표시된다.

## 스택

- **프론트**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4
- **백엔드**: Supabase (Postgres + Row Level Security + Realtime + 익명 인증)
- **저장**: 로컬 데이터는 브라우저 `localStorage`, 커플 공유 데이터는 Supabase
- **호스팅**: Vercel (무료 Hobby)

## 아키텍처 요약

- 개인 데이터(사귄 날, 커스텀 기념일)는 `localStorage` 에만 저장 → 서버 없이 동작.
- 커플 연동 시:
  - 익명 로그인(Supabase Anonymous)으로 기기별 지속 신원 부여(이메일 불필요).
  - `couples` 1행 = 커플 1쌍, 6자리 `invite_code` 로 상대가 합류.
  - `couple_members` 최대 2명, RLS 로 '내 커플'만 접근.
  - 쿡찌르기는 `pokes` insert → Supabase Realtime 로 상대 기기에 즉시 push.
  - 커플의 `start_date` 가 공유 D-day 의 단일 소스.
- 데이터 흐름/보안 상세는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드(타입/린트 검사 포함)
npm test        # 날짜 로직 회귀 테스트(node:test, zero-dep)
```

핵심 날짜 로직은 `src/lib/dday.ts` 에 순수 함수로 분리(UI/스토리지와 독립),
`src/lib/dday.test.ts` 가 2/29 윤년 등 엣지케이스를 lock.

## 커플 연동 켜기 (Supabase)

2분이면 된다. 전체 절차·원복은 **[docs/SETUP.md](docs/SETUP.md)** 참조. 요약:

1. supabase.com 에서 무료 프로젝트 생성.
2. Authentication > Providers > **Anonymous** 를 ON.
3. SQL Editor 에 [`supabase/schema.sql`](supabase/schema.sql) 전체 실행.
4. Project URL + anon key 를 환경변수로 등록(로컬 `.env.local`, 배포 Vercel).
5. 재시작/재배포하면 커플 연동·쿡찌르기 활성화.

## 배포 (Vercel)

- 이미 연결됨: `main` 대상 CLI 배포(`vercel --prod`) 사용 중.
- 자동 재배포(push → deploy)를 원하면 Vercel 계정에 GitHub 로그인 연결 후
  프로젝트를 Git 저장소에 연결(`vercel git connect`).
- 커플 연동을 배포에서 쓰려면 Vercel 프로젝트 환경변수에 위 두 값을 등록.

## 환경변수

| 변수 | 용도 | 없을 때 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 로컬 모드(연동 비활성) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public 키 | 로컬 모드(연동 비활성) |

`anon` 키는 공개(public) 키로 클라이언트 노출이 정상이다. 데이터 보호는 RLS 가 담당한다.
서버 전용 `service_role` 키는 절대 클라이언트/레포에 넣지 않는다.

## 프로젝트 구조

```
src/
  app/
    page.tsx        # 메인 화면(온보딩·대시보드·기념일·설정)
    layout.tsx      # 메타/뷰포트/PWA
    globals.css     # 로즈 테마
  components/
    CoupleSync.tsx  # 커플 연동 + 쿡찌르기 UI(페어링/실시간)
  lib/
    dday.ts         # 날짜 로직(순수 함수)
    dday.test.ts    # 회귀 테스트
    supabase.ts     # Supabase 클라이언트(미설정 시 null)
    couple.ts       # 커플/쿡찌르기 데이터 계층
supabase/
  schema.sql        # 테이블 + RLS + 페어링 RPC + realtime
public/
  manifest.webmanifest, sw.js, icon*.svg, *.png   # PWA
docs/
  SETUP.md          # Supabase 세팅 지침서(원복 포함)
  ARCHITECTURE.md   # 데이터 모델·보안·실시간 흐름
```

## 보안 참고

- 익명 인증 + RLS 로 '내 커플' 데이터만 접근 가능.
- 초대코드는 6자리(헷갈리는 0/O/1/I 제외)로 상대에게 직접 전달하는 준비된 비밀값.
- 쿡찌르기 메시지 등 민감 정보는 넣지 않는 것을 권장(개인 프로젝트 수준의 보호).

## 로드맵

- [ ] 사진/공유 다이어리(Supabase Storage)
- [ ] 진짜 예약 푸시 알림(web-push + VAPID, 백그라운드 수신)
- [ ] 오늘의 질문(둘 다 답하면 공개)
- [ ] 쿡찌르기 이모지 리액션/스티커
