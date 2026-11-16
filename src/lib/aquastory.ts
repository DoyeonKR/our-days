/** 개체 이야기를 글로(2026-11-13) — 저장된 줄(aqualife)을 화면 문장으로 바꾼다. 저장은 안 바꾼다.
 *  '누가'는 보는 사람 기준이다(나 → 내가 · 상대 → 상대가 · 혼자 하는 섬은 안 적는다). 날짜는 KST. */
import { ALL_FORMS, fishName, type AquaState } from "./aquarium.ts";
import { lifeDays, type LifeEntry, type LifeRef, type Memorial } from "./aqualife.ts";
import { MORPH_INFO } from "./aquamorph.ts";
import { spotOf } from "./fishing.ts";
import { josa } from "./josa.ts";
import { kstDate } from "./kst.ts";

/** 그림 key → 모습 이름(코브라 구피 · 구피 치어 …). 모르는 key 면 '물고기' */
export function formName(key: string): string {
  const f = ALL_FORMS.find((x) => x.key === key);
  return f ? fishName(f) : "물고기";
}
export const storyDate = (t: number, approx?: boolean) => {
  const [, m, d] = kstDate(t).split("-");
  return `${Number(m)}월 ${Number(d)}일${approx ? " 무렵" : ""}`;
};
export type StoryCtx = { who: string; couple: boolean; a: Pick<AquaState, "life"> };
const byWho = (by: string | undefined, c: StoryCtx) => (!by || !c.couple ? "" : by === c.who ? "내가 " : "상대가 ");
/** 다른 물고기를 부르는 이름 — 지어 준 이름(살아 있거나 추모 칸) · 아니면 그때 모습 */
export function refName(r: LifeRef, a: Pick<AquaState, "life">): string {
  return a.life?.names[String(r.id)] || a.life?.memorial.find((m) => m.id === r.id)?.name || formName(r.key);
}
/** '콩이'라고 · '별'이라고 — 받침에 따라 */
const calledAs = (name: string) => `'${name}'${josa(name, "이에요/예요").slice(name.length) === "이에요" ? "이라고" : "라고"}`;

/** 이야기 한 줄 — [날짜, 문장] */
export function storyLine(e: LifeEntry, c: StoryCtx): [string, string] {
  const when = storyDate(e.t, e.a === 1);
  switch (e.k) {
    case "caught": {
      const spot = e.spot ? spotOf(e.spot)?.name : undefined;
      return [when, `${spot ? `${spot}에서 ` : ""}${byWho(e.by, c)}${e.net ? "낚아 대기 그물에 두었다가 수조로 데려왔어요" : "낚아 수조에 데려왔어요"} · ${formName(e.key)}`];
    }
    case "hatched": {
      const parents = (e.p ?? []).map((p) => refName(p, c.a));
      const from = parents.length === 2 ? `${parents[0]} × ${parents[1]}의 알에서` : parents.length === 1 ? `${parents[0]}의 알에서` : "수조의 알에서";
      return [when, `${from} 깨어났어요${e.m ? ` · ${MORPH_INFO[e.m].name} 변이로 태어났어요` : ""}`];
    }
    case "grew": return [when, e.stage === 2 ? `다 자라 ${josa(formName(e.key), "이/가")} 됐어요` : `${josa(formName(e.key), "으로/로")} 자랐어요`];
    case "ate": return [when, `${josa(refName(e.prey, c.a), "을/를")} 잡아먹었어요`];
    case "named": return [when, `${byWho(e.by, c)}${calledAs(e.name)} 이름을 지어 줬어요`];
    case "start": return [when, "이 무렵부터 이야기를 적기 시작했어요"];
  }
}

/** 추모 칸 한 줄 — 까닭 · 함께한 날 */
export function memorialLine(m: Memorial, a: Pick<AquaState, "life">): { name: string; form: string; cause: string; span: string } {
  const cause = m.cause === "eaten" ? `${m.by ? `${refName(m.by, a)}에게 ` : ""}잡아먹혔어요` : m.cause === "released" ? "바다로 보내 줬어요" : "수조를 떠났어요";
  const span = m.from !== undefined ? `${storyDate(m.from)} ~ ${storyDate(m.to, m.a === 1)} · ${lifeDays(m.from, m.to)}일 함께했어요` : `${storyDate(m.to, m.a === 1)}에 떠났어요`;
  return { name: m.name || formName(m.key), form: formName(m.key), cause, span };
}
