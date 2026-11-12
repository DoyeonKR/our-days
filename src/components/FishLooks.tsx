"use client";
/** 장비 꾸미기 · 강화(2026-11-12) — '장비' 탭 아래 칸의 한 갈래. 규칙은 lib/fishlooks, 그리기는 lib/fishingfx(paintBobber — 상점의 찌가 낚시터의 찌다).
 *  [사용자: "찌 · 낚싯줄 색 · 낚싯대 스킨을 하트로 사고, 낚싯대에 별 강화와 세트 효과를 붙입니다"]
 *  - 꾸미기는 섬 하트로 사서 커플이 같이 갖고, 끼는 건 이 폰의 사람만(who). 저장 · 실패 문구는 부모 act 가 맡는다(모자란 하트 등).
 *  - 미리보기는 그림 파일 없이 그린다 — 찌는 작은 캔버스 한 장(고를 때만 다시 그린다), 줄 · 낚싯대 색은 CSS 색 띠. */
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/AppButtons";
import type { FishTabProps } from "@/components/FishCollect";
import { Coin } from "@/components/island/UiIcon";
import { NETS, RODS } from "@/lib/fishing";
import { paintBobber } from "@/lib/fishingfx";
import { LOOKS, LOOK_KINDS, LOOK_KIND_NAME, STAR_MAX, buyLook, enhanceRod, looksOf, ownsLook, setBonus, starBonus, starCost, starsOf, wearLook, wornLooks, type FishLook, type LookKind } from "@/lib/fishlooks";

/** 찌 미리보기 — 48px 캔버스 한 장. 기기 화소비만큼 크게 그려 흐리지 않게 */
function BobberPic({ skin }: { skin: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const c = el?.getContext("2d");
    if (!el || !c) return;
    const px = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), size = 48;
    el.width = size * px;
    el.height = size * px;
    c.setTransform(px, 0, 0, px, 0, 0);
    c.clearRect(0, 0, size, size);
    // 물 한 줄 — 찌가 떠 있는 모습으로
    c.fillStyle = "rgba(125,211,252,.28)";
    c.fillRect(0, 34, size, size - 34);
    paintBobber(c, skin, size / 2, 34, 1.75, (_k, make) => make());
  }, [skin]);
  return <canvas ref={ref} className="fish-look-bobber" aria-hidden />;
}

function LookPic({ look }: { look: FishLook }) {
  if (look.kind === "bobber") return <BobberPic skin={look.id} />;
  if (look.kind === "line") return <span className="fish-look-line" aria-hidden style={{ color: look.color }}><svg viewBox="0 0 48 48"><path d="M6 8 C 20 30, 30 34, 42 40" /></svg></span>;
  return <span className={`fish-look-rod ${look.color ? "" : "is-plain"}`} aria-hidden style={look.color ? { background: `linear-gradient(115deg, #2b2116 0 22%, ${look.color} 22% 100%)` } : undefined} />;
}

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(STAR_MAX - n);
}

export default function FishLooks(p: FishTabProps) {
  const [kind, setKind] = useState<LookKind>("bobber");
  const rec = looksOf(p.st);
  const worn = wornLooks(p.st, p.who);
  const rod = RODS[p.fs.rod];
  const now = starsOf(p.st, rod.key);
  const bonus = starBonus(now), nextBonus = starBonus(now + 1);
  const cost = now < STAR_MAX ? starCost(p.fs.rod, now + 1) : 0;
  const set = setBonus(p.fs);
  const gain = nextBonus.power - bonus.power > 0 ? `힘 +${nextBonus.power - bonus.power}${nextBonus.line > bonus.line ? ` · 줄 다루기 +${nextBonus.line - bonus.line}` : ""}` : "";

  return (
    <>
      <section className="aqua-card fish-looks">
        <header><strong>장비 꾸미기</strong><small>모습만 바뀌어요 · 산 건 둘이 같이, 끼는 건 각자</small></header>
        {kind === "bobber" && <p className="aqua-note">찌는 찌낚시에서 보여요 · 뜰채 낚시엔 낚싯대도 안 보여요</p>}
        <div className="fish-look-tabs" role="tablist" aria-label="꾸밀 곳">
          {LOOK_KINDS.map((k) => (
            <ActionButton key={k} role="tab" aria-selected={kind === k} on={kind === k} onClick={() => setKind(k)}>{LOOK_KIND_NAME[k]}</ActionButton>
          ))}
        </div>
        <ul className="aqua-shop is-flat">
          {LOOKS.filter((x) => x.kind === kind).map((x) => {
            const own = ownsLook(rec, x.id), on = worn[x.kind].id === x.id;
            return (
              <li key={x.id}>
                <span className="aqua-shop-pic fish-look-pic"><LookPic look={x} /></span>
                <span className="min-w-0 flex-1">
                  <strong>{x.name}</strong>
                  <small>{x.desc}</small>
                </span>
                {on ? (
                  <ActionButton on disabled>끼는 중</ActionButton>
                ) : own ? (
                  <ActionButton disabled={p.busy} onClick={() => void p.act((s) => wearLook(s, p.who, x.id))}>끼기</ActionButton>
                ) : (
                  <ActionButton disabled={p.busy || p.st.coins < x.price} aria-label={`${x.name} ${x.price.toLocaleString()}하트에 사기`} onClick={() => void p.act((s) => buyLook(s, p.who, x.id))}>
                    <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
                  </ActionButton>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="aqua-card fish-enhance">
        <header><strong>낚싯대 강화</strong><small>별은 그 낚싯대에 남아요 · 새 낚싯대는 별 0개부터</small></header>
        <div className="fish-enhance-row">
          <span className="min-w-0 flex-1">
            <strong>{rod.name} <b className="fish-enhance-stars" aria-label={`별 ${now}개`}>{stars(now)}</b></strong>
            <small>{now > 0 ? `지금 힘 +${bonus.power}${bonus.line ? ` · 줄 다루기 +${bonus.line}` : ""}` : "아직 강화하지 않았어요"}{now < STAR_MAX ? ` · 다음 별 ${gain}` : " · 별을 다 채웠어요"}</small>
          </span>
          {now < STAR_MAX && (
            <ActionButton disabled={p.busy || p.st.coins < cost} aria-label={`별 ${now + 1}개로 강화 ${cost.toLocaleString()}하트`} onClick={() => void p.act((s) => enhanceRod(s, rod.key, now + 1))}>
              <span className="aqua-price"><Coin /> {cost.toLocaleString()}</span>
            </ActionButton>
          )}
        </div>
        <p className="aqua-note mt-2">
          세트 효과 — {set.catch > 0 ? `낚싯대 · 뜰채 둘 다 ${set.tier + 1}단계 이상: 포획 +${set.catch}` : "아직 없어요"}
          {set.next ? ` · 둘 다 ${set.next.from + 1}단계(${RODS[set.next.from].name} · ${NETS[set.next.from].name}) 이상이면 포획 +${set.next.catch}` : ""}
        </p>
      </section>
    </>
  );
}
