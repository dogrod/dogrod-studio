import { redirect } from "next/navigation";
import { AuthSessionMissingError } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // When no session exists, Supabase returns AuthSessionMissingError
  // We should return null instead of throwing, allowing requireUser() to redirect
  if (error) {
    if (error instanceof AuthSessionMissingError) {
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
