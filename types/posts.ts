import type { AssetRendition, AssetWithRenditions, Tag } from "./photos";

export type ContentStatus = "draft" | "published" | "archived";
export type Visibility = "public" | "unlisted" | "private";

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_asset_id: string;
  gallery_photo_id: string | null;
  status: ContentStatus;
  published_at: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Post with cover asset and renditions for list view.
 */
export interface PostListItem extends Post {
  cover_asset: AssetWithRenditions | null;
}

/**
 * Full post detail with all related data for editing.
 */
export interface PostDetail extends Post {
  cover_asset: AssetWithRenditions | null;
  tags: Tag[];
  gallery_photo?: {
    id: string;
    title: string | null;
    asset_original_id: string;
  } | null;
}

/**
 * Photo item for cover image picker.
 */
export interface PhotoPickerItem {
  id: string;
  title: string | null;
  asset_original_id: string;
  renditions: AssetRendition[];
}
