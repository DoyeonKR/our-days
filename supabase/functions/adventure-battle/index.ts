// 모험 온라인 대전 — 서버가 판정한다(2026-11-08, 실시간 전투). README §14.6
// 앱은 실시간 아레나를 돌리며 내 입력(이동 · 기술 · 회피 · 교체)만 기록해 판이 끝나면 보낸다. 여기서 저장해 둔 시작 판(시드 포함)으로
// 같은 엔진(replayDuel)을 처음부터 다시 돌려 승패를 정한다 — 앱이 보낸 판 상태 · 결과는 읽지 않는다. 상대는 엔진의 컴퓨터(think)가 조종한다.
// 엔진은 _shared/adventure 의 복사본(scripts/adventure-shared.mjs 가 만든다 — 고치면 다시 만들고 이 함수를 다시 배포한다).
// verify_jwt = true(로그인한 사용자만). 쓰기는 서비스 롤로만 — 세 표 모두 앱이 직접 못 쓴다.
//
// 대전 지키기(2026-11-09, migration 20261107050000_adventure_guard):
//   · 엔진 지문(ENGINE_HASH) — start 에서 앱 지문이 다르면 409 engine. 판을 연 엔진과 지금 엔진이 다르면(함수를 다시 배포) 그 판은 무효(void)
//   · 상대는 계정 id 가 아니라 팀 행의 public_id 로 주고받는다
//   · 판 하나에 finish 한 번 · 연 지 MATCH_TTL_MIN 분이 지나면 진 것 · 보낸 입력 기록은 판에 남긴다
//   · 같은 상대 하루 세 판(DB 트리거 PT429) · 하루 점수 상승 상한 · 연습 판은 점수 그대로(adventure_settle)
//   · 등록 때 팀이 엔진으로 만들 수 있는 값인지(teamProblem) · 닉네임은 대소문자 무시하고 하나만
//
// op:
//   register   {ids: string[], nickname}  — 서버에 저장된 모험 기록에서 id 로 대전 팀(최대 3)을 고른다
//   unregister {}                          — 내 대전 팀을 내린다(순위판 · 상대 목록에서 빠진다)
//   me         {}                          — 내 팀 · 점수
//   opponents  {}                          — 점수가 가까운 다른 사람 넷(public_id) + 연습 상대 둘
//   start      {opponent, engine}          — 판을 만든다(끝내지 않은 판이 있으면 진 것으로 정산하고 새로 — 처음부터 다시 하기를 막는다)
//   finish     {match, log, engine}        — 입력 기록으로 다시 돌려 정산(한 번만 — status 가 active 일 때만 닫는다)
//   forfeit    {match}                     — 기권(진 것으로)
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeSave, type Battle } from "../_shared/adventure/adventure.ts";
import { TPS, replayDuel, validLog } from "../_shared/adventure/arena.ts";
import {
  DAILY_DUELS, K_BOT, K_DEFENDER, K_PLAYER, MATCH_TTL_MIN, botTeam, cleanNick, pickTeam, startDuel, teamLevel, teamPower, teamProblem, validTeam,
} from "../_shared/adventure/adventurepvp.ts";
import { ENGINE_HASH } from "../_shared/adventure/adventurehash.ts";

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_MS = MATCH_TTL_MIN * 60_000;
// ilike 의 특수 글자를 글자 그대로 — 닉네임 겹침을 대소문자만 무시하고 찾는다
const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

// deno-lint-ignore no-explicit-any
type Sb = any;
type MatchRow = { id: string; user_id: string; opponent_id: string | null; bot: boolean; state: Battle };

async function myTeam(admin: Sb, uid: string) {
  const { data } = await admin.from("adventure_teams").select("nickname, team, power, updated_at").eq("user_id", uid).maybeSingle();
  return data && validTeam(data.team) ? data : null;
}

async function myRating(admin: Sb, uid: string) {
  const { data } = await admin.from("adventure_ratings").select("rating, wins, losses, streak, best, practice_wins, practice_losses").eq("user_id", uid).maybeSingle();
  return data ?? { rating: 1000, wins: 0, losses: 0, streak: 0, best: 1000, practice_wins: 0, practice_losses: 0 };
}

