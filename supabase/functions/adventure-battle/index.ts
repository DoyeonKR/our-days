// 모험 온라인 대전 — 서버가 판을 돌린다(2026-11-08). README §14.6
// 앱은 행동(기술 · 교체)만 보내고, 판 상태 · 난수 · 피해 계산은 여기서만 한다. 상대 쪽은 등록된 대전 팀을 엔진의 aiPick 이 조종한다.
// 엔진은 _shared/adventure 의 복사본(scripts/adventure-shared.mjs 가 만든다 — 고치면 다시 만들고 이 함수를 다시 배포한다).
// verify_jwt = true(로그인한 사용자만). 쓰기는 서비스 롤로만 — 세 표 모두 앱이 직접 못 쓴다.
//
// op:
//   register  {ids: string[], nickname}  — 서버에 저장된 모험 기록에서 id 로 대전 팀(최대 3)을 고른다
//   me        {}                          — 내 팀 · 점수 · 진행 중인 판
//   opponents {}                          — 점수가 가까운 다른 사람 넷 + 연습 상대 둘
//   start     {opponent: uuid | "bot:N"}  — 판을 만든다(진행 중인 판이 있으면 그것을 돌려준다)
//   act       {match, turn, action}       — 한 턴. turn 은 앱이 본 판의 턴(두 번 눌러도 한 번만 돈다)
//   forfeit   {match}                     — 기권(진 것으로)
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeSave, playTurn, type Battle } from "../_shared/adventure/adventure.ts";
import {
  DAILY_DUELS, DUEL_TURN_LIMIT, K_BOT, K_DEFENDER, K_PLAYER, botTeam, cleanNick, duelAction, hpShare, pickTeam, startDuel, teamLevel, teamPower, validTeam,
} from "../_shared/adventure/adventurepvp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const seed = () => crypto.getRandomValues(new Int32Array(1))[0];

// deno-lint-ignore no-explicit-any
type Sb = any;

async function myTeam(admin: Sb, uid: string) {
  const { data } = await admin.from("adventure_teams").select("nickname, team, power, updated_at").eq("user_id", uid).maybeSingle();
  return data && validTeam(data.team) ? data : null;
}

async function myRating(admin: Sb, uid: string) {
  const { data } = await admin.from("adventure_ratings").select("rating, wins, losses, streak, best").eq("user_id", uid).maybeSingle();
  return data ?? { rating: 1000, wins: 0, losses: 0, streak: 0, best: 1000 };
}

