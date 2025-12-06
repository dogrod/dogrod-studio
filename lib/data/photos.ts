import { addYears } from "date-fns";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  Photo,
  PhotoDetail,
  PhotoExif,
  PhotoHistogram,
  PhotoRendition,
  Tag,
} from "@/types/photos";

export type PhotoListVisibilityFilter = "all" | "visible" | "hidden";
export type PhotoListSortBy = "added" | "taken";

export interface PhotoListFilters {
  page?: number;
  visibility?: PhotoListVisibilityFilter;
  year?: number;
  sortBy?: PhotoListSortBy;
}

export interface PhotoListItem extends Photo {
  renditions: PhotoRendition[];
}

export interface PhotoListResponse {
  items: PhotoListItem[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
  availableYears: number[];
}

const PHOTO_LIST_PAGE_SIZE = 20;

export async function fetchPhotoList({
  page = 1,
  visibility = "all",
  year,
  sortBy = "added",
}: PhotoListFilters): Promise<PhotoListResponse> {
  const supabase = createSupabaseServiceRoleClient();
  const offset = (page - 1) * PHOTO_LIST_PAGE_SIZE;

  let query = supabase
    .from("photos")
    .select(
      `*, photo_rendition(variant_name, url, width, height, file_size, checksum)`,
      { count: "exact" },
    );

  // Apply sorting based on sortBy parameter
  if (sortBy === "taken") {
    // Sort by capture date (date taken), with fallback to upload date for photos without capture date
    query = query
    .order("captured_at", { ascending: false, nullsFirst: false })
      .order("uploaded_at", { ascending: false });
  } else {
    // Sort by upload date (date added) - default
    query = query.order("uploaded_at", { ascending: false });
  }

  query = query.range(offset, offset + PHOTO_LIST_PAGE_SIZE - 1);

  if (visibility === "visible") {
    query = query.eq("is_visible", true);
  } else if (visibility === "hidden") {
    query = query.eq("is_visible", false);
  }

  if (year) {
    const start = new Date(Date.UTC(year, 0, 1)).toISOString();
    const end = addYears(new Date(start), 1).toISOString();
    query = query.or(
      `and(captured_at.gte.${start},captured_at.lt.${end}),and(captured_at.is.null,uploaded_at.gte.${start},uploaded_at.lt.${end})`,
      { referencedTable: "photos" },
    );
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PHOTO_LIST_PAGE_SIZE));

  const availableYears = await fetchDistinctYears();

  const items = (data as (Photo & { photo_rendition: PhotoRendition[] | null })[] | null)?.map(
    (row) => ({
      ...row,
      renditions: row.photo_rendition ?? [],
    }),
  );

  return {
    items: items ?? [],
    total,
    pages,
    page,
    pageSize: PHOTO_LIST_PAGE_SIZE,
    availableYears,
  };
}

let cachedYears: Promise<number[]> | null = null;

export async function invalidatePhotoYearCache() {
  cachedYears = null;
}

async function fetchDistinctYears(): Promise<number[]> {
  if (!cachedYears) {
    cachedYears = loadYears().catch((error) => {
      cachedYears = null;
      throw error;
    });
  }
  return cachedYears;
}

async function loadYears(): Promise<number[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("photos")
    .select("captured_at, uploaded_at")
    .order("captured_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) {
    throw error;
  }

  const years = new Set<number>();

  for (const row of data ?? []) {
    const captured = row.captured_at ? new Date(row.captured_at) : null;
    const uploaded = row.uploaded_at ? new Date(row.uploaded_at) : null;
    const source = captured ?? uploaded;
    if (source) {
      years.add(source.getUTCFullYear());
    }
  }

  const sorted = Array.from(years.values()).sort((a, b) => b - a);
  return sorted;
}

export async function fetchPhotoDetail(photoId: string): Promise<PhotoDetail | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("photos")
    .select(
      `*,
      photo_rendition(variant_name, url, width, height, file_size, checksum),
      photo_exif(*),
      photo_histogram(*),
      photo_tag(tag_id, tags(id, name, slug, description, color))
    `,
    )
    .eq("id", photoId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as Photo & {
    photo_rendition: PhotoRendition[] | null;
    photo_exif: PhotoExif | null;
    photo_histogram: PhotoHistogram | null;
    photo_tag:
      | Array<{
          tag_id: string;
          tags: Tag | null;
        }>
      | null;
  };

  const tags = (row.photo_tag ?? [])
    .map((entry) => entry.tags)
    .filter((tag): tag is Tag => Boolean(tag));

  return {
    ...(row as Photo),
    renditions: row.photo_rendition ?? [],
    exif: row.photo_exif,
    histogram: row.photo_histogram,
    tags,
  };
}

export async function fetchAllTags(): Promise<Tag[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}
