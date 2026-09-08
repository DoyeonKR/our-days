"use client";

import Icon from "@/components/Icon";

/* 대표사진 액자 — 함께 탭 맨 위(쿡찌르기 바로 위).
   [사용자 요청 2026-09-08] 여기 있던 '두 도시의 지금'(듀얼 클록·도시 간 거리·현재 날씨)을 뺐다.
   카드가 못 만들어져서가 아니라 **매일 같은 숫자**여서다 — 같은 생활권이면 시차도 거리도 안 변한다.

   그 자리에 대표사진을 크게 건다. 지금까지 대표사진이 나오는 곳은 페이지 배경 13% wash
   하나뿐이라 사실상 안 보였다(사용자: "배경 메인 사진이 너무 안 보인다").

   ⚠ **wash 를 진하게 해서 해결할 수는 없다.** 그 위에 글씨가 뜨기 때문이다 — 배포본 실측으로
     어두운 사진 위에서 --muted 3.47 / --accent-ink 3.85 로 **지금도 이미 기준(4.5) 미달**이다.
     사진을 크게 보여주려면 wash 를 올리는 게 아니라 **글씨가 안 얹히는 자리**를 줘야 한다.
     그래서 이 액자 안에는 글씨를 한 줄도 안 넣는다(설명은 액자 아래 카드 면 위로 뺐다). */

export default function CoverFrame({
  coverUrl,
  onOpenAlbum,
}: {
  coverUrl: string | null;
  onOpenAlbum: () => void;
}) {
  return (
    <button
      onClick={onOpenAlbum}
      aria-label={coverUrl ? "대표사진 — 사진첩 열기" : "대표사진 정하기 — 사진첩 열기"}
      className="tap block w-full rounded-[var(--radius-card)] bg-card p-3 text-left shadow-[var(--shadow-md)] ring-1 ring-line"
    >
      {/* 액자 — 홈 빨랫줄 폴라로이드와 같은 문법(흰 여백 + 아래쪽이 더 두꺼움).
          기울이지는 않는다: 빨랫줄은 여러 장이라 각도가 리듬이지만 여기는 한 장이라 흔들려 보인다. */}
      <div className="bg-white p-1.5 pb-4 shadow-[var(--shadow-sm)]">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="block aspect-[4/3] w-full object-cover"
          />
        ) : (
          <span className="grid aspect-[4/3] w-full place-items-center bg-glass2 text-muted">
            <Icon name="camera" size={28} strokeWidth={1.8} />
          </span>
        )}
      </div>

      {/* 설명은 사진 위가 아니라 **카드 면 위**에 둔다 — 사진은 커플이 고르는 임의 이미지라
          그 위의 글씨는 대비를 보장할 방법이 없다(README 의 말풍선 사례와 같은 함정). */}
      <p className="mt-2.5 flex items-center gap-1.5 text-sm font-extrabold leading-tight text-ink">
        <Icon name="star" size={14} className="text-rose-deep" />
        {coverUrl ? "우리 대표사진" : "대표사진이 아직 없어요"}
        <span className="ml-auto inline-flex items-center gap-0.5 text-sm font-semibold text-muted">
          사진첩
          <Icon name="chevronRight" size={14} />
        </span>
      </p>
      <p className="mt-0.5 text-sm leading-tight text-muted">
        {coverUrl ? "홈 배경으로도 은은하게 깔려요" : "사진첩에서 별을 누르면 여기에 걸려요"}
      </p>
    </button>
  );
}
