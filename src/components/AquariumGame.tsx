"use client";

/* 우리 수조 화면 — 규칙은 전부 lib/aquarium(순수). 여기는 그리기와 저장뿐이다.
 * 저장은 사람이 무언가 했을 때 + 물고기가 자랐을 때만 한다(섬과 같은 행 · 버전 충돌이면 다시 읽어 한 번 더). 매분 다시 그리는 건 저장하지 않는 미리보기다. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { DecorArt, FishArt } from "@/components/AquaArt";
import { Coin } from "@/components/island/UiIcon";
import { asset } from "@/lib/base";
import { confirmDialog } from "@/lib/confirm";
import { TANK_IMAGE_KEYS } from "@/lib/aquaimages";
import {
  ALL_SPECIES, DECOR, FAMILIES, GRADES, TANKS,
  aquaEffects, buyDecor, buyFry, cleanWater, decorBeauty, decorOf, familyOf, feedFish, fishArtKey, fishCare, fishName, fryLockReason, growBlock,
  hoursLeft, moveDecor, openFinals, placeDecor, releaseFish, releaseReward, speciesOf, storeDecor, syncAqua, tankOf, upgradeTank,
  type AquaEvolved, type AquaFish, type AquaResult, type AquaState, type DecorKind, type Grade,
} from "@/lib/aquarium";
import { loadIsland, saveIsland, watchIsland, type IslandRow } from "@/lib/couple";
import type { IslandState } from "@/lib/island";

type Tab = "tank" | "fry" | "decor" | "dex";
const TABS: readonly (readonly [Tab, string])[] = [["tank", "수조"], ["fry", "치어 가게"], ["decor", "악세사리"], ["dex", "도감"]];
const KIND_LABEL: Record<DecorKind, string> = { gear: "장비", plant: "수초", rock: "돌 · 나무", ornament: "장식" };
const EFFECT_LABEL = { clean: "물이 오래 깨끗해요", grow: "더 빨리 자라요", feed: "배고픔이 느려요" } as const;

function duration(h: number): string {
  if (h < 1) return "1시간 안";
  if (h < 48) return `${Math.ceil(h)}시간`;
  return `${Math.ceil(h / 24)}일`;
}
const gradeClass = (g: Grade) => `aqua-grade g-${GRADES.indexOf(g)}`;

export default function AquariumGame({ coupleId, onClose, onOpenIsland }: { coupleId: string | null; onClose: () => void; onOpenIsland: () => void }) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("tank");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selFish, setSelFish] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const [selDecor, setSelDecor] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [grown, setGrown] = useState<AquaEvolved[]>([]);
  const tankRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);

  /** 최신 상태를 읽어 정산 → 동작 → 저장. 충돌이면 다시 읽어 한 번 더. */
  const act = useCallback(async (make?: (st: IslandState, t: number) => AquaResult) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await loadIsland(coupleId).catch(() => null);
        if (!r) {
          setMsg("불러오지 못했어요. 잠시 후 다시 해 주세요.");
          return;
        }
        const t = Date.now();
        const synced = syncAqua(r.state, t);
        const res: AquaResult = make ? make(synced.state, t) : { ok: true, state: synced.state };
        if (!res.ok) {
          setMsg(res.reason);
          setRow(r);
          setNow(t);
          if (synced.evolved.length === 0) return; // 자란 게 없으면 저장할 것도 없다
        }
        try {
          const saved = await saveIsland(coupleId, r.version, res.ok ? res.state : synced.state);
          setRow(saved);
          setNow(t);
          if (synced.evolved.length) setGrown((g) => [...g, ...synced.evolved]);
          if (res.ok) setMsg(res.note ?? null);
          return;
        } catch {
          /* 상대가 그 사이 섬을 바꿨다 — 다시 읽어서 한 번 더 */
        }
      }
      setMsg("저장하지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [coupleId]);

  const load = useCallback(async () => {
    const r = await loadIsland(coupleId).catch(() => null);
    setRow(r);
    setNow(Date.now());
    setLoaded(true);
  }, [coupleId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => watchIsland(coupleId, () => void load()), [coupleId, load]);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const view = useMemo(() => (row && now ? syncAqua(row.state, now) : null), [row, now]);
  // 자란 물고기가 있으면 한 번 저장한다(도감 · 모습이 두 기기에서 같아지게)
  const pendingGrow = view?.evolved.length ?? 0;
  useEffect(() => {
    if (pendingGrow > 0) void act();
  }, [pendingGrow, act]);

  const shell = (children: ReactNode) => (
    <div className="aqua-shell fixed inset-0 z-[90] overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-md pb-10">
        <div className="aqua-head sticky top-0 z-[500] flex items-center gap-2 px-4 py-3">
          <p className="text-base font-extrabold">우리 수조</p>
          {row && <p className="aqua-wallet"><Coin /> {row.state.coins.toLocaleString()}</p>}
          <button type="button" onClick={onClose} className="tap aqua-close">닫기</button>
        </div>
        {children}
      </div>
    </div>
  );

  if (!loaded) return shell(<p className="p-6 text-center text-sm">불러오는 중…</p>);
  if (!row || !view) {
    return shell(
      <div className="p-6 text-center">
        <p className="text-sm">수조는 섬 하트로 꾸며요. 먼저 섬을 시작해 주세요.</p>
        <button type="button" className="tap aqua-btn is-main mt-4" onClick={onOpenIsland}>우리 섬으로 가기</button>
      </div>,
    );
  }

  const a = view.a;
  const coins = view.state.coins;
  const tk = tankOf(a);
  const fx = aquaEffects(a);
  const block = a.fish.length ? growBlock(a) : null;
  const sel = a.fish.find((f) => f.id === selFish) ?? null;
  const decorSel = a.placed.find((p) => p.id === selDecor) ?? null;
  const bagList = Object.entries(a.bag).filter(([, n]) => n > 0);
  const nextTank = TANKS[a.tank];
  const murk = Math.max(0, Math.min(0.55, (60 - a.water) / 100));
  const tankKey = `tank_${a.tank}`;

  function onTankTap(e: MouseEvent<HTMLDivElement>) {
    if (!editing || (!placing && !(moving && selDecor))) return;
    const box = tankRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    if (moving && selDecor) {
      const id = selDecor;
      setMoving(false);
      setSelDecor(null);
      void act((st, t) => moveDecor(st, id, x, y, t));
    } else if (placing) {
      const key = placing;
      if ((a.bag[key] ?? 0) <= 1) setPlacing(null);
      void act((st, t) => placeDecor(st, key, x, y, t));
    }
  }

  async function release(f: AquaFish) {
    const reward = releaseReward(f);
    const ok = await confirmDialog({
      message: `${fishName(f)} — 보내 줄까요?`,
      detail: f.stage === 2 ? `하트 ${reward.toLocaleString()}개를 돌려받아요. 도감 기록은 남아요.` : "다 크기 전에 보내면 하트를 돌려받지 못해요.",
      confirmText: "보내 주기",
      danger: f.stage !== 2,
    });
    if (!ok) return;
    setSelFish(null);
    void act((st, t) => releaseFish(st, f.id, t));
  }

  return shell(
    <div className="px-4">
      <div className="aqua-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tap ${tab === k ? "is-on" : ""}`} onClick={() => { setTab(k); setMsg(null); }}>{label}</button>
        ))}
      </div>
      {msg && <p className="aqua-msg" aria-live="polite">{msg}</p>}

      {tab === "tank" && (
        <>
          <div
            ref={tankRef}
            className={`aqua-tank ${editing ? "is-editing" : ""}`}
            style={{ "--murk": murk, ...(TANK_IMAGE_KEYS.has(tankKey) ? { backgroundImage: `url(${asset(`/aqua/tank/${tankKey}.webp`)})` } : {}) } as CSSProperties}
            onClick={onTankTap}
          >
            {a.placed.slice().sort((p, q) => p.y - q.y).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`aqua-placed ${selDecor === p.id ? "is-sel" : ""}`}
                style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: Math.round(p.y) }}
                disabled={!editing}
                aria-label={decorOf(p.key)?.name}
                onClick={(e) => {
                  if (!editing || placing || moving) return;
                  e.stopPropagation();
                  setSelDecor(p.id);
                }}
              >
                <DecorArt artKey={p.key} />
              </button>
            ))}
            {a.fish.map((f, i) => {
              const fam = familyOf(f.family);
              const size = (fam?.size ?? 16) * (f.stage === 2 ? 1 : f.stage === 1 ? 0.65 : 0.4);
              const dur = 13 + ((f.id * 7) % 12);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`aqua-fish ${selFish === f.id ? "is-sel" : ""}`}
                  style={{ top: `${12 + ((f.id * 37) % 66)}%`, zIndex: 200 + i, "--w": `${size}cqw`, "--t": `${dur}s`, "--d": `-${(f.id * 5) % dur}s` } as CSSProperties}
                  aria-label={fishName(f)}
                  disabled={editing}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelFish(selFish === f.id ? null : f.id);
                  }}
                >
                  <span className="aqua-fish-flip"><span className="aqua-fish-bob"><FishArt artKey={fishArtKey(f)} /></span></span>
                </button>
              );
            })}
            <i className="aqua-murk" aria-hidden />
            {Array.from({ length: 8 }, (_, k) => (
              <b key={k} className="aqua-bubble" aria-hidden style={{ "--x": `${(k * 29 + 9) % 96}%`, "--d": `-${k * 1.3}s`, "--t": `${5 + (k % 4)}s`, "--s": `${4 + (k % 3) * 3}px` } as CSSProperties} />
            ))}
            {a.fish.length === 0 && !editing && <p className="aqua-empty">아직 물고기가 없어요<br />치어 가게에서 첫 물고기를 데려와요</p>}
            {editing && (placing || moving) && <p className="aqua-hint">놓을 자리를 눌러 주세요</p>}
          </div>

          <div className="aqua-meters">
            <Meter label="배고픔" value={a.hunger} />
            <Meter label="물 상태" value={a.water} />
          </div>
          {block && <p className="aqua-warn">{block}</p>}
          <div className="aqua-actions">
            <button type="button" className="tap aqua-btn is-main" disabled={busy} onClick={() => void act((st, t) => feedFish(st, t))}>먹이 주기</button>
            <button type="button" className="tap aqua-btn" disabled={busy} onClick={() => void act((st, t) => cleanWater(st, t))}>물 갈기</button>
            <button
              type="button"
              className={`tap aqua-btn ${editing ? "is-on" : ""}`}
              onClick={() => {
                setEditing(!editing);
                setPlacing(null);
                setSelDecor(null);
                setMoving(false);
                setSelFish(null);
              }}
            >
              {editing ? "꾸미기 끝" : "꾸미기"}
            </button>
          </div>

          {editing && (
            <section className="aqua-card">
              <header><strong>꾸미기</strong><small>놓은 것 {a.placed.length}/{tk.decor}</small></header>
              {decorSel && !moving ? (
                <div className="aqua-row">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{decorOf(decorSel.key)?.name}</span>
                  <button type="button" className="tap aqua-btn" onClick={() => setMoving(true)}>옮기기</button>
                  <button
                    type="button"
                    className="tap aqua-btn"
                    onClick={() => {
                      const id = decorSel.id;
                      setSelDecor(null);
                      void act((st, t) => storeDecor(st, id, t));
                    }}
                  >
                    보관함으로
                  </button>
                </div>
              ) : bagList.length === 0 ? (
                <p className="aqua-note">보관함이 비었어요. 악세사리 칸에서 사 오거나, 놓인 것을 눌러 옮겨 보세요.</p>
              ) : (
                <div className="aqua-bag">
                  {bagList.map(([k, n]) => (
                    <button
                      key={k}
                      type="button"
                      className={`tap ${placing === k ? "is-on" : ""}`}
                      aria-label={decorOf(k)?.name}
                      onClick={() => {
                        setPlacing(placing === k ? null : k);
                        setSelDecor(null);
                      }}
                    >
                      <span className="aqua-bag-pic"><DecorArt artKey={k} /></span>
                      <small>{decorOf(k)?.name}{n > 1 ? ` ×${n}` : ""}</small>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {sel && !editing && <FishCard f={sel} a={a} onRelease={() => void release(sel)} />}

          <section className="aqua-card">
            <header><strong>{tk.name}</strong><small>물고기 {a.fish.length}/{tk.fish} · 악세사리 {a.placed.length}/{tk.decor}</small></header>
            <p className="aqua-note">
              아름다움 {fx.beauty}{fx.beautyGrow > 0 ? ` · 성장 +${Math.round(fx.beautyGrow * 100)}%` : ""} · 먹이 한 번에 {Math.round(fx.hungerHours)}시간 · 물 한 번에 {Math.round(fx.waterHours)}시간
            </p>
            {nextTank ? (
              <button type="button" className="tap aqua-btn is-wide" disabled={busy || coins < nextTank.price} onClick={() => void act((st, t) => upgradeTank(st, t))}>
                수조 넓히기 · {nextTank.name} <span className="aqua-price"><Coin /> {nextTank.price.toLocaleString()}</span>
              </button>
            ) : <p className="aqua-note">가장 큰 수조예요.</p>}
          </section>

          {a.fish.length > 0 && (
            <section className="aqua-card">
              <header><strong>우리 물고기</strong></header>
              <ul className="aqua-list">
                {a.fish.map((f) => {
                  const sp = speciesOf(f.species);
                  return (
                    <li key={f.id}>
                      <button type="button" className={`tap ${selFish === f.id ? "is-on" : ""}`} onClick={() => setSelFish(selFish === f.id ? null : f.id)}>
                        <span className="aqua-thumb"><FishArt artKey={fishArtKey(f)} /></span>
                        <span className="min-w-0 flex-1 truncate font-bold">{fishName(f)}</span>
                        {f.stage === 2 && sp ? <span className={gradeClass(sp.grade)}>{sp.grade}</span> : <small>{duration(hoursLeft(a, f))} 남음</small>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === "fry" && (
        <ul className="aqua-shop">
          {FAMILIES.map((fam) => {
            const lock = fryLockReason(a, fam);
            return (
              <li key={fam.key} className={lock ? "is-locked" : ""}>
                <span className="aqua-shop-pic"><FishArt artKey={`fry_${fam.key}`} /></span>
                <span className="min-w-0 flex-1">
                  <strong>{fam.name} 치어</strong>
                  <small>다 크는 데 {duration(fam.hours)} · {fam.finals[0].grade}~{fam.finals[3].grade}</small>
                  {lock && <small className="aqua-lock">{lock}</small>}
                </span>
                <button type="button" className="tap aqua-btn" disabled={busy || !!lock || a.fish.length >= tk.fish || coins < fam.price} onClick={() => void act((st, t) => buyFry(st, fam.key, t))}>
                  <span className="aqua-price"><Coin /> {fam.price.toLocaleString()}</span>
                </button>
              </li>
            );
          })}
          <li className="aqua-foot">잘 돌볼수록 높은 형태까지 열리고, 아직 못 만난 형태가 먼저 나와요.</li>
        </ul>
      )}

      {tab === "decor" && (["gear", "plant", "rock", "ornament"] as const).map((kind) => (
        <section key={kind} className="aqua-card">
          <header><strong>{KIND_LABEL[kind]}</strong>{kind === "gear" && <small>종류마다 가장 좋은 하나만 들어요</small>}</header>
          <ul className="aqua-shop is-flat">
            {DECOR.filter((x) => x.kind === kind).map((x) => (
              <li key={x.key}>
                <span className="aqua-shop-pic"><DecorArt artKey={x.key} /></span>
                <span className="min-w-0 flex-1">
                  <strong>{x.name}</strong>
                  <small>
                    {x.effect ? `${EFFECT_LABEL[x.effect.type]} +${Math.round(x.effect.amount * 100)}%` : `아름다움 +${decorBeauty(x)}`}
                    {(a.bag[x.key] ?? 0) > 0 ? ` · 보관 ${a.bag[x.key]}` : ""}
                  </small>
                </span>
                <button type="button" className="tap aqua-btn" disabled={busy || coins < x.price} onClick={() => void act((st, t) => buyDecor(st, x.key, t))}>
                  <span className="aqua-price"><Coin /> {x.price.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {tab === "dex" && (
        <>
          <p className="aqua-note mt-3">만난 물고기 {a.dex.length}/{ALL_SPECIES.length}</p>
          {FAMILIES.map((fam) => (
            <section key={fam.key} className="aqua-card">
              <header><strong>{fam.name}</strong></header>
              <div className="aqua-dex">
                {fam.finals.map((sp) => {
                  const seen = a.dex.includes(sp.key);
                  return (
                    <div key={sp.key} className={seen ? "" : "is-hidden"}>
                      <span className="aqua-dex-pic">{seen ? <FishArt artKey={sp.key} /> : <b aria-hidden>?</b>}</span>
                      <small>{seen ? sp.name : "???"}</small>
                      <span className={gradeClass(sp.grade)}>{sp.grade}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      {grown[0] && <GrownCard g={grown[0]} onNext={() => setGrown((x) => x.slice(1))} />}
    </div>,
  );
}

function GrownCard({ g, onNext }: { g: AquaEvolved; onNext: () => void }) {
  const look = { family: g.family, stage: g.stage, species: g.species };
  const sp = speciesOf(g.species);
  return (
    <div className="aqua-grown" role="dialog" aria-modal="true" aria-label="물고기가 자랐어요">
      <div>
        <p className="aqua-grown-kicker">{g.stage === 2 ? "최종 형태!" : "쑥쑥 자랐어요"}</p>
        <span className="aqua-grown-pic"><FishArt artKey={fishArtKey(look)} /></span>
        <strong>{fishName(look)}</strong>
        {sp && <span className={gradeClass(sp.grade)}>{sp.grade}</span>}
        <button type="button" className="tap aqua-btn is-main is-wide" autoFocus onClick={onNext}>확인</button>
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.round(value);
  return (
    <div className="aqua-meter">
      <span>{label}</span>
      <i aria-hidden><b className={v < 30 ? "is-low" : ""} style={{ width: `${v}%` }} /></i>
      <em>{v}</em>
    </div>
  );
}

function FishCard({ f, a, onRelease }: { f: AquaFish; a: AquaState; onRelease: () => void }) {
  const fam = familyOf(f.family);
  const cq = fishCare(f);
  const sp = speciesOf(f.species);
  const pct = fam ? Math.min(100, Math.round((f.growH / fam.hours) * 100)) : 0;
  return (
    <section className="aqua-card">
      <div className="aqua-row">
        <span className="aqua-thumb is-big"><FishArt artKey={fishArtKey(f)} /></span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{fishName(f)}</strong>
          {f.stage === 2 && sp ? <span className={gradeClass(sp.grade)}>{sp.grade}</span> : <small className="aqua-note">성장 {pct}% · {duration(hoursLeft(a, f))} 남음 · 정성 {cq}</small>}
        </span>
        <button type="button" className="tap aqua-btn" onClick={onRelease}>보내 주기</button>
      </div>
      {f.stage !== 2 && <p className="aqua-note mt-2">지금 정성이면 최종 형태 {openFinals(cq)}/4 까지 열려요. 하루 두 번 먹이를 주고 물을 깨끗하게 하면 정성이 올라요.</p>}
    </section>
  );
}
