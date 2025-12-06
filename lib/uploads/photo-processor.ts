/**
 * Photo Processing Pipeline
 *
 * ⚠️ KNOWN LIMITATIONS & BOTTLENECKS:
 *
 * 1. MEMORY USAGE (Risk: Medium)
 *    - Vercel Serverless: 1024MB (Hobby) / 3008MB (Pro)
 *    - Worst case for 50MB image: ~300-500MB memory
 *    - If OOM occurs: reduce MAX_FILE_SIZE or upgrade plan
 *
 * 2. EXECUTION TIME (Risk: Low-Medium)
 *    - Vercel Serverless: 60s (Hobby) / 300s (Pro)
 *    - Typical processing: 15-30s for large images
 *    - If timeout: consider async processing with queue
 *
 * 3. R2 READ LATENCY (Risk: Low)
 *    - Reading 50MB file: 2-5s typically
 *    - Retry mechanism handles transient failures
 *
 * 4. SHARP PROCESSING (Risk: Low)
 *    - CPU-bound, 5-15s for renditions generation
 *    - Serial processing to minimize peak memory
 *
 * Processing Flow:
 * Phase 1: Read original file from R2 (with retry)
 * Phase 2: Extract metadata (EXIF, dimensions) - single pass
 * Phase 3: Write basic data to database (assets, photos, photo_exif)
 * Phase 4: Generate renditions serially (thumb -> list -> detail)
 * Phase 5: Upload renditions to R2 (with retry)
 * Phase 6: Compute derived data (histogram, blurhash, dominant color)
 * Phase 7: Write derived data and update photo record
 */

import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { encode as encodeBlurhash } from "blurhash";
import exifr from "exifr";
import sharp from "sharp";

import { withRetry } from "@/lib/async-retry";
import { invalidatePhotoYearCache } from "@/lib/data/photos";
import { getR2Bucket, getR2Client, getR2PublicBaseUrl } from "@/lib/r2";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { enqueueGeocodeTask } from "@/lib/tasks/geocode-photo";
import type { Photo } from "@/types/photos";

// ============================================================================
// Configuration
// ============================================================================

/** Maximum retry attempts for each retriable operation */
const MAX_RETRY_ATTEMPTS = 3;

