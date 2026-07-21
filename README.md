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
| 공유 캘린더 | 월 달력에 카테고리 색 점 + 선택일 아젠다(오늘/선택 구분), 작성자색(내/상대), 기념일/일정 종류, 날짜 탭 추가·삭제 |
| 커플 버킷리스트 | 함께할 일 목록 + 완료 체크 + 진행률 게이지 + 카테고리 + 추천 시드 (실시간) |
| 공유 사진첩 | WebP+썸네일 고속 로딩, 서명URL 캐시, 대표사진(별 버튼/더블탭 → 확인) 홈 상단·배경 |
| 일기장 | 배경·기분·사진·해시태그·스티커 꾸민 일기 + 검색·필터(작성자/기분/태그) + 월별 타임라인 + '작년 오늘' 회상 + 이번 달 기분 인사이트 |
| 일기 상호작용 | 상대 일기에 이모지 반응 + 한 줄 댓글(실시간). 비밀일기(나만 보기 — RLS로 작성자만 조회) |
| 미래 편지 | 서로에게/미래의 우리에게 편지 → 지정한 날짜에 열림(봉인 전엔 수신자에게 안 보임, RLS 시간게이트) |
| 무드 체크인 | 오늘 기분 이모지+한줄, 상대와 실시간 공유 |
| 오늘의 질문 | 매일 질문, 내가 답해야 상대 답 공개(RLS 강제) + 지난 질문 보관함 |
| **게임 아케이드** | 커플 1:1 비동기 미니게임 5종(반응속도·기억력·연타·숫자순서·타이밍). **하루 1판 = 3라운드 평균**, 승패로 포인트/전적. 최고기록 → **전체 공개 순위판 TOP 5**(커플 닉네임 + 30자 한마디). §14 |
| **부루마블(보드게임)** | 실시간 1:1 부루마블 세계여행(도시 매입·별장/빌딩/호텔/랜드마크·통행료·관광세·축제·황금열쇠·무인도·N바퀴). 비동기(상대 오프라인이면 푸시로 이어서). 게임 포인트로 **말 스킨 상점**(일반/레어/에픽/레전드 등급). §14 |
| **테트리스** | 풀 룰 엔진(7-bag·SRS 월킥·홀드·고스트·B2B·콤보·T-스핀·퍼펙트 클리어). **점수 대결**(하루 1판·3라운드 2분 울트라 평균, 같은 시드=같은 블록, 순위판 반영) + **실시간 공격전**(무제한, 줄 클리어 공격/상쇄·상대 미니보드·탑아웃 승패 전적). §14 |
| 서로 얼마나 알까 | 1회성 커플 퀴즈(내 답+상대 예측, RLS 스포방지) |
| PWA | 홈 화면 설치, 오프라인 앱 셸 |
| 진단 | 설정에 푸시 진단/로그(debug_logs) |

### 디자인 · 품질

- 디자인 시스템: 인라인 SVG 아이콘 셋(`src/lib/icons.ts` — UI 크롬 이모지 전면 제거),
  라이트/다크(시스템 자동, `prefers-color-scheme`), 로즈틴트 그림자·라운드·모션 토큰,
  세그먼트 컨트롤·로딩 스켈레톤·공용 확인 모달(`ConfirmHost`), 눌리는 촉감(`.tap`).
- 품질 게이트: 순수 로직 유닛 테스트(`node --test`, 현재 143) + CI 게이트(`deploy-pages.yml`
  의 `test` job — 타입체크+테스트 통과해야 build/deploy). `keepalive.yml`로 Supabase 무료
  1주 미사용 pause 방지.
