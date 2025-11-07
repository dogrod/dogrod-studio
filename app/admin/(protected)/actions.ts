'use server';

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export async function setPhotoVisibilityAction(photoId: string, isVisible: boolean) {
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase
    .from("photos")
    .update({
      is_visible: isVisible,
      updated_by: user.id,
    })
    .eq("id", photoId);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");

  return { success: true };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
