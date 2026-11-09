/* 모험 저장 — 서버(adventure_saves, 사람마다 한 행) + 이 기기 사본.
 * 서버가 정본이다. 이 기기 사본은 끊겼을 때 · 표가 아직 없을 때(migration 적용 전 1분) 이어서 하려고 둔다.
 * 쓰기는 adventure_save RPC 하나 — 버전이 안 맞으면 PT409(다른 기기가 먼저 썼다) → 서버 것을 다시 읽는다.
 *
 * ⚠ 못 올린 진행(2026-11-09): 저장은 이 기기 사본을 먼저 쓰고 서버로 보낸다. 서버가 실패하면 사본엔 더 앞선 진행이
 *   옛 버전 번호로 남는데, 예전엔 다음 읽기가 서버 행으로 그 사본을 덮어 진행이 사라졌다. 이제 사본에 dirty 표시를 두고
 *   - 읽을 때 dirty 이고 서버 버전이 사본과 같으면 → 사본을 그 버전으로 올린다(이 기기가 이어 쓴 것)
 *   - 서버가 앞서 갔으면(다른 기기가 썼다) → 서버를 쓰고, 이 기기 것은 백업 키(`…:backup`)에 남기고 Stored.backup = true
 *   PT409 로 서버 것을 받을 때도 덮이는 이 기기 진행을 백업에 남긴다.
 * ⚠ 화면이 쓸 것: 전투가 끝나면 곧바로 commit(→ saveAdventure), 탭을 숨길 때 · 연결이 돌아올 때 flushAdventure(uid).
 *   pagehide 에서 부른 요청은 브라우저가 끊을 수 있다 — 그래도 dirty 사본이 남아 다음 읽기가 올린다.
 *   저장은 사람마다 한 줄로 차례대로 돈다(이 모듈의 queue) — flush 와 화면의 저장이 같은 버전으로 부딪히지 않는다. */
import { getSupabase } from "@/lib/supabase";
import { normalizeSave, type AdvSave } from "@/lib/adventure";

/** backup: 서버가 앞서 있어 이 기기의 못 올린 진행을 백업 키에 남겼다(화면이 알려 줄 수 있다) */
export type Stored = { save: AdvSave; version: number; backup?: boolean };
type Local = { save: AdvSave; version: number; dirty: boolean };

const key = (uid: string) => `ourdays:adventure:v1:${uid}`;
/** 서버 것에 밀린 이 기기 진행 — 지우지 않고 한 벌 남긴다(사람이 되살릴 길) */
export const backupKey = (uid: string) => `ourdays:adventure:v1:${uid}:backup`;

function readLocal(uid: string): Local | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) ?? "null");
    const save = normalizeSave(raw?.save);
    return save ? { save, version: Number(raw.version) || 0, dirty: raw.dirty === true } : null;
  } catch {
    return null;
  }
}
function writeLocal(uid: string, s: Stored, dirty: boolean) {
  try {
    localStorage.setItem(key(uid), JSON.stringify({ save: s.save, version: s.version, dirty }));
  } catch {
    /* 저장이 막힌 기기 — 서버 저장만 */
  }
}
function keepBackup(uid: string, save: AdvSave) {
  try {
    localStorage.setItem(backupKey(uid), JSON.stringify({ save, at: new Date().toISOString() }));
  } catch {
    /* 저장이 막힌 기기 */
  }
}

