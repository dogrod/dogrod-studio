export type PhotoStatus = "draft" | "scheduled" | "published" | "archived";
export type PhotoVisibility = "public" | "unlisted" | "private";

export interface Asset {
  id: string;
  type: "image" | "file";
  url: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  checksum: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Photo {
  id: string;
  title: string | null;
  description: string | null;
  captured_at: string | null;
  uploaded_at: string;
  asset_original_id: string | null;
  width: number;
  height: number;
  aspect_ratio: string | null;
  orientation: "landscape" | "portrait" | "square" | null;
  place_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  dominant_color: string | null;
  blurhash: string | null;
  megapixels: string | null;
  dynamic_range_usage: string | null;
  is_visible: boolean;
  status: PhotoStatus;
  visibility: PhotoVisibility;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface PhotoRendition {
  photo_id: string;
  variant_name: "thumb" | "list" | "detail" | string;
  url: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  checksum: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface PhotoExif {
  photo_id: string;
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length_mm: string | null;
  aperture: string | null;
  shutter_s: string | null;
  iso: number | null;
  exposure_compensation_ev: string | null;
  metering_mode: string | null;
  white_balance_mode: string | null;
  shooting_mode: string | null;
  exif_datetime_original: string | null;
  color_space: string | null;
  bit_depth: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface PhotoHistogram {
  photo_id: string;
  bins: number;
  counts_luma: number[];
  counts_red: number[];
  counts_green: number[];
  counts_blue: number[];
  highlights_pct: number | null;
  shadows_pct: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  color: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface PhotoTag {
  photo_id: string;
  tag_id: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface PhotoDetail extends Photo {
  renditions: PhotoRendition[];
  exif: PhotoExif | null;
  histogram: PhotoHistogram | null;
  tags: Tag[];
}