/** 판을 닫고 점수를 정산한다 — 닫기(status active → done)에 성공한 한 번만 정산한다(두 번 보내도 한 번). */
async function finish(admin: Sb, match: MatchRow, b: Battle, ticks: number, log: unknown = null) {
  const win = b.over === "win";
  const { data: closed, error: closeError } = await admin.from("adventure_matches")
    .update({ status: "done", result: win ? "win" : "lose", turn: ticks, finished_at: new Date().toISOString(), state: b, log })
    .eq("id", match.id).eq("status", "active").select("id");
  if (closeError) throw closeError;
  if (!closed?.length) return null;
  // 연습 판은 p_opp null — 점수는 그대로, 연습 전적만(adventure_settle)
  const { data: s, error } = await admin.rpc("adventure_settle", {
    p_user: match.user_id, p_opp: match.bot ? null : match.opponent_id, p_win: win, p_k: match.bot ? K_BOT : K_PLAYER, p_k_def: K_DEFENDER,
  });
  if (error) {
    await admin.from("adventure_matches").update({ status: "active" }).eq("id", match.id);
    throw error;
  }
  await admin.from("adventure_matches").update({ delta: s.delta, opp_delta: s.opp_delta }).eq("id", match.id);
  return { result: win ? "win" : "lose", delta: s.delta as number, rating: s.rating as number, practice: !!s.practice };
}

/** 엔진이 바뀐 뒤(함수 재배포) 남은 판 — 누구 탓도 아니라 무효로 닫는다(점수 없음 · 전적에도 안 보인다) */
async function voidMatch(admin: Sb, id: string) {
  await admin.from("adventure_matches").update({ status: "void", finished_at: new Date().toISOString() }).eq("id", id).eq("status", "active");
}

