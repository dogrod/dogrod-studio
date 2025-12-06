'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { reverseGeocode } from "@/lib/mapbox/geocoder";
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

  revalidatePath(`/admin/gallery/photos/${payload.photoId}`);
  revalidatePath("/admin/gallery");

  return { success: true };
}

const geocodePhotoSchema = z.object({
  photoId: z.string().uuid(),
});

export type GeocodePhotoInput = z.infer<typeof geocodePhotoSchema>;

export async function geocodePhotoAction(input: GeocodePhotoInput) {
  const payload = geocodePhotoSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();
  const env = getEnv();

  if (!env.MAPBOX_ACCESS_TOKEN) {
    throw new Error("MapBox access token is not configured");
  }

  // Fetch photo's coordinates
  const { data: photo, error: fetchError } = await supabase
    .from("photos")
    .select("latitude, longitude, place_name, city, region, country")
    .eq("id", payload.photoId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  if (!photo) {
    throw new Error("Photo not found");
  }

  if (photo.latitude === null || photo.longitude === null) {
    throw new Error("Photo does not have GPS coordinates");
  }

  // Call MapBox reverse geocoding
  const location = await reverseGeocode(
    photo.latitude,
    photo.longitude,
    env.MAPBOX_ACCESS_TOKEN,
  );

  if (!location) {
    throw new Error("Could not determine location from coordinates");
  }

  // Update photo with location info
  const { error: updateError } = await supabase
    .from("photos")
    .update({
      place_name: location.placeName,
      city: location.city,
      region: location.region,
      country: location.country,
      updated_by: user.id,
    })
    .eq("id", payload.photoId);

  if (updateError) {
    throw updateError;
  }

  revalidatePath(`/admin/gallery/photos/${payload.photoId}`);
  revalidatePath("/admin/gallery");

  return { success: true, location };
}

