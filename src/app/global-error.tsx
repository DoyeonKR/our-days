"use client";

// 루트 레이아웃까지 크래시한 최후의 안전망(자체 <html><body> 렌더, globals.css 미적용 → 인라인).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff5f8",
          color: "#2c2027",
        }}
      >
        <div style={{ fontSize: "44px" }}>💔</div>
        <div>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
            잠깐 문제가 생겼어요
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#756069" }}>
            앱을 새로고침해 주세요.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: "16px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg,#ff5f97,#e5407a)",
            }}
          >
            다시 시도
          </button>
          <button
            onClick={() => location.reload()}
            style={{
              borderRadius: "16px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#756069",
              background: "#fff",
              border: "1px solid rgba(229,64,122,0.2)",
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  );
}
