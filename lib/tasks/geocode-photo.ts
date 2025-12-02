/**
 * Background task for reverse geocoding photo locations.
 * Runs asynchronously without blocking the upload flow.
 */

import { withRetry } from '@/lib/async-retry';
import { reverseGeocode, type GeocodedLocation } from '@/lib/mapbox/geocoder';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const RETRY_OPTIONS = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  operationName: 'photo-geocode',
};

type GeocodeTaskParams = {
  photoId: string;
  latitude: number;
  longitude: number;
  userId: string;
};

/**
 * Checks if any location fields need to be populated.
 */
function needsGeocoding(photo: {
  country: string | null;
  region: string | null;
  city: string | null;
  place_name: string | null;
}): boolean {
  return !photo.country || !photo.region || !photo.city || !photo.place_name;
}

/**
 * Builds the update payload, only including empty fields.
 */
function buildUpdatePayload(
  existing: {
    country: string | null;
    region: string | null;
    city: string | null;
    place_name: string | null;
  },
  geocoded: GeocodedLocation,
  userId: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (!existing.country && geocoded.country) {
    updates.country = geocoded.country;
  }
  if (!existing.region && geocoded.region) {
    updates.region = geocoded.region;
  }
  if (!existing.city && geocoded.city) {
    updates.city = geocoded.city;
  }
  if (!existing.place_name && geocoded.placeName) {
    updates.place_name = geocoded.placeName;
  }

  return updates;
}

/**
 * Executes the geocoding workflow for a single photo.
 * This is the internal implementation that may throw errors.
 */
async function executeGeocodeTask(params: GeocodeTaskParams): Promise<void> {
  const { photoId, latitude, longitude, userId } = params;

  // Get Mapbox token - skip if not configured
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    console.info('[geocode-photo] Skipping - MAPBOX_ACCESS_TOKEN not configured', {
      photoId,
    });
    return;
  }

  const supabase = createSupabaseServiceRoleClient();

  // Fetch current photo state to check which fields need updating
  const { data: photo, error: fetchError } = await supabase
    .from('photos')
    .select('country, region, city, place_name')
    .eq('id', photoId)
    .single();

  if (fetchError || !photo) {
    throw new Error(`Failed to fetch photo: ${fetchError?.message ?? 'not found'}`);
  }

  // Skip if all fields are already populated
  if (!needsGeocoding(photo)) {
    console.info('[geocode-photo] Skipping - all location fields populated', {
      photoId,
    });
    return;
  }

  // Perform geocoding with retry
  const result = await withRetry(
    () => reverseGeocode(latitude, longitude, accessToken),
    { ...RETRY_OPTIONS, context: { photoId, latitude, longitude } },
  );

  if (!result.success) {
    throw result.error;
  }

  const geocoded = result.data;
  if (!geocoded) {
    console.info('[geocode-photo] No location data returned from Mapbox', {
      photoId,
      latitude,
      longitude,
    });
    return;
  }

  // Build update payload with only empty fields
  const updates = buildUpdatePayload(photo, geocoded, userId);

  // Only update if there are actual location changes (beyond audit fields)
  const hasLocationUpdates = Object.keys(updates).some(
    (key) => !['updated_at', 'updated_by'].includes(key),
  );

  if (!hasLocationUpdates) {
    console.info('[geocode-photo] No new location data to update', {
      photoId,
    });
    return;
  }

  // Update the photo record
  const { error: updateError } = await supabase
    .from('photos')
    .update(updates)
    .eq('id', photoId);

  if (updateError) {
    throw new Error(`Failed to update photo: ${updateError.message}`);
  }

  console.info('[geocode-photo] Successfully updated location', {
    photoId,
    updates: {
      country: updates.country ?? '(unchanged)',
      region: updates.region ?? '(unchanged)',
      city: updates.city ?? '(unchanged)',
      place_name: updates.place_name ?? '(unchanged)',
    },
  });
}

/**
 * Enqueues a background geocoding task for a photo.
 * This is fire-and-forget - errors are logged but never thrown.
 *
 * @param photoId - The photo ID to geocode
 * @param latitude - Latitude coordinate from EXIF
 * @param longitude - Longitude coordinate from EXIF
 * @param userId - User ID for audit fields
 *
 * @example
 * ```ts
 * // Fire and forget - don't await
 * enqueueGeocodeTask(photoId, 37.7749, -122.4194, userId);
 * ```
 */
export function enqueueGeocodeTask(
  photoId: string,
  latitude: number,
  longitude: number,
  userId: string,
): void {
  // Fire-and-forget: start the task but don't await it
  void executeGeocodeTask({ photoId, latitude, longitude, userId }).catch(
    (error) => {
      console.error('[geocode-photo] Task failed', {
        photoId,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    },
  );
}