/** Retry configuration for R2 operations */
const R2_RETRY_OPTIONS = {
  maxAttempts: MAX_RETRY_ATTEMPTS,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

type RenditionConfig = {
  name: "thumb" | "list" | "detail";
  maxSize: number;
  quality: number;
};

/** Rendition configurations - processed serially to minimize memory usage */
const RENDITIONS: RenditionConfig[] = [
  { name: "thumb", maxSize: 320, quality: 80 },
  { name: "list", maxSize: 1024, quality: 88 },
  { name: "detail", maxSize: 2048, quality: 92 },
];

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ============================================================================
// Types
// ============================================================================

export interface ProcessFromR2Context {
  /** Storage ID (UUID) used as the folder name in R2 */
  storageId: string;
  /** R2 object key for the original file */
  originalKey: string;
  /** Original filename for title derivation */
  originalFilename: string;
  /** Content type of the original file */
  contentType: string;
  /** User ID for audit fields */
  userId: string;
}

export interface ProcessedPhotoResult {
  photoId: string;
  detailUrl: string;
}

interface GeneratedRendition {
  name: RenditionConfig["name"];
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
  checksum: string;
  url: string;
  key: string;
}

interface ExifData {
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  focalLength: number | null;
  aperture: number | null;
  shutterSpeed: number | null;
  iso: number | null;
  exposureCompensation: number | null;
  meteringMode: string | null;
  whiteBalance: string | null;
  shootingMode: string | null;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  colorSpace: string | null;
  bitDepth: number | null;
  description: string | null;
}

interface HistogramResult {
  countsLuma: number[];
  countsRed: number[];
  countsGreen: number[];
  countsBlue: number[];
  highlightsPct: number;
  shadowsPct: number;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Process a photo that has been uploaded directly to R2.
 * This is the main entry point called after client completes direct upload.
 *
 * ⚠️ MEMORY WARNING: This function loads the entire original file into memory.
 * For 50MB files, expect ~300-500MB peak memory usage during processing.
 */
export async function processPhotoFromR2(
  context: ProcessFromR2Context
): Promise<ProcessedPhotoResult> {
  const { storageId, originalKey, originalFilename, contentType, userId } =
    context;
  const publicBase = getR2PublicBaseUrl();
  const photoId = randomUUID();
  const assetId = randomUUID();
  const now = new Date().toISOString();

  console.log("[photo-processor] Starting processing", {
    storageId,
    photoId,
    originalKey,
  });

  // --------------------------------------------------------------------------
  // Phase 1: Read original file from R2 (with retry)
  // ⚠️ MEMORY: Loads entire file into memory
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 1: Reading original from R2");

  const readResult = await withRetry(
    () => readFileFromR2(originalKey),
    {
      ...R2_RETRY_OPTIONS,
      operationName: "r2-read-original",
      context: { storageId, originalKey },
    }
  );

  if (!readResult.success) {
    throw new Error(
      `Failed to read original file from R2 after ${MAX_RETRY_ATTEMPTS} attempts: ${readResult.error.message}`
    );
  }

  const originalBuffer = readResult.data;
  const originalSize = originalBuffer.length;

  console.log("[photo-processor] Phase 1 complete", {
    size: originalSize,
    attempts: readResult.attempts,
  });

  // --------------------------------------------------------------------------
  // Phase 2: Extract metadata (single pass through buffer)
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 2: Extracting metadata");

  const basePipeline = sharp(originalBuffer, { failOnError: false }).rotate();
  const metadata = await basePipeline.metadata();

  if (!metadata.width || !metadata.height) {
    await cleanupR2Object(originalKey);
    throw new Error("Unable to read image dimensions.");
  }

  const derivedType = metadata.format ? `image/${metadata.format}` : "";
  const matchesType = contentType && ACCEPTED_TYPES.has(contentType);
  const matchesDerived = derivedType && ACCEPTED_TYPES.has(derivedType);

  if (!matchesType && !matchesDerived) {
    await cleanupR2Object(originalKey);
    throw new Error("Unsupported file type. Allowed: JPEG, PNG, WebP.");
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  const originalChecksum = createHash("sha256").update(originalBuffer).digest("hex");
  const originalUrl = combineUrl(publicBase, originalKey);

  // Extract EXIF - this is a single-pass operation
  const exif = await extractExif(originalBuffer);

  console.log("[photo-processor] Phase 2 complete", {
    width: originalWidth,
    height: originalHeight,
    hasExif: !!exif,
  });

  // --------------------------------------------------------------------------
  // Phase 3: Write basic data to database
  // This happens early so we have a record even if later processing fails
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 3: Writing basic data to database");

  const supabase = createSupabaseServiceRoleClient();
  const aspectRatio = (originalWidth / originalHeight).toFixed(4);
  const orientation = deriveOrientation(originalWidth, originalHeight);
  const megapixels = ((originalWidth * originalHeight) / 1_000_000).toFixed(2);
  const capturedAt = exif?.capturedAt ?? null;

  // Insert asset record
  const { error: assetError } = await supabase.from("assets").insert({
    id: assetId,
    type: "image",
    url: originalUrl,
    width: originalWidth,
    height: originalHeight,
    file_size: originalSize,
    checksum: originalChecksum,
    created_by: userId,
    updated_by: userId,
  });

  if (assetError) {
    await cleanupR2Object(originalKey);
    throw new Error(`Failed to insert asset: ${assetError.message}`);
  }

  // Insert photo record (without derived fields like blurhash, dominant_color)
  const photoRecord: Partial<Photo> = {
    id: photoId,
    title: deriveTitle(originalFilename),
    description: exif?.description ?? null,
    captured_at: capturedAt,
    uploaded_at: now,
    asset_original_id: assetId,
    width: originalWidth,
    height: originalHeight,
    aspect_ratio: aspectRatio,
    orientation,
    place_name: null,
    city: null,
    region: null,
    country: null,
    latitude: exif?.latitude ?? null,
    longitude: exif?.longitude ?? null,
    dominant_color: null, // Will be updated in Phase 7
    blurhash: null, // Will be updated in Phase 7
    megapixels,
    dynamic_range_usage: null, // Will be updated in Phase 7
    is_visible: false, // Hidden until processing complete
    status: "draft", // Mark as draft until processing complete, then publish
    visibility: "private", // Private until processing complete and published
    created_by: userId,
    created_at: now,
    updated_by: userId,
    updated_at: now,
  } as Photo;

  const { error: photoError } = await supabase.from("photos").insert(photoRecord);

  if (photoError) {
    await supabase.from("assets").delete().eq("id", assetId);
    await cleanupR2Object(originalKey);
    throw new Error(`Failed to insert photo: ${photoError.message}`);
  }

  // Insert EXIF data if available
  if (exif) {
    const { error: exifError } = await supabase.from("photo_exif").insert({
      photo_id: photoId,
      camera_make: exif.cameraMake,
      camera_model: exif.cameraModel,
      lens_model: exif.lensModel,
      focal_length_mm: exif.focalLength,
      aperture: exif.aperture,
      shutter_s: exif.shutterSpeed,
      iso: exif.iso,
      exposure_compensation_ev: exif.exposureCompensation,
      metering_mode: exif.meteringMode,
      white_balance_mode: exif.whiteBalance,
      shooting_mode: exif.shootingMode,
      exif_datetime_original: exif.capturedAt,
      color_space: exif.colorSpace,
      bit_depth: exif.bitDepth,
      created_by: userId,
      updated_by: userId,
    });

    if (exifError) {
      console.warn("[photo-processor] Failed to insert EXIF, continuing", {
        photoId,
        error: exifError.message,
      });
    }
  }

  console.log("[photo-processor] Phase 3 complete", { photoId, assetId });

  // --------------------------------------------------------------------------
  // Phase 4: Generate renditions serially
  // ⚠️ MEMORY: Each rendition is generated one at a time to reduce peak memory
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 4: Generating renditions");

  const renditions: GeneratedRendition[] = [];

  for (const config of RENDITIONS) {
    console.log(`[photo-processor] Generating ${config.name} rendition`);
    const rendition = await generateSingleRendition(
      originalBuffer,
      storageId,
      config,
      publicBase
    );
    renditions.push(rendition);
  }

  console.log("[photo-processor] Phase 4 complete", {
    renditionCount: renditions.length,
  });

  // --------------------------------------------------------------------------
  // Phase 5: Upload renditions to R2 (with retry for each)
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 5: Uploading renditions to R2");

  for (const rendition of renditions) {
    const uploadResult = await withRetry(
      () => uploadRenditionToR2(rendition),
      {
        ...R2_RETRY_OPTIONS,
        operationName: `r2-upload-${rendition.name}`,
        context: { storageId, key: rendition.key },
      }
    );

    if (!uploadResult.success) {
      // Cleanup and fail
      await cleanupPhotoRecords(supabase, photoId, assetId);
      await deleteR2Objects([originalKey, ...renditions.map((r) => r.key)]);
      throw new Error(
        `Failed to upload ${rendition.name} rendition after ${MAX_RETRY_ATTEMPTS} attempts: ${uploadResult.error.message}`
      );
    }
  }

  // Insert rendition records
  const { error: renditionError } = await supabase.from("photo_rendition").insert(
    renditions.map((rendition) => ({
      photo_id: photoId,
      variant_name: rendition.name,
      url: rendition.url,
      width: rendition.width,
      height: rendition.height,
      file_size: rendition.fileSize,
      checksum: rendition.checksum,
      created_by: userId,
      updated_by: userId,
    }))
  );

  if (renditionError) {
    console.warn("[photo-processor] Failed to insert renditions, continuing", {
      photoId,
      error: renditionError.message,
    });
  }

  console.log("[photo-processor] Phase 5 complete");

  // --------------------------------------------------------------------------
  // Phase 6: Compute derived data (serial to minimize memory)
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 6: Computing derived data");

  const detailRendition = renditions.find((r) => r.name === "detail");
  const listRendition = renditions.find((r) => r.name === "list");

  if (!detailRendition || !listRendition) {
    throw new Error("Missing required renditions for derived data computation");
  }

  // Compute histogram from detail rendition
  const histogram = await computeHistogram(detailRendition.buffer);

  // Compute dominant color from detail rendition
  const dominantColor = await computeDominantColor(detailRendition.buffer);

  // Compute blurhash from list rendition (smaller = faster)
  const blurhash = await computeBlurhash(listRendition.buffer);

  const dynamicRangeUsage = Math.max(
    0,
    100 - histogram.highlightsPct - histogram.shadowsPct
  ).toFixed(2);

  console.log("[photo-processor] Phase 6 complete", {
    dominantColor,
    blurhashLength: blurhash.length,
  });

  // --------------------------------------------------------------------------
  // Phase 7: Write derived data and finalize
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Phase 7: Writing derived data");

  // Insert histogram
  const { error: histogramError } = await supabase.from("photo_histogram").insert({
    photo_id: photoId,
    bins: 256,
    counts_luma: histogram.countsLuma,
    counts_red: histogram.countsRed,
    counts_green: histogram.countsGreen,
    counts_blue: histogram.countsBlue,
    highlights_pct: Number(histogram.highlightsPct.toFixed(2)),
    shadows_pct: Number(histogram.shadowsPct.toFixed(2)),
    created_by: userId,
    updated_by: userId,
  });

  if (histogramError) {
    console.warn("[photo-processor] Failed to insert histogram, continuing", {
      photoId,
      error: histogramError.message,
    });
  }

  // Update photo with derived fields and mark as published
  // Only published photos can have public visibility
  const { error: updateError } = await supabase
    .from("photos")
    .update({
      dominant_color: dominantColor,
      blurhash,
      dynamic_range_usage: dynamicRangeUsage,
      status: "published",
      visibility: "public", // Now safe to make public since processing is complete
      is_visible: true, // Make visible after successful processing
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId);

  if (updateError) {
    console.warn("[photo-processor] Failed to update photo status, continuing", {
      photoId,
      error: updateError.message,
    });
  }

  // Invalidate cache
  await invalidatePhotoYearCache();

  // Fire-and-forget: trigger background geocoding if coordinates exist
  if (exif?.latitude != null && exif?.longitude != null) {
    enqueueGeocodeTask(photoId, exif.latitude, exif.longitude, userId);
  }

  console.log("[photo-processor] Processing complete", {
    photoId,
    detailUrl: detailRendition.url,
  });

  return { photoId, detailUrl: detailRendition.url };
}

// ============================================================================
// R2 Operations
// ============================================================================

async function readFileFromR2(key: string): Promise<Buffer> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error("Empty response body from R2");
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function uploadRenditionToR2(rendition: GeneratedRendition): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: rendition.key,
      Body: rendition.buffer,
      ContentType: "image/jpeg",
      CacheControl: CACHE_CONTROL,
    })
  );
}

