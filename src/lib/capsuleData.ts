// 타임캡슐 편지 — 데이터 계층. README §10.26 · migrations/20261114060000_time_capsule.sql
//
// 읽기는 둘로 나뉜다: 카드(누가 · 언제 열리나 · 사진이 있나)는 본문 없는 RPC time_capsule_cards 로 모두 받고,
// 본문 · 사진 경로는 표를 직접 읽는다 — 서버 정책이 '내가 쓴 편지이거나 여는 날이 지난 편지'만 돌려준다.
// 그래서 봉인된 상대 편지의 본문은 이 기기에 아예 오지 않는다(화면이 숨기는 것이 아니다).
// 사진은 따로 둔 비공개 버킷 capsule-photos 에 '{커플}/{나}/{편지 id}-….webp' 로 올린다(사진첩과 같은 preparePhoto 로 줄인다).
import { getSupabase } from "@/lib/supabase";
import { currentUserId } from "@/lib/couple";
import { preparePhoto, PhotoPrepError } from "@/lib/image";
import { capsuleBodyError, capsulePhotoPath, capsuleToday, validOpenOn } from "@/lib/capsule";

export const CAPSULE_BUCKET = "capsule-photos";

export type TimeCapsule = {
  id: string;
  createdBy: string;
  openOn: string;
  hasPhoto: boolean;
  replyTo: string | null;
  openedAt: string | null;
  createdAt: string;
  /** 읽을 수 있을 때만(내가 썼거나 열린 편지). 봉인된 상대 편지는 null — 서버가 안 준다. */
  body: string | null;
  photoPath: string | null;
  updatedAt: string | null;
};

type CardRow = { id: string; created_by: string; open_on: string; has_photo: boolean; reply_to: string | null; opened_at: string | null; created_at: string };
type LetterRow = { id: string; body: string; photo_path: string | null; updated_at: string };

/** migration 이 아직 운영에 없을 때(함수 · 표 없음) — 기능 전체를 '준비 중'으로. */
export class CapsuleUnavailableError extends Error {}

function missing(code: string | undefined, message: string | undefined): boolean {
  return code === "42883" || code === "42P01" || code === "PGRST202" || code === "PGRST205" || /does not exist|could not find/i.test(message ?? "");
}

function human(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("failed to fetch") || m.includes("network")) return "연결을 확인하고 다시 시도해 주세요";
  if (m.includes("row-level security") || m.includes("permission")) return "이미 열렸거나 고칠 수 없는 편지예요";
  if (m.includes("time_capsules_body_len")) return "편지는 2,000자까지 쓸 수 있어요";
  return "잠시 후 다시 시도해 주세요";
}

/** 여는 날이 지난 편지를 연다(활동함 한 줄) — 크론이 매시 돌지만, 자정 직후 먼저 연 사람이 바로 보게. 실패는 조용히(크론이 한다). */
async function openDue(coupleId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.rpc("open_due_time_capsules", { p_couple: coupleId });
  } catch {
    /* noop */
  }
}

export async function listTimeCapsules(coupleId: string): Promise<TimeCapsule[]> {
  const sb = getSupabase();
  if (!sb) return [];
  await openDue(coupleId);
  const [cards, letters] = await Promise.all([
    sb.rpc("time_capsule_cards", { p_couple: coupleId }),
    sb.from("time_capsules").select("id,body,photo_path,updated_at").eq("couple_id", coupleId).limit(1000),
  ]);
  if (cards.error) {
    if (missing(cards.error.code, cards.error.message)) throw new CapsuleUnavailableError("타임캡슐을 준비하고 있어요");
    throw new Error(human(cards.error.message));
  }
  if (letters.error && !missing(letters.error.code, letters.error.message)) throw new Error(human(letters.error.message));
  const byId = new Map<string, LetterRow>(((letters.data ?? []) as LetterRow[]).map((r) => [r.id, r]));
  return ((cards.data ?? []) as CardRow[]).map((c) => {
    const l = byId.get(c.id);
    return {
      id: c.id,
      createdBy: c.created_by,
      openOn: c.open_on,
      hasPhoto: !!c.has_photo,
      replyTo: c.reply_to,
      openedAt: c.opened_at,
      createdAt: c.created_at,
      body: l?.body ?? null,
      photoPath: l?.photo_path ?? null,
      updatedAt: l?.updated_at ?? null,
    };
  });
}

