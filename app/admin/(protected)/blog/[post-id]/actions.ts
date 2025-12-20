'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isSlugAvailable } from "@/lib/data/posts";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  slug: z.string().trim().min(1, "Slug is required").max(255).regex(slugRegex, "Slug must be kebab-case (e.g., my-post-title)"),
  excerpt: z.string().trim().max(500).nullable(),
  content: z.string().nullable(),
  coverAssetId: z.string().uuid("Cover image is required"),
  galleryPhotoId: z.string().uuid().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  visibility: z.enum(["public", "unlisted", "private"]),
  language: z.enum(["zh-CN", "en-US"]),
  translationGroupId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export async function createPostAction(input: CreatePostInput) {
  const payload = createPostSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Check slug uniqueness
  const slugAvailable = await isSlugAvailable(payload.slug);
  if (!slugAvailable) {
    throw new Error("This slug is already in use. Please choose a different one.");
  }

  const publishedAt = payload.status === "published" ? new Date().toISOString() : null;

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      title: payload.title,
      slug: payload.slug,
      excerpt: payload.excerpt,
      content: payload.content,
      cover_asset_id: payload.coverAssetId,
      gallery_photo_id: payload.galleryPhotoId,
      status: payload.status,
      visibility: payload.visibility,
      language: payload.language,
      translation_group_id: payload.translationGroupId,
      published_at: publishedAt,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (postError) {
    throw postError;
  }

  // Insert tags
  if (payload.tagIds.length > 0) {
    const tagRows = payload.tagIds.map((tagId) => ({
      post_id: post.id,
      tag_id: tagId,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: tagError } = await supabase.from("post_tag").insert(tagRows);

    if (tagError) {
      throw tagError;
    }
  }

  revalidatePath("/admin/blog");

  return { success: true, postId: post.id };
}

const updatePostSchema = z.object({
  postId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(255),
  slug: z.string().trim().min(1, "Slug is required").max(255).regex(slugRegex, "Slug must be kebab-case (e.g., my-post-title)"),
  excerpt: z.string().trim().max(500).nullable(),
  content: z.string().nullable(),
  coverAssetId: z.string().uuid("Cover image is required"),
  galleryPhotoId: z.string().uuid().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  visibility: z.enum(["public", "unlisted", "private"]),
  tagIds: z.array(z.string().uuid()),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export async function updatePostAction(input: UpdatePostInput) {
  const payload = updatePostSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Check slug uniqueness (excluding current post)
  const slugAvailable = await isSlugAvailable(payload.slug, payload.postId);
  if (!slugAvailable) {
    throw new Error("This slug is already in use. Please choose a different one.");
  }

  // Fetch current post to check status transitions
  const { data: currentPost, error: fetchError } = await supabase
    .from("posts")
    .select("status, published_at")
    .eq("id", payload.postId)
    .single();

  if (fetchError || !currentPost) {
    throw new Error("Post not found");
  }

  // Determine published_at
  let publishedAt = currentPost.published_at;
  if (payload.status === "published" && currentPost.status !== "published") {
    // First time publishing
    publishedAt = new Date().toISOString();
  } else if (payload.status !== "published") {
    // Not published, clear published_at (optional: could keep it for "last published" info)
    // For now, we keep the original behavior: published_at is set once when first published
  }

  const { error: updateError } = await supabase
    .from("posts")
    .update({
      title: payload.title,
      slug: payload.slug,
      excerpt: payload.excerpt,
      content: payload.content,
      cover_asset_id: payload.coverAssetId,
      gallery_photo_id: payload.galleryPhotoId,
      status: payload.status,
      visibility: payload.visibility,
      published_at: publishedAt,
      updated_by: user.id,
    })
    .eq("id", payload.postId);

  if (updateError) {
    throw updateError;
  }

  // Update tags: delete all and re-insert
  const { error: deleteTagError } = await supabase
    .from("post_tag")
    .delete()
    .eq("post_id", payload.postId);

  if (deleteTagError) {
    throw deleteTagError;
  }

  if (payload.tagIds.length > 0) {
    const tagRows = payload.tagIds.map((tagId) => ({
      post_id: payload.postId,
      tag_id: tagId,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: insertTagError } = await supabase
      .from("post_tag")
      .insert(tagRows);

    if (insertTagError) {
      throw insertTagError;
    }
  }

  revalidatePath(`/admin/blog/${payload.postId}`);
  revalidatePath("/admin/blog");

  return { success: true };
}

const deletePostSchema = z.object({
  postId: z.string().uuid(),
});

export type DeletePostInput = z.infer<typeof deletePostSchema>;

export async function deletePostAction(input: DeletePostInput) {
  const payload = deletePostSchema.parse(input);
  await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Delete tags first (foreign key constraint)
  const { error: deleteTagError } = await supabase
    .from("post_tag")
    .delete()
    .eq("post_id", payload.postId);

  if (deleteTagError) {
    throw deleteTagError;
  }

  // Delete the post
  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", payload.postId);

  if (deleteError) {
    throw deleteError;
  }

  revalidatePath("/admin/blog");

  return { success: true };
}

const checkSlugSchema = z.object({
  slug: z.string(),
  excludePostId: z.string().uuid().optional(),
});

export type CheckSlugInput = z.infer<typeof checkSlugSchema>;

export async function checkSlugAction(input: CheckSlugInput) {
  const payload = checkSlugSchema.parse(input);
  await requireUser();

  const available = await isSlugAvailable(payload.slug, payload.excludePostId);

  return { available };
}

const createTranslationSchema = z.object({
  sourcePostId: z.string().uuid(),
  targetLanguage: z.enum(["zh-CN", "en-US"]),
});

export type CreateTranslationInput = z.infer<typeof createTranslationSchema>;

/**
 * Create a new translation for an existing post.
 * Copies the translation_group_id, cover_asset_id, gallery_photo_id, and tags.
 */
export async function createTranslationAction(input: CreateTranslationInput) {
  const payload = createTranslationSchema.parse(input);
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();

  // Fetch source post
  const { data: sourcePost, error: fetchError } = await supabase
    .from("posts")
    .select("*, post_tag(tag_id)")
    .eq("id", payload.sourcePostId)
    .single();

  if (fetchError || !sourcePost) {
    throw new Error("Source post not found");
  }

  // Check if translation already exists for this language
  const { data: existingTranslation } = await supabase
    .from("posts")
    .select("id")
    .eq("translation_group_id", sourcePost.translation_group_id)
    .eq("language", payload.targetLanguage)
    .maybeSingle();

  if (existingTranslation) {
    throw new Error(`A ${payload.targetLanguage} translation already exists for this post.`);
  }

  // Generate a default slug based on source slug + language suffix
  const baseSlug = sourcePost.slug.replace(/-zh$|-en$/, "");
  const langSuffix = payload.targetLanguage === "en-US" ? "-en" : "-zh";
  let newSlug = `${baseSlug}${langSuffix}`;

  // Check if slug is available, if not add a number
  let slugAvailable = await isSlugAvailable(newSlug);
  let counter = 1;
  while (!slugAvailable && counter < 100) {
    newSlug = `${baseSlug}${langSuffix}-${counter}`;
    slugAvailable = await isSlugAvailable(newSlug);
    counter++;
  }

  // Create the translation post
  const { data: newPost, error: createError } = await supabase
    .from("posts")
    .insert({
      title: `[${payload.targetLanguage}] ${sourcePost.title}`,
      slug: newSlug,
      excerpt: null,
      content: null,
      cover_asset_id: sourcePost.cover_asset_id,
      gallery_photo_id: sourcePost.gallery_photo_id,
      status: "draft",
      visibility: sourcePost.visibility,
      language: payload.targetLanguage,
      translation_group_id: sourcePost.translation_group_id,
      published_at: null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  // Copy tags from source post
  const sourceTags = sourcePost.post_tag as Array<{ tag_id: string }> | null;
  if (sourceTags && sourceTags.length > 0) {
    const tagRows = sourceTags.map((tag) => ({
      post_id: newPost.id,
      tag_id: tag.tag_id,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: tagError } = await supabase.from("post_tag").insert(tagRows);

    if (tagError) {
      console.error("Failed to copy tags:", tagError);
      // Don't throw - tags are optional
    }
  }

  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${payload.sourcePostId}`);

  return { success: true, postId: newPost.id };
}
