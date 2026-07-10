import { parseDurationHours } from "@/lib/duration";
import type { AggregatedLocation, PublicApprovedFlyer } from "@/lib/types/public-map";

export type PeriodFilter = "7d" | "30d" | "all";

export interface AreaRankingRow {
  nama: string;
  jumlah_kejadian: number;
  total_jam: number;
}

export interface TodayLocationEntry {
  nama: string;
  jam: string;
}

export interface TodayFlyerReport {
  id: string;
  unit_pelaksana: string | null;
  waktu_pemadaman: string | null;
  locations: TodayLocationEntry[];
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

export function getPeriodStartDate(period: PeriodFilter): string | null {
  if (period === "all") {
    return null;
  }

  const days = period === "7d" ? 7 : 30;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return formatLocalDate(start);
}

export function filterFlyersByPeriod(
  flyers: PublicApprovedFlyer[],
  period: PeriodFilter,
): PublicApprovedFlyer[] {
  const startDate = getPeriodStartDate(period);
  if (!startDate) {
    return flyers;
  }

  return flyers.filter((flyer) => {
    if (!flyer.tanggal_pemadaman) {
      return false;
    }
    return flyer.tanggal_pemadaman >= startDate;
  });
}

export function aggregateAreaRanking(
  flyers: PublicApprovedFlyer[],
): AreaRankingRow[] {
  const grouped = new Map<string, AreaRankingRow>();

  for (const flyer of flyers) {
    for (const session of flyer.outage_sessions ?? []) {
      const sessionHours = parseDurationHours(session.waktu_spesifik ?? "");

      for (const location of session.locations ?? []) {
        const namaKey = (location.nama_normalized || location.nama_raw).trim();
        if (!namaKey) {
          continue;
        }

        const existing = grouped.get(namaKey);
        if (existing) {
          existing.jumlah_kejadian += 1;
          existing.total_jam =
            Math.round((existing.total_jam + sessionHours) * 100) / 100;
          continue;
        }

        grouped.set(namaKey, {
          nama: namaKey,
          jumlah_kejadian: 1,
          total_jam: sessionHours,
        });
      }
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.total_jam - a.total_jam);
}

export function buildTodayFlyerReports(
  flyers: PublicApprovedFlyer[],
  today: string = getTodayDateString(),
): TodayFlyerReport[] {
  return flyers
    .filter((flyer) => flyer.tanggal_pemadaman === today)
    .map((flyer) => {
      const locations: TodayLocationEntry[] = [];

      for (const session of flyer.outage_sessions ?? []) {
        const jam =
          session.waktu_spesifik?.trim() ||
          flyer.waktu_pemadaman?.trim() ||
          "—";

        for (const location of session.locations ?? []) {
          const nama = (location.nama_normalized || location.nama_raw).trim();
          if (!nama) {
            continue;
          }
          locations.push({ nama, jam });
        }
      }

      return {
        id: flyer.id,
        unit_pelaksana: flyer.unit_pelaksana,
        waktu_pemadaman: flyer.waktu_pemadaman,
        locations,
      };
    });
}

export function countUniqueAreas(ranking: AreaRankingRow[]): number {
  return ranking.length;
}

export function sumTotalHours(ranking: AreaRankingRow[]): number {
  return Math.round(ranking.reduce((sum, row) => sum + row.total_jam, 0) * 100) / 100;
}

export function averageHoursPerIncident(ranking: AreaRankingRow[]): number {
  const totalIncidents = ranking.reduce(
    (sum, row) => sum + row.jumlah_kejadian,
    0,
  );
  if (totalIncidents === 0) {
    return 0;
  }
  return Math.round((sumTotalHours(ranking) / totalIncidents) * 10) / 10;
}

export function countLocationsInFlyer(flyer: PublicApprovedFlyer): number {
  return (flyer.outage_sessions ?? []).reduce(
    (count, session) => count + (session.locations?.length ?? 0),
    0,
  );
}

export function exportRankingCsv(ranking: AreaRankingRow[]): string {
  const header = "nama,jumlah_kejadian,total_jam";
  const rows = ranking.map(
    (row) =>
      `"${row.nama.replace(/"/g, '""')}",${row.jumlah_kejadian},${row.total_jam}`,
  );
  return [header, ...rows].join("\n");
}

// --- Legacy map dashboard helpers (dipertahankan untuk referensi) ---

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
          existing.total_jam =
            Math.round((existing.total_jam + sessionHours) * 100) / 100;
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

export function toMapPoints(locations: AggregatedLocation[]) {
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
