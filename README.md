# 우리의 하루 · 커플 D-day

둘이 함께한 날을 세고, 기념일을 챙기고, 서로 쿡 찔러 알림을 보내고, 사진·캘린더를 공유하는 모바일 웹 앱.

**라이브: https://doyeonkr.github.io/our-days/**

> 이 문서는 프로젝트의 마스터 레퍼런스(기능·구조·운영·배포). 세부는 [docs/](docs/) 참고.
> ⚠ 비밀값(액세스 토큰·DB 비번·VAPID 비공개키·service_role)은 공개 레포라 여기 없음 — "어디에 있는지"만 기록.

---

## 1. 기능

| 기능 | 설명 | 백엔드 |
|---|---|---|
| 함께한 날 카운트 | 사귄 날 기준 한국식 '며칠째'(당일=1일) | 로컬 |
| 기념일 자동 생성 | 100일 단위 + 주년 자동 계산, D-day 표시 | 로컬 |
| 커스텀 기념일 | 생일 등 추가, 매년 반복 | 로컬/커플 공유 |
| **커플 연동** | 6자리 초대코드로 두 사람 페어링 | Supabase |
| **쿡찌르기** | 프리셋 4종+자유 메시지, 실시간 배너, 말풍선(내/상대) 기록 | Supabase Realtime |
| **백그라운드 푸시** | 앱 꺼놔도 쿡찌르기 알림 도착 | Web Push + Edge Function |
| **공유 캘린더** | 월 달력에 기념일·마일스톤 미리보기, 날짜 눌러 일정 추가 | 커플 공유 |
| **공유 사진첩** | 사진 업로드·공유, 대표사진을 홈 상단/배경으로 | Supabase Storage |
| **기기 간 연동** | 이메일 계정으로 어느 브라우저/기기에서도 로그인 | Supabase Auth |
| PWA | 홈 화면 설치, 오프라인 앱 셸 | 로컬 |

백엔드(Supabase) 없이도 앱은 '로컬 모드'로 동작(혼자, localStorage). 커플 기능만 Supabase 연결 시 활성화.

## 2. 스택 · 호스팅

- **프론트**: Next.js 16 (App Router, **정적 export**) · React 19 · TypeScript · Tailwind v4
- **백엔드**: Supabase (Postgres + RLS + Realtime + 익명/이메일 인증 + Storage + Edge Functions)
- **호스팅**: **GitHub Pages** (무료). `main` push → GitHub Actions 빌드·배포
- **하위경로**: 프로젝트 사이트라 `/our-days/` → `NEXT_PUBLIC_BASE_PATH=/our-days` 빌드 주입 (`src/lib/base.ts`)

## 3. 링크 · 운영 레퍼런스

| 항목 | 값 |
|---|---|
| 라이브 | https://doyeonkr.github.io/our-days/ |
| GitHub | https://github.com/DoyeonKR/our-days (public) |
| Supabase 프로젝트 ref | `tqegatiuembcvphxmujl` |
| Supabase URL | `https://tqegatiuembcvphxmujl.supabase.co` (공개) |
| Supabase 대시보드 | https://supabase.com/dashboard/project/tqegatiuembcvphxmujl |
| anon(publishable) 키 | `sb_publishable_JxofXpqHGa6lmxzOnvHGnw_yUG4RtP2` (공개 설계 — 클라 노출 정상) |
| VAPID 공개키 | `BCtL979r_uhxfLMWItNDLwALWuJsl1YYDO6AtdXDEaWB3S8K-FpW_ozE3doQh1uPEnU-w--nLhi5wwloYhGXF58` (공개) |

## 4. 아키텍처 (요약 — 상세 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))

**인증 2단계**
- 기본은 **익명 로그인**(이메일 없이 기기별 uid). → 브라우저 바꾸면 신원이 달라짐.
- **이메일+비번으로 '계정 저장'** 하면 익명 uid 그대로 영구 전환 → 다른 기기에서 그 이메일로 로그인하면 같은 uid → 커플이 따라옴. (`src/lib/auth.ts`, 설정 안 계정 카드)

**데이터 (Postgres, 전부 RLS)**
| 테이블 | 용도 |
|---|---|
| `couples` | 커플 1쌍(invite_code, start_date). start_date 만 컬럼 update 허용 |
| `couple_members` | 구성원(최대 2). RPC `create_couple`/`join_couple`(SECURITY DEFINER)로만 가입 |
| `pokes` | 쿡찌르기(realtime) |
| `couple_events` | 공유 기념일(realtime) |
| `couple_photos` | 공유 사진 메타(realtime). 실제 파일은 Storage |
| `push_subscriptions` | 웹푸시 구독(본인 기기만) |

- 핵심: `is_couple_member(uuid)` SECURITY DEFINER 함수로 '내 커플'만 접근(RLS 재귀 방지).
- **Storage**: 비공개 버킷 `couple-photos`, 경로 `{couple_id}/파일` → 그 커플 멤버만(정책 `couple_photos_obj_all`). 표시는 서명 URL.
- **Edge Function** `send-poke-push`: 쿡찌르기 시 호출 → service_role 로 상대 구독 조회 → web-push 전송. VAPID 비공개키는 함수 시크릿.
- 스키마 전체: [`supabase/schema.sql`](supabase/schema.sql) (재실행 가능, 상단 drop 후 재생성 — 운영데이터 주의).

## 5. Supabase 설정 상태 (이미 적용됨)

| 항목 | 상태 |
|---|---|
| Authentication > Anonymous | **ON** |
| Authentication > Email + **확인메일 없이**(autoconfirm) | **ON** (테스트 편의, 이메일 미검증 허용) |
| 스키마(`schema.sql`) | 적용됨 |
| Storage 버킷 `couple-photos` (비공개) | 생성됨 |
| Realtime publication (pokes/events/photos) | 등록됨 |
| Edge Function `send-poke-push` | 배포됨 (시크릿 VAPID_PUBLIC/PRIVATE/SUBJECT) |

