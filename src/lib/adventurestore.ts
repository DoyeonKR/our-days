/* 모험 저장 — 서버(adventure_saves, 사람마다 한 행) + 이 기기 사본.
 * 서버가 정본이다. 이 기기 사본은 끊겼을 때 · 표가 아직 없을 때(migration 적용 전 1분) 이어서 하려고 둔다.
 * 쓰기는 adventure_save RPC 하나 — 버전이 안 맞으면 PT409(다른 기기가 먼저 썼다) → 서버 것을 다시 읽는다.
 *
 * ⚠ 못 올린 진행(2026-11-09): 저장은 이 기기 사본을 먼저 쓰고 서버로 보낸다. 서버가 실패하면 사본엔 더 앞선 진행이
 *   옛 버전 번호로 남는데, 예전엔 다음 읽기가 서버 행으로 그 사본을 덮어 진행이 사라졌다. 이제 사본에 dirty 표시를 두고
 *   - 읽을 때 dirty 이고 서버 버전이 사본과 같으면 → 사본을 그 버전으로 올린다(이 기기가 이어 쓴 것)
 *   - 서버가 앞서 갔으면(다른 기기가 썼다) → 서버를 쓰고, 이 기기 것은 백업(최근 셋)에 남기고 Stored.backup = true
 *   PT409 로 서버 것을 받을 때도 덮이는 이 기기 진행을 백업에 남긴다.
 * ⚠ 화면이 쓸 것: 전투가 끝나면 곧바로 commit(→ stageAdventure + saveAdventure), 탭을 숨길 때 · 연결이 돌아올 때 flushAdventure(uid).
 *   pagehide 에서 부른 요청은 브라우저가 끊을 수 있다 — 그래도 dirty 사본이 남아 다음 읽기가 올린다.
 *   저장은 사람마다 한 줄로 차례대로 돈다(이 모듈의 queue) — flush 와 화면의 저장이 같은 버전으로 부딪히지 않는다.
 *
 * 저장 다듬기(2026-11-09 두 번째):
 *   · 쓰기 표(`_w`) — 보낼 때마다 새 값을 저장에 싣고 이 기기에 (표, 보낸 버전)을 기억한다. 저장은 닿았는데 응답만 잃으면
 *     다음 저장이 PT409 를 받는데, 서버 행의 `_w` 가 이 기기가 보낸 표이고 버전이 '보낸 버전 + 1' 이면 다른 기기가 아니라
 *     이 기기의 것이다 — 충돌로 보지 않고 그 버전 위에 이어 쓴다(예전엔 '다른 기기에서 진행한 기록'이라는 거짓 알림).
 *     normalizeSave 는 모르는 칸을 흘리므로 `_w` 가 읽기 · 쓰기에서 살아남는다(adventure.ts 의 `...s`).
 *   · 기기 사본은 줄을 기다리지 않는다(`stageAdventure`) — 멈춘 저장 뒤에 사본까지 묶여 앱을 닫으면 진행이 사라졌다.
 *     RPC 는 12초(`RPC_TIMEOUT_MS`)에 끊는다 — 늦게라도 닿으면 위의 쓰기 표가 알아본다.
 *   · 백업은 한 벌이 아니라 최근 셋(`listBackups` · `restoreBackup`) — 예전엔 덮어써지고 되살릴 길이 없었다.
 *   · 싸우던 판(`_fight`) — 판을 열 때 표시를 남기고 판이 끝나면 지운다. 앱을 꺼서 판을 버리면 다음에 읽을 때
 *     `settleFight` 가 정산한다(쓴 공 · 약은 돌아오지 않고, 대장 · 트레이너는 진 것 · 야생은 도망). 다른 기기의 판은 30분 뒤에만. */
import { getSupabase } from "@/lib/supabase";
import { healMon, normalizeSave, type AdvSave } from "@/lib/adventure";

