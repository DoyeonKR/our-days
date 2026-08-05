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
| 오늘의 질문 | 매일 질문, 내가 답해야 상대 답 공개(RLS 강제) + 지난 질문 보관함 |
| **게임 아케이드** | 커플 1:1 비동기 미니게임 5종(반응속도·기억력·연타·숫자순서·타이밍). **하루 1판 = 3라운드 평균**, 승패로 포인트/전적. 최고기록 → **전체 공개 순위판 TOP 5**(커플 닉네임 + 30자 한마디). §14 |
| **부루마블(보드게임)** | 실시간 1:1 부루마블 세계여행(도시 매입·별장/빌딩/호텔/랜드마크·통행료·관광세·축제·황금열쇠·무인도·N바퀴). 비동기(상대 오프라인이면 푸시로 이어서). 게임 포인트로 **말 스킨 상점**(일반/레어/에픽/레전드 등급). §14 |
| **테트리스** | 풀 룰 엔진(7-bag·SRS 월킥·홀드·고스트·B2B·콤보·T-스핀·퍼펙트 클리어). **점수 대결**(하루 1판·3라운드 2분 울트라 평균, 같은 시드=같은 블록, 순위판 반영) + **실시간 공격전**(무제한, 줄 클리어 공격/상쇄·상대 미니보드·탑아웃 승패 전적). §14 |
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
src/components/   AuthGate · CoupleSync · Calendar · DecoBook(일기장) · PhotoAlbum
                  DailyQuestion · BucketList · TodayLog · AccountSection · Diagnostics
                  GameArcade(아케이드) · BoardGame(부루마블) · games/{Reaction,Memory,Tap,Order,Timing}
src/lib/          dday(+test) · supabase · couple(데이터 계층) · auth · push · debug · image · base
                  questions · game(+test, 아케이드 순수로직) · boardgame(+test, 부루마블 룰엔진)
