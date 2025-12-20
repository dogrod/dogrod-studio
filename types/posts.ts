import type { AssetRendition, AssetWithRenditions, Tag } from "./photos";

export type ContentStatus = "draft" | "published" | "archived";
export type Visibility = "public" | "unlisted" | "private";
export type PostLanguage = "zh-CN" | "en-US";

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
  language: PostLanguage;
  translation_group_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Translation link for sidebar display.
 */
export interface TranslationLink {
  id: string;
  language: PostLanguage;
  title: string;
  status: ContentStatus;
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

/**
 * Supported languages in priority order (first = primary).
 */
export const SUPPORTED_LANGUAGES: PostLanguage[] = ["zh-CN", "en-US"];

/**
 * A group of posts sharing the same translation_group_id.
 * Used for the "Matrix View" in the post list.
 */
export interface PostGroup {
  /** The translation_group_id shared by all variants */
  groupId: string;
  /** The primary post to display (prefers zh-CN, fallback to first available) */
  primaryPost: PostListItem;
  /** Map of language variants */
  variants: Partial<Record<PostLanguage, PostListItem>>;
  /** Earliest created_at among all variants (for sorting) */
  createdAt: string;
}
