import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import exifr from 'exifr';
import sharp from 'sharp';

import { invalidatePhotoYearCache } from '@/lib/data/photos';
import { getR2Bucket, getR2Client, getR2PublicBaseUrl } from '@/lib/r2';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { enqueueGeocodeTask } from '@/lib/tasks/geocode-photo';
import type { Photo } from '@/types/photos';

type UploadContext = {
  file: File;
  userId: string;
};

type RenditionConfig = {
  name: 'thumb' | 'list' | 'detail';
  maxSize: number;
  quality: number;
};

type GeneratedRendition = {
  name: RenditionConfig['name'];
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
  checksum: string;
  url: string;
  key: string;
};

const RENDITIONS: RenditionConfig[] = [
  { name: 'thumb', maxSize: 320, quality: 80 },
  { name: 'list', maxSize: 1024, quality: 88 },
  { name: 'detail', maxSize: 2048, quality: 92 },
];

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export interface ProcessedPhotoResult {
  photoId: string;
  detailUrl: string;
}

interface HistogramResult {
  countsLuma: number[];
  countsRed: number[];
  countsGreen: number[];
  countsBlue: number[];
  highlightsPct: number;
  shadowsPct: number;
}

export async function processPhotoUpload({ file, userId }: UploadContext): Promise<ProcessedPhotoResult> {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalSize = originalBuffer.length;
  const basePipeline = sharp(originalBuffer, { failOnError: false }).rotate();
  const metadata = await basePipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions.');
  }

  const derivedType = metadata.format ? `image/${metadata.format}` : '';
  const matchesType = file.type && ACCEPTED_TYPES.has(file.type);
  const matchesDerived = derivedType && ACCEPTED_TYPES.has(derivedType);

  if (!matchesType && !matchesDerived) {
    throw new Error('Unsupported file type. Allowed: JPEG, PNG, WebP.');
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  const photoId = randomUUID();
  const assetId = randomUUID();
  const storageId = photoId;

  const renditions = await generateRenditions(originalBuffer, storageId);

  const detailRendition = renditions.find((r) => r.name === 'detail');
  if (!detailRendition) {
    throw new Error('Failed to generate detail rendition.');
  }

  const histogram = await computeHistogram(detailRendition.buffer);

  const dominantColor = await computeDominantColor(detailRendition.buffer);

  const exif = await extractExif(originalBuffer);

  const { key: originalKey, url: originalUrl, checksum: originalChecksum } = await uploadOriginal(
    file,
    originalBuffer,
    storageId,
  );

  await uploadRenditions(renditions);

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const aspectRatio = Number((originalWidth / originalHeight).toFixed(4));
  const orientation = deriveOrientation(originalWidth, originalHeight);
  const megapixels = Number(((originalWidth * originalHeight) / 1_000_000).toFixed(2));
  const detailUrl = detailRendition.url;

  const capturedAt = exif?.capturedAt ?? null;

  const dynamicRangeUsage = Math.max(
    0,
    Number((100 - histogram.highlightsPct - histogram.shadowsPct).toFixed(2)),
  );

  const photoRecord: Partial<Photo> = {
    id: photoId,
    title: deriveTitle(file.name),
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
    dominant_color: dominantColor,
    blurhash: null,
    megapixels,
    dynamic_range_usage: dynamicRangeUsage,
    is_visible: true,
    status: 'published',
    visibility: 'public',
    created_by: userId,
    created_at: now,
    updated_by: userId,
    updated_at: now,
  } as Photo;

  const cleanupTasks: Array<() => Promise<void>> = [];

  try {
    await supabase.from('assets').insert({
      id: assetId,
      type: 'image',
      url: originalUrl,
      width: originalWidth,
      height: originalHeight,
      file_size: originalSize,
      checksum: originalChecksum,
      created_by: userId,
      updated_by: userId,
    });

    cleanupTasks.push(() =>
      supabase.from('assets').delete().eq('id', assetId),
    );

    await supabase.from('photos').insert(photoRecord);

    cleanupTasks.push(() =>
      supabase.from('photos').delete().eq('id', photoId),
    );

    await supabase.from('photo_rendition').insert(
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
      })),
    );

    if (exif) {
    await supabase.from('photo_exif').insert({
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
    }

    await supabase.from('photo_histogram').insert({
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

    await invalidatePhotoYearCache();

    // Fire-and-forget: trigger background geocoding if coordinates exist
    if (photoRecord.latitude != null && photoRecord.longitude != null) {
      enqueueGeocodeTask(photoId, photoRecord.latitude, photoRecord.longitude, userId);
    }

    return { photoId, detailUrl };
  } catch (error) {
    for (const cleanup of cleanupTasks.reverse()) {
      try {
        await cleanup();
      } catch {
        // ignore cleanup errors
      }
    }

    await deleteR2Objects([originalKey, ...renditions.map((r) => r.key)]);

    throw error;
  }
}

async function generateRenditions(originalBuffer: Buffer, storageId: string): Promise<GeneratedRendition[]> {
  const outputs: GeneratedRendition[] = [];
  const publicBase = getR2PublicBaseUrl();

  for (const config of RENDITIONS) {
    const cloned = sharp(originalBuffer, { failOnError: false })
      .rotate()
      .toColorspace('srgb')
      .resize({
        width: config.maxSize,
        height: config.maxSize,
        fit: 'inside',
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
    const checksum = createHash('sha256').update(data).digest('hex');

    outputs.push({
      name: config.name,
      buffer: data,
      width,
      height,
      fileSize,
      checksum,
      url,
      key,
    });
  }

  return outputs;
}

async function uploadOriginal(file: File, buffer: Buffer, storageId: string) {
  const bucket = getR2Bucket();
  const client = getR2Client();
  const baseUrl = getR2PublicBaseUrl();
  const extension = inferExtension(file);
  const key = `photos/${storageId}/original${extension}`;
  const url = combineUrl(baseUrl, key);
  const checksum = createHash('sha256').update(buffer).digest('hex');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: CACHE_CONTROL,
    }),
  );

  return { key, url, checksum };
}

async function uploadRenditions(renditions: GeneratedRendition[]) {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await Promise.all(
    renditions.map((rendition) =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: rendition.key,
          Body: rendition.buffer,
          ContentType: 'image/jpeg',
          CacheControl: CACHE_CONTROL,
        }),
      ),
    ),
  );
}

