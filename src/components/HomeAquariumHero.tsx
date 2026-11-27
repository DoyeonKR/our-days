"use client";

import { useEffect, useMemo, useState } from "react";
import Aquarium3D from "@/components/Aquarium3D";
import { loadIsland, type IslandRow } from "@/lib/couple";
import { watchIslandStore } from "@/lib/islandstore";
import { syncAqua } from "@/lib/aquarium";
import { aquaLightRec } from "@/lib/aqualight";
import { eventsAt } from "@/lib/aquaevent";
import { eventSaveOf, eventTints } from "@/lib/aquaeventclaim";
import { gameNow } from "@/lib/islandsync";
import { createIsland } from "@/lib/island";

/** 홈 메인 히어로 3D 수조 — HomeExperience 에서 dynamic(..., { ssr: false })로 지연 로드한다(firstload.test 준수). */
export default function HomeAquariumHero({
  coupleId,
  active,
  onOpenFull,
}: {
  coupleId: string | null;
  active: boolean;
  onOpenFull?: () => void;
}) {
  const [row, setRow] = useState<IslandRow | null>(null);
  const [selFish, setSelFish] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void loadIsland(coupleId)
        .then((r) => { if (alive && r) setRow(r); })
        .catch(() => { /* 폴백 기본 수조 */ });
    };
    refresh();
    const stop = watchIslandStore(coupleId, () => refresh());
    return () => { alive = false; stop(); };
  }, [coupleId]);

  const fallback = useMemo(() => createIsland("콩", null, 0), []);
  const st = row?.state ?? fallback;
  const aq = useMemo(() => syncAqua(st, gameNow()).a, [st]);
  const lights = useMemo(() => aquaLightRec(st), [st]);
  const events = useMemo(() => eventsAt(gameNow()), []);
  const tints = useMemo(() => eventTints(eventSaveOf(st), aq.placed), [st, aq.placed]);

  if (!active) {
    return <div className="home-aqua-hero-shell home-scene-v3" aria-label="우리 수조" />;
  }

  return (
    <section className="home-aqua-hero-shell home-scene-v3" aria-label="우리 수조">
      <Aquarium3D
        hero
        onOpenFull={onOpenFull}
        view={{
          aquarium: aq,
          editing: false,
          placing: false,
          selectedFish: selFish,
          selectedDecor: null,
          season: { keys: events.map((e) => e.def.key), tints, clock: gameNow, seed: coupleId ?? "" },
          light: lights.on,
        }}
        onFish={(id) => setSelFish((cur) => (cur === id ? null : id))}
        onDecor={() => {}}
        onPlace={() => {}}
      />
    </section>
  );
}
