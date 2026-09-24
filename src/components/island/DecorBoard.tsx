"use client";

/* 꾸미기 배치판 — 섬을 위에서 내려다본 격자. [2026-09-24]
 *
 * 이웃 조합(49)과 생산 부스트는 **가로·세로로 맞닿았는지**가 전부인데, 풍경(IslandScene)은 원근으로
 * 줄을 눌러 그려서 누가 누구 옆인지 눈으로 알 수 없었다(뒷줄 칸 간격 30 · 앞줄 53 · 줄 사이 13~14).
 * 장식도 16~24px 이라 알아보기도 누르기도 어려웠다. 배치판은 **엔진의 격자를 그대로** 보여 준다 —
 * 48px 장식 · 조합 고리 · 생산 표시 · 놓으면 무엇이 생기는지(✨ 조합 · ⚡ 생산 부스트).
 *
 * ⚠ 누르는 동작은 풍경과 **같은 함수**(onTap)다. 판정도 엔진 것만 읽는다(DECOR_COMBOS · produce.boostBy
 *   · produceStatus) — 배치판이 따로 규칙을 들면 '빛나는 칸에 놓았는데 조합이 안 생기는' 거짓말이 된다.
 */

import { DECOR_COLS, DECOR_ROWS, decorDef, decorRowsOf, goodsOf, produceStatus, type IslandState, type Placed } from "@/lib/island";
import { comboOf, placementHint } from "@/lib/decorhint";
import DecorIcon from "@/components/island/DecorIcon";
import { MicroIcon, MoodGlyph } from "@/components/island/UiIcon";

export default function DecorBoard({
  s,
  now,
  placing,
  movingId,
  selectedId,
  justPlaced,
  onTap,
}: {
  s: IslandState;
  now: number;
  /** 놓으려는(또는 옮기는) 장식 key — 있으면 빈 칸이 열리고 힌트가 뜬다. */
  placing: string | null;
  movingId: string | null;
  selectedId: string | null;
  justPlaced: { x: number; y: number; ts: number } | null;
  onTap: (x: number, y: number, placed: Placed | null) => void;
}) {
  const rows = decorRowsOf(s);
  const byPos = new Map(s.decor.map((d) => [`${d.x},${d.y}`, d]));
  const at = (x: number, y: number): Placed | null => byPos.get(`${x},${y}`) ?? null;
  const prod = new Map(produceStatus(s, now).map((p) => [p.id, p]));
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < DECOR_COLS; x++) cells.push({ x, y });

  return (
    <div className="decor-board">
      <p className="decor-board-edge" aria-hidden>
        ↑ 섬 안쪽
      </p>
      <div className="decor-board-grid" role="grid" aria-label="섬 배치판" style={{ gridTemplateColumns: `repeat(${DECOR_COLS}, minmax(0, 1fr))` }}>
        {cells.map(({ x, y }) => {
          const p = at(x, y);
          const d = p ? decorDef(p.key) : null;
          const ps = p ? prod.get(p.id) : undefined;
          const right = p ? at(x + 1, y) : null;
          const down = p ? at(x, y + 1) : null;
          const linkR = p && right ? comboOf(p.key, right.key) : undefined;
          const linkD = p && down ? comboOf(p.key, down.key) : undefined;
          const hint = !p && placing ? placementHint(s, placing, x, y, movingId) : null;
          const pop = justPlaced && justPlaced.x === x && justPlaced.y === y;
          const label = d
            ? `${d.name}${ps?.ready ? `, ${goodsOf(ps.goods).name} ${ps.ready}개 모을 수 있어요` : ""}`
            : hint
              ? `빈 칸${hint.combos.length ? `, 놓으면 조합 ${hint.combos.map((c) => c.name).join("·")}` : ""}${hint.boost ? ", 생산 2배" : ""}`
              : "빈 칸";
          return (
            <button
              key={`${x}-${y}`}
              role="gridcell"
              onClick={() => onTap(x, y, p)}
              aria-label={`${y + 1}줄 ${x + 1}칸 · ${label}`}
              className={[
                "tap decor-tile",
                y >= DECOR_ROWS ? "is-shore" : "",
                p ? "" : "is-empty",
                placing && !p ? "is-open" : "",
                hint ? "is-hint" : "",
                p && p.id === movingId ? "is-moving" : "",
                p && p.id === selectedId ? "is-selected" : "",
              ].join(" ")}
            >
              {p && d && (
                <span key={pop ? justPlaced!.ts : 0} className={pop ? "decor-tile-pop" : "decor-tile-art"}>
                  <DecorIcon decorKey={p.key} size={48} title={d.name} />
                </span>
              )}
              {!p && placing && !hint && (
                <span className="decor-tile-plus" aria-hidden>
                  +
                </span>
              )}
              {hint && (
                <span className="decor-tile-hint" aria-hidden>
                  {hint.combos.length > 0 && (
                    <b>
                      <MicroIcon k="sparkle" size={12} />
                      {hint.combos.length > 1 ? hint.combos.length : ""}
                    </b>
                  )}
                  {hint.boost && (
                    <b>
                      <MoodGlyph e="⚡" size={16} />
                    </b>
                  )}
                </span>
              )}
              {ps && ps.ready > 0 && (
                <span className="decor-tile-ready" aria-hidden>
                  {goodsOf(ps.goods).emoji}
                  {ps.ready}
                </span>
              )}
              {ps?.boosted && (
                <span className="decor-tile-boost" aria-hidden>
                  <MoodGlyph e="⚡" size={16} />
                </span>
              )}
              {linkR && <span className="decor-link is-h" title={linkR.name} aria-hidden />}
              {linkD && <span className="decor-link is-v" title={linkD.name} aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="decor-board-edge" aria-hidden>
        ↓ 해변 쪽
      </p>
    </div>
  );
}