function nonce(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadPhoto(coupleId: string, uid: string, capsuleId: string, file: File): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요");
  let full: File;
  try {
    ({ full } = await preparePhoto(file));
  } catch (e) {
    throw new Error(e instanceof PhotoPrepError ? e.message : "사진을 준비하지 못했어요");
  }
  const ext = (full.type.split("/")[1] || "webp").replace("jpeg", "jpg");
  const path = capsulePhotoPath(coupleId, uid, capsuleId, ext, nonce());
  const { error } = await sb.storage.from(CAPSULE_BUCKET).upload(path, full, { upsert: false, contentType: full.type || undefined });
  if (error) throw new Error("사진을 올리지 못했어요 — " + human(error.message));
  return path;
}

async function removePhoto(path: string | null | undefined): Promise<void> {
  const sb = getSupabase();
  if (!sb || !path) return;
  try {
    await sb.storage.from(CAPSULE_BUCKET).remove([path]);
    signed.delete(path);
  } catch {
    /* 남은 파일은 내 폴더 안이라 나만 본다 */
  }
}

export type CapsuleDraft = {
  /** 고칠 때만 — 새 편지는 비운다 */
  id?: string;
  coupleId: string;
  openOn: string;
  body: string;
  /** 새로 붙일 사진 */
  photo?: File | null;
  /** 고칠 때 있던 사진을 뗀다 */
  dropPhoto?: boolean;
  /** 고칠 때 지금 사진 경로(바꾸면 옛 파일을 지운다) */
  prevPhotoPath?: string | null;
  replyTo?: string | null;
};

/** 묻기 · 고치기. 사진을 먼저 올리고(내 폴더 — 나만 본다) 행을 쓴다. 행을 못 쓰면 올린 사진을 지운다. */
export async function saveTimeCapsule(d: CapsuleDraft): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요");
  const uid = await currentUserId();
  if (!uid) throw new Error("로그인이 필요해요");
  const bodyErr = capsuleBodyError(d.body);
  if (bodyErr) throw new Error(bodyErr);
  if (!validOpenOn(d.openOn, capsuleToday())) throw new Error("여는 날은 내일부터 10년 뒤까지 고를 수 있어요");
  const id = d.id ?? crypto.randomUUID();
  const uploaded = d.photo ? await uploadPhoto(d.coupleId, uid, id, d.photo) : null;
  const photoPath = uploaded ?? (d.dropPhoto ? null : (d.prevPhotoPath ?? null));
  if (!d.id) {
    const { error } = await sb.from("time_capsules").insert({
      id,
      couple_id: d.coupleId,
      created_by: uid,
      open_on: d.openOn,
      body: d.body,
      photo_path: photoPath,
      reply_to: d.replyTo ?? null,
    });
    if (error) {
      await removePhoto(uploaded);
      if (missing(error.code, error.message)) throw new Error("타임캡슐을 준비하고 있어요 — 잠시 후 다시 시도해 주세요");
      throw new Error(human(error.message));
    }
    return id;
  }
  const { data, error } = await sb
    .from("time_capsules")
    .update({ open_on: d.openOn, body: d.body, photo_path: photoPath })
    .eq("id", d.id)
    .select("id");
  if (error || !data?.length) {
    await removePhoto(uploaded);
    throw new Error(error ? human(error.message) : "이미 열렸거나 지워진 편지예요");
  }
  if (d.prevPhotoPath && d.prevPhotoPath !== photoPath) await removePhoto(d.prevPhotoPath);
  return d.id;
}

/** 지우기(쓴 사람 · 열리기 전만 — 서버가 막는다). */
export async function deleteTimeCapsule(c: Pick<TimeCapsule, "id" | "photoPath">): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("연동이 설정되지 않았어요");
  const { data, error } = await sb.from("time_capsules").delete().eq("id", c.id).select("id");
  if (error) throw new Error(human(error.message));
  if (!data?.length) throw new Error("이미 열렸거나 지워진 편지예요");
  await removePhoto(c.photoPath);
}

const signed = new Map<string, { url: string; exp: number }>();

/** 편지 사진 서명 URL(1시간, 메모리 캐시). 서버가 봉인된 남의 사진엔 서명하지 않는다. */
export async function signedCapsulePhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const sb = getSupabase();
  const out: Record<string, string> = {};
  const now = Date.now();
  const need: string[] = [];
  for (const p of new Set(paths.filter(Boolean))) {
    const c = signed.get(p);
    if (c && c.exp - now > 5 * 60_000) out[p] = c.url;
    else need.push(p);
  }
  if (sb && need.length) {
    const { data } = await sb.storage.from(CAPSULE_BUCKET).createSignedUrls(need, 3600);
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) {
        out[s.path] = s.signedUrl;
        signed.set(s.path, { url: s.signedUrl, exp: now + 3600_000 });
      }
    }
  }
  return out;
}

/** 로그아웃 · 계정 전환 때 — 서명 URL 을 남기지 않는다. */
export function clearCapsuleUrlCache(): void {
  signed.clear();
}
