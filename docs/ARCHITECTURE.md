# 아키텍처

## 데이터 위치

| 데이터 | 저장소 | 이유 |
|---|---|---|
| 사귀기 시작한 날(로컬) | localStorage | 연동 전에도 혼자 사용 가능 |
| 커스텀 기념일(생일 등) | localStorage | 개인 목록, 기기 로컬 |
| 알림 발화 마커 | localStorage | D-DAY 알림 하루 1회 중복 방지 |
| 커플/구성원 | Supabase `couples`, `couple_members` | 두 기기 공유 |
| 공유 사귄 날 | Supabase `couples.start_date` | 커플 공통 D-day 소스 |
| 쿡찌르기 | Supabase `pokes` | 실시간 전달 |

## 인증

- Supabase Anonymous sign-in. 기기마다 지속되는 `auth.uid()` 를 부여(이메일/비번 없음).
- 클라이언트는 `ensureAnonAuth()` 로 세션 없으면 익명 로그인 후 uid 확보.
- 세션은 브라우저에 persist. 기기를 바꾸면 새 uid(= 새 사용자)로 취급.

## 데이터 모델

```
couples
  id uuid pk
  invite_code text unique       # 6자리, 상대 합류용
  start_date date               # 공유 D-day 소스
  created_by uuid
  created_at timestamptz

couple_members  (couple당 최대 2)
  couple_id uuid fk -> couples
  user_id uuid                  # auth.uid()
  nickname text
  pk (couple_id, user_id)

pokes
  id uuid pk
  couple_id uuid fk -> couples
  from_user uuid
  kind text                     # poke | miss | meal | love | custom
  message text
  created_at timestamptz
```

## 보안 (RLS)

- 3개 테이블 모두 Row Level Security ON.
- 핵심 판별 함수 `is_couple_member(couple_id)` 는 `SECURITY DEFINER` 로 RLS 를 우회해
  조회한다. 이렇게 하지 않으면 `couple_members` 정책이 자기 테이블을 다시 참조해
  무한 재귀가 발생한다.
- 정책 요약:

| 테이블 | select | insert | update/delete |
|---|---|---|---|
| couples | 내 커플만 | RPC 로만(직접 insert 없음) | 내 커플만, **start_date 컬럼만**(grant 로 제한) |
| couple_members | 내 커플 구성원 | RPC 로만 | 본인 행만 delete(나가기) |
| pokes | 내 커플만 | 내 커플 & 본인 명의 | - |

- couples 는 RLS(행 단위) 위에 컬럼 grant 로 `start_date` 만 수정 허용 →
  멤버가 `invite_code`/`created_by` 를 변조(초대코드 무효화·소유자 스푸핑)하는 것 차단.
- 커플 생성/합류는 `create_couple`, `join_couple` RPC(`SECURITY DEFINER`)가 담당.
  코드 조회·중복/포화(2명) 검증·멤버 insert 를 처리하며, `join_couple` 은 couples 행을
  `for update` 로 잠가 동시 합류 경쟁조건(2인 초과)을 막는다. 클라이언트가
  couple_members 에 임의 insert 할 필요/권한이 없음.
- 상대 합류 전(대기중)에는 클라이언트가 4초 간격으로 구성원을 폴링해 2명이 되면 반영.

## 쿡찌르기 실시간 흐름

```
A 기기: sendPoke() ─ insert pokes ─▶ Postgres
                                       │  (RLS: A는 자기 커플에 insert 가능)
                                       ▼
                          supabase_realtime publication
                                       │  postgres_changes(INSERT, filter couple_id=eq.X)
                          ┌────────────┴────────────┐
                          ▼                         ▼
                    A 기기 구독              B 기기 구독
                (from_user==나 → 목록만)   (from_user!=나 → 배너+알림+목록)
```

- 구독은 `subscribePokes(coupleId, cb)` 가 `channel().on('postgres_changes', …)` 로 설정.
- realtime 도 RLS 를 준수하므로 다른 커플의 poke 는 수신되지 않는다.
- 수신 콜백은 id 로 dedupe(자기 insert 에코 + 낙관적 추가 중복 방지).

## 그레이스풀 디그레이드

- `NEXT_PUBLIC_SUPABASE_*` 가 없으면 `getSupabase()` 가 null, `isSupabaseConfigured=false`.
- 이 경우 커플 UI 는 안내 문구만 표시하고, 나머지(로컬 D-day/기념일/알림/PWA)는 정상.
- 즉 백엔드 유무와 무관하게 배포/실행이 깨지지 않는다.

## 시작일 동기화 규칙

- 커플 로드/생성/합류 시 `couples.start_date` 가 있으면 로컬로 채택(`onAdoptStart`).
- 연동 상태에서 설정의 사귄 날을 바꾸면 로컬 + `couples.start_date` 동시 갱신.
- 채택은 커플로 되돌려 쓰지 않아(단방향) 갱신 루프가 없다.
