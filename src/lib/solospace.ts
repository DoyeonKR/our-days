// 혼자 쓰는 기록 공간 · 계정 삭제 안내 문구(순수) — 화면 셋(ConnectFirst · CoupleSync · AccountSection)이 같은 말을 한다.
//
// [2026-11-06] 상대가 없으면 일기 · 사진 · 3초 로그 · 추억이 전부 '커플 연결 후 함께 써요'에서 멈췄다.
// 그런데 커플 공간은 초대코드를 만드는 순간 이미 생긴다(create_couple — 만든 사람 혼자인 couples 행).
// 그래서 '혼자 시작하기'는 같은 RPC 로 1인 공간을 만들 뿐이다 — RLS · storage 정책 · 내보내기 · 계정 삭제가 전부 그대로 돈다.
// 나중에 상대가 **내 코드**로 들어오면 기록이 그대로 둘의 것이 된다. 반대로 **남의 코드**로 들어가려면 지금 공간을
// 떠나야 하고(join_couple 이 막는다), 혼자 남긴 기록은 옮겨지지 않는다 — 행 · 파일 경로(폴더 = 커플 id)를 옮기는
// 병합 RPC 는 실패하면 되돌리기 어려워 만들지 않았다. 대신 떠나기 전에 분명히 말하고 내보내기를 먼저 권한다.

/** 공간에 나 혼자인가(상대가 아직 안 들어왔다). */
export const isSoloSpace = (memberCount: number): boolean => memberCount < 2;

/** 혼자 쓰던 공간을 떠날 때 — 무엇이 어떻게 되는지.
 *  2026-11-05: 예전엔 '돌아올 길이 없다'고 하면서 실제로는 초대코드가 살아 있어, 그 코드를 가진 누구든 들어와 기록을 봤다.
 *  이제 아무도 안 남은 공간은 서버가 닫는다(couples.closed_at) — 문구가 실제와 같아졌다. */
export const SOLO_LEAVE_DETAIL =
  "혼자 남긴 일기·사진·3초 로그·일정·버킷리스트와 우리 섬이 이 계정에서 모두 안 보이게 돼요. " +
  "아무도 없는 공간은 닫혀서 초대코드로도 다시 들어올 수 없고, 다른 사람의 코드로 합류해도 기록은 옮겨지지 않아요. " +
  "'내 기록도 지우고 나가기'를 고르지 않으면 기록은 닫힌 공간에 남아요(계정을 지우면 함께 지워져요).";

/** 연결 관리의 '내 기록도 지우고 나가기' — leave_couple(p_wipe_mine) 이 지우는 것과 같은 목록. */
export const LEAVE_WIPE_LABEL = "내 기록도 지우고 나가기";
export const LEAVE_WIPE_DETAIL =
  "이 공간에 내가 남긴 일기·사진·3초 로그·쿡·질문 답·기분·댓글·반응과 내가 만든 일정·버킷리스트를 지워요. " +
  "상대 화면에서도 사라지고 되돌릴 수 없어요.";

/** 떠나기 전 내보내기를 먼저 권하는 확인창. */
export const SOLO_EXPORT_FIRST = {
  message: "혼자 남긴 기록을 먼저 내보낼까요?",
  detail: "설정 › 데이터에서 일기·사진·영상을 ZIP 으로 받아 둘 수 있어요. 연결을 해제하면 이 기록은 새 공간으로 따라가지 않아요.",
  confirmText: "내보내기 먼저",
  cancelText: "이미 받았어요",
} as const;

/** 혼자 쓰는 중에 남의 초대 링크로 들어왔을 때. */
export const SOLO_INVITE_CONFLICT =
  "혼자 쓰는 기록 공간이 이미 있어요. 이 링크로 합류하려면 아래 '연결 관리'에서 지금 공간을 해제해야 하고, " +
  "혼자 남긴 기록은 새 공간으로 옮겨지지 않아요. 먼저 설정 › 데이터에서 내보내기를 해 두세요.";

/** 계정을 지우면 무엇이 사라지고 무엇이 남는지 — purge_account_data(schema.sql)와 같은 목록이어야 한다. */
export type SpaceKind = "none" | "solo" | "pair";
export function deletionImpact(
  space: SpaceKind,
  partnerName: string | null,
): { gone: string[]; kept: string[]; lead: string } {
  const who = partnerName?.trim() ? `${partnerName.trim()}님` : "상대";
  const pair = space === "pair";
  return {
    lead: pair
      ? `${who} 화면에서도 아래 기록이 함께 사라져요.`
      : space === "solo"
        ? "혼자 쓰는 공간이라 그 공간의 기록이 모두 함께 삭제돼요."
        : "내 계정과 내가 남긴 기록이 삭제돼요.",
    gone: [
      `내가 쓴 일기(거기 달린 ${who}의 반응·댓글 포함)`,
      "내가 올린 사진(대표사진·빨랫줄에 걸린 것 포함)",
      `내 3초 로그 영상·글(달린 댓글 포함)`,
      "오늘의 질문에 남긴 내 답 · 내 기분",
      "내가 보낸 쿡 메시지 · 내 활동 기록",
    ],
    kept: pair ? [`일정 · 버킷리스트 · 우리 섬은 ${who}에게 넘어가 그대로 남아요.`] : [],
  };
}
