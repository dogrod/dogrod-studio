import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  Post,
  PostListItem,
  PostDetail,
  ContentStatus,
  PhotoPickerItem,
  TranslationLink,
  PostLanguage,
} from "@/types/posts";
import type { AssetRendition, AssetWithRenditions, Tag } from "@/types/photos";

export type PostListStatusFilter = "all" | ContentStatus;
export type PostListSortBy = "created" | "published" | "title";

export interface PostListFilters {
  page?: number;
  status?: PostListStatusFilter;
  sortBy?: PostListSortBy;
}

export interface PostListResponse {
  items: PostListItem[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
}

const POST_LIST_PAGE_SIZE = 20;

export async function fetchPostList({
  page = 1,
  status = "all",
  sortBy = "created",
}: PostListFilters): Promise<PostListResponse> {
  const supabase = createSupabaseServiceRoleClient();
  const offset = (page - 1) * POST_LIST_PAGE_SIZE;

  let query = supabase
    .from("posts")
    .select(
      `*, cover_asset:cover_asset_id(id, dominant_color, blurhash, asset_rendition(*))`,
      { count: "exact" }
    );

  // Apply status filter
  if (status !== "all") {
    query = query.eq("status", status);
  }

  // Apply sorting
  switch (sortBy) {
    case "published":
      query = query
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "created":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + POST_LIST_PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / POST_LIST_PAGE_SIZE));

  const items = (
    data as (Post & { cover_asset: AssetWithRenditions | null })[] | null
  )?.map((row) => ({
    ...row,
    cover_asset: row.cover_asset ?? null,
  }));

  return {
    items: items ?? [],
    total,
    pages,
    page,
    pageSize: POST_LIST_PAGE_SIZE,
  };
}

export async function fetchPostDetail(postId: string): Promise<PostDetail | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `*,
      cover_asset:cover_asset_id(id, dominant_color, blurhash, asset_rendition(*)),
      gallery_photo:gallery_photo_id(id, title, asset_original_id),
      post_tag(tag_id, tags(id, name, slug, description, color))
    `
    )
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as Post & {
    cover_asset: AssetWithRenditions | null;
    gallery_photo: {
      id: string;
      title: string | null;
      asset_original_id: string;
    } | null;
    post_tag:
      | Array<{
          tag_id: string;
          tags: Tag | null;
        }>
      | null;
  };

  const tags = (row.post_tag ?? [])
    .map((entry) => entry.tags)
    .filter((tag): tag is Tag => Boolean(tag));

  return {
    ...(row as Post),
    cover_asset: row.cover_asset ?? null,
    gallery_photo: row.gallery_photo,
    tags,
  };
}

export async function fetchPostBySlug(slug: string): Promise<PostDetail | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `*,
      cover_asset:cover_asset_id(id, dominant_color, blurhash, asset_rendition(*)),
      gallery_photo:gallery_photo_id(id, title, asset_original_id),
      post_tag(tag_id, tags(id, name, slug, description, color))
    `
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as Post & {
    cover_asset: AssetWithRenditions | null;
    gallery_photo: {
      id: string;
      title: string | null;
      asset_original_id: string;
    } | null;
    post_tag:
      | Array<{
          tag_id: string;
          tags: Tag | null;
        }>
      | null;
  };

  const tags = (row.post_tag ?? [])
    .map((entry) => entry.tags)
    .filter((tag): tag is Tag => Boolean(tag));

  return {
    ...(row as Post),
    cover_asset: row.cover_asset ?? null,
    gallery_photo: row.gallery_photo,
    tags,
  };
}

/**
 * Fetch photos available for cover image selection.
 * Returns published photos with their renditions.
 */
export async function fetchPhotosForPicker(
  page = 1,
  search?: string
): Promise<{
  items: PhotoPickerItem[];
  total: number;
  pages: number;
  page: number;
}> {
  const supabase = createSupabaseServiceRoleClient();
  const pageSize = 12;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("photos")
    .select(
      `id, title, asset_original_id, assets:asset_original_id(id, asset_rendition(*))`,
      { count: "exact" }
    )
    .eq("status", "published")
    .eq("is_visible", true)
    .order("captured_at", { ascending: false, nullsFirst: false })
    .order("uploaded_at", { ascending: false });

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const items: PhotoPickerItem[] = (data ?? []).map((row) => {
    // Handle the case where assets could be an object or null from the join
    const rawAssets = row.assets as unknown;
    const assets = (rawAssets && typeof rawAssets === 'object' && !Array.isArray(rawAssets))
      ? (rawAssets as { id: string; asset_rendition: Array<{ asset_id: string; variant_name: string; url: string }> })
      : null;
    return {
      id: row.id as string,
      title: row.title as string | null,
      asset_original_id: row.asset_original_id as string,
      renditions: (assets?.asset_rendition ?? []) as AssetRendition[],
    };
  });

  return {
    items,
    total,
    pages,
    page,
  };
}

/**
 * Check if a slug is already in use by another post.
 */
export async function isSlugAvailable(
  slug: string,
  excludePostId?: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("posts")
    .select("id")
    .eq("slug", slug);

  if (excludePostId) {
    query = query.neq("id", excludePostId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data === null;
}

/**
 * Fetch all translations for a given translation group.
 * Returns posts in the same translation group, excluding the current post.
 */
export async function fetchTranslations(
  translationGroupId: string,
  excludePostId?: string
): Promise<TranslationLink[]> {
  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("posts")
    .select("id, language, title, status")
    .eq("translation_group_id", translationGroupId)
    .order("language", { ascending: true });

  if (excludePostId) {
    query = query.neq("id", excludePostId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    language: row.language as PostLanguage,
    title: row.title as string,
    status: row.status as ContentStatus,
  }));
}

/**
 * Get all languages that exist for a translation group.
 */
export async function getExistingLanguages(
  translationGroupId: string
): Promise<PostLanguage[]> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("posts")
    .select("language")
    .eq("translation_group_id", translationGroupId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.language as PostLanguage);
}