- 전체 데이터 모델·RLS는 `supabase/schema.sql`이 단일 소스(신규: couple_bucket,
  entry_reactions/comments, letters, deco_entries.visibility, couple_photos.thumb_path, debug_logs).

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
| `game_challenges` / `game_attempts` | 게임 아케이드 챌린지/점수. reveal-gate(내가 도전해야 상대 점수 열림, `game_i_played`) + 승패 확정은 `resolve_challenge` RPC 만. 점수 플로시빌리티 트리거 |
| `game_daily` / `game_ranks` | 하루 1판 카운트(KST) / 전체 공개 순위판. 갱신은 `record_play` RPC(일일 캡·최고기록·rank·**표시명=커플 닉네임**). 순위판 SELECT 는 전체 로그인 사용자 공개 |
| `game_profile` | 부루마블 말 스킨(token/owned)·포인트 지출(points_spent). 커플 신뢰 모델(클라 계산) |
| `board_games` | 부루마블 진행 상태(`state` jsonb + version 낙관적 락). 룰은 클라, 서버는 차례 소유·버전만 강제 |
| `couple_island` | 우리 섬(메인 게임) 상태(커플당 1행 · `state` jsonb + version 낙관적 락). 차례 없이 둘 다 자유, `island_action` 이 버전만 강제 |

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
src/app/          page.tsx(게이트·하단탭·홈/캘린더/일기장/사진첩/게임) · layout · globals.css
src/components/   AuthGate · CoupleSync · Calendar · DecoBook(일기장) · PhotoAlbum · MoodCheckin
                  DailyQuestion · QuizGame · Letters · BucketList · TodayLog · AccountSection · Diagnostics
                  GameArcade(아케이드) · BoardGame(부루마블) · games/{Reaction,Memory,Tap,Order,Timing}
src/lib/          dday(+test) · supabase · couple(데이터 계층) · auth · push · debug · image · base
                  questions · game(+test, 아케이드 순수로직) · boardgame(+test, 부루마블 룰엔진)
supabase/         schema.sql(단일 소스) · functions/{send-poke-push,daily-reminders}
tests             src/**/*.test.ts (node --test, 143) — CI 게이트에서 강제
.github/workflows/deploy-pages.yml · keepalive.yml
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

**게임 era (2026-07-06~07)**: 게임 탭 → 아케이드 5종(비동기 챌린지) → 전체 공개 순위판 → 하루 1판
=3라운드 평균 → TOP 5 노출/등록 → 닉네임 커플닉 고정('익명' 클로버링 버그 fix) → 기억력 시작 프리뷰 →
결과화면 '다시' 제거 → **부루마블 실시간 보드게임**(룰엔진+실시간+말 스킨 상점) → 말 상점 가격상향·등급 →
주사위/보드 그래픽 SVG 고급화. (상세 §14)

## 13. 로드맵

- [ ] 오늘의 질문 알림(아침 푸시)
- [ ] 커플 공통 배경(현재 대표사진은 공유, 확장)
- [ ] 일기장 자유 배치(드래그) 데코
- [x] ~~쿡찌르기 이모지 반응~~ · ~~게임 탭(아케이드 + 부루마블)~~ · ~~전체 공개 순위판~~

## 14. 게임 (아케이드 + 부루마블) 상세

세션 간 이어쓰기용 상세 노트. 순수 로직 = `src/lib/game.ts`·`src/lib/boardgame.ts`(회귀 테스트 동반),
서버 계약 = `supabase/schema.sql`의 RPC(`create_challenge`·`resolve_challenge`·`record_play`).

### 14.1 아케이드 (커플 1:1 비동기 미니게임)

- **5종**: 반응속도(낮은 ms 승)·기억력(높은 점수, 시작에 카드 위치 3초 공개 프리뷰)·연타(높을수록)·
  숫자순서(낮을수록)·타이밍바(목표거리 낮을수록). 방향 = `GAME_DIR`(higher: memory/tap).
  ⚠ **클라 `game.ts` `decideWinner`/`GAME_DIR` ↔ 서버 `resolve_challenge`/`record_play` 방향이 반드시
  동일**(한쪽 바꾸면 둘 다).
- **비동기 챌린지**: A 점수 잠금(`create_challenge`) → 상대 push → B 같은 seed 판 도전 → 양쪽 attempt
  있으면 `resolve_challenge`(서버) 승패 확정. reveal-gate: 내가 도전해야 상대 점수 열림(RLS
  `game_i_played`). 전적/포인트는 winner 컬럼 집계(별도 테이블 X, 승 +10/무 +5).
- **하루 1판 = 3라운드 평균**: 게임별 하루 1판(KST 00시), 1판 = `ROUNDS_PER_MATCH`(3) 라운드, 매치
  점수 = 평균(`averageScore`). `roundSeeds(matchSeed)`로 두 사람이 같은 3라운드 재현(공정). 결과화면
  라운드 재시도('다시') 없음. 상수 `DAILY_MATCHES` = 서버 `record_play` 일일 캡과 일치.
