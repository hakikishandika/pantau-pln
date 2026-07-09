/**
 * Parse durasi dari teks seperti "09:00 - 14:00 WITA" menjadi selisih jam (desimal).
 * Mengembalikan 0 jika format tidak dikenali.
 */
export function parseDurationHours(waktuSpesifik: string): number {
  const cleaned = waktuSpesifik.replace(/\bWITA\b/gi, "").trim();
  const match = cleaned.match(
    /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
  );

  if (!match) {
    return 0;
  }

  const startHours = Number.parseInt(match[1], 10);
  const startMinutes = Number.parseInt(match[2], 10);
  const endHours = Number.parseInt(match[3], 10);
  const endMinutes = Number.parseInt(match[4], 10);

  if (
    startHours > 23 ||
    endHours > 23 ||
    startMinutes > 59 ||
    endMinutes > 59
  ) {
    return 0;
  }

  const start = startHours + startMinutes / 60;
  const end = endHours + endMinutes / 60;

  if (end <= start) {
    return 0;
  }

  return Math.round((end - start) * 100) / 100;
}

export function formatHoursLabel(hours: number): string {
  if (Number.isInteger(hours)) {
    return `${hours} jam`;
  }
  return `${hours.toFixed(1)} jam`;
}
