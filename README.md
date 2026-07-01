# 우리의 하루 · 커플 D-day

둘이 함께한 날을 세고, 다가오는 기념일(100일 단위 · 주년 · 생일 등)을 알려주는 모바일 웹 앱.

- **스택**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4
- **PWA**: 홈 화면 설치 + 오프라인 앱 셸 (`public/manifest.webmanifest`, `public/sw.js`)
- **저장**: MVP는 브라우저 `localStorage` (서버 불필요) → 무료 정적 배포로 바로 동작
- **호스팅**: Vercel 무료 티어 (GitHub push 시 자동 배포)

## 기능 (MVP)

- 사귄 날 기준 **함께한 일수**(한국식 — 당일이 1일째) 카운트
- **100일 단위 + 주년** 기념일 자동 생성 + D-day 표시
- **커스텀 기념일**(생일 등) 추가, 매년 반복 옵션
- 다가오는 기념일 목록 (D-day 순 정렬)
- 브라우저 알림 (D-DAY 당일) — 실 푸시 알림은 phase 2

## 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드 (타입/린트 검사 포함)
```

핵심 날짜 로직은 `src/lib/dday.ts` 에 순수 함수로 분리 (UI/스토리지와 독립).

## 배포 (Vercel, 무료)

1. 이 레포를 GitHub에 push
2. [vercel.com](https://vercel.com) → GitHub 로그인 → **Add New Project** → 이 레포 선택
3. 프레임워크 자동 감지(Next.js) → **Deploy**
4. push 할 때마다 자동 재배포

## 로드맵 (phase 2 — 커플 공유)

지금은 한 기기(브라우저) 안에서만 동작한다. 두 사람이 같은 데이터를 공유하려면:

- **Supabase** (무료) 도입 — 인증 + Postgres + 실시간
- **초대 코드로 커플 페어링**: 한 명이 커플을 만들고 코드 발급 → 상대가 코드로 합류
- 기념일/사진/다이어리를 커플 단위로 공유
- **실 푸시 알림**: web-push + 서비스워커 `push` 이벤트 (VAPID 키)

`.env.local.example` 에 Supabase 연결용 자리표시자를 넣어 뒀다.