/** backup: 서버가 앞서 있어 이 기기의 못 올린 진행을 백업에 남겼다(화면이 알려 줄 수 있다) · fight: 끝내지 않은 판을 정산한 한 줄 */
export type Stored = { save: AdvSave; version: number; backup?: boolean; fight?: string };
type Local = { save: AdvSave; version: number; dirty: boolean };
/** 싸우던 판 표시 — 판을 열 때 남기고 끝나면 null(최상위 칸은 합쳐 쓰므로 지울 땐 null 을 쓴다) */
export type Fight = { kind: "wild" | "trainer" | "boss" | "tower"; startedAt: number; region: string; isBoss: boolean; dev?: string };
/** 저장에 덧붙는 칸(엔진은 모르고 흘린다) */
type Extra = { _w?: string; _fight?: Fight | null };
export type BackupMeta = { at: string; level: number; gold: number; dex: number };
type Backup = BackupMeta & { save: AdvSave };

const key = (uid: string) => `ourdays:adventure:v1:${uid}`;
/** 옛 한 벌 백업(2026-11-09 첫 판) — 읽기만 한다 */
export const backupKey = (uid: string) => `ourdays:adventure:v1:${uid}:backup`;
/** 최근 백업 셋 */
export const backupsKey = (uid: string) => `ourdays:adventure:v1:${uid}:backups`;
/** 이 기기가 보낸 쓰기 표(최근 8개 — 표 · 보낸 버전) */
const sentKey = (uid: string) => `ourdays:adventure:v1:${uid}:w`;
const DEVICE_KEY = "ourdays:adventure:device";
export const BACKUP_MAX = 3;
export const RPC_TIMEOUT_MS = 12_000;
/** 다른 기기가 연 판은 이만큼 지나야 버린 판으로 본다(그 기기에서 아직 싸우는 중일 수 있다) */
export const FIGHT_STALE_MS = 30 * 60_000;

const extra = (s: AdvSave) => s as AdvSave & Extra;

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

/** 한 줄 요약 — 고를 때 보이는 것(가장 높은 레벨 · 골드 · 잡은 종 수) */
export function backupMeta(save: AdvSave, at = new Date().toISOString()): BackupMeta {
  const level = [...save.party, ...save.box].reduce((a, m) => Math.max(a, m.level), 0);
  return { at, level, gold: save.gold, dex: save.caught.length };
}

function readBackups(uid: string): Backup[] {
  const out: Backup[] = [];
  try {
    const ring = JSON.parse(localStorage.getItem(backupsKey(uid)) ?? "[]");
    if (Array.isArray(ring)) {
      for (const b of ring) {
        const save = normalizeSave(b?.save);
        if (save) out.push({ ...backupMeta(save, String(b.at ?? "")), save });
      }
    }
    // 옛 한 벌 — 셋 안에 없으면 끝에 붙인다
    const old = JSON.parse(localStorage.getItem(backupKey(uid)) ?? "null");
    const oldSave = normalizeSave(old?.save);
    if (oldSave && !out.some((b) => b.at === old.at)) out.push({ ...backupMeta(oldSave, String(old.at ?? "")), save: oldSave });
  } catch {
    /* 깨진 값 · 막힌 저장 */
  }
  return out.slice(0, BACKUP_MAX);
}

/** 서버 것에 밀린 이 기기 진행을 남긴다 — 지우지 않고 최근 셋(같은 진행을 두 번 넣지 않는다) */
function keepBackup(uid: string, save: AdvSave) {
  try {
    const list = readBackups(uid);
    const body = JSON.stringify({ ...save, _w: undefined });
    if (list.some((b) => JSON.stringify({ ...b.save, _w: undefined }) === body)) return;
    const at = new Date().toISOString();
    const next = [{ save, at }, ...list.map((b) => ({ save: b.save, at: b.at }))].slice(0, BACKUP_MAX);
    localStorage.setItem(backupsKey(uid), JSON.stringify(next));
  } catch {
    /* 저장이 막힌 기기 */
  }
}

/** 보관한 기록 — 새것부터 셋까지 */
export function listBackups(uid: string): BackupMeta[] {
  return readBackups(uid).map((b) => ({ at: b.at, level: b.level, gold: b.gold, dex: b.dex }));
}

