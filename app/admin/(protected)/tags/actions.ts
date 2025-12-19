'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isTagNameAvailable, isTagSlugAvailable } from "@/lib/data/tags";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Generate a slug from a tag name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createTagSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z.string().trim().max(100).regex(slugRegex, "Slug must be kebab-case").optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

export async function createTagAction(input: CreateTagInput) {
  const payload = createTagSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Check name uniqueness
  const nameAvailable = await isTagNameAvailable(payload.name);
  if (!nameAvailable) {
    throw new Error("A tag with this name already exists.");
  }

  // Generate slug if not provided
  let slug = payload.slug;
  if (!slug) {
    slug = generateSlug(payload.name);
  }

  // Check slug uniqueness
  if (slug) {
    const slugAvailable = await isTagSlugAvailable(slug);
    if (!slugAvailable) {
      // Auto-generate a unique slug
      let counter = 1;
      let newSlug = `${slug}-${counter}`;
      while (!(await isTagSlugAvailable(newSlug)) && counter < 100) {
        counter++;
        newSlug = `${slug}-${counter}`;
      }
      slug = newSlug;
    }
  }

  const { data: tag, error } = await supabase
    .from("tags")
    .insert({
      name: payload.name,
      slug: slug || null,
      description: payload.description || null,
      color: payload.color || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, name, slug")
    .single();

  if (error) {
    throw error;
  }

  revalidatePath("/admin/tags");

  return { success: true, tag };
}

const updateTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z.string().trim().max(100).regex(slugRegex, "Slug must be kebab-case").optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export async function updateTagAction(input: UpdateTagInput) {
  const payload = updateTagSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Check name uniqueness (excluding current tag)
  const nameAvailable = await isTagNameAvailable(payload.name, payload.id);
  if (!nameAvailable) {
    throw new Error("A tag with this name already exists.");
  }

  // Check slug uniqueness if provided
  if (payload.slug) {
    const slugAvailable = await isTagSlugAvailable(payload.slug, payload.id);
    if (!slugAvailable) {
      throw new Error("A tag with this slug already exists.");
    }
  }

  const { error } = await supabase
    .from("tags")
    .update({
      name: payload.name,
      slug: payload.slug || null,
      description: payload.description || null,
      color: payload.color || null,
      updated_by: user.id,
      // Note: updated_at is handled by DB trigger
    })
    .eq("id", payload.id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/tags");

  return { success: true };
}

const deleteTagSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteTagInput = z.infer<typeof deleteTagSchema>;

export async function deleteTagAction(input: DeleteTagInput) {
  const payload = deleteTagSchema.parse(input);
  await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Note: CASCADE delete will remove photo_tag and post_tag entries automatically
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", payload.id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/tags");

  return { success: true };
}

/**
 * Quick create a tag from the TagInput component.
 * Used for "magic create" when typing a new tag name.
 */
const quickCreateTagSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type QuickCreateTagInput = z.infer<typeof quickCreateTagSchema>;

export async function quickCreateTagAction(input: QuickCreateTagInput) {
  const payload = quickCreateTagSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Check if tag already exists
  const nameAvailable = await isTagNameAvailable(payload.name);
  if (!nameAvailable) {
    // Return existing tag instead of error
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id, name, slug, color")
      .eq("name", payload.name)
      .single();

    if (existingTag) {
      return { success: true, tag: existingTag, created: false };
    }
  }

  // Generate slug
  const slug = generateSlug(payload.name);
  let finalSlug = slug;

  // Ensure slug is unique
  const slugAvailable = await isTagSlugAvailable(slug);
  if (!slugAvailable) {
    let counter = 1;
    finalSlug = `${slug}-${counter}`;
    while (!(await isTagSlugAvailable(finalSlug)) && counter < 100) {
      counter++;
      finalSlug = `${slug}-${counter}`;
    }
  }

  const { data: tag, error } = await supabase
    .from("tags")
    .insert({
      name: payload.name,
      slug: finalSlug,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, name, slug, color")
    .single();

  if (error) {
    throw error;
  }

  revalidatePath("/admin/tags");

  return { success: true, tag, created: true };
}
