import { extractJsonFromResponse } from "@/lib/ai-extraction";

export const NORMALIZE_SYSTEM_PROMPT = `Kamu membersihkan daftar nama jalan/lokasi di Banjarbaru. Tugas: (1) perbaiki typo penulisan nama jalan umum (contoh: 'sidodadai' -> 'Sidodadi', 'chitramitra' -> 'Citra Mitra' jika relevan), (2) gabungkan variasi angka dari jalan yang sama jadi satu entri tanpa embel-embel angka (contoh: 'Sidodadi 1' dan 'Sidodadi 2' -> satu entri 'Jalan Sidodadi'), (3) hapus duplikat setelah normalisasi. Kembalikan HANYA JSON array of string, tanpa teks lain, tanpa markdown wrapper.`;

export class NormalizeParseError extends Error {
  readonly debugRawResponse: string;

  constructor(message: string, debugRawResponse: string) {
    super(message);
    this.name = "NormalizeParseError";
    this.debugRawResponse = debugRawResponse;
  }
}

export function parseNormalizeResponse(text: string): string[] {
  const jsonString = extractJsonFromResponse(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new NormalizeParseError(
      "Gagal parse hasil normalisasi: format JSON tidak valid.",
      text,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new NormalizeParseError(
      "Gagal parse hasil normalisasi: respons bukan array JSON.",
      text,
    );
  }

  return parsed.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/^j(?:l|alan)\.?\s+/i, "jalan ")
    .replace(/\s+\d+.*$/, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchOriginalToNormalized(
  original: string,
  normalizedList: string[],
): string {
  const trimmedOriginal = original.trim();
  if (!trimmedOriginal) {
    return trimmedOriginal;
  }

  const exactMatch = normalizedList.find(
    (item) => item.toLowerCase() === trimmedOriginal.toLowerCase(),
  );
  if (exactMatch) {
    return exactMatch;
  }

  const originalKey = normalizeForMatch(trimmedOriginal);
  let bestMatch = trimmedOriginal;
  let bestScore = 0;

  for (const candidate of normalizedList) {
    const candidateKey = normalizeForMatch(candidate);
    if (!candidateKey) {
      continue;
    }

    if (
      candidateKey === originalKey ||
      candidateKey.includes(originalKey) ||
      originalKey.includes(candidateKey)
    ) {
      return candidate;
    }

    const originalWords = originalKey.split(" ").filter((word) => word.length > 2);
    const sharedWords = originalWords.filter((word) =>
      candidateKey.split(" ").includes(word),
    ).length;
    const score = sharedWords / Math.max(originalWords.length, 1);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestScore > 0 ? bestMatch : trimmedOriginal;
}
