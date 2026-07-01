// Supabase 클라이언트 (브라우저). env 가 없으면 null 을 돌려 앱이 로컬 모드로 동작.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 커플 연동(Supabase) 사용 가능 여부. env 두 개가 모두 있어야 함. */
export const isSupabaseConfigured = Boolean(url && anon);

let _client: SupabaseClient | null = null;

/** 설정돼 있으면 싱글턴 클라이언트, 아니면 null. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) {
    _client = createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return _client;
}
