import type { Metadata } from "next";
import Icon from "@/components/Icon";
import { BASE } from "@/lib/base";

export const metadata: Metadata = {
  title: "개인정보·데이터 관리 안내 | 하루",
  description: "하루가 저장하는 정보와 내보내기, 기기 초기화, 계정 삭제 방식을 설명합니다.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacy/" },
};

const SECTIONS = [
  {
    title: "저장하는 정보",
    body: [
      "로그인을 위한 이메일 주소와 인증 정보, 커플 연결 정보와 애칭을 저장합니다. 비밀번호 원문은 앱 데이터베이스에 저장하지 않습니다.",
      "사용자가 만든 일정·버킷리스트·사진·일기·오늘 로그·기분·질문 답변·활동 기록·게임 상태와 알림 설정을 저장합니다.",
      "작성 중인 초안, 화면 테마, 서명된 미디어 주소 캐시는 현재 기기의 브라우저 저장소에만 남습니다.",
    ],
  },
  {
    title: "왜 사용하는지",
    body: [
      "두 사람이 같은 기록을 보고 수정하도록 동기화하고, 선택한 일정과 상대 활동을 알려주며, 오류를 진단하기 위해 사용합니다.",
      "도시를 선택한 경우 Open-Meteo에는 해당 도시의 좌표만 전달합니다. 계정 ID·이메일·작성 내용은 날씨 요청에 포함하지 않습니다.",
    ],
  },
  {
    title: "어디에서 처리하는지",
    body: [
      "인증·PostgreSQL 데이터베이스·비공개 미디어·실시간 동기화·서버 함수는 Supabase에서 처리합니다.",
      "정적 앱 파일은 GitHub Pages에서 제공하며, 푸시 알림은 사용 중인 브라우저와 운영체제의 Web Push 전달망을 거칩니다.",
      "개인정보를 판매하지 않으며, 앱 기능 제공에 필요한 위 처리자 외에 임의로 제공하지 않습니다.",
    ],
  },
  {
    title: "보관과 정리",
    body: [
      "기록은 사용자가 직접 지우거나 계정을 삭제하기 전까지 보관됩니다. 오래된 기록을 날짜 제한으로 자동 삭제하지 않습니다.",
      "업로드 도중 연결이 끊겨 데이터베이스 어느 곳에서도 참조하지 않는 미디어는 24시간 보호 기간 뒤 운영자가 다시 확인한 경우에만 정리할 수 있습니다.",
      "더 이상 사용할 수 없는 푸시 구독은 알림 발송 응답을 확인한 뒤 정리합니다.",
    ],
  },
  {
    title: "내보내기·기기 초기화",
    body: [
      "설정 → 데이터에서 현재 계정으로 조회 가능한 기록을 JSON으로 내보낼 수 있고, 사진·일기 사진·로그 영상은 ZIP으로 받을 수 있습니다.",
      "‘이 기기 데이터 초기화’는 이 브라우저의 캐시·초안·화면 설정만 지웁니다. 계정과 서버의 공유 기록은 삭제하지 않습니다.",
    ],
  },
  {
    title: "계정 삭제",
    body: [
      "설정 → 데이터 → 계정 삭제에서 현재 비밀번호로 다시 확인한 뒤 탈퇴할 수 있습니다. 미디어 정리, 데이터베이스 정리, 인증 계정 삭제 순서로 처리합니다.",
      "상대가 남아 있으면 내가 작성한 개인 기록과 내 식별 정보는 지우고, 둘이 함께 관리하던 일정·버킷리스트는 상대가 계속 볼 수 있도록 유지합니다. 혼자 남은 공간이면 그 공유 공간도 함께 삭제합니다.",
      "삭제가 끝나면 로그인할 수 없으며 복구할 수 없습니다. 필요한 기록은 먼저 내보내 주세요.",
    ],
  },
  {
    title: "보안과 문의",
    body: [
      "통신은 HTTPS를 사용하고, 데이터베이스 행 수준 보안과 비공개 Storage 정책으로 연결된 두 사람 또는 작성자만 접근하도록 제한합니다.",
      "문의나 삭제 오류 제보는 GitHub Issues를 이용할 수 있습니다. 공개 게시판이므로 이메일·초대코드·사진·비밀번호 같은 개인정보는 올리지 마세요.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="reading mx-auto min-h-dvh max-w-2xl px-5 pb-16 pt-[calc(env(safe-area-inset-top)+28px)]">
      <a
        href={`${BASE}/`}
        className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full bg-glass px-3 py-2 text-sm font-bold text-rose-deep ring-1 ring-line"
      >
        <Icon name="chevronLeft" size={18} />
        하루로 돌아가기
      </a>

      <header className="mt-7 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-md)] ring-1 ring-line">
        <div className="flex items-center gap-3 text-rose-deep">
          <Icon name="lock" size={30} />
          <p className="text-sm font-bold">DATA &amp; PRIVACY</p>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">개인정보·데이터 관리 안내</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          무엇을 저장하고, 직접 어떻게 가져가거나 지울 수 있는지 제품 동작 기준으로 설명합니다.
        </p>
        <p className="mt-3 text-xs text-muted">시행일 2026년 8월 25일 · 마지막 변경 2026년 8월 25일</p>
      </header>

      <div className="mt-5 space-y-4">
        {SECTIONS.map((section, index) => (
          <section
            key={section.title}
            className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-sm)] ring-1 ring-line"
          >
            <p className="text-xs font-bold text-rose-deep">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-1 text-xl font-extrabold text-ink">{section.title}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              {section.body.map((paragraph) => (
                <li key={paragraph} className="flex gap-2">
                  <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-deep" />
                  <span>{paragraph}</span>
                </li>
              ))}
            </ul>
            {section.title === "보안과 문의" && (
              <a
                href="https://github.com/DoyeonKR/our-days/issues"
                target="_blank"
                rel="noreferrer"
                className="tap mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-glass px-3 py-2.5 text-sm font-bold text-rose-deep ring-1 ring-line"
              >
                GitHub Issues 열기
                <Icon name="chevronRight" size={17} />
              </a>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
