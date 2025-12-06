import { redirect } from "next/navigation";
import { AuthSessionMissingError, AuthApiError } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // When no session exists, Supabase returns AuthSessionMissingError
  // When refresh token is invalid/expired, Supabase returns AuthApiError
  // We should return null instead of throwing, allowing requireUser() to redirect
  if (error) {
    if (error instanceof AuthSessionMissingError) {
      return null;
    }
    // Handle invalid refresh token error - treat as session missing
    if (error instanceof AuthApiError && error.message.includes("Refresh Token")) {
      return null;
    }
    throw error;
  }

  return user ? { user } : null;
}

export async function requireUser() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return session.user;
}
