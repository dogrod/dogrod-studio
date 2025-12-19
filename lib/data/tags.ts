import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tag, TagStats } from "@/types/tags";

/**
 * Fetch all tags with usage statistics from the tag_stats view.
 * The view uses security_invoker, respecting RLS policies.
 */
export async function fetchTagStats(): Promise<TagStats[]> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("tag_stats")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TagStats[];
}

/**
 * Fetch a single tag by ID with full details.
 */
export async function fetchTagById(tagId: string): Promise<Tag | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("id", tagId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Tag | null;
}

/**
 * Fetch all tags for selection (lightweight, no stats).
 */
export async function fetchAllTags(): Promise<Tag[]> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Tag[];
}

/**
 * Check if a tag name is already in use.
 */
export async function isTagNameAvailable(
  name: string,
  excludeTagId?: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("tags")
    .select("id")
    .eq("name", name);

  if (excludeTagId) {
    query = query.neq("id", excludeTagId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data === null;
}

/**
 * Check if a tag slug is already in use.
 */
export async function isTagSlugAvailable(
  slug: string,
  excludeTagId?: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from("tags")
    .select("id")
    .eq("slug", slug);

  if (excludeTagId) {
    query = query.neq("id", excludeTagId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data === null;
}