async function deleteR2Objects(keys: string[]) {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await Promise.all(
    keys.map((key) =>
      client
        .send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        )
        .catch(() => undefined),
    ),
  );
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
    const luma = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));

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

async function extractExif(buffer: Buffer) {
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
      : typeof bitDepthRaw === 'number'
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
      shootingMode: parsed.SceneCaptureType ? String(parsed.SceneCaptureType) : null,
      capturedAt: parsed.DateTimeOriginal ? new Date(parsed.DateTimeOriginal).toISOString() : null,
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      colorSpace: parsed.ColorSpace ? String(parsed.ColorSpace) : null,
      bitDepth: bitDepth,
      description: parsed.ImageDescription ?? parsed.XPComment ?? null,
    };
  } catch (error) {
    console.warn('Failed to parse EXIF metadata', error);
    return null;
  }
}

function deriveOrientation(width: number, height: number) {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Derives a clean title from a filename by removing extension and sanitizing.
 */
function deriveTitle(filename: string): string {
  const baseName = path.basename(filename, path.extname(filename));
  // Replace underscores/dashes with spaces, trim whitespace
  return baseName.trim() || 'Untitled';
}

/**
 * Converts RGB values to hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Computes the dominant color from an image buffer.
 */
async function computeDominantColor(buffer: Buffer): Promise<string> {
  const { dominant } = await sharp(buffer).stats();
  return rgbToHex(dominant.r, dominant.g, dominant.b);
}

function combineUrl(base: string, key: string) {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(key, normalizedBase).toString();
}

function inferExtension(file: File) {
  const extFromName = path.extname(file.name)?.toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  switch (file.type) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
}
