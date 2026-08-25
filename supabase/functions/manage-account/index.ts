import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "couple-photos";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "delete") return json({ error: "bad request" }, 400);
    const jwt = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "no auth" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) return json({ error: "invalid auth" }, 401);
    const userId = authData.user.id;

    // 현재 멤버십뿐 아니라 연결 해제 뒤 남아 있을 수 있는 작성 미디어까지 찾는다.
    // 그래야 사용자가 새 커플에 들어온 뒤 계정을 삭제해도 과거 파일이 고아로 남지 않는다.
    const [memberships, ownedCouples, photos, diaries, logs] = await Promise.all([
      admin.from("couple_members").select("couple_id").eq("user_id", userId),
      admin.from("couples").select("id").eq("created_by", userId),
      admin
        .from("couple_photos")
        .select("couple_id,storage_path,thumb_path")
        .eq("created_by", userId),
      admin.from("deco_entries").select("couple_id,photo_paths").eq("created_by", userId),
      admin.from("couple_logs").select("couple_id,video_path").eq("created_by", userId),
    ]);
    for (const result of [memberships, ownedCouples, photos, diaries, logs]) {
      if (result.error) throw result.error;
    }

    const coupleIds = new Set<string>();
    const paths = new Set<string>();
    for (const row of memberships.data ?? []) coupleIds.add(row.couple_id);
    for (const row of ownedCouples.data ?? []) coupleIds.add(row.id);
    for (const row of photos.data ?? []) {
      coupleIds.add(row.couple_id);
      if (row.storage_path) paths.add(row.storage_path);
      if (row.thumb_path) paths.add(row.thumb_path);
    }
    for (const row of diaries.data ?? []) {
      coupleIds.add(row.couple_id);
      for (const path of row.photo_paths ?? []) if (path) paths.add(path);
    }
    for (const row of logs.data ?? []) {
      coupleIds.add(row.couple_id);
      if (row.video_path) paths.add(row.video_path);
    }

    for (const coupleId of coupleIds) {
      // 상대가 한 명이라도 남아 있으면 그 사람의 고아 파일일 수 있으므로 폴더 전체를 지우지 않는다.
      const others = await admin
        .from("couple_members")
        .select("user_id", { count: "exact", head: true })
        .eq("couple_id", coupleId)
        .neq("user_id", userId);
      if (others.error) throw others.error;

      // 남은 멤버가 없는 공간만 metadata-less orphan까지 포함한다. 현재 업로드는 한 단계 경로다.
      if ((others.count ?? 0) === 0) {
        for (let offset = 0; ; offset += 1000) {
          const { data: objects, error: listError } = await admin.storage
            .from(BUCKET)
            .list(coupleId, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
          if (listError) throw listError;
          for (const object of objects ?? []) if (object.name) paths.add(`${coupleId}/${object.name}`);
          if (!objects || objects.length < 1000) break;
        }
      }
    }

    const allPaths = [...paths];
    for (let index = 0; index < allPaths.length; index += 100) {
      const chunk = allPaths.slice(index, index + 100);
      const { error } = await admin.storage.from(BUCKET).remove(chunk);
      if (error) throw new Error(`storage cleanup failed: ${error.message}`);
    }

    const { data: purgeResult, error: purgeError } = await admin.rpc("purge_account_data", {
      p_user: userId,
    });
    if (purgeError) throw purgeError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ deleted: true, media_removed: allPaths.length, data: purgeResult });
  } catch (error) {
    console.error("manage-account", messageOf(error));
    return json({ error: "account deletion failed" }, 500);
  }
});