/** 열어 둔 채 MATCH_TTL_MIN 분이 지난 내 판을 진 것으로(엔진이 바뀐 판은 무효). all 이면 시간과 상관없이 전부. */
async function closeOpen(admin: Sb, uid: string, all: boolean) {
  let q = admin.from("adventure_matches").select("id, user_id, opponent_id, bot, state, engine").eq("user_id", uid).eq("status", "active");
  if (!all) q = q.lt("created_at", new Date(Date.now() - TTL_MS).toISOString());
  const { data: open } = await q;
  let abandoned = false;
  for (const m of open ?? []) {
    if (m.engine !== ENGINE_HASH) {
      await voidMatch(admin, m.id);
      continue;
    }
    const b = m.state as Battle;
    b.over = "lose";
    if (await finish(admin, m, b, 0)) abandoned = true;
  }
  return abandoned;
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
      // 엔진이 만들 수 없는 생물(레벨 50 초과 · 개체값 7 초과 · 뱃지 없이 전설 …)이면 거절 — 고쳐 쓴 기록을 그대로 받지 않게
      const problem = teamProblem(save, ids);
      if (problem) return json({ error: problem }, 422);
      const team = pickTeam(save, ids);
      if (!team.length) return json({ error: "empty team" }, 422);
      // 닉네임은 대소문자를 무시하고 하나만(DB 의 lower(nickname) unique 가 마지막 그물)
      const { data: taken } = await admin.from("adventure_teams").select("user_id").ilike("nickname", likeExact(nickname)).neq("user_id", uid).limit(1);
      if (taken?.length) return json({ error: "nick taken" }, 409);
      const { error } = await admin.from("adventure_teams").upsert({ user_id: uid, nickname, team, power: teamPower(team), updated_at: new Date().toISOString() });
      if (error) {
        if (error.code === "23505") return json({ error: "nick taken" }, 409);
        throw error;
      }
      return json({ team, nickname });
    }

    if (op === "unregister") {
      // 팀 행만 지운다 — 순위판(팀과 join) · 상대 목록에서 빠진다. 점수는 남아 다시 등록하면 이어진다
      const { error } = await admin.from("adventure_teams").delete().eq("user_id", uid);
      if (error) throw error;
      return json({ ok: true });
    }

    if (op === "me") {
      await closeOpen(admin, uid, false);
      const [team, rating] = await Promise.all([myTeam(admin, uid), myRating(admin, uid)]);
      return json({ team, rating });
    }

    if (op === "opponents") {
      const mine = await myTeam(admin, uid);
      if (!mine) return json({ error: "no team" }, 409);
      await closeOpen(admin, uid, false);
      const me = await myRating(admin, uid);
      // 점수가 가까운 순으로 DB 가 고른다(200명이 넘어도 가까운 사람이 나온다 · 오늘 세 번 붙은 사람은 빠진다). 계정 id 는 안 나간다
      const { data, error } = await admin.rpc("adventure_candidates", { p_user: uid, p_rating: me.rating, p_limit: 200 });
      if (error) throw error;
      const people = (data ?? [])
        .filter((t: { team: unknown }) => validTeam(t.team))
        .slice(0, 4)
        .map((t: { public_id: string; nickname: string; rating: number; wins: number; losses: number; team: { species: string; level: number }[] }) => ({
          id: t.public_id, nickname: t.nickname, rating: t.rating, wins: t.wins, losses: t.losses, team: t.team.map((m) => ({ species: m.species, level: m.level })),
        }));
      const lv = teamLevel(mine.team);
      const day = kstDay();
      const bots = [0, 1].map((i) => {
        const b = botTeam(lv, i + (Number(day.slice(-2)) % 3), day);
        return { id: `bot:${i}`, nickname: b.name, rating: null, wins: 0, losses: 0, bot: true, team: b.team.map((m) => ({ species: m.species, level: m.level })) };
      });
      return json({ people, bots });
    }

    if (op === "start") {
      // 앱 엔진이 이 함수의 엔진과 다르면 판정이 갈린다 — 옛 앱(지문 없음)도 여기서 멈춘다
      if (body.engine !== ENGINE_HASH) return json({ error: "engine" }, 409);
      const mine = await myTeam(admin, uid);
      if (!mine) return json({ error: "no team" }, 409);
      // 끝내지 않은 판은 진 것으로 — 이어 하기를 열면 같은 시드로 처음부터 다시 해 볼 수 있다
      const abandoned = await closeOpen(admin, uid, true);
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
        if (!UUID.test(target)) return json({ error: "no opponent" }, 404);
        const { data: opp } = await admin.from("adventure_teams").select("user_id, nickname, team").eq("public_id", target).maybeSingle();
        if (!opp || !validTeam(opp.team)) return json({ error: "no opponent" }, 404);
        if (opp.user_id === uid) return json({ error: "self" }, 422);
        oppTeam = opp.team;
        oppName = opp.nickname;
        oppId = opp.user_id;
      }
      const battle = startDuel(mine.team, oppTeam, seed(), [mine.nickname, oppName]);
      const { data: m, error } = await admin.from("adventure_matches")
        .insert({ user_id: uid, opponent_id: oppId, opponent_name: oppName, bot, state: battle, engine: ENGINE_HASH }).select("id").single();
      if (error) {
        if (error.code === "PT429") return json({ error: "same opponent" }, 429);
        throw error;
      }
      return json({ match: m.id, battle, opponent: oppName, abandoned });
    }

    if (op === "finish" || op === "forfeit") {
      const { data: m } = await admin.from("adventure_matches").select("id, user_id, opponent_id, bot, state, status, created_at, engine").eq("id", body.match).eq("user_id", uid).maybeSingle();
      if (!m || m.status !== "active") return json({ error: "no match" }, 404);
      const start = m.state as Battle;
      // 판을 연 뒤 함수가 다시 배포돼 엔진이 바뀌었다 — 다시 돌린 결과를 믿을 수 없어 무효(앱이 보낸 지문은 판정에 쓰지 않는다)
      if (m.engine !== ENGINE_HASH) {
        await voidMatch(admin, m.id);
        return json({ error: "engine" }, 409);
      }
      if (op === "forfeit") {
        start.over = "lose";
        const r = await finish(admin, m, start, 0);
        return r ? json(r) : json({ error: "no match" }, 404);
      }
      const elapsed = (Date.now() - new Date(m.created_at).getTime()) / 1000;
      // 연 지 오래된 판 — 시드를 받아 밖에서 이기는 입력을 찾을 시간을 주지 않는다
      if (elapsed * 1000 > TTL_MS) {
        start.over = "lose";
        const r = await finish(admin, m, start, 0, validLog(body.log) ? body.log : null);
        return json({ error: "too slow", ...r }, 422);
      }
      if (!validLog(body.log)) {
        start.over = "lose";
        const r = await finish(admin, m, start, 0);
        return json({ error: "bad log", ...r }, 422);
      }
      const a = replayDuel(start, body.log);
      // 기록이 실제 걸린 시간보다 길 수 없다(엔진을 빨리 돌려 만든 기록) — 15초 여유
      if (a.tick / TPS > elapsed + 15) {
        start.over = "lose";
        const r = await finish(admin, m, start, a.tick, body.log);
        return json({ error: "too fast", ...r }, 422);
      }
      // 기록이 끊겨 끝나지 않은 판은 진 것으로(finish 가 over 가 win 일 때만 이긴 것으로 친다)
      const r = await finish(admin, m, a.b, a.tick, body.log);
      return r ? json({ ...r, ticks: a.tick }) : json({ error: "no match" }, 404);
    }

    return json({ error: "bad op" }, 400);
  } catch (e) {
    console.error("adventure-battle", e instanceof Error ? e.message : e);
    return json({ error: "internal error" }, 500);
  }
});