/** 판이 끝났으면 점수를 정산하고 기록을 닫는다 */
async function finish(admin: Sb, match: { id: string; user_id: string; opponent_id: string | null; bot: boolean }, b: Battle) {
  let win = b.over === "win";
  if (!b.over) win = hpShare(b, 0) > hpShare(b, 1); // 턴 제한
  const { data: s, error } = await admin.rpc("adventure_settle", {
    p_user: match.user_id, p_opp: match.bot ? null : match.opponent_id, p_win: win, p_k: match.bot ? K_BOT : K_PLAYER, p_k_def: K_DEFENDER,
  });
  if (error) throw error;
  await admin.from("adventure_matches").update({
    status: "done", result: win ? "win" : "lose", delta: s.delta, opp_delta: s.opp_delta, finished_at: new Date().toISOString(), state: b,
  }).eq("id", match.id);
  return { result: win ? "win" : "lose", delta: s.delta as number, rating: s.rating as number };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !auth.user) return json({ error: "invalid auth" }, 401);
    const uid = auth.user.id;
    const body = await req.json().catch(() => ({}));
    const op = body?.op;

    if (op === "register") {
      const nickname = cleanNick(body.nickname);
      if (!nickname) return json({ error: "nickname" }, 422);
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 6) : [];
      const { data: row } = await admin.from("adventure_saves").select("state").eq("user_id", uid).maybeSingle();
      const save = row ? normalizeSave(row.state) : null;
      if (!save) return json({ error: "no save" }, 409);
      const team = pickTeam(save, ids);
      if (!team.length) return json({ error: "empty team" }, 422);
      const { error } = await admin.from("adventure_teams").upsert({ user_id: uid, nickname, team, power: teamPower(team), updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ team, nickname });
    }

    if (op === "me") {
      const [team, rating, active] = await Promise.all([
        myTeam(admin, uid),
        myRating(admin, uid),
        admin.from("adventure_matches").select("id, opponent_name, state, turn").eq("user_id", uid).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return json({ team, rating, active: active.data ?? null });
    }

    if (op === "opponents") {
      const mine = await myTeam(admin, uid);
      if (!mine) return json({ error: "no team" }, 409);
      const me = await myRating(admin, uid);
      const { data } = await admin.from("adventure_teams").select("user_id, nickname, team, power").neq("user_id", uid).limit(200);
      const ids = (data ?? []).map((t: { user_id: string }) => t.user_id);
      const { data: rs } = ids.length ? await admin.from("adventure_ratings").select("user_id, rating, wins, losses").in("user_id", ids) : { data: [] };
      const rmap = new Map((rs ?? []).map((r: { user_id: string }) => [r.user_id, r]));
      const people = (data ?? [])
        .filter((t: { team: unknown }) => validTeam(t.team))
        .map((t: { user_id: string; nickname: string; team: { species: string; level: number }[] }) => {
          const r = (rmap.get(t.user_id) ?? { rating: 1000, wins: 0, losses: 0 }) as { rating: number; wins: number; losses: number };
          return { id: t.user_id, nickname: t.nickname, rating: r.rating, wins: r.wins, losses: r.losses, team: t.team.map((m) => ({ species: m.species, level: m.level })) };
        })
        .sort((a: { rating: number }, b: { rating: number }) => Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating))
        .slice(0, 4);
      const lv = teamLevel(mine.team);
      const day = kstDay();
      const bots = [0, 1].map((i) => {
        const b = botTeam(lv, i + (Number(day.slice(-2)) % 3), day);
        return { id: `bot:${i}`, nickname: b.name, rating: null, wins: 0, losses: 0, bot: true, team: b.team.map((m) => ({ species: m.species, level: m.level })) };
      });
      return json({ people, bots });
    }

    if (op === "start") {
      const mine = await myTeam(admin, uid);
      if (!mine) return json({ error: "no team" }, 409);
      const { data: active } = await admin.from("adventure_matches").select("id, opponent_name, state, turn").eq("user_id", uid).eq("status", "active").limit(1).maybeSingle();
      if (active) return json({ match: active.id, battle: active.state, turn: active.turn, opponent: active.opponent_name, resumed: true });
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count } = await admin.from("adventure_matches").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since);
      if ((count ?? 0) >= DAILY_DUELS) return json({ error: "daily limit" }, 429);
      const target = String(body.opponent ?? "");
      let oppTeam;
      let oppName: string;
      let oppId: string | null = null;
      let bot = false;
      if (target.startsWith("bot:")) {
        const i = Number(target.slice(4)) || 0;
        const day = kstDay();
        const b = botTeam(teamLevel(mine.team), i + (Number(day.slice(-2)) % 3), day);
        oppTeam = b.team;
        oppName = b.name;
        bot = true;
      } else {
        if (target === uid) return json({ error: "self" }, 422);
        const opp = await myTeam(admin, target);
        if (!opp) return json({ error: "no opponent" }, 404);
        oppTeam = opp.team;
        oppName = opp.nickname;
        oppId = target;
      }
      const battle = startDuel(mine.team, oppTeam, seed(), [mine.nickname, oppName]);
      const { data: m, error } = await admin.from("adventure_matches").insert({ user_id: uid, opponent_id: oppId, opponent_name: oppName, bot, state: battle }).select("id").single();
      if (error) throw error;
      return json({ match: m.id, battle, turn: 0, opponent: oppName });
    }

    if (op === "act" || op === "forfeit") {
      const { data: m } = await admin.from("adventure_matches").select("id, user_id, opponent_id, bot, state, turn, status").eq("id", body.match).eq("user_id", uid).maybeSingle();
      if (!m || m.status !== "active") return json({ error: "no match" }, 404);
      const b = m.state as Battle;
      if (op === "forfeit") {
        b.over = "lose";
        const r = await finish(admin, m, b);
        return json({ battle: b, events: [{ t: "text", s: "기권했다…" }, { t: "end", result: "lose" }], ...r });
      }
      if (Number(body.turn) !== m.turn) return json({ error: "stale", battle: b, turn: m.turn }, 409);
      const action = duelAction(body.action);
      if (!action) return json({ error: "bad action" }, 422);
      const out = playTurn(b, action);
      if (!out.events.length) return json({ error: "illegal" }, 422);
      const nb = out.battle;
      const next = m.turn + 1;
      const { data: upd, error } = await admin.from("adventure_matches").update({ state: nb, turn: next }).eq("id", m.id).eq("turn", m.turn).select("id");
      if (error) throw error;
      if (!upd?.length) return json({ error: "stale" }, 409);
      if (nb.over || nb.turn >= DUEL_TURN_LIMIT) {
        const r = await finish(admin, m, nb);
        return json({ battle: nb, events: out.events, turn: next, ...r });
      }
      return json({ battle: nb, events: out.events, turn: next });
    }

    return json({ error: "bad op" }, 400);
  } catch (e) {
    console.error("adventure-battle", e instanceof Error ? e.message : e);
    return json({ error: "internal error" }, 500);
  }
});