const missingTable = (e: { code?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202");

/** 이 페이지에서 올린 버전의 이어짐(올린 버전 → 새 버전) — flush 가 먼저 올렸으면 화면이 든 옛 버전 번호를 새 번호로 잇는다 */
const advanced = new Map<string, Map<number, number>>();
const queue = new Map<string, Promise<unknown>>();
function serial<T>(uid: string, job: () => Promise<T>): Promise<T> {
  const run = (queue.get(uid) ?? Promise.resolve()).then(job, job);
  queue.set(uid, run.catch(() => undefined));
  return run;
}
function resolveVersion(uid: string, v: number): number {
  const m = advanced.get(uid);
  let guard = 0;
  while (m?.has(v) && guard++ < 64) v = m.get(v)!;
  return v;
}

/** 처음 읽기. 서버에 없고 이 기기에 있으면 올린다. 둘 다 없으면 null(시작 생물 고르기). 못 올린 진행이 있으면 올리거나 백업한다. */
export async function loadAdventure(uid: string): Promise<Stored | null> {
  const local = readLocal(uid);
  const plain = local ? { save: local.save, version: local.version } : null;
  const sb = getSupabase();
  if (!sb) return plain;
  const { data, error } = await sb.from("adventure_saves").select("state, version").eq("user_id", uid).maybeSingle();
  if (error) {
    if (missingTable(error) || local) return plain;
    throw new Error(error.message);
  }
  if (data) {
    const server = normalizeSave(data.state);
    const sv = data.version as number;
    if (local?.dirty) {
      if (local.version === sv) {
        // 같은 버전 위에서 이 기기가 이어 쓴 것 — 그 버전으로 올린다(서버를 덮지 않고 그대로 잇는다)
        try {
          return await saveAdventure(uid, local.save, sv);
        } catch (e) {
          if (e instanceof StaleSave && e.latest) return { ...e.latest, backup: true };
          return plain;
        }
      }
      // 서버가 앞서 갔다(다른 기기) — 서버를 쓰고 이 기기 것은 백업으로
      keepBackup(uid, local.save);
      if (server) {
        const s = { save: server, version: sv };
        writeLocal(uid, s, false);
        return { ...s, backup: true };
      }
    }
    if (server) {
      const s = { save: server, version: sv };
      writeLocal(uid, s, false);
      return s;
    }
  }
  if (local) {
    try {
      return await saveAdventure(uid, local.save, 0);
    } catch {
      return plain;
    }
  }
  return null;
}

// 매개변수 속성(public latest)은 node 의 타입 지우기가 못 읽는다 — 테스트가 이 파일을 그대로 띄운다
export class StaleSave extends Error {
  latest: Stored | null;
  constructor(latest: Stored | null) {
    super("stale");
    this.latest = latest;
  }
}

/** 저장 — 새 버전을 돌려준다. 다른 기기가 먼저 썼으면 StaleSave(서버 최신을 싣고, 덮인 이 기기 진행은 백업 키에). */
export function saveAdventure(uid: string, save: AdvSave, version: number): Promise<Stored> {
  return serial(uid, () => writeSave(uid, save, version));
}

/** 줄 안에서만 부른다(saveAdventure · flushAdventure) */
async function writeSave(uid: string, save: AdvSave, version: number): Promise<Stored> {
  const from = resolveVersion(uid, version);
  const sb = getSupabase();
  // 서버가 받기 전까지는 dirty — 실패하면 다음 읽기 · flushAdventure 가 올린다
  writeLocal(uid, { save, version: from }, !!sb);
  if (!sb) return { save, version: from };
  const { data, error } = await sb.rpc("adventure_save", { p_state: save, p_version: from });
  if (error) {
    if (missingTable(error)) return { save, version: from };
    if (error.code === "PT409") {
      keepBackup(uid, save);
      const { data: row } = await sb.from("adventure_saves").select("state, version").eq("user_id", uid).maybeSingle();
      const latest = row ? normalizeSave(row.state) : null;
      const s = latest ? { save: latest, version: row!.version as number } : null;
      if (s) writeLocal(uid, s, false);
      throw new StaleSave(s);
    }
    throw new Error(error.message);
  }
  const s = { save, version: Number(data) };
  if (!advanced.has(uid)) advanced.set(uid, new Map());
  advanced.get(uid)!.set(from, s.version);
  writeLocal(uid, s, false);
  return s;
}

/** 이 기기에 못 올린 진행이 있나 */
export function hasPendingAdventure(uid: string): boolean {
  return !!readLocal(uid)?.dirty;
}

/** 못 올린 진행을 지금 올린다 — 없으면 null. 화면은 탭을 숨길 때(visibilitychange · pagehide) · 연결이 돌아올 때(online) 부른다.
 *  다른 기기가 앞서 썼으면 StaleSave(서버 최신 · 이 기기 것은 백업 키). 화면이 든 버전 번호는 다음 saveAdventure 가 알아서 잇는다. */
export function flushAdventure(uid: string): Promise<Stored | null> {
  // 사본은 줄 안에서 읽는다 — 앞에 줄 선 저장이 더 새 진행을 올린 뒤라면 옛 사본으로 덮지 않게
  return serial(uid, async () => {
    const local = readLocal(uid);
    if (!local?.dirty || !getSupabase()) return null;
    return writeSave(uid, local.save, local.version);
  });
}
