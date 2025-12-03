import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const session = user ? { user } : null;

  if (error) {
    throw error;
  }

  return session;
}

export async function requireUser() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return session.user;
}