const missingTable = (e: { code?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202");

/** 멈춘 요청이 저장 줄을 영영 붙잡지 않게 — 늦게 닿은 저장은 쓰기 표가 알아본다 */
function withTimeout<T>(p: PromiseLike<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/* ───────── 쓰기 표 ───────── */

const newNonce = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
type Sent = { w: string; from: number };
function readSent(uid: string): Sent[] {
  try {
    const v = JSON.parse(localStorage.getItem(sentKey(uid)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.w === "string" && typeof x.from === "number") : [];
  } catch {
    return [];
  }
}
function rememberSent(uid: string, w: string, from: number) {
  try {
    localStorage.setItem(sentKey(uid), JSON.stringify([{ w, from }, ...readSent(uid)].slice(0, 8)));
  } catch {
    /* 막힌 저장 — 이 기기의 저장을 못 알아볼 뿐(충돌로 본다) */
  }
}
/** 서버 행이 이 기기가 보낸 저장인가 — 표가 같고 버전이 '보낸 버전 + 1'(그 사이 다른 기기가 안 썼다) */
export function landedOwn(sent: readonly Sent[], state: unknown, version: number): boolean {
  const w = (state as Extra | null)?._w;
  return typeof w === "string" && sent.some((r) => r.w === w && version === r.from + 1);
}

/** 이 페이지에서 올린 버전의 이어짐(올린 버전 → 새 버전) — flush 가 먼저 올렸으면 화면이 든 옛 버전 번호를 새 번호로 잇는다 */
const advanced = new Map<string, Map<number, number>>();
const queue = new Map<string, Promise<unknown>>();
function serial<T>(uid: string, job: () => Promise<T>): Promise<T> {
  const run = (queue.get(uid) ?? Promise.resolve()).then(job, job);
  queue.set(uid, run.catch(() => undefined));
  return run;
}
function link(uid: string, from: number, to: number) {
  if (!advanced.has(uid)) advanced.set(uid, new Map());
  if (from !== to) advanced.get(uid)!.set(from, to);
}
function resolveVersion(uid: string, v: number): number {
  const m = advanced.get(uid);
  let guard = 0;
  while (m?.has(v) && guard++ < 64) v = m.get(v)!;
  return v;
}
/** 화면이 든 버전을 이 페이지가 이어 올린 마지막 버전으로 */
export const latestVersion = resolveVersion;

/** 처음 읽기. 서버에 없고 이 기기에 있으면 올린다. 둘 다 없으면 null(시작 생물 고르기). 못 올린 진행이 있으면 올리거나 백업한다.
 *  끝내지 않은 판(앱을 꺼서 버린 판)이 있으면 정산해 저장하고 Stored.fight 에 한 줄을 싣는다. */
export async function loadAdventure(uid: string): Promise<Stored | null> {
  const s = await loadRaw(uid);
  if (!s) return s;
  const f = settleFight(s.save, deviceId());
  if (!f) return s;
  try {
    const r = await saveAdventure(uid, f.save, s.version);
    return { ...r, backup: s.backup, fight: f.note };
  } catch (e) {
    if (e instanceof StaleSave && e.latest) return { ...e.latest, backup: true };
    // 못 올렸다 — 사본에 남겨 다음 저장 · flush 가 올린다(쓴 공 · 약은 이미 빠져 있다)
    stageAdventure(uid, f.save, s.version);
    return { save: f.save, version: s.version, backup: s.backup, fight: f.note };
  }
}

async function loadRaw(uid: string): Promise<Stored | null> {
  const local = readLocal(uid);
  const plain = local ? { save: local.save, version: local.version } : null;
  const sb = getSupabase();
  if (!sb) return plain;
  let data: { state: unknown; version: number } | null = null;
  let error: { message: string; code?: string } | null = null;
  try {
    ({ data, error } = await withTimeout(sb.from("adventure_saves").select("state, version").eq("user_id", uid).maybeSingle()));
  } catch (e) {
    error = { message: e instanceof Error ? e.message : "timeout", code: "timeout" };
  }
  if (error) {
    if (missingTable(error) || local) return plain;
    throw new Error(error.message);
  }
  if (data) {
    const server = normalizeSave(data.state);
    const sv = data.version as number;
    if (local?.dirty) {
      const own = landedOwn(readSent(uid), data.state, sv);
      if (local.version === sv || own) {
        // 같은 버전 위에서 이 기기가 이어 쓴 것 · 또는 서버 행이 이 기기가 보낸 저장(응답만 잃었다) — 그 버전으로 올린다
        if (own && server && extra(local.save)._w === extra(server)._w) {
          const s = { save: server, version: sv };
          writeLocal(uid, s, false);
          return s;
        }
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

/** 이 기기 사본을 지금 바로 쓴다(dirty) — 줄에 선 서버 저장을 기다리지 않는다. 화면의 commit 이 서버 저장보다 먼저 부른다 */
export function stageAdventure(uid: string, save: AdvSave, version: number) {
  // 쓰기 표는 뗀다 — 화면의 저장엔 지난번 서버 행의 표가 남아 있어, 그대로 두면 다시 열 때 '이미 올린 진행'으로 보고 이 사본을 버린다
  writeLocal(uid, { save: { ...save, _w: undefined } as AdvSave, version: resolveVersion(uid, version) }, !!getSupabase());
}

/** 저장 — 새 버전을 돌려준다. 다른 기기가 먼저 썼으면 StaleSave(서버 최신을 싣고, 덮인 이 기기 진행은 백업에). */
export function saveAdventure(uid: string, save: AdvSave, version: number): Promise<Stored> {
  return serial(uid, () => writeSave(uid, save, version));
}

/** 줄 안에서만 부른다(saveAdventure · flushAdventure) */
async function writeSave(uid: string, save: AdvSave, version: number, depth = 0): Promise<Stored> {
  const from = resolveVersion(uid, version);
  const sb = getSupabase();
  const w = newNonce();
  const body: AdvSave = { ...save, _w: w } as AdvSave;
  // 서버가 받기 전까지는 dirty — 실패하면 다음 읽기 · flushAdventure 가 올린다
  writeLocal(uid, { save: body, version: from }, !!sb);
  if (!sb) return { save: body, version: from };
  rememberSent(uid, w, from);
  const { data, error } = await withTimeout(sb.rpc("adventure_save", { p_state: body, p_version: from }));
  if (error) {
    if (missingTable(error)) return { save: body, version: from };
    if (error.code === "PT409") {
      const { data: row } = await withTimeout(sb.from("adventure_saves").select("state, version").eq("user_id", uid).maybeSingle());
      const latest = row ? normalizeSave(row.state) : null;
      // 서버 행이 이 기기가 앞서 보낸 저장이다(닿았는데 응답만 잃었다) — 다른 기기가 아니다. 그 버전 위에 이어 쓴다
      if (latest && depth === 0 && landedOwn(readSent(uid), row!.state, row!.version as number)) {
        link(uid, from, row!.version as number);
        return writeSave(uid, save, row!.version as number, depth + 1);
      }
      keepBackup(uid, body);
      const s = latest ? { save: latest, version: row!.version as number } : null;
      if (s) writeLocal(uid, s, false);
      throw new StaleSave(s);
    }
    throw new Error(error.message);
  }
  const s = { save: body, version: Number(data) };
  link(uid, from, s.version);
  // 기다리는 사이 화면이 더 새 진행을 사본에 써 뒀으면(stageAdventure) 그것을 지우지 않는다 — 다음 저장 · 읽기가 올린다
  const now = readLocal(uid);
  if (!now || extra(now.save)._w === w) writeLocal(uid, s, false);
  return s;
}

/** 이 기기에 못 올린 진행이 있나 */
export function hasPendingAdventure(uid: string): boolean {
  return !!readLocal(uid)?.dirty;
}

/** 서버 버전만 가볍게(state 없이) — 앱으로 돌아왔을 때 다른 기기가 앞서 썼는지 본다. 못 읽으면 null */
export async function serverVersion(uid: string): Promise<number | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await withTimeout(sb.from("adventure_saves").select("version").eq("user_id", uid).maybeSingle());
    if (error || !data) return null;
    return Number(data.version) || null;
  } catch {
    return null;
  }
}

/** 못 올린 진행을 지금 올린다 — 없으면 null. 화면은 탭을 숨길 때(visibilitychange · pagehide) · 연결이 돌아올 때(online) 부른다.
 *  다른 기기가 앞서 썼으면 StaleSave(서버 최신 · 이 기기 것은 백업). 화면이 든 버전 번호는 다음 saveAdventure 가 알아서 잇는다. */
export function flushAdventure(uid: string): Promise<Stored | null> {
  // 사본은 줄 안에서 읽는다 — 앞에 줄 선 저장이 더 새 진행을 올린 뒤라면 옛 사본으로 덮지 않게
  return serial(uid, async () => {
    const local = readLocal(uid);
    if (!local?.dirty || !getSupabase()) return null;
    return writeSave(uid, local.save, local.version);
  });
}

/** 보관한 기록 하나를 되살린다 — 지금 진행도 먼저 보관하고(되돌릴 수 있게), 서버의 지금 버전 위에 쓴다 */
export async function restoreBackup(uid: string, index: number, current: AdvSave | null): Promise<Stored> {
  const b = readBackups(uid)[index];
  if (!b) throw new Error("no backup");
  const v = getSupabase() ? await serverVersion(uid) : (readLocal(uid)?.version ?? 0);
  if (v == null) throw new Error("offline");
  if (current) keepBackup(uid, current);
  // 싸우던 판 표시는 되살리지 않는다(그 판은 이미 없다)
  return saveAdventure(uid, { ...b.save, _fight: null } as AdvSave, v);
}

/* ───────── 싸우던 판 ───────── */

/** 이 기기 표 — 싸우던 판을 이 기기가 열었는지 가른다 */
export function deviceId(): string {
  try {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d) {
      d = newNonce();
      localStorage.setItem(DEVICE_KEY, d);
    }
    return d;
  } catch {
    return "";
  }
}

/** 판을 열 때 저장에 남길 표시 */
export function markFight(save: AdvSave, f: Omit<Fight, "dev" | "startedAt">, now = Date.now()): AdvSave {
  return { ...save, _fight: { ...f, startedAt: now, dev: deviceId() } } as AdvSave;
}

/** 판이 끝난 저장 — 표시를 지운다(합쳐 쓰므로 null) */
export const clearFight = (save: AdvSave): AdvSave => ({ ...save, _fight: null }) as AdvSave;

/** 끝내지 않은 판을 정산한다 — 표시가 없으면 null. 이 기기 판은 바로, 다른 기기 판은 FIGHT_STALE_MS 뒤에만.
 *  쓴 공 · 약은 이미 저장에 빠져 있다(돌려주지 않는다). 대장 · 트레이너는 진 것(골드 10% · 쉼터 회복 — finishBattle 과 같은 규칙),
 *  탑은 진 것이지만 골드는 그대로(탑은 원래 잃지 않는다), 야생은 도망친 것. */
export function settleFight(save: AdvSave, dev: string, now = Date.now()): { save: AdvSave; note: string } | null {
  const f = extra(save)._fight;
  if (!f || typeof f !== "object") return null;
  const mine = !!f.dev && f.dev === dev;
  if (!mine && now - Number(f.startedAt || 0) < FIGHT_STALE_MS) return null;
  if (f.kind === "wild") return { save: clearFight(save), note: "끝내지 않은 전투는 도망친 것으로 쳤어요 — 쓴 공 · 약은 돌아오지 않아요" };
  const lost = f.kind === "tower" ? 0 : Math.floor(save.gold * 0.1);
  const what = f.kind === "boss" || f.isBoss ? "대장" : f.kind === "tower" ? "탑" : "트레이너";
  return {
    save: clearFight({ ...save, gold: Math.max(0, save.gold - lost), party: save.party.map(healMon) }),
    note: `끝내지 않은 ${what} 승부는 진 것으로 쳤어요${lost ? ` · 골드 ${lost} 를 잃었어요` : ""}`,
  };
}