async function cleanupR2Object(key: string): Promise<void> {
  try {
    const client = getR2Client();
    const bucket = getR2Bucket();

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch (error) {
    console.warn("[photo-processor] Failed to cleanup R2 object", { key, error });
  }
}

async function deleteR2Objects(keys: string[]): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await Promise.all(
    keys.map((key) =>
      client
        .send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        )
        .catch(() => undefined)
    )
  );
}

// ============================================================================
// Database Cleanup
// ============================================================================

async function cleanupPhotoRecords(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  photoId: string,
  assetId: string
): Promise<void> {
  try {
    await supabase.from("photo_histogram").delete().eq("photo_id", photoId);
    await supabase.from("photo_rendition").delete().eq("photo_id", photoId);
    await supabase.from("photo_exif").delete().eq("photo_id", photoId);
    await supabase.from("photos").delete().eq("id", photoId);
    await supabase.from("assets").delete().eq("id", assetId);
  } catch (error) {
    console.warn("[photo-processor] Failed to cleanup database records", {
      photoId,
      assetId,
      error,
    });
  }
}

// ============================================================================
// Image Processing
// ============================================================================

async function generateSingleRendition(
  originalBuffer: Buffer,
  storageId: string,
  config: RenditionConfig,
  publicBase: string
): Promise<GeneratedRendition> {
  const cloned = sharp(originalBuffer, { failOnError: false })
    .rotate()
    .toColorspace("srgb")
    .resize({
      width: config.maxSize,
      height: config.maxSize,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: config.quality,
      mozjpeg: true,
    });

  const { data, info } = await cloned.toBuffer({ resolveWithObject: true });
  const width = info.width ?? config.maxSize;
  const height = info.height ?? config.maxSize;
  const fileSize = info.size ?? data.length;

  const key = `photos/${storageId}/${config.name}.jpg`;
  const url = combineUrl(publicBase, key);
  const checksum = createHash("sha256").update(data).digest("hex");

  return {
    name: config.name,
    buffer: data,
    width,
    height,
    fileSize,
    checksum,
    url,
    key,
  };
}

