/* 모험 저장 — 서버(adventure_saves, 사람마다 한 행) + 이 기기 사본.
 * 서버가 정본이다. 이 기기 사본은 끊겼을 때 · 표가 아직 없을 때(migration 적용 전 1분) 이어서 하려고 둔다.
 * 쓰기는 adventure_save RPC 하나 — 버전이 안 맞으면 PT409(다른 기기가 먼저 썼다) → 서버 것을 다시 읽는다. */
import { getSupabase } from "@/lib/supabase";
import { normalizeSave, type AdvSave } from "@/lib/adventure";

export type Stored = { save: AdvSave; version: number };

const key = (uid: string) => `ourdays:adventure:v1:${uid}`;

function readLocal(uid: string): Stored | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) ?? "null");
    const save = normalizeSave(raw?.save);
    return save ? { save, version: Number(raw.version) || 0 } : null;
  } catch {
    return null;
  }
}
function writeLocal(uid: string, s: Stored) {
  try {
    localStorage.setItem(key(uid), JSON.stringify(s));
  } catch {
    /* 저장이 막힌 기기 — 서버 저장만 */
  }
}

const missingTable = (e: { code?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202");

/** 처음 읽기. 서버에 없고 이 기기에 있으면 올린다. 둘 다 없으면 null(시작 생물 고르기). */
export async function loadAdventure(uid: string): Promise<Stored | null> {
  const local = readLocal(uid);
  const sb = getSupabase();
  if (!sb) return local;
  const { data, error } = await sb.from("adventure_saves").select("state, version").eq("user_id", uid).maybeSingle();
  if (error) {
    if (missingTable(error) || local) return local;
    throw new Error(error.message);
  }
  if (data) {
    const save = normalizeSave(data.state);
    if (save) {
      const s = { save, version: data.version as number };
      writeLocal(uid, s);
      return s;
    }
  }
  if (local) {
    try {
      return await saveAdventure(uid, local.save, 0);
    } catch {
      return local;
    }
  }
  return null;
}

export class StaleSave extends Error {
  constructor(public latest: Stored | null) {
    super("stale");
  }
}

/** 저장 — 새 버전을 돌려준다. 다른 기기가 먼저 썼으면 StaleSave(서버 최신을 싣고). */
export async function saveAdventure(uid: string, save: AdvSave, version: number): Promise<Stored> {
  writeLocal(uid, { save, version });
  const sb = getSupabase();
  if (!sb) return { save, version };
  const { data, error } = await sb.rpc("adventure_save", { p_state: save, p_version: version });
  if (error) {
    if (missingTable(error)) return { save, version };
    if (error.code === "PT409") {
      const { data: row } = await sb.from("adventure_saves").select("state, version").eq("user_id", uid).maybeSingle();
      const latest = row ? normalizeSave(row.state) : null;
      const s = latest ? { save: latest, version: row!.version as number } : null;
      if (s) writeLocal(uid, s);
      throw new StaleSave(s);
    }
    throw new Error(error.message);
  }
  const s = { save, version: Number(data) };
  writeLocal(uid, s);
  return s;
}
