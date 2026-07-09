import {
  geocodeLocation,
  type GeocodeResult,
  type GeocodeSource,
} from "@/lib/geocode";
import { createSupabaseAdminClient } from "@/lib/supabase";

interface LocationCacheRow {
  nama_normalized: string;
  lat: number;
  lng: number;
  geocode_source: GeocodeSource | "nominatim";
}

export async function getCachedGeocode(
  namaNormalized: string,
): Promise<GeocodeResult | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("location_cache")
    .select("nama_normalized, lat, lng, geocode_source")
    .eq("nama_normalized", namaNormalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const cache = data as LocationCacheRow;
  if (cache.lat === null || cache.lng === null) {
    return null;
  }

  return {
    lat: cache.lat,
    lng: cache.lng,
    source: cache.geocode_source as GeocodeSource,
  };
}

export async function saveGeocodeToCache(
  namaNormalized: string,
  result: GeocodeResult,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("location_cache").upsert(
    {
      nama_normalized: namaNormalized,
      lat: result.lat,
      lng: result.lng,
      geocode_source: result.source,
    },
    { onConflict: "nama_normalized" },
  );
}

export function isNominatimSource(source: string | null | undefined): boolean {
  return (
    source === "nominatim" ||
    source === "nominatim_banjarbaru" ||
    source === "nominatim_kalsel"
  );
}

export async function geocodeWithCache(
  namaNormalized: string,
  options?: { skipCache?: boolean },
): Promise<{
  result: GeocodeResult | null;
  fromCache: boolean;
}> {
  if (!options?.skipCache) {
    const cached = await getCachedGeocode(namaNormalized);
    if (cached) {
      return { result: cached, fromCache: true };
    }
  }

  const result = await geocodeLocation(namaNormalized);
  if (result) {
    await saveGeocodeToCache(namaNormalized, result);
  }

  return { result, fromCache: false };
}
