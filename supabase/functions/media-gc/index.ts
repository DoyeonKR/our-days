import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const BUCKET = "couple-photos";
const QUARANTINE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_SCAN = 20_000;
const MAX_DELETE = 200;

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StoredFile = { path: string; createdAt: string | null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function canonicalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/^\/+/, "");
  return path && !path.includes("..") ? path : null;
}

function addPath(target: Set<string>, value: unknown) {
  const path = canonicalPath(value);
  if (path) target.add(path);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!CRON_SECRET || request.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "server configuration missing" }, 500);

  try {
    const input = await request.json().catch(() => ({}));
    const confirm = input?.confirm === true;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    async function allRows(table: string, columns: string): Promise<Record<string, unknown>[]> {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin
          .from(table)
          .select(columns)
          .order("id", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return rows;
    }

    async function referencedPaths(): Promise<Set<string>> {
      const refs = new Set<string>();
      const [photos, diaries, logs, couples] = await Promise.all([
        allRows("couple_photos", "id,storage_path,thumb_path"),
        allRows("deco_entries", "id,photo_paths"),
        allRows("couple_logs", "id,video_path"),
        allRows("couples", "id,cover_path,hung_paths"),
      ]);
      for (const row of photos) {
        addPath(refs, row.storage_path);
        addPath(refs, row.thumb_path);
      }
      for (const row of diaries) {
        if (Array.isArray(row.photo_paths)) row.photo_paths.forEach((path) => addPath(refs, path));
      }
      for (const row of logs) addPath(refs, row.video_path);
      for (const row of couples) {
        addPath(refs, row.cover_path);
        if (Array.isArray(row.hung_paths)) row.hung_paths.forEach((path) => addPath(refs, path));
      }
      return refs;
    }

    async function listTree(): Promise<StoredFile[]> {
      const files: StoredFile[] = [];
      const pending = [{ prefix: "", depth: 0 }];
      while (pending.length) {
        const { prefix, depth } = pending.shift()!;
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
            limit: PAGE_SIZE,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          if (error) throw error;
          for (const object of data ?? []) {
            const path = prefix ? `${prefix}/${object.name}` : object.name;
            const isFolder = !object.id && !object.metadata;
            if (isFolder) {
              if (depth < 4) pending.push({ prefix: path, depth: depth + 1 });
              continue;
            }
            files.push({ path, createdAt: object.created_at ?? null });
            if (files.length > MAX_SCAN) throw new Error("storage scan limit exceeded");
          }
          if (!data || data.length < PAGE_SIZE) break;
        }
      }
      return files;
    }

    async function verifyAbsent(paths: string[]): Promise<string[]> {
      const byParent = new Map<string, Set<string>>();
      for (const path of paths) {
        const slash = path.lastIndexOf("/");
        const parent = slash < 0 ? "" : path.slice(0, slash);
        const name = slash < 0 ? path : path.slice(slash + 1);
        const names = byParent.get(parent) ?? new Set<string>();
        names.add(name);
        byParent.set(parent, names);
      }
      const remaining: string[] = [];
      for (const [parent, names] of byParent) {
        for (let offset = 0; names.size; offset += PAGE_SIZE) {
          const { data, error } = await admin.storage.from(BUCKET).list(parent, {
            limit: PAGE_SIZE,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
          if (error) throw error;
          for (const object of data ?? []) {
            if (names.has(object.name)) remaining.push(parent ? `${parent}/${object.name}` : object.name);
          }
          if (!data || data.length < PAGE_SIZE) break;
        }
      }
      return remaining;
    }

    const firstRefs = await referencedPaths();
    const files = await listTree();
    const cutoff = Date.now() - QUARANTINE_MS;
    let candidates = files
      .filter((file) => {
        const created = file.createdAt ? Date.parse(file.createdAt) : Number.NaN;
        return Number.isFinite(created) && created <= cutoff && !firstRefs.has(file.path);
      })
      .sort((a, b) => Date.parse(a.createdAt!) - Date.parse(b.createdAt!));

    if (!confirm) {
      return json({
        dry_run: true,
        scanned: files.length,
        referenced: firstRefs.size,
        candidates: candidates.length,
        delete_cap: MAX_DELETE,
        sample: candidates.slice(0, 20).map((file) => ({ path: file.path, created_at: file.createdAt })),
      });
    }

    // 삭제 직전 참조를 한 번 더 읽는다. 스캔 중 메타데이터 저장이 끝난 업로드를 지우지 않는다.
    const finalRefs = await referencedPaths();
    candidates = candidates.filter((file) => !finalRefs.has(file.path)).slice(0, MAX_DELETE);
    const paths = candidates.map((file) => file.path);
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(index, index + 100));
      if (error) throw error;
    }
    const remaining = await verifyAbsent(paths);
    if (remaining.length) {
      return json({ error: "storage deletion incomplete", attempted: paths.length, remaining }, 500);
    }
    return json({
      dry_run: false,
      scanned: files.length,
      candidates: candidates.length,
      deleted: paths.length,
      capped: paths.length === MAX_DELETE,
    });
  } catch (error) {
    console.error("media-gc", errorMessage(error));
    return json({ error: "media cleanup failed" }, 500);
  }
});
