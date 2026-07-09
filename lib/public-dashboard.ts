import { parseDurationHours } from "@/lib/duration";
import type {
  AggregatedLocation,
  MapLocationPoint,
  PublicApprovedFlyer,
} from "@/lib/types/public-map";

export function filterFlyersByDateRange(
  flyers: PublicApprovedFlyer[],
  dateFrom: string,
  dateTo: string,
): PublicApprovedFlyer[] {
  if (!dateFrom && !dateTo) {
    return flyers;
  }

  return flyers.filter((flyer) => {
    if (!flyer.tanggal_pemadaman) {
      return false;
    }

    if (dateFrom && flyer.tanggal_pemadaman < dateFrom) {
      return false;
    }

    if (dateTo && flyer.tanggal_pemadaman > dateTo) {
      return false;
    }

    return true;
  });
}

export function aggregateLocationsByName(
  flyers: PublicApprovedFlyer[],
): AggregatedLocation[] {
  const grouped = new Map<string, AggregatedLocation>();

  for (const flyer of flyers) {
    for (const session of flyer.outage_sessions ?? []) {
      const sessionHours = parseDurationHours(session.waktu_spesifik ?? "");

      for (const location of session.locations ?? []) {
        if (location.lat === null || location.lng === null) {
          continue;
        }

        const namaKey = (location.nama_normalized || location.nama_raw).trim();
        if (!namaKey) {
          continue;
        }

        const existing = grouped.get(namaKey);
        if (existing) {
          existing.jumlah_sesi += 1;
          existing.total_jam = Math.round((existing.total_jam + sessionHours) * 100) / 100;
          if (
            existing.geocode_source !== "nominatim" &&
            location.geocode_source === "nominatim"
          ) {
            existing.geocode_source = "nominatim";
          }
          continue;
        }

        grouped.set(namaKey, {
          nama: namaKey,
          jumlah_sesi: 1,
          total_jam: sessionHours,
          lat: location.lat,
          lng: location.lng,
          geocode_source: location.geocode_source,
        });
      }
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.total_jam - a.total_jam);
}

export function toMapPoints(locations: AggregatedLocation[]): MapLocationPoint[] {
  return locations.map((location) => ({
    id: location.nama,
    lat: location.lat,
    lng: location.lng,
    nama: location.nama,
    jumlah_sesi: location.jumlah_sesi,
    total_jam: location.total_jam,
    geocode_source: location.geocode_source,
  }));
}
