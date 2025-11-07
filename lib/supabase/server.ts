import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";

type CookieOptions = {
  expires?: Date;
  maxAge?: number;
  domain?: string;
  path?: string;
  sameSite?: "strict" | "lax" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  priority?: "low" | "medium" | "high";
};

const env = getEnv();

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // ignore if cookies() is read-only (e.g. during SSR render)
        }
      },
      remove(name: string, options?: CookieOptions) {
        try {
          cookieStore.delete({ name, ...options });
        } catch {
          // ignore if cookies() is read-only
        }
      },
    },
  });
}

export function createSupabaseServiceRoleClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}
