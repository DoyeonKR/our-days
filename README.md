# 우리의 하루 · 커플 D-day

둘이 함께한 날을 세고, 기념일·캘린더·사진·일기를 공유하고, 서로 쿡 찔러 알림을 보내는 모바일 웹 앱.

**라이브: https://doyeonkr.github.io/our-days/**

> 프로젝트 마스터 레퍼런스(기능·구조·운영·배포). 세부는 [docs/](docs/).
> ⚠ 비밀값(액세스 토큰·DB 비번·VAPID 비공개키·service_role)은 공개 레포라 여기 없음 — 위치만 기록.

---

## 1. 기능

| 기능 | 설명 |
|---|---|
| **로그인 필수** | 이메일+비번 계정. 로그인해야 앱 사용(첫 진입 시 로그인/회원가입 화면). 같은 이메일로 어느 기기든 연동 유지 |
| 함께한 날 카운트 | 사귄 날 기준 한국식 '며칠째'(당일=1일) |
| 주년 기념일 | 1·2·3주년… 자동. **홈에는 앞으로 3개월 이내만 노출**. (100일 등 일수 기념일은 자동 생성 안 함 — 필요 시 커스텀으로) |
| 커스텀 기념일 | 생일 등 추가, 매년 반복. 커플 공유 |
| 커플 연동 | 6자리 초대코드 페어링(최대 2명) |
| 쿡찌르기 | 프리셋+자유 메시지, 실시간 배너 + **백그라운드 푸시**(앱 꺼져도), 말풍선 기록(내/상대) |
| 기념일 예약 푸시 | 주년/커스텀을 D-7/3/1/당일에 자동 푸시(pg_cron 매일) |
| 공유 캘린더 | 월 달력에 기념일 제목 미리보기, 날짜 눌러 일정 추가 |
| 공유 사진첩 | 업로드(자동 축소·압축)·삭제, 대표사진을 홈 상단·배경으로(커플 공유) |
| 일기장(데코) | 날짜·위치·기분·사진·본문·해시태그·배경·스티커로 꾸민 일기 페이지, 실시간 공유 |
| 무드 체크인 | 오늘 기분 이모지+한줄, 상대와 실시간 공유 |
| 오늘의 질문 | 매일 질문, 내가 답해야 상대 답 공개(RLS 강제) + 지난 질문 보관함 |
| PWA | 홈 화면 설치, 오프라인 앱 셸 |
| 진단 | 설정에 🩺 푸시 진단/로그(debug_logs) |

## 2. 스택 · 호스팅

- 프론트: Next.js 16(App Router, **정적 export**) · React 19 · TS · Tailwind v4
- 백엔드: Supabase 무료 — Postgres + RLS + Realtime + **Auth(익명+이메일)** + Storage + Edge Functions + **pg_cron/pg_net**
- 호스팅: **GitHub Pages**(무료). `main` push → GitHub Actions 정적 빌드·배포
- 하위경로 `/our-days/` → 빌드 시 `NEXT_PUBLIC_BASE_PATH=/our-days` 주입(`src/lib/base.ts`)
- 서비스워커: 문서는 network-first(+no-store)로 항상 최신, `_next/static`은 cache-first (재배포 stale 방지)

## 3. 링크 · 운영 레퍼런스

| 항목 | 값 |
|---|---|
| 라이브 | https://doyeonkr.github.io/our-days/ |
| GitHub | https://github.com/DoyeonKR/our-days (public) |
| Supabase ref | `tqegatiuembcvphxmujl` |
| Supabase URL | `https://tqegatiuembcvphxmujl.supabase.co` (공개) |
| 대시보드 | https://supabase.com/dashboard/project/tqegatiuembcvphxmujl |
| anon(publishable) 키 | `sb_publishable_JxofXpqHGa6lmxzOnvHGnw_yUG4RtP2` (공개 설계) |
| VAPID 공개키 | `BCtL979r_uhxfLMWItNDLwALWuJsl1YYDO6AtdXDEaWB3S8K-FpW_ozE3doQh1uPEnU-w--nLhi5wwloYhGXF58` |

## 4. 인증 (로그인 필수)