- **순위판 TOP 5**: `record_play` RPC 가 일일 캡 + 최고기록(방향 인지) + 전체 rank 산정, rank ≤
  `LEADERBOARD_TOP_N`(5)일 때만 축하 팝업(닉네임+30자 한마디 등록). 순위판 = 상위 5명 전체 공개.
  ⚠ **표시명 = 커플 닉네임(`couple_members.nickname`)을 서버(record_play)가 확정** — 클라 로컬 애칭
  (LS.me)으로 덮어쓰면 미설정 시 '익명'으로 커플 닉네임을 클로버링함(2026-07-07 버그 fix). `updateMyRank`
  는 **한마디만** 수정(display_name 클라 절대 미변경).
- **anti-cheat**: 전역 순위판이라 `game_score_plausible`로 불가능 점수(0ms/음수/초고속) 거부("비정상
  점수"). `best_score`는 record_play RPC 만(컬럼 권한), 이름/한마디만 직접 PATCH(길이 CHECK 24/40).
  커플 사적 대결은 신뢰 모델(정적 export라 클라 점수 측정 자체는 못 막음 — 막을 수 있는 winner/순위만 고정).
- ⚠ **submitMatch 순서**: 커플 대결 쓰기(create/attempt+resolve) **먼저**, 비가역 `recordPlay`(일일 캡
  소모) **마지막**. 먼저 부르면 중간 실패 시 '대결 미생성인데 하루 소진'(새 대결)/attempt 미저장으로 상대
  무한 대기 데드락(응답). (`GameArcade.order.test.ts` lock)

### 14.2 부루마블 (실시간 보드게임)

- 룰 엔진 `src/lib/boardgame.ts`(순수, `boardgame.test.ts` 회귀). 28칸 세계여행 링, 도시 매입/별장·빌딩·
  호텔·랜드마크(4단계) 건설/통행료(독점 시 땅 ×2·건물 ×1.5)/관광세(순자산 10%, 200~500)/축제(도착 시
  둘 다 +150)/황금열쇠/무인도(도착 시 갇힘, 더블·벌금 탈출)/우주여행/사회복지기금. 출발 월급 300에 바퀴가
  늘수록 가속(2바퀴 400·3바퀴 500). 상대 파산 즉시 승, 또는 N바퀴 완주 시 자산 많은 쪽.
- 실시간 `board_games`(state jsonb + version 낙관적 락). **커플 신뢰 모델**: 상태 계산은 클라, 서버는
  차례 소유(turn_user)·버전만 강제(비-차례자 쓰기/유실 방지). 상대 오프라인이면 내 차례에 두고 push로
  이어감(동접 불필요). ⚠ 인게임 보드는 상대 연결돼야 렌더("상대가 아직 없어요").
- **말 스킨 상점**: 게임 포인트(대결 승 +10)로 잠금 해제. `game_profile`(token/owned/points_spent). 등급
  일반/레어(하늘)/에픽(보라)/레전드(금) 18종, 60~2200P. **무료 기본말 🚗🐰(cost 0)는 owned 기본값과
  일치 필수**. 상점은 클라 계산(서버 검증 없음 — 사적 게임). `BoardGame.shop.test.ts` lock.
- 그래픽은 **자작 SVG/CSS**(주사위 SVG·입체 타일·프리미엄 판·광택 말) — **외부 이미지 안 씀**(저작권 +
  오프라인 PWA 링크깨짐/CORS).

### 14.3 테트리스 (점수 대결 + 실시간 공격전)

- 룰 엔진 `src/lib/tetris.ts`(순수·시드 결정론, `tetris.test.ts` 21케이스). 7-bag/SRS 월킥/홀드/
  고스트/락 딜레이(리셋 상한)/B2B ×1.5/콤보/퍼펙트 클리어/T-스핀(3코너 full·mini). 공격 테이블:
  2줄=1·3줄=2·테트리스=4·TSD=4·B2B+1·콤보 보너스·PC+6, **상쇄(캔슬)** 후 잔여만 유입(락 시,
  배치당 같은 구멍, 1회 8줄 캡).
- 플레이필드 `games/TetrisPlayfield.tsx`: 캔버스(DPR)+터치 제스처(드래그 이동/탭 회전/플릭
  하드드롭)+버튼(DAS)+키보드. DOM 은 100ms 스로틀 스냅샷만 재렌더.
- **점수 대결** = 기존 아케이드 인프라 재사용: GAMES 에 `tetris`(2분 울트라, higher 승) 추가 →
  하루 1판·3라운드 평균·챌린지·순위판 자동. 서버 game 키 CHECK 3곳/`game_score_plausible`
  (0~400000)/`resolve_challenge`/`record_play` 에 tetris 반영.
- **실시간 공격전** `TetrisVersus.tsx`: Realtime broadcast 채널(`joinTetrisChannel`) — 로비
  프레즌스 → **동일 시드 3초 동기 시작**(시작 레이스는 (t0,uid) 최소값 수렴) → attack/snap
  (600ms 미니보드) → 탑아웃 승패(동시 종료 점수 비교) → `tetris_results`(match_id=`seed:t0`
  **PK 멱등** — 양쪽이 각자 기록해도 1행, 커플 신뢰 모델) → 재대결. 이탈 8초 유예 몰수승.
  **무제한**(일일 캡 미소모 — `GameArcade.tetris.test.ts` lock).
- 진입: 아케이드 **부루마블 카드 바로 아래** 테트리스 카드(입장+룰북 버튼) → 모드 선택 시트.

### 14.5 우리 섬 (메인 게임 — 지속형 공유 세계)

- 게임 탭 **최상단 히어로**. 커플이 함께 키우는 하나의 섬(정원+펫+꾸미기). 룰 엔진
  `src/lib/island.ts`(순수·단일 TUNING·결정적 RNG·**지연 tick** = 액션마다 경과시간 1회 감쇠/성장,
  `island.test.ts` 24케이스). 상태 `couple_island`(커플당 1행 · `state` jsonb + version 낙관적 락,
  **차례 없음** — 둘 다 자유, `island_action` 이 버전만 강제). 데이터레이어 couple.ts.
- **펫 진화(핵심)**: 알🥚→아기🐣→(햇살🐥/포근🐤/그늘🐦‍⬛)→(여우🦊/고양이🐱/곰🐻/판다🐼/부엉이🦉/늑대🐺)
  →최종 12형(천상여우🌟/별빛여우✨…). 진입 레벨 {5,15,30,50} 게이트 + **케어품질(CQ)·유대·방치**로
  분기. 레벨=누적 케어XP 앵커 구간선형. 최종형은 박물관 은퇴 후 새 알(컬렉션 반복).
- **펫 케어**: 5스탯(포만/행복/기력/청결/건강) 지연감쇠 + 질병/회복, 6액션(밥/놀기/씻기/안기/재우기/약)
  쿨다운, **함께 놀기**(pending — 상대가 확인해야 완성, 유대+).
- **정원**: 작물 8종·계절(제철 페널티)·품질 **★1~5**(스킬+물+비료+제철 롤)·농사 스킬·물 가속·밭 확장.
  **공방** 가공 6종(창고 재료 소모→시간 완성, 별 상속), 스프링클러/온실 도구.
- **꾸미기**: 데코 22종·테마 세트 5(완성 퍽)·섬 평점(브론즈~로열)·도감. **유대 레벨**(coop/선물/함께출석/
  D-day), **함께 액션**, **D-day 마일스톤**(100일마다). 일일 퀘스트 3(결정적)·출석 스트릭·업적.
- 미니게임(아케이드/부루마블/테트리스) **승리 시 하트코인 지급**(`awardIslandCoins`, 있을 때만·조용히·
  stale 1회 재시도) → 섬이 앱 전체 보상 레이어. 그래픽 **이모지/CSS**(외부 이미지 없음).

### 14.4 개발/검증 유의

- **배포 flake**: `deploy-pages.yml` deploy 단계가 간헐 "Deployment failed, try again later"(GitHub
  Pages 이슈, 코드 무관). 해법: `gh workflow run deploy-pages.yml --ref main` 새 dispatch. SHA 고착
  (deployment_failed/cancelled)이면 **빈 커밋으로 새 SHA** 만들어 재배포.
- **프리뷰 검증 제약**: 헤드리스 프리뷰 탭은 rAF/setTimeout throttle(마이크로태스크는 진행) → 타이밍성
  게임 자동 구동·부루마블 인게임(상대 연결 필요)은 **동일 CSS 목업 DOM 주입**으로 시각 검증(주사위/축하
  팝업/보드 동일 기법). 자동 초고속 점수는 anti-cheat 로 거부됨.
- **회귀 lock 룰**: 버그 fix 마다 `src/**/*.test.ts`에 소스-스캔/로직 테스트 동반(방향 계약·submitMatch
  순서·닉네임 클로버링 금지·상점 가격·mood note truncate 금지 등).