supabase/         schema.sql(단일 소스) · functions/{send-poke-push,daily-reminders}
tests             src/**/*.test.ts (node --test, 490) — CI 게이트에서 강제
.github/workflows/deploy-pages.yml · keepalive.yml
```

## 10.5 홈 월드 (히어로 씬)

`src/components/HomeWorld.tsx` + 순수 파생 `lib/scenetime.ts`·`lib/occasion.ts`.
히어로에 남는 것은 **하늘 · 풍경 · 사진줄 · 펫** 넷뿐이다.

**월드 내비 소품은 제거했다 (2026-08-04).** 우편함(쿡)·표지판(캘린더)·나룻배(섬)·벤치(일기)는
하단 탭과 **같은 곳으로 가는 두 번째 문**이었다. 한 번은 상태 배지(안 본 쿡·섬 할 일·새 일기)를
달아 쓸모를 만들어 보려 했지만 사용자 판단은 여전히 군더더기였다 → 전부 뺐다.
함께 걷어낸 것: `lib/pokeglobal.ts`, `lib/seen.ts`, petglobal 의 todo 필드
(아무도 안 읽는 스토어에 계속 발행하는 게 죽은 코드 중 나쁜 쪽이다).
`islandTodos`(island.ts)는 소비처 없이 남겨 뒀다 — 섬 화면에 '지금 할 일'을 붙일 때 쓰라고.
⚠ 되살릴 땐 **히트테스트와 말풍선 폭 계산을 함께** 되돌려야 한다(아래).

**⚠ 하늘 위 UI 는 앱 테마 토큰을 쓰지 마라 (2026-08-05).** `--card`/`--line-strong`/`--ink` 는
사용자 테마를 따르는데, 배경인 **하늘은 실제 시각**을 따른다. 두 축이 독립이라
8 하늘 × 4 계절 × 3 밴드 = 96 조합 중 어딘가는 반드시 같은 색이 된다.
말풍선이 `bg-white/95` 였을 땐 **96 중 65 조합이 3:1 미만**(최악 1.05 — 완전히 동일)이었고,
테마 토큰으로 바꾼 1차 수정은 라이트를 고치면서 **다크 × 노을을 1.02 로 악화**시켰다.
→ `--world-card/-line/-ink`(다크에서 **뒤집지 않는** 토큰)를 쓰고, 가독성은 면이 아니라
**면·테두리 중 살아남는 쪽**이 책임진다. `worldui.test.ts` 가 96 조합을 전부 계산해 잠근다.
같은 이유로 `bg-white`(리터럴) + `text-ink`(테마) 짝은 다크에서 흰 글씨가 된다 —
19곳이 그 상태였다(게임 버튼 전부, 실측 1.13:1). `--ink-on-light` + `contrast.test.ts`.

**⚠ GNB 는 네온 베젤(.app-frame, z-60) 안쪽에 앉는다 (2026-08-05).** 베젤이 GNB(z-20) 위에
그려져서, 여백이 모자라면 **맨 오른쪽 '게임' 탭**이 오른쪽 변 + 아래 변 + 26px 모서리 곡선
세 방향에서 덮인다(+ `0 0 22px` 글로우). 실측 375×812: 베젤 안쪽 x 8~367 · 아래 805.
→ `BottomNav` 는 `px-2.5` + `pb-[calc(env(safe-area-inset-bottom)+8px)]`. 두 값은 globals.css 의
`.app-frame` padding·border 와 짝이며 `navfit.test.ts` 가 그 관계를 잠근다.
탭 버튼엔 `min-w-0` 필수 — flex 기본 `min-width:auto` 라 라벨(시스템 서체, 기기마다 폭이 다르다)
보다 좁아지지 못해 마지막 칸부터 밀려난다.

**펫 탭 점프 — 캔버스는 자기 안에서 움직인다 (2026-08-05).** 섬 무대는 하늘·잔디·나무·펫이
**한 장의 캔버스**라, 래퍼에 CSS transform 을 걸면 그림 전체가 통째로 흔들린다
(사용자: "네모 픽셀 자체가 움직이고"). `PetTapFx stageMotion={false}` 로 무대 변형을 끄고,
`PixelPet` 이 `tapHop(combo, elapsed)`(순수·정수 논리픽셀) 으로 **스프라이트 좌표만** 옮긴다.
점프 높이는 단계가 아니라 **연타 수에 비례**한다(홈은 `--pet-hop` CSS 변수로 같은 개념).
⚠ 콤보는 state 가 아니라 **ref** 로 센다 — state 면 같은 틱의 연타가 stale 값을 읽어 1 에서 멈춘다.

**사진 빨랫줄 — 커플이 고르는 4장.** `couples.hung_paths`(text[]) 에 저장, 비면 최근 4장 자동.
사진첩 타일의 집 버튼으로 걸고/내린다(가득 차면 FIFO 로 가장 오래된 것이 밀려남).
대표사진과 같은 행이라 기존 `subscribeCouple` 하나로 상대 변경까지 따라온다(새 채널 0).
`listRecentPhotos`/`photosByPaths` 는 **썸네일만** 서명한다(홈은 원본이 필요 없다).
⚠ `couples` 는 **컬럼 단위 grant** 다. 컬럼을 추가할 때 `grant update (…)` 를 재선언하면서
  기존 컬럼을 빠뜨리면 시작일·대표사진 수정이 **조용히** 막힌다(revoke 가 먼저 돈다).
  `hung.test.ts` 가 schema.sql 의 마지막 grant 에 세 컬럼이 다 있는지 잠근다.

**세로 예산이 빡빡하다.** 헤어로 위에서 아래로: 헤더(~y40) → 사진줄(33~113) → D-day(80~204)
→ 펫 컬럼(말풍선 밴드 78 + 무대 128 + 이름행 32). 하나를 키우면 반드시 다른 것과 부딪힌다.
- 말풍선 밴드는 **pointer-events-none + 고정 높이 + 가운데 좁은 폭**이어야 한다.
- 펫 무대 컨테이너도 `pointer-events-none` — 화면 전폭 × 240px 라 투명해도 뒤를 덮는다.
  누를 자식(펫 버튼·이름 행)만 `pointer-events-auto` 로 되돌린다.

**배경 다양성.** 계절이 언덕 3색에만 걸려 봄↔여름 Δ17/255 로 뭉쳐 있던 걸 언덕색을 벌리고
**나무·하늘 아래쪽·지면(눈)** 까지 확장했다. `seasonlook.test.ts` 가 색이 있는지가 아니라
**차이의 크기**(Δ≥20)를 잠근다.
- ⚠ 하늘 **top/upper 는 계절 무관** — `headerDark`(top 휘도) 판정이 흔들리면 헤더 대비가 깨진다.
- 날씨: wind = 구름 2배속 + 사선 입자 / 겨울 rain = 눈보라 / rainbow 는 낮에만.
- **오늘의 경사**(`occasionOf`): 100일 단위·기념일 당일·크리스마스·새해에 축포 + 리본을
  하늘 **위에 얹는다**. 대부분의 날은 null — 상시 축하는 축하가 아니다.

**펫 탭 반응(콤보).** `tapReaction(vibe, combo, r)` 순수 스펙. 1초 안에 연타하면 단계가 오른다
(1~2 / 3~4 / 5~7 / 8+): 파티클 3→14, 3단계부터 충격파 링 + 무대 흔들림, 2단계부터 짧은 외침.
- ⚠ **도트 회전 금지**(§14.5). 과격함은 스쿼시·점프·흔들림·파티클로만. `pettap.test.ts` 가
  모든 반응 애니의 keyframes 를 스캔해 `rotate(` 를 막는다.
- ⚠ **1단계를 넘는 모든 반응에서 말풍선을 숨긴다**(quiet). 실측상 bounce(2단계)만 해도
  말풍선을 뚫고 올라온다. 3단계부터만 숨기면 대사를 넘기려 탭하는 구간에서 그대로 겹친다.
- 무대는 bare 일 때 `overflow-visible` — 128px 안에서 102px 펫이 크게 뛰면 머리가 잘린다.
- ⚠ 흔들림 재생에 **루트 key 를 쓰지 않는다**. key 가 바뀌면 React 가 DOM 서브트리를 파괴/
  재생성해 진행 중 파티클이 되감기고 펫이 순간이동한다 → 동일 키프레임 두 개를 번갈아 건다.

**고쳐진 버그(재발 주의)**
- 달이 상현·하현에 사라졌다: 그림자 원 오프셋이 cos·30 이라 phase .25/.75 에서 0 이 되어
  달을 통째로 덮었다. `moonLitPath` 가 종결선을 rx = r·|cos| 타원호로 그린다.
  ⚠ cos(π/2)=6.1e-17 이라 **반올림 필수** — 안 하면 경로에 지수 표기가 박힌다.
- 시간대별 후광색이 8단계 전부 같았다: `glow` 가 rgba 라 렌더의 `#`-체크에 걸려 상수 폴백으로
  떨어졌다 → hex 통일. `haloRings` 는 색 뒤에 알파를 잇므로 **반드시 #rrggbb 7자**.
- reduced-motion 에서 입자·비·새가 애니만 꺼진 채 정지 잔상으로 남던 것 → 숨김.

**⚠ 홈은 로그인 게이트 뒤라 실화면을 못 연다.** 목업 DOM 으로 재면 *내 계산을 재현할 뿐*이라
틀린 지점이 그대로 통과한다(실제로 말풍선 겹침을 두 번 놓쳤다). `src/app/probe/page.tsx` 에
실제 컴포넌트를 목 props 로 띄우는 임시 라우트를 만들어 재는 편이 훨씬 빠르다.
애니메이션 최고점은 `el.getAnimations()[0].currentTime` 을 강제로 옮겨 잰다
(프리뷰 pane 이 숨겨져 rAF/타이머가 throttle 된다). **정적 export 라 공개 라우트가 되므로
검증 후 반드시 삭제할 것.**

⚠ 캔버스 씬은 rAF 가 throttle 되어 프레임 캡처가 안 된다. 그럴 땐 **결과(픽셀) 대신 원인
(적용된 클래스·computed style)** 을 재라 — "네모가 통째로 움직인다"는 래퍼의 `animate-pet-*`
하나가 원인이었고, 클래스가 안 붙는 걸 확인하는 게 프레임 비교보다 확실했다.

**⚠ 평범한 텍스트가 앱 CSS 를 통째로 깨뜨릴 수 있다 (2026-08-05).** Tailwind v4 는 **레포 전체**
(소스뿐 아니라 이 README 같은 문서까지)를 훑어 임의값 클래스를 만들어낸다. 테스트 실패
메시지에 `pb-` + 대괄호 + `calc(...)` 모양의 **예시 문자열**을 넣었더니 그게 후보로 잡혀
유효하지 않은 규칙이 생성됐고, globals.css 파싱이 통째로 실패했다(= 앱 스타일 전멸).
`next build` 는 조용히 통과했고 **브라우저 콘솔에서만** 잡혔다.

같은 실수를 이 문서를 쓰다가 한 번 더 했다 — 위 사례를 **문자 그대로** 적어 놓는 순간
README 가 스캔되어 버그가 되살아났다. 그래서 이 문단엔 문제의 문자열을 조각내서 적는다.
규칙: **설명·메시지·주석에 클래스 문법을 통짜로 쓰지 마라.** 꼭 보여야 하면 조각내거나
`{ }` 로 끊어라(`pb-{[}calc(...){]}`).

**⚠ 소스 스캔 테스트는 주석을 먼저 지워라.** 이 저장소는 '왜 그렇게 했는지'를 주석에 길게
남기는 스타일이라, 전체 소스를 정규식으로 훑으면 설명문이 먼저 잡힌다(한 세션에 3번 오검출).
`src.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/[^\n]*/g,"")` 를 거치거나
`className="..."` 문자열만 추출해서 봐라.

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
- **정원**: 작물 **9종**·계절(제철 페널티)·품질 **★1~5**(스킬+물+비료+제철 롤)·농사 스킬·물 가속·밭 확장.
  **공방** 가공 6종(창고 재료 소모→시간 완성, 별 상속), 스프링클러/온실 도구.
  - **무등산수박**(2026-08-04) = 최고 난도 작물. **작물 중 유일하게 스킬 게이트**(농사 Lv.10)를
    갖고, 성장 4일(2위 호박 2.5일의 1.6배)·씨앗 150(5배)·판매 260(최고)이다.
    ⚠ 게이트를 새로 만들 땐 **UI 에 잠긴 이유를 반드시 띄운다** — 이 저장소는 '골드비료를
    부르는 곳이 없어 안내만 하고 살 수는 없던' 실수를 이미 겪었다(islandReachable.test.ts).
    ⚠ **줄무늬를 그리지 마라.** 무등산수박(푸랭이)은 "무늬가 없이 진초록의 껍질 색"이 이름의
    유래이고, 타원형에 일반 수박의 2~3배(10~30kg)다. 첫 판을 흔한 줄무늬 수박으로 그렸다가
    되돌렸다 — **실존하는 대상은 그리기 전에 찾아본다.** watermelon.test.ts 가 '한 행의 톤은
    좌→우 단조 증가'(=밝은 면에 어두운 열이 못 낀다)로 무늬 재발을 구조적으로 막는다.
- **꾸미기**: 데코 22종·테마 세트 5(완성 퍽)·섬 평점(브론즈~로열)·도감. **유대 레벨**(coop/선물/함께출석/
  D-day), **함께 액션**, **D-day 마일스톤**(100일마다). 일일 퀘스트 3(결정적)·출석 스트릭·업적.
- **꾸미기 = 배치 게임**(2026-08-03): 예전엔 평점이 등급 합 + 세트만 세서 **좌표가 어디에도 안 쓰였다**
  → 빈 칸 아무 데나가 늘 정답이라 '사서 놓기'로 끝났다. 이제 위치가 결과를 바꾼다.
  - **이웃 조합 16종**(`DECOR_COMBOS`): **가로·세로로 맞닿은**(대각선 ✕) 두 장식이 이름 있는 장면을
    만든다. 붙어 있는 동안 평점 가산, 최초 발견 시 코인·행복·XP + 도감(`catalog` 의 `combo_<id>`).
    절반 이상이 **세트 교차** — 세트만 모아선 안 나온다. 22종 전부가 최소 하나의 조합에 쓰이고
    **최대 차수 2** → 16개 동시 성립이 실제로 풀리는 퍼즐(테스트가 이 성질을 고정).
    ⚠ 보상은 **최초 1회만**(떼었다 붙여도 코인 0) · 같은 조합 여러 쌍이어도 평점은 **1회만**.
  - **손님**(`todayGuest`/`welcomeGuest`): 발견한 조합 소문을 듣고 하루 한 명. 그 조합이 **지금 붙어
    있어야** 맞이할 수 있다(선물 = 평점 비례, 상한 있음). 위시=사기 / 손님=배치로 역할이 안 겹친다.
  - **조합 힌트**(`comboHint`): 재료가 이미 섬에 있으면 '사라'가 아니라 '옮겨라'를 먼저 권한다.
    날짜 해시로 회전 — `rngNext` 금지(양 클라가 갈린다).
  - 씬에 **조합 빛줄기**(IslandScene `links`) — 붙었다는 사실이 숫자가 아니라 화면으로 보인다.
    발견 축하 토스트는 `catalog` diff 감지라 **상대가 붙여도 같이** 뜬다(세트 완성과 같은 방식).
- 미니게임(아케이드/부루마블/테트리스) **승리 시 하트코인 지급**(`awardIslandCoins`, 있을 때만·조용히·
  stale 1회 재시도) → 섬이 앱 전체 보상 레이어.
- **그래픽 = 픽셀 아트(기본) + 자체 SVG 아트**, 외부 이미지 0 (저작권·오프라인 PWA):
  - **펫은 앱 전역이 픽셀이 기본**(`src/lib/pixelpref.ts` — 저장값 없으면 픽셀). 섬의 토글은
    전역 설정이라 홈·쿡찌르기·게임 카드·도감의 같은 펫이 함께 바뀐다.
  - 펫 아트를 그리는 **단일 진입점 = `island/PetIcon.tsx`**(픽셀/일러스트 분기). 새 자리에
    펫을 넣을 땐 `petArt()` 를 직접 부르지 말고 PetIcon 을 쓴다(아홉 군데가 어긋나던 원인).
  - 픽셀 저작: `lib/pixel.ts`(팔레트+행문자열 포맷·5톤 램프 `ramp()`·팔레트 스왑 조명),
    `lib/pixelpet32.ts`(**32×32** 펫 — 공용 골격 위에 종별 **귀·마킹·꼬리** 오버레이),
    `lib/pixelart.ts`(폼→스프라이트 매핑 + 소품). 렌더는 `island/PixelPet.tsx`(무대) /
    `island/PetPixel.tsx`(캐릭터만).
    - ⚠ 행은 **`row([x,"문자열"], …)` 런으로만** 적는다 — 점(.)을 손으로 세면 하나 빠져도
      눈에 안 보이는 채로 아트가 통째로 밀린다. `paint()` 가 길이 어긋난 패치를 즉시 throw.
    - ⚠ 스케일은 **정수배만**(`imageSmoothingEnabled=false`) — 도트가 뭉개지는 유일한 원인.
    - ⚠ 첫 프레임은 **동기로** 그린다. rAF 안에서만 그리면 백그라운드 복귀·저전력·헤드리스에서
      캔버스가 빈 채 남는다(실제 버그).
    - ⚠ 도트를 **회전시키지 않는다**(픽셀 격자가 깨짐) — 수면 포즈는 전용 스프라이트로.
  - 작물 8종×성장 4단계 + 가공품 8종도 픽셀(`lib/pixelcrop.ts`, 24×24). 단일 진입점은
    `island/CropIcon.tsx`(CropIcon/ProductIcon). 정적 아이콘 렌더는 `island/PixelSprite.tsx`
    — 격자에 수십 개가 깔리므로 rAF 없이 마운트 때 한 번만 그린다.
    - 작물은 **바닥 정렬**(mk 가 빈 행을 위에 채움) — 성장 단계마다 지면선이 튀면 안 된다.
    - 0·1 단계는 공용 새싹(형태 동일) + **작물색 봉오리**로 구분. 1단계를 무성하게 그리면
      2단계보다 잎이 많아져 "자랄수록 커진다"가 깨진다(테스트가 잉크량으로 감시).
  - 데코 22종도 픽셀(`lib/pixeldecor.ts`, 24×24). 세트별 색 톤 통일(봄=꽃/잎 · 집=나무/크림 ·
    바다=물/모래 · 커플=로즈/골드 · 천상=밤/바이올렛). 진입점 `island/DecorIcon.tsx`.
  - 꾸미기 풍경(IslandScene)은 하나의 `<svg>` 라 캔버스를 못 넣는다 → `lib/spriteurl.ts` 가
    스프라이트를 **한 번만 구워 data URL 로 캐시**하고 `<image image-rendering:pixelated>` 로 얹는다.
    (픽셀을 `<rect>` 로 펴면 데코 24개에 수천 노드가 되어 모바일에서 못 쓴다.)
  - ⚠ 아트 함수(`petArt/cropArt/productArt/decorArt`)를 컴포넌트에서 **직접 부르지 않는다** —
    PetIcon/CropIcon/DecorIcon 을 쓴다. pixeldecor.test.ts 가 소스 스캔으로 강제.
- **SVG 아트 60+종** (`src/components/island/art/`):
  - `parts.tsx` **아트 파운데이션**(단일 기준): 공용 팔레트 PAL(3톤 셰이딩), `<Art>` 가 viewBox
    100×100 고정, **지면 y=92·중심 x=50** 규약(씬 배치와 정렬), 광원 **좌상단** 통일, 재사용 파츠
    (Eyes/Blush/Smile/Body/GroundShadow/Sparkle/Leaf). 랜덤 금지(purity) — 모션은 CSS 만.
  - `pets.tsx` 펫 23종: 종별 **베이스 함수**(foxBase/catBase/bearBase/owlBase/wolfBase)를 최종형이
    공유하고 왕관·후광·오라·보석만 덧붙여 **진화 계보가 시각적으로 이어짐**.
  - `crops.tsx` 작물 8×성장 4단계 + 가공품 6, `decor.tsx` 데코 22(세트별 색 톤 통일, 등급↑=화려).
  - ⚠ **SVG gradient id 는 반드시 `useId`** — 하드코딩하면 같은 아트가 두 번 렌더될 때(도감+본화면)
    id 중복으로 잘못된 그라데이션을 참조한다.
  - ⚠ 아트는 **JSX 로만 렌더**(`A(props)` 함수 호출 금지) — 내부 useId 가 부모 훅 순서에 섞여
    폼 전환 시 훅 개수가 달라진다. 레지스트리 조회라 `react-hooks/static-components` 는 예외 처리.
- **꾸미기 = 섬 풍경** (`island/IslandScene.tsx`, 격자 UI 아님): 계절 4 × 시간대(낮/노을/밤) 하늘
  그라데이션·해/달·밤별, 물결 바다(CSS), 모래 해변 + 잔디 고원. **6×4 배치 슬롯을 원근 매핑**
  (`ROWS` = [화면Y, 반너비, 스케일] — 뒤로 갈수록 작고 좁게, 앞 데코가 위로 겹침). 하늘 소품
  (나비/달/별/혜성/행성)은 `SKY_DECOR` 로 공중 배치, 펫은 해변에 서서 살랑임. 빈 슬롯은 **배치
  모드에서만** 표시.
  - ⚠ **CSS 애니 transform 이 SVG transform 속성을 덮어쓴다** → 위치용 `<g transform>` 과
    애니용 `<g className>` 을 **반드시 분리**(안 하면 (0,0) 으로 튄다).

### 14.4 개발/검증 유의

- **배포 flake**: `deploy-pages.yml` deploy 단계가 간헐 "Deployment failed, try again later"(GitHub
  Pages 이슈, 코드 무관). 해법: `gh workflow run deploy-pages.yml --ref main` 새 dispatch. SHA 고착
  (deployment_failed/cancelled)이면 **빈 커밋으로 새 SHA** 만들어 재배포.
- **프리뷰 검증 제약**: 헤드리스 프리뷰 탭은 rAF/setTimeout throttle(마이크로태스크는 진행) → 타이밍성
  게임 자동 구동·부루마블 인게임(상대 연결 필요)은 **동일 CSS 목업 DOM 주입**으로 시각 검증(주사위/축하
  팝업/보드 동일 기법). 자동 초고속 점수는 anti-cheat 로 거부됨.
- **회귀 lock 룰**: 버그 fix 마다 `src/**/*.test.ts`에 소스-스캔/로직 테스트 동반(방향 계약·submitMatch
  순서·닉네임 클로버링 금지·상점 가격·mood note truncate 금지 등).