- **이메일+비번**. 첫 진입 시 `AuthGate`(로그인/회원가입). 로그인 전 기능 사용 불가.
- Supabase Email provider + **autoconfirm ON**(확인메일 없이 즉시). 이메일 미검증 허용(개인 프로젝트 편의).
- 회원가입: 익명 세션이 있으면 전환(데이터 유지), 없으면 새 계정. 로그인: `signInWithPassword`.
- 같은 이메일 로그인 = 같은 `auth.uid()` → 커플·데이터가 모든 기기에서 이어짐. (`src/lib/auth.ts`)
- 로그아웃: 설정 → 계정.

## 5. 데이터 모델 (Postgres, 전부 RLS · `is_couple_member` 기반)

| 테이블 | 용도 |
|---|---|
| `couples` | 커플(invite_code, start_date, **cover_path**). start_date/cover_path 컬럼만 update 허용 |
| `couple_members` | 구성원(최대 2). RPC `create_couple`/`join_couple`(SECURITY DEFINER)로만 가입 |
| `pokes` | 쿡찌르기(realtime) |
| `couple_events` | 공유 기념일(realtime) |
| `couple_photos` | 공유 사진 메타(realtime). 파일은 Storage `couple-photos`(비공개, 커플 폴더 RLS) |
| `deco_entries` | 일기장 페이지(realtime). 사진은 Storage 재사용 |
| `mood_checkins` | 무드(본인 1개 upsert, realtime) |
| `qa_answers` | 오늘의 질문 답변. **내가 답해야 상대 답 SELECT 허용**(`qa_i_answered` SECURITY DEFINER) |
| `push_subscriptions` | 웹푸시 구독(본인 기기) |
| `debug_logs` | 진단/에러 로그(본인) |

스키마 전체(재실행 가능): [`supabase/schema.sql`](supabase/schema.sql). 질문 풀은 번들 JSON(`src/lib/questions.ts`, 날짜 시드).

## 6. Edge Functions · 크론

- `send-poke-push`: 쿡찌르기 → 상대 구독으로 web-push. `{test:true}`면 내 구독으로 강제(force) 자가 테스트.
- `daily-reminders`: 주년/커스텀 기념일 D-7/3/1/당일 계산 → 양쪽 푸시. `x-cron-secret` 보호.
- **pg_cron** `'0 0 * * *'`(09시 KST) → pg_net 으로 daily-reminders 호출.
- VAPID 비공개키/`CRON_SECRET`은 함수 시크릿(`supabase secrets`).

## 6.5 네이티브 앱 (iOS/Android · Capacitor) — ⏸ 보류(나중에)

> **현재 운영 = 웹앱/PWA** (홈 화면 추가로 앱처럼 사용, 무료·계정 불필요). 스토어 출시는
> 비용(Google Play $25 1회 / Apple $99년)과 개발자 계정·서명·심사가 필요해 **나중으로 보류**.
> 아래 스캐폴드는 그대로 두고, 원할 때 [docs/APP-RELEASE.md](docs/APP-RELEASE.md) 로 이어가면 됨.

- 웹앱을 그대로 **Capacitor** 로 감싸 스토어 앱으로 배포(원코드 유지). DB/인증은 Supabase 그대로.
- 앱 전용 빌드는 basePath 없이: `npm run build:app && npx cap sync` → `ios/`·`android/` 프로젝트.
- appId `com.doyeonkr.ourdays`, 앱명 "우리의 하루". 아이콘/스플래시는 `assets/` 소스로 생성.
- **출시 절차(계정·서명·업로드·심사)** 는 [docs/APP-RELEASE.md](docs/APP-RELEASE.md),
  개인정보처리방침 초안 [docs/PRIVACY.md](docs/PRIVACY.md).
- 네이티브 백그라운드 푸시(FCM/APNs)는 무료로 가능(Firebase Spark, 카드 불필요) — DB 이전 없이
  푸시만 FCM. 상세는 APP-RELEASE.md §5.

## 7. 배포 · 운영

**프론트(자동)**: `main` push → Actions(`.github/workflows/deploy-pages.yml`) 정적 빌드·배포.
```bash
git push origin main         # → 약 1분 후 라이브
gh run watch                 # 진행 확인
```
캐시로 옛 화면이 보이면 앱 완전히 닫았다 다시 열기(SW가 no-store로 최신 문서 로드).

