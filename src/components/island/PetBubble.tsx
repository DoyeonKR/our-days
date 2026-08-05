/* 펫 대사 말풍선 — 히어로 하늘 위에 뜬다.
 *
 * ⚠ 색을 앱 테마(--card/--line)에서 가져오지 마라. 뒤에 깔리는 하늘은 **실제 시각**을
 *   따르는데(깊은 밤 ~ 한낮) 테마는 사용자 설정을 따른다. 두 축이 독립이라
 *   8 하늘 × 2 테마 = 16 조합 중 어딘가는 반드시 같은 색이 된다.
 *   [사용자 리포트 2026-08-05 "라이트모드에서 말풍선이 잘 안보여 같은 하얀색이라"]
 *   → 첫 수정(테마 토큰 + 테두리)은 라이트를 고쳤지만 **다크 × 노을에서 대비 1.02** 로
 *     오히려 더 나빠졌다. 그래서 --world-* (테마 불변) 토큰을 쓴다. globals.css 주석 참조.
 *
 * 가독성은 면이 아니라 **면+테두리 둘 중 살아남는 쪽**이 책임진다:
 *   밝은 하늘 → 진한 테두리가(6.8~11.3:1), 어두운 하늘 → 크림 면이(3.3~8.2:1) 형태를 지킨다.
 *
 * 별도 파일인 이유: HomePet 은 Supabase 구독을 물고 있어 프로브에서 못 띄운다.
 * 말풍선만 떼어 두면 진짜 하늘 위에 올려놓고 눈으로 확인할 수 있다.
 */

const SKIN = "border-2 border-[var(--world-line)] bg-[var(--world-card)]";

export default function PetBubble({ text }: { text: string }) {
  return (
    <div className="animate-pop max-w-[55%]">
      <div
        className={`relative line-clamp-3 rounded-2xl ${SKIN} px-3 py-1.5 text-center text-sm font-bold leading-snug text-[var(--world-ink)] shadow-[var(--world-shadow)]`}
      >
        {text}
        {/* 꼬리 — 45° 회전한 정사각형의 두 변에만 테두리를 줘 몸통 외곽선과 이어 붙인다.
            몸통 배경이 꼬리 뿌리를 덮도록 -bottom 을 테두리 두께만큼만 내린다. */}
        <span
          aria-hidden
          className={`absolute -bottom-[7px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-[var(--world-line)] bg-[var(--world-card)]`}
        />
      </div>
    </div>
  );
}
