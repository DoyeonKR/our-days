// 모험 온라인 대전 — 서버가 판정한다(2026-11-08, 실시간 전투). README §14.6
// 앱은 실시간 아레나를 돌리며 내 입력(이동 · 기술 · 회피 · 교체)만 기록해 판이 끝나면 보낸다. 여기서 저장해 둔 시작 판(시드 포함)으로
// 같은 엔진(replayDuel)을 처음부터 다시 돌려 승패를 정한다 — 앱이 보낸 판 상태 · 결과는 읽지 않는다. 상대는 엔진의 컴퓨터(think)가 조종한다.
// 엔진은 _shared/adventure 의 복사본(scripts/adventure-shared.mjs 가 만든다 — 고치면 다시 만들고 이 함수를 다시 배포한다).
// verify_jwt = true(로그인한 사용자만). 쓰기는 서비스 롤로만 — 세 표 모두 앱이 직접 못 쓴다.
//
// op:
//   register  {ids: string[], nickname}  — 서버에 저장된 모험 기록에서 id 로 대전 팀(최대 3)을 고른다
//   me        {}                          — 내 팀 · 점수
//   opponents {}                          — 점수가 가까운 다른 사람 넷 + 연습 상대 둘
//   start     {opponent: uuid | "bot:N"}  — 판을 만든다(끝내지 않은 판이 있으면 진 것으로 정산하고 새로 — 처음부터 다시 하기를 막는다)
//   finish    {match, log}                — 입력 기록으로 다시 돌려 정산(한 번만 — status 가 active 일 때만 닫는다)
//   forfeit   {match}                     — 기권(진 것으로)
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeSave, type Battle } from "../_shared/adventure/adventure.ts";
import { TPS, replayDuel, validLog } from "../_shared/adventure/arena.ts";
import {
  DAILY_DUELS, K_BOT, K_DEFENDER, K_PLAYER, botTeam, cleanNick, pickTeam, startDuel, teamLevel, teamPower, validTeam,
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

/** 판을 닫고 점수를 정산한다 — 닫기(status active → done)에 성공한 한 번만 정산한다(두 번 보내도 한 번). */
async function finish(admin: Sb, match: { id: string; user_id: string; opponent_id: string | null; bot: boolean }, b: Battle, ticks: number) {
  const win = b.over === "win";
  const { data: closed, error: closeError } = await admin.from("adventure_matches")
    .update({ status: "done", result: win ? "win" : "lose", turn: ticks, finished_at: new Date().toISOString(), state: b })
    .eq("id", match.id).eq("status", "active").select("id");
  if (closeError) throw closeError;
  if (!closed?.length) return null;
  const { data: s, error } = await admin.rpc("adventure_settle", {
    p_user: match.user_id, p_opp: match.bot ? null : match.opponent_id, p_win: win, p_k: match.bot ? K_BOT : K_PLAYER, p_k_def: K_DEFENDER,
  });
  if (error) {
    await admin.from("adventure_matches").update({ status: "active" }).eq("id", match.id);
    throw error;
  }
  await admin.from("adventure_matches").update({ delta: s.delta, opp_delta: s.opp_delta }).eq("id", match.id);
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
      const [team, rating] = await Promise.all([myTeam(admin, uid), myRating(admin, uid)]);
      return json({ team, rating });
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
      // 끝내지 않은 판은 진 것으로 — 이어 하기를 열면 같은 시드로 처음부터 다시 해 볼 수 있다
      const { data: open } = await admin.from("adventure_matches").select("id, user_id, opponent_id, bot, state").eq("user_id", uid).eq("status", "active");
      let abandoned = false;
      for (const m of open ?? []) {
        const b = m.state as Battle;
        b.over = "lose";
        if (await finish(admin, m, b, 0)) abandoned = true;
      }
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
      return json({ match: m.id, battle, opponent: oppName, abandoned });
    }

    if (op === "finish" || op === "forfeit") {
      const { data: m } = await admin.from("adventure_matches").select("id, user_id, opponent_id, bot, state, status, created_at").eq("id", body.match).eq("user_id", uid).maybeSingle();
      if (!m || m.status !== "active") return json({ error: "no match" }, 404);
      const start = m.state as Battle;
      if (op === "forfeit") {
        start.over = "lose";
        const r = await finish(admin, m, start, 0);
        return r ? json(r) : json({ error: "no match" }, 404);
      }
      if (!validLog(body.log)) {
        start.over = "lose";
        const r = await finish(admin, m, start, 0);
        return json({ error: "bad log", ...r }, 422);
      }
      const a = replayDuel(start, body.log);
      // 기록이 실제 걸린 시간보다 길 수 없다(엔진을 빨리 돌려 만든 기록) — 15초 여유
      const elapsed = (Date.now() - new Date(m.created_at).getTime()) / 1000;
      if (a.tick / TPS > elapsed + 15) {
        start.over = "lose";
        const r = await finish(admin, m, start, a.tick);
        return json({ error: "too fast", ...r }, 422);
      }
      // 기록이 끊겨 끝나지 않은 판은 진 것으로(finish 가 over 가 win 일 때만 이긴 것으로 친다)
      const r = await finish(admin, m, a.b, a.tick);
      return r ? json({ ...r, ticks: a.tick }) : json({ error: "no match" }, 404);
    }

    return json({ error: "bad op" }, 400);
  } catch (e) {
    console.error("adventure-battle", e instanceof Error ? e.message : e);
    return json({ error: "internal error" }, 500);
  }
});