**백엔드(수동)** — Supabase 직접:
- 스키마: 대시보드 SQL Editor 에 `supabase/schema.sql`, 또는 Management API `POST /v1/projects/{ref}/database/query`.
- 함수: `SUPABASE_ACCESS_TOKEN=<토큰> supabase functions deploy <name> --project-ref tqegatiuembcvphxmujl --use-api` (daily-reminders 는 `--no-verify-jwt`).
- 시크릿: `supabase secrets set KEY=… --project-ref …`. 인증설정: Management API `PATCH /v1/projects/{ref}/config/auth`.

**빌드 env(공개, GitHub Actions Secrets)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## 8. 비밀값 (레포에 없음)

| 시크릿 | 위치 |
|---|---|
| Supabase Access Token(`sbp_…`) | 개인 비밀번호 관리자 |
| DB 비밀번호 | 개인 비밀번호 관리자(직접 psql 시만) |
| VAPID 비공개키 / CRON_SECRET | Supabase Edge Function 시크릿 |
| service_role 키 | 대시보드(서버 전용, 절대 클라/레포 금지) |

## 9. 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 정적 export(타입/린트) → out/
npm test        # 날짜 로직 회귀 테스트(node:test)
```
`.env.local`에 3개 `NEXT_PUBLIC_*` 넣으면 로컬에서 백엔드 기능 동작(없으면 로컬 모드).

## 10. 프로젝트 구조

```
src/app/          page.tsx(게이트·하단탭·홈/캘린더/일기장/사진첩) · layout · globals.css
src/components/   AuthGate · CoupleSync · Calendar · DecoBook(일기장) · PhotoAlbum
                  MoodCheckin · DailyQuestion · AccountSection · PushSettings · Diagnostics
src/lib/          dday(+test) · supabase · couple(데이터 계층) · auth · push · debug · image · base · questions
supabase/         schema.sql · functions/{send-poke-push,daily-reminders}
docs/             SETUP.md · ARCHITECTURE.md
.github/workflows/deploy-pages.yml
```

## 11. 알아둘 점 / 트러블슈팅

- **푸시는 기기마다** 설정→🔔에서 "이 기기에서 푸시 켜기" 한 번씩. 테스트는 켠 기기에서만 표시.
- **아이폰**: 홈 화면에 추가한 PWA 에서만 백그라운드 푸시(iOS 16.4+). 사파리 탭은 안 됨.
- **안드로이드 '차단됨'**: 브라우저 보안상 앱이 강제로 못 켬 → 사이트 설정에서 알림 '허용' 후 재시도. 삼성 배터리 절전이 백그라운드 푸시 막으면 '제한 없음'으로.
- **진단**: 설정 → 🩺 푸시 진단/로그 에서 지원/권한/구독/서버저장 상태 + 최근 로그 확인.
- 사진은 업로드 시 자동 축소(≤1600px). 기존 원본 사진은 다시 올리면 빨라짐.
- 옛 화면이 계속 보이면 앱 완전 종료 후 재실행(SW no-store로 최신화).

## 12. 개발 히스토리 (2026-07-01, 요약)

MVP → GitHub 연동 → 무료 배포(Vercel 팀 유료벽 → **GitHub Pages 이전**) → 커플 연동/쿡찌르기 →
백그라운드 푸시(Web Push+Edge Function) → 세션 유지 → 공유 기념일 → 하단탭+공유 캘린더+공유
사진첩+대표사진 → **이메일 기기간 연동** → 캘린더 일정추가 → 예약 푸시(cron)+무드+오늘의질문+
일기장 → 푸시 진단/에러로그 인프라 → 이미지 리사이즈 → **로그인 게이트** → 데코북→일기장 개명,
기념일 3개월 필터, iOS safe-area, 설정 정리(닫기 버튼·설정 항목 집중).

## 13. 로드맵

- [ ] 오늘의 질문 알림(아침 푸시)
- [ ] 쿡찌르기 이모지 반응
- [ ] 커플 공통 배경(현재 대표사진은 공유, 확장)
- [ ] 일기장 자유 배치(드래그) 데코
