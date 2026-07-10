import type { PublicApprovedFlyer } from "@/lib/types/public-map";
import type {
  Verification,
  VerificationAreaRow,
  VerificationStatus,
  VerificationTally,
} from "@/lib/types/verification";

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getVerificationStartDate(days = 3): string {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return formatLocalDate(start);
}

export function buildVerificationAreaRows(
  flyers: PublicApprovedFlyer[],
): VerificationAreaRow[] {
  const rows: VerificationAreaRow[] = [];

  for (const flyer of flyers) {
    const seenAreas = new Set<string>();

    for (const session of flyer.outage_sessions ?? []) {
      const waktu =
        session.waktu_spesifik?.trim() ||
        flyer.waktu_pemadaman?.trim() ||
        "—";

      for (const location of session.locations ?? []) {
        const namaArea = (location.nama_normalized || location.nama_raw).trim();
        if (!namaArea || seenAreas.has(namaArea)) {
          continue;
        }

        seenAreas.add(namaArea);
        rows.push({
          key: `${flyer.id}|${namaArea}`,
          flyerId: flyer.id,
          namaArea,
          tanggal: flyer.tanggal_pemadaman,
          waktu,
          unitPelaksana: flyer.unit_pelaksana,
        });
      }
    }
  }

  return rows.sort((a, b) => {
    const dateCompare = (b.tanggal ?? "").localeCompare(a.tanggal ?? "");
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.namaArea.localeCompare(b.namaArea, "id");
  });
}

export function getVerificationVoteStorageKey(
  flyerId: string,
  namaArea: string,
): string {
  return `voted_${flyerId}_${encodeURIComponent(namaArea)}`;
}

export function getSavedVerificationVote(
  flyerId: string,
  namaArea: string,
): VerificationStatus | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(
    getVerificationVoteStorageKey(flyerId, namaArea),
  );

  if (value === "padam" || value === "tidak_padam") {
    return value;
  }

  return null;
}

export function saveVerificationVote(
  flyerId: string,
  namaArea: string,
  status: VerificationStatus,
): void {
  localStorage.setItem(
    getVerificationVoteStorageKey(flyerId, namaArea),
    status,
  );
}

export function getAreaTallyKey(flyerId: string, namaArea: string): string {
  return `${flyerId}|${namaArea}`;
}

function createEmptyTally(): VerificationTally {
  return { padam: 0, tidakPadam: 0 };
}

function addVerificationToTally(
  tally: VerificationTally,
  status: string,
): VerificationTally {
  if (status === "padam") {
    return { ...tally, padam: tally.padam + 1 };
  }
  if (status === "tidak_padam") {
    return { ...tally, tidakPadam: tally.tidakPadam + 1 };
  }
  return tally;
}

export function aggregateVerificationsByArea(
  verifications: Pick<Verification, "flyer_id" | "nama_area" | "status">[],
): Map<string, VerificationTally> {
  const map = new Map<string, VerificationTally>();

  for (const verification of verifications) {
    const key = getAreaTallyKey(verification.flyer_id, verification.nama_area);
    const existing = map.get(key) ?? createEmptyTally();
    map.set(key, addVerificationToTally(existing, verification.status));
  }

  return map;
}

export function aggregateVerificationsByFlyer(
  verifications: Pick<Verification, "flyer_id" | "status">[],
): Map<string, VerificationTally> {
  const map = new Map<string, VerificationTally>();

  for (const verification of verifications) {
    const existing = map.get(verification.flyer_id) ?? createEmptyTally();
    map.set(
      verification.flyer_id,
      addVerificationToTally(existing, verification.status),
    );
  }

  return map;
}

export function formatVerificationTally(tally: VerificationTally): string {
  return `${tally.padam} padam · ${tally.tidakPadam} tidak padam`;
}

export function hasVerificationData(tally: VerificationTally): boolean {
  return tally.padam + tally.tidakPadam > 0;
}
