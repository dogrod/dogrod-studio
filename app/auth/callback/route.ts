import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Handle password recovery flow
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/admin/update-password", origin));
      }

      // Default: redirect to intended destination (magic link sign-in)
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Auth code exchange failed - redirect to login with error
  const loginUrl = new URL("/admin/login", origin);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}