async function computeHistogram(buffer: Buffer): Promise<HistogramResult> {
  const image = sharp(buffer).removeAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const buckets = 256;
  const countsLuma = new Array(buckets).fill(0);
  const countsRed = new Array(buckets).fill(0);
  const countsGreen = new Array(buckets).fill(0);
  const countsBlue = new Array(buckets).fill(0);

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = Math.max(
      0,
      Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b))
    );

    countsRed[r] += 1;
    countsGreen[g] += 1;
    countsBlue[b] += 1;
    countsLuma[luma] += 1;
  }

  const totalPixels = info.width * info.height;
  const highlightBins = countsLuma.slice(230);
  const shadowBins = countsLuma.slice(0, 25);

  const highlightCount = highlightBins.reduce((acc, value) => acc + value, 0);
  const shadowCount = shadowBins.reduce((acc, value) => acc + value, 0);

  const highlightsPct = totalPixels > 0 ? (highlightCount / totalPixels) * 100 : 0;
  const shadowsPct = totalPixels > 0 ? (shadowCount / totalPixels) * 100 : 0;

  return {
    countsLuma,
    countsRed,
    countsGreen,
    countsBlue,
    highlightsPct,
    shadowsPct,
  };
}

async function computeDominantColor(buffer: Buffer): Promise<string> {
  const { dominant } = await sharp(buffer).stats();
  return rgbToHex(dominant.r, dominant.g, dominant.b);
}

