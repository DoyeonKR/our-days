// 커플 버킷리스트 순수 로직(카테고리/진행률/시드) — UI·데이터 계층과 분리해 테스트 용이.

export type BucketCategory = "date" | "travel" | "food" | "growth" | "etc";

export const BUCKET_CATEGORIES: {
  key: BucketCategory;
  label: string;
  emoji: string;
}[] = [
  { key: "date", label: "데이트", emoji: "💞" },
  { key: "travel", label: "여행", emoji: "✈️" },
  { key: "food", label: "맛집", emoji: "🍽️" },
  { key: "growth", label: "함께 성장", emoji: "🌱" },
  { key: "etc", label: "기타", emoji: "⭐" },
];

/** 카테고리 키 → 메타(라벨/이모지). 모르는 키는 '기타'로 폴백. */
export function categoryMeta(key: string): { key: BucketCategory; label: string; emoji: string } {
  return (
    BUCKET_CATEGORIES.find((c) => c.key === key) ??
    BUCKET_CATEGORIES[BUCKET_CATEGORIES.length - 1]
  );
}

/** 진행률(완료/전체/퍼센트). 빈 목록은 0%. */
export function bucketProgress(items: { done: boolean }[]): {
  done: number;
  total: number;
  pct: number;
} {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

/** 빈 화면 방지용 추천 시드(정적 — DB 부담 0). 첫 진입 시 원탭 추가로 노출. */
export const BUCKET_SEED: { category: BucketCategory; title: string }[] = [
  { category: "date", title: "한강에서 자전거 타기" },
  { category: "date", title: "놀이공원 하루종일 놀기" },
  { category: "date", title: "야경 보러 가기" },
  { category: "date", title: "커플 사진관에서 사진 찍기" },
  { category: "date", title: "방탈출 카페 같이 가기" },
  { category: "travel", title: "제주도 여행 가기" },
  { category: "travel", title: "바다 보러 강릉 가기" },
  { category: "travel", title: "1박 2일 캠핑 가기" },
  { category: "travel", title: "해외여행 함께 가기" },
  { category: "travel", title: "온천·스파 여행" },
  { category: "food", title: "오마카세 먹으러 가기" },
  { category: "food", title: "같이 요리 만들어 먹기" },
  { category: "food", title: "디저트 카페 투어" },
  { category: "food", title: "노포·포장마차 가보기" },
  { category: "growth", title: "커플 운동 같이 하기" },
  { category: "growth", title: "함께 책 한 권 읽기" },
  { category: "growth", title: "새로운 취미 같이 배우기" },
  { category: "growth", title: "커플 통장 만들기" },
  { category: "etc", title: "커플 잠옷 맞추기" },
  { category: "etc", title: "서로에게 손편지 쓰기" },
  { category: "etc", title: "함께 봉사활동 해보기" },
  { category: "etc", title: "1주년 특별하게 보내기" },
];

/** 시드에서 무작위 n개 (첫 진입 추천 칩). */
export function sampleSeed(n: number, rnd: () => number = Math.random): typeof BUCKET_SEED {
  const arr = [...BUCKET_SEED];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
}
