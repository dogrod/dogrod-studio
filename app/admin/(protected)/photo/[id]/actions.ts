'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const updatePhotoSchema = z.object({
  photoId: z.string().uuid(),
  title: z.string().trim().max(255).nullable(),
  description: z.string().trim().max(4000).nullable(),
  capturedAt: z.string().datetime().nullable(),
  placeName: z.string().trim().max(255).nullable(),
  city: z.string().trim().max(255).nullable(),
  region: z.string().trim().max(255).nullable(),
  country: z.string().trim().max(255).nullable(),
  isVisible: z.boolean(),
  tagIds: z.array(z.string().uuid()),
});

export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;

export async function updatePhotoAction(input: UpdatePhotoInput) {
  const payload = updatePhotoSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  const updatePayload = {
    title: payload.title,
    description: payload.description,
    captured_at: payload.capturedAt,
    place_name: payload.placeName,
    city: payload.city,
    region: payload.region,
    country: payload.country,
    is_visible: payload.isVisible,
    updated_by: user.id,
  };

  const { error: photoError } = await supabase
    .from("photos")
    .update(updatePayload)
    .eq("id", payload.photoId);

  if (photoError) {
    throw photoError;
  }

  const { error: deleteError } = await supabase
    .from("photo_tag")
    .delete()
    .eq("photo_id", payload.photoId);

  if (deleteError) {
    throw deleteError;
  }

  if (payload.tagIds.length > 0) {
    const tagRows = payload.tagIds.map((tagId) => ({
      photo_id: payload.photoId,
      tag_id: tagId,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: insertError } = await supabase
      .from("photo_tag")
      .insert(tagRows);

    if (insertError) {
      throw insertError;
    }
  }

  revalidatePath(`/admin/photo/${payload.photoId}`);
  revalidatePath("/admin");

  return { success: true };
}