async function computeBlurhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const componentX = 4;
  const componentY = 3;

  return encodeBlurhash(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    componentX,
    componentY
  );
}

// ============================================================================
// EXIF Extraction
// ============================================================================

async function extractExif(buffer: Buffer): Promise<ExifData | null> {
  try {
    const parsed = await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
    });

    if (!parsed) return null;

    const bitDepthRaw = parsed.BitsPerSample;
    const bitDepth = Array.isArray(bitDepthRaw)
      ? bitDepthRaw[0]
      : typeof bitDepthRaw === "number"
        ? bitDepthRaw
        : null;

    return {
      cameraMake: parsed.Make ?? null,
      cameraModel: parsed.Model ?? null,
      lensModel: parsed.LensModel ?? null,
      focalLength: parsed.FocalLength ? Number(parsed.FocalLength) : null,
      aperture: parsed.FNumber ?? null,
      shutterSpeed: parsed.ExposureTime ?? null,
      iso: parsed.ISO ?? null,
      exposureCompensation: parsed.ExposureCompensation ?? null,
      meteringMode: parsed.MeteringMode ? String(parsed.MeteringMode) : null,
      whiteBalance: parsed.WhiteBalance ? String(parsed.WhiteBalance) : null,
      shootingMode: parsed.SceneCaptureType
        ? String(parsed.SceneCaptureType)
        : null,
      capturedAt: parsed.DateTimeOriginal
        ? new Date(parsed.DateTimeOriginal).toISOString()
        : null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      colorSpace: parsed.ColorSpace ? String(parsed.ColorSpace) : null,
      bitDepth,
      description: parsed.ImageDescription ?? parsed.XPComment ?? null,
    };
  } catch (error) {
    console.warn("[photo-processor] Failed to parse EXIF metadata", error);
    return null;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function deriveOrientation(width: number, height: number): string {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

function deriveTitle(filename: string): string {
  const baseName = path.basename(filename, path.extname(filename));
  return baseName.trim() || "Untitled";
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function combineUrl(base: string, key: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return new URL(key, normalizedBase).toString();
}

// ============================================================================
// Reprocess Existing Photo
// ============================================================================

export interface ReprocessPhotoContext {
  /** Photo ID to reprocess */
  photoId: string;
  /** User ID for audit fields */
  userId: string;
}

export interface ReprocessPhotoResult {
  photoId: string;
  detailUrl: string;
}

/**
 * Reprocess an existing photo that failed during initial processing.
 * This function reads the original file from R2 and re-executes Phase 4-7.
 *
 * ⚠️ MEMORY WARNING: This function loads the entire original file into memory.
 * For 50MB files, expect ~300-500MB peak memory usage during processing.
 *
 * Use this when:
 * - Photo status is not "published"
 * - Derived fields (blurhash, dominant_color, histogram) are missing
 * - Renditions are missing or corrupted
 */
export async function reprocessPhoto(
  context: ReprocessPhotoContext
): Promise<ReprocessPhotoResult> {
  const { photoId, userId } = context;
  const publicBase = getR2PublicBaseUrl();

  console.log("[photo-processor] Starting reprocess", { photoId });

  const supabase = createSupabaseServiceRoleClient();

  // --------------------------------------------------------------------------
  // Step 1: Fetch existing photo and asset info
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 1: Fetching photo info");

  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("*, assets:asset_original_id(*)")
    .eq("id", photoId)
    .single();

  if (photoError || !photo) {
    throw new Error(`Photo not found: ${photoError?.message ?? "Unknown error"}`);
  }

  if (!photo.assets) {
    throw new Error("Original asset not found for this photo");
  }

  // Extract storage ID from the asset URL
  // URL format: {publicBase}/photos/{storageId}/original.{ext}
  const assetUrl = photo.assets.url as string;
  const urlMatch = assetUrl.match(/photos\/([^/]+)\/original/);
  if (!urlMatch) {
    throw new Error("Cannot determine storage ID from asset URL");
  }
  const storageId = urlMatch[1];

  // Determine the original key from the URL
  const originalKey = assetUrl.replace(publicBase + "/", "").replace(publicBase, "");

  console.log("[photo-processor] Reprocess Step 1 complete", {
    photoId,
    storageId,
    originalKey,
  });

  // --------------------------------------------------------------------------
  // Step 2: Read original file from R2 (with retry)
  // ⚠️ MEMORY: Loads entire file into memory
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 2: Reading original from R2");

  const readResult = await withRetry(
    () => readFileFromR2(originalKey),
    {
      ...R2_RETRY_OPTIONS,
      operationName: "r2-read-original-reprocess",
      context: { photoId, originalKey },
    }
  );

  if (!readResult.success) {
    throw new Error(
      `Failed to read original file from R2 after ${MAX_RETRY_ATTEMPTS} attempts: ${readResult.error.message}`
    );
  }

  const originalBuffer = readResult.data;

  console.log("[photo-processor] Reprocess Step 2 complete", {
    size: originalBuffer.length,
    attempts: readResult.attempts,
  });

  // --------------------------------------------------------------------------
  // Step 3: Delete existing renditions and derived data
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 3: Cleaning up old data");

  // Get existing rendition keys for R2 cleanup
  const { data: existingRenditions } = await supabase
    .from("photo_rendition")
    .select("url")
    .eq("photo_id", photoId);

  const existingRenditionKeys = (existingRenditions ?? [])
    .map((r) => r.url.replace(publicBase + "/", "").replace(publicBase, ""))
    .filter(Boolean);

  // Delete from R2
  if (existingRenditionKeys.length > 0) {
    await deleteR2Objects(existingRenditionKeys);
  }

  // Delete from database
  await supabase.from("photo_rendition").delete().eq("photo_id", photoId);
  await supabase.from("photo_histogram").delete().eq("photo_id", photoId);

  console.log("[photo-processor] Reprocess Step 3 complete", {
    deletedRenditions: existingRenditionKeys.length,
  });

  // --------------------------------------------------------------------------
  // Step 4: Generate renditions serially
  // ⚠️ MEMORY: Each rendition is generated one at a time to reduce peak memory
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 4: Generating renditions");

  const renditions: GeneratedRendition[] = [];

  for (const config of RENDITIONS) {
    console.log(`[photo-processor] Generating ${config.name} rendition`);
    const rendition = await generateSingleRendition(
      originalBuffer,
      storageId,
      config,
      publicBase
    );
    renditions.push(rendition);
  }

  console.log("[photo-processor] Reprocess Step 4 complete", {
    renditionCount: renditions.length,
  });

  // --------------------------------------------------------------------------
  // Step 5: Upload renditions to R2 (with retry for each)
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 5: Uploading renditions to R2");

  for (const rendition of renditions) {
    const uploadResult = await withRetry(
      () => uploadRenditionToR2(rendition),
      {
        ...R2_RETRY_OPTIONS,
        operationName: `r2-upload-${rendition.name}-reprocess`,
        context: { photoId, key: rendition.key },
      }
    );

    if (!uploadResult.success) {
      throw new Error(
        `Failed to upload ${rendition.name} rendition after ${MAX_RETRY_ATTEMPTS} attempts: ${uploadResult.error.message}`
      );
    }
  }

  // Insert rendition records
  const { error: renditionError } = await supabase.from("photo_rendition").insert(
    renditions.map((rendition) => ({
      photo_id: photoId,
      variant_name: rendition.name,
      url: rendition.url,
      width: rendition.width,
      height: rendition.height,
      file_size: rendition.fileSize,
      checksum: rendition.checksum,
      created_by: userId,
      updated_by: userId,
    }))
  );

  if (renditionError) {
    console.warn("[photo-processor] Failed to insert renditions, continuing", {
      photoId,
      error: renditionError.message,
    });
  }

  console.log("[photo-processor] Reprocess Step 5 complete");

  // --------------------------------------------------------------------------
  // Step 6: Compute derived data (serial to minimize memory)
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 6: Computing derived data");

  const detailRendition = renditions.find((r) => r.name === "detail");
  const listRendition = renditions.find((r) => r.name === "list");

  if (!detailRendition || !listRendition) {
    throw new Error("Missing required renditions for derived data computation");
  }

  // Compute histogram from detail rendition
  const histogram = await computeHistogram(detailRendition.buffer);

  // Compute dominant color from detail rendition
  const dominantColor = await computeDominantColor(detailRendition.buffer);

  // Compute blurhash from list rendition (smaller = faster)
  const blurhash = await computeBlurhash(listRendition.buffer);

  const dynamicRangeUsage = Math.max(
    0,
    100 - histogram.highlightsPct - histogram.shadowsPct
  ).toFixed(2);

  console.log("[photo-processor] Reprocess Step 6 complete", {
    dominantColor,
    blurhashLength: blurhash.length,
  });

  // --------------------------------------------------------------------------
  // Step 7: Write derived data and finalize
  // --------------------------------------------------------------------------
  console.log("[photo-processor] Reprocess Step 7: Writing derived data");

  // Insert histogram
  const { error: histogramError } = await supabase.from("photo_histogram").insert({
    photo_id: photoId,
    bins: 256,
    counts_luma: histogram.countsLuma,
    counts_red: histogram.countsRed,
    counts_green: histogram.countsGreen,
    counts_blue: histogram.countsBlue,
    highlights_pct: Number(histogram.highlightsPct.toFixed(2)),
    shadows_pct: Number(histogram.shadowsPct.toFixed(2)),
    created_by: userId,
    updated_by: userId,
  });

  if (histogramError) {
    console.warn("[photo-processor] Failed to insert histogram, continuing", {
      photoId,
      error: histogramError.message,
    });
  }

  // Update photo with derived fields and mark as published
  const { error: updateError } = await supabase
    .from("photos")
    .update({
      dominant_color: dominantColor,
      blurhash,
      dynamic_range_usage: dynamicRangeUsage,
      status: "published",
      visibility: "public",
      is_visible: true,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", photoId);

  if (updateError) {
    console.warn("[photo-processor] Failed to update photo status, continuing", {
      photoId,
      error: updateError.message,
    });
  }

  // Invalidate cache
  await invalidatePhotoYearCache();

  console.log("[photo-processor] Reprocess complete", {
    photoId,
    detailUrl: detailRendition.url,
  });

  return { photoId, detailUrl: detailRendition.url };
}

/**
 * Check if a photo needs reprocessing.
 * A photo needs reprocessing if:
 * - Status is not "published"
 * - OR blurhash/dominant_color/histogram are missing
 */
export function needsReprocessing(photo: {
  status: string;
  blurhash: string | null;
  dominant_color: string | null;
}): boolean {
  if (photo.status !== "published") {
    return true;
  }
  if (!photo.blurhash || !photo.dominant_color) {
    return true;
  }
  return false;
}
