/**
 * Mapbox Geocoding module for reverse geocoding coordinates to location names.
 * Designed for server-side use only - token must remain server-side.
 */

const MAPBOX_API_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const REQUEST_TIMEOUT_MS = 2000;

export type GeocodedLocation = {
  country: string | null;
  region: string | null;
  city: string | null;
  placeName: string | null;
};

type MapboxFeature = {
  id: string;
  place_type: string[];
  text: string;
  place_name: string;
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
};

type MapboxResponse = {
  features: MapboxFeature[];
};

/**
 * Extracts a context value by type prefix (e.g., 'country', 'region', 'place').
 */
function extractContextValue(
  feature: MapboxFeature,
  typePrefix: string,
): string | null {
  // Check if the feature itself is of this type
  if (feature.place_type.some((t) => t.startsWith(typePrefix))) {
    return feature.text;
  }

  // Check context array
  const contextItem = feature.context?.find((c) => c.id.startsWith(typePrefix));
  return contextItem?.text ?? null;
}

/**
 * Parses Mapbox response and normalizes to GeocodedLocation.
 * Uses the most specific feature (first in array) and extracts location hierarchy.
 */
function parseMapboxResponse(data: MapboxResponse): GeocodedLocation | null {
  const feature = data.features?.[0];
  if (!feature) {
    return null;
  }

  // Extract location components from the most specific match
  const country = extractContextValue(feature, 'country');
  const region = extractContextValue(feature, 'region');

  // City can come from 'place' or 'locality' types
  const city =
    extractContextValue(feature, 'place') ??
    extractContextValue(feature, 'locality');

  // Place name is the most specific location (neighborhood, poi, or the feature text)
  const neighborhood = extractContextValue(feature, 'neighborhood');
  const placeName = neighborhood ?? feature.text;

  return {
    country,
    region,
    city,
    placeName,
  };
}

/**
 * Performs reverse geocoding using the Mapbox API.
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param accessToken - Mapbox access token (server-side only)
 * @returns GeocodedLocation or null if geocoding fails
 * @throws Error on network/API failures (caller should handle retries)
 *
 * @example
 * ```ts
 * const location = await reverseGeocode(37.7749, -122.4194, process.env.MAPBOX_ACCESS_TOKEN);
 * // { country: 'United States', region: 'California', city: 'San Francisco', placeName: 'SoMa' }
 * ```
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  accessToken: string,
): Promise<GeocodedLocation | null> {
  const url = new URL(`${MAPBOX_API_BASE}/${longitude},${latitude}.json`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('language', 'en');
  url.searchParams.set('types', 'country,region,place,locality,neighborhood');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as MapboxResponse;
    return parseMapboxResponse(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Mapbox request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