## 6. 비밀값 정책 (레포에 없음)

| 시크릿 | 어디에 |
|---|---|
| Supabase Access Token (`sbp_...`) | 개인 비밀번호 관리자 (Management API/CLI 용) |
| DB 비밀번호 | 개인 비밀번호 관리자 (직접 psql 접속 시만) |
| VAPID 비공개키 | Supabase Edge Function 시크릿 (`supabase secrets`) |
| service_role 키 | Supabase 대시보드 (서버 전용, 절대 클라/레포 금지) |

빌드 주입용 공개 env는 **GitHub Actions Secrets**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## 7. 배포 · 운영

**자동 배포**: `main` 에 push → `.github/workflows/deploy-pages.yml` 가 정적 export 빌드 후 Pages 배포.

```bash
git push origin main        # → Actions 가 빌드·배포 (약 1분)
gh run watch                # 진행 확인
```

**백엔드 변경**(스키마/함수/설정)은 레포 push 로 안 됨 — Supabase 에 직접:
- 스키마: 대시보드 SQL Editor 에 `supabase/schema.sql` 실행, 또는 Management API `POST /v1/projects/{ref}/database/query`.
- Edge Function 재배포: `SUPABASE_ACCESS_TOKEN=<토큰> supabase functions deploy send-poke-push --project-ref tqegatiuembcvphxmujl --use-api`.
- 함수 시크릿: `supabase secrets set VAPID_PRIVATE=... --project-ref tqegatiuembcvphxmujl`.
- 인증/설정: Management API `PATCH /v1/projects/{ref}/config/auth`.

**env/시크릿 변경**: `gh secret set NEXT_PUBLIC_... --repo DoyeonKR/our-days --body "..."` 후 재push.

## 8. 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 정적 export (타입/린트 검사)  → out/
npm test        # 날짜 로직 회귀 테스트 (node:test, zero-dep)
```

`.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`VAPID_PUBLIC_KEY` 넣으면 로컬에서도 커플 기능 동작(예시 `.env.local.example`). 없으면 로컬 모드.

## 9. 프로젝트 구조

```
src/
  app/          page.tsx(메인·하단탭·홈/캘린더/사진첩) · layout.tsx · globals.css
  components/   CoupleSync · Calendar · PhotoAlbum · AccountSection
  lib/          dday(순수 날짜 로직·테스트) · supabase · couple(데이터 계층)
                auth(이메일 로그인) · push(웹푸시) · base(basePath)
supabase/
  schema.sql                       테이블·RLS·RPC·realtime·storage
  functions/send-poke-push/        Edge Function(web-push)
docs/           SETUP.md(세팅·원복) · ARCHITECTURE.md(데이터/보안/흐름)
.github/workflows/deploy-pages.yml GitHub Pages 자동배포
```

## 10. 알아둘 점 / 주의

- **아이폰 백그라운드 푸시**: iOS 정책상 **홈 화면에 추가한 PWA**에서만 수신(iOS 16.4+). 안드/PC 브라우저는 설치 없이 OK.
- **기기 간 연동**: 각자 **자기 이메일**로 '계정 저장'해야 여러 기기에서 로그인 가능(커플=2계정). 상대와 같은 이메일 금지.
- **이메일 autoconfirm ON**: 확인메일 없이 가입돼 이메일 미검증 상태 허용(개인 프로젝트 편의). 필요 시 대시보드에서 확인메일 켤 수 있음.
- **대표 사진 선택은 기기별**(localStorage). 앨범 자체는 커플 공유.
- **표기 규칙**: UI/문서 예시 이름은 중립값 `유진`, 실명 금지(민감정보).
- 사진은 비공개 버킷 + 커플 폴더 RLS 로 보호(다른 커플 접근 차단 검증됨). 개인 사진은 레포가 아니라 Storage 에만 저장.

## 11. 개발 히스토리 (2026-07-01 세션)

| # | 커밋 요지 |
|---|---|
| 1 | 커플 D-day MVP (함께한 날·기념일·PWA) |
| 2 | 멀티에이전트 리뷰 반영 — 정확성/PWA 버그 10건 + 2/29 회귀 테스트 |
| 3 | 커플 연동(초대코드) + 쿡찌르기(실시간) + 문서 |
| 4 | Vercel(팀=유료 벽) → **GitHub Pages 무료 배포** 이전(정적 export+basePath+Actions) |
| 5 | 쿡찌르기 백그라운드 푸시(Web Push + Edge Function) |
| 6 | 온보딩 내 애칭만, 상대 애칭은 연결 시 자동 |
| 7 | 기념일 커플 공유 + 세션 유지(자동 재연결) |
| 8 | 쿡찌르기 말풍선/더보기, 안드 푸시 오류 표면화 |
| 9 | 하단 탭 + 공유 캘린더 + 공유 사진첩 + 대표사진 배경/상단 |
| 10 | 이메일 계정으로 **기기 간 연동 유지** |
| 11 | 캘린더 날짜 눌러 일정 추가 + 셀 제목 미리보기 |

## 12. 로드맵

- [x] 커플 연동 · 쿡찌르기 · 백그라운드 푸시 · 공유 기념일/캘린더/사진첩 · 기기 간 로그인
- [ ] 오늘의 질문(둘 다 답하면 공개)
- [ ] 쿡찌르기 이모지 리액션/스티커
- [ ] 사진 다중 대표(슬라이드) / 커플 공통 배경(현재는 기기별)
- [ ] D-day 위젯 이미지 공유(카톡 등)
