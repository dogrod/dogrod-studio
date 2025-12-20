/**
 * Tag types for the Tag Management System.
 * Based on public.tags table and public.tag_stats view.
 */

/**
 * Base tag from the tags table.
 */
export interface Tag {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Tag with usage statistics from tag_stats view.
 * This is the primary type used in the Tag Manager.
 */
export interface TagStats {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  post_count: number;
}

/**
 * Input for creating a new tag.
 */
export interface CreateTagInput {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
}

/**
 * Input for updating an existing tag.
 */
export interface UpdateTagInput {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  color?: string;
}

/**
 * Preset colors for tag badges.
 * These map to Tailwind color classes.
 */
export const TAG_COLOR_PRESETS = [
  { name: "Gray", value: "gray", class: "bg-gray-500" },
  { name: "Red", value: "red", class: "bg-red-500" },
  { name: "Orange", value: "orange", class: "bg-orange-500" },
  { name: "Amber", value: "amber", class: "bg-amber-500" },
  { name: "Yellow", value: "yellow", class: "bg-yellow-500" },
  { name: "Lime", value: "lime", class: "bg-lime-500" },
  { name: "Green", value: "green", class: "bg-green-500" },
  { name: "Emerald", value: "emerald", class: "bg-emerald-500" },
  { name: "Teal", value: "teal", class: "bg-teal-500" },
  { name: "Cyan", value: "cyan", class: "bg-cyan-500" },
  { name: "Sky", value: "sky", class: "bg-sky-500" },
  { name: "Blue", value: "blue", class: "bg-blue-500" },
  { name: "Indigo", value: "indigo", class: "bg-indigo-500" },
  { name: "Violet", value: "violet", class: "bg-violet-500" },
  { name: "Purple", value: "purple", class: "bg-purple-500" },
  { name: "Fuchsia", value: "fuchsia", class: "bg-fuchsia-500" },
  { name: "Pink", value: "pink", class: "bg-pink-500" },
  { name: "Rose", value: "rose", class: "bg-rose-500" },
] as const;

export type TagColorPreset = (typeof TAG_COLOR_PRESETS)[number]["value"];

/**
 * Get the Tailwind class for a tag color.
 */
export function getTagColorClass(color: string | null): string {
  if (!color) return "bg-gray-500";
  const preset = TAG_COLOR_PRESETS.find((p) => p.value === color);
  return preset?.class ?? "bg-gray-500";
}
