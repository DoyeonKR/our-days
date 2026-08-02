// 일기장(DecoBook) 회귀 lock. [2026-07-28]
// 배경: 5관점 멀티에이전트 리뷰 + 적대 검증에서 확정된 결함들. DecoBook 은 그동안 소스 lock 이
// 0건이라 같은 회귀가 조용히 다시 들어올 수 있었다(순수 로직 diary.ts 만 테스트 보유).
// 여기서 잠그는 계약:
//  ① 반응 in-flight 가드가 '취소 분기보다 먼저'(더블탭 시 tmp id 를 DB uuid 로 보내는 사고)
//  ② 내 행동 반영은 realtime 소켓 의존 금지 — 성공 즉시 HTTP 재조회(ownerSplit.test.ts:82 와 동일 계약)
//  ③ 댓글 입력은 '성공했을 때만' 비움(실패 시 문장 유실 금지)
//  ④ 오류 배너는 목록보다 위 + 닫기 가능 + 성공 시 해제, 로드 실패를 빈 상태로 위장 금지
//  ⑤ 사진 만료는 '그 엔트리만' 재서명(전량 refresh 는 브라우저 캐시 파괴) + 재시도 캡
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "DecoBook.tsx"), "utf8");
const couple = readFileSync(join(here, "../lib/couple.ts"), "utf8");

test("반응 토글 — in-flight 가드가 취소 분기보다 먼저 [회귀 lock]", () => {
  const fn = src.slice(src.indexOf("async function toggleReaction"), src.indexOf("async function submitComment"));
  const iGuard = fn.indexOf("pendingReact.current.has(key)");
  const iMine = fn.indexOf("const mine = reactions.find");
  assert.ok(iGuard > 0 && iMine > 0, "가드/취소 분기 존재");
  assert.ok(iGuard < iMine, "가드가 mine 탐색보다 먼저(더블탭 시 tmp id 삭제 요청 차단)");
  assert.ok(fn.includes('!mine.id.startsWith("tmp-")'), "tmp 레코드는 취소 대상에서 제외");
});

test("댓글 — 성공했을 때만 입력 비움 + 결과 반환 [회귀 lock]", () => {
  assert.ok(
    /async function submitComment\([^)]*\): Promise<boolean>/.test(src),
    "submitComment 는 성공 여부를 돌려준다",
  );
  const card = src.slice(src.indexOf("async function send()"));
  assert.ok(/const ok = await onComment\(body\)[\s\S]{0,80}if \(ok\) setC\(""\)/.test(card), "성공 시에만 setC('')");
  assert.ok(!/onComment\(c\);\s*\n\s*setC\(""\)/.test(src), "결과 무시 후 즉시 비우는 옛 코드 부활 금지");
});

test("내 행동 반영 — realtime 소켓 의존 금지(즉시 HTTP 재조회) [회귀 lock]", () => {
  // 저장 성공 후 재조회 실패를 삼키면 'DB엔 있는데 내 화면엔 없음'
  const saved = src.slice(src.indexOf("onSaved={async"), src.indexOf("</section>"));
  assert.ok(saved.includes("await listDecoEntries(coupleId)"), "저장 후 즉시 재조회");
  assert.ok(saved.includes("catch"), "재조회 실패를 삼키지 않음");
  // 편집기 닫힘 보장(finally). 상태가 boolean → {entry}|null 로 바뀌어(수정 모드 도입,
  // 2026-07-28) 닫기 표현은 setEditing(null) — 의도(재조회 실패해도 반드시 닫힘)는 동일.
  assert.ok(/finally\s*\{[\s\S]{0,80}setEditing\(null\)/.test(saved), "편집기 닫힘 보장(finally)");
  // 댓글도 동일 계약
  assert.ok(
    /await addComment\([\s\S]{0,120}listComments\(coupleId\)/.test(src),
    "댓글 추가 후 즉시 재조회",
  );
});

test("오류 표면화 — 배너 위치/해제/로드실패 구분 [회귀 lock]", () => {
  const iErr = src.indexOf('role="alert"');
  // ⚠ 앵커는 '목록' 이어야 한다 — "{coupleId && (" 는 헤더의 '오늘 쓰기' 버튼에도 있어
  //   그걸 잡으면 배너가 실제로 위에 있어도 실패한다(테스트 자체 오류였던 지점)
  const iList = src.indexOf("<SkeletonList");
  assert.ok(iErr > 0 && iList > 0 && iErr < iList, "오류 배너는 목록보다 위(54편 중간 실패도 보이게)");
  assert.ok(src.includes('aria-label="오류 닫기"'), "사용자가 배너를 닫을 수 있음");
  assert.ok(/setErr\(null\)/.test(src), "성공 시 옛 오류 해제(리로드 전까지 상주 금지)");
  assert.ok(src.includes("loadFailed"), "로드 실패 상태 분리");
  assert.ok(
    src.indexOf("일기를 불러오지 못했어요") > 0 &&
      src.indexOf("loadFailed ?") < src.indexOf("entries.length === 0 ?"),
    "로드 실패를 '아직 일기가 없어요'로 위장 금지(실패 분기가 먼저)",
  );
  // 반응/댓글 메타 로드 실패도 무증상 금지
  const meta = src.slice(src.indexOf("const refreshMeta"), src.indexOf("refresh();"));
  assert.ok(!/\.catch\(\(\) => \{\}\)/.test(meta), "메타 로드 빈 catch 금지");
});

test("사진 만료 자가복구 — 엔트리 단위 재서명 + 재시도 캡 [회귀 lock]", () => {
  assert.ok(src.includes("onError={onPhotoError}"), "일기 사진에 onError 복구 경로");
  const fn = src.slice(src.indexOf("async function recoverPhotos"), src.indexOf("async function remove("));
  assert.ok(fn.includes("resignPaths("), "그 엔트리 경로만 재서명");
  assert.ok(!fn.includes("listDecoEntries("), "전량 재조회 금지(이미 받은 사진 캐시 파괴)");
  assert.ok(/n >= 2/.test(fn), "엔트리당 재시도 캡(삭제된 파일 무한루프 차단)");
  assert.ok(couple.includes("export async function resignPaths"), "couple.ts 에 좁은 재서명 API");
});

test("삭제 확인 — 상대 반응·댓글 동반 삭제를 미리 알림 [회귀 lock]", () => {
  const fn = src.slice(src.indexOf("async function remove("), src.indexOf("const todayIso"));
  assert.ok(fn.includes("detail:"), "확인 대화에 상세 안내");
  assert.ok(/반응과 댓글도 함께 사라져요/.test(fn), "cascade 결과 명시");
});

test("카드 — 작성자 표시(둘이 쓰는 피드의 기본 정보) [회귀 lock]", () => {
  assert.ok(/의 하루/.test(src), "작성자 칩");
  assert.ok(
    /mine \? \(myName \|\| "나"\)/.test(src),
    "내 글/상대 글 구분(myName/partnerName 이 댓글 라벨 외에도 쓰임)",
  );
});
