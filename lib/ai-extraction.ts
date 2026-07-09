export const AI_EXTRACTION_SYSTEM_PROMPT = `Anda adalah Agen AI Ekstraksi Data Spasial profesional yang bertugas memproses infografis pemadaman listrik dari PLN ULP Banjarbaru.

TUGAS UTAMA:
Ekstrak metadata waktu dan buat daftar lokasi (jalan, kompleks, bangunan) yang terdampak pemadaman dari teks di dalam gambar.

PANDUAN EKSTRAKSI LOKASI:
1. Pisahkan setiap lokasi berdasarkan tanda koma (,).
2. Bersihkan kata serapan atau penutup seperti "dan sekitarnya", "dan sekitarnya.", atau sejenisnya.
3. Lakukan normalisasi otomatis terhadap singkatan (Jl. -> Jalan, Komp./Komplek -> Kompleks, Gg. -> Gang).
4. Jika menemukan nama tempat krusial atau fasilitas publik (contoh: Puskesmas Cempaka, SPBE, Taman, Sekolah, Kompleks Perumahan), ekstrak secara utuh sebagai entitas mandiri.
5. Jika ada penulisan rentang nomor atau KM yang membingungkan (seperti "ayani km 32-32,5" atau "karang anyar 1-3"), ambil basis jalan utamanya saja (contoh: "Jalan Ahmad Yani KM 32", "Jalan Karang Anyar") agar mudah dikenali oleh API Geocoding.

PANDUAN OUTPUT:
Anda WAJIB mengembalikan HANYA JSON murni dengan struktur PERSIS seperti ini, tanpa teks pembuka atau penutup apapun:

{
  "metadata": {
    "tanggal_pemadaman": "YYYY-MM-DD",
    "waktu_pemadaman": "HH:MM - HH:MM WITA",
    "unit_pelaksana": "String"
  },
  "wilayah_terdampak": [
    {
      "sesi_ke": 1,
      "waktu_spesifik": "String",
      "daftar_lokasi": ["String (Nama Jalan/Tempat Terstandarisasi)"]
    }
  ]
}

Jika hanya ada satu sesi pemadaman, buat array wilayah_terdampak dengan satu elemen saja (sesi_ke: 1). Jika flyer menunjukkan beberapa sesi/kelompok lokasi terpisah (seperti dua kotak terpisah di infografis), buat elemen array terpisah untuk masing-masing dengan sesi_ke berbeda.

Pastikan JSON valid dan TIDAK dibungkus dalam tag markdown apapun (jangan gunakan \`\`\`json), langsung kembalikan teks JSON mentah.`;

export interface ExtractionMetadata {
  tanggal_pemadaman: string;
  waktu_pemadaman: string;
  unit_pelaksana: string;
}

export interface ExtractionWilayah {
  sesi_ke: number;
  waktu_spesifik: string;
  daftar_lokasi: string[];
}

export interface ExtractionResult {
  metadata: ExtractionMetadata;
  wilayah_terdampak: ExtractionWilayah[];
}

export class ExtractionParseError extends Error {
  readonly debugRawResponse: string;

  constructor(message: string, debugRawResponse: string) {
    super(message);
    this.name = "ExtractionParseError";
    this.debugRawResponse = debugRawResponse;
  }
}

type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp";

/** Ambil teks JSON dari respons Claude; strip fence markdown hanya jika ada (fallback). */
export function extractJsonFromResponse(text: string): string {
  const trimmed = text.trim();

  const fullFenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFenceMatch?.[1]) {
    return fullFenceMatch[1].trim();
  }

  const inlineFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (inlineFenceMatch?.[1]) {
    return inlineFenceMatch[1].trim();
  }

  return trimmed;
}

export function parseExtractionResponse(text: string): ExtractionResult {
  const jsonString = extractJsonFromResponse(text);

  if (!jsonString) {
    throw new ExtractionParseError(
      "Gagal parse JSON dari AI: respons kosong.",
      text,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new ExtractionParseError(
      "Gagal parse JSON dari AI: format JSON tidak valid.",
      text,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ExtractionParseError(
      "Gagal parse JSON dari AI: struktur data tidak valid.",
      text,
    );
  }

  const data = parsed as Partial<ExtractionResult>;

  if (!data.metadata || typeof data.metadata !== "object") {
    throw new ExtractionParseError(
      "Gagal parse JSON dari AI: field metadata tidak ditemukan.",
      text,
    );
  }

  if (!Array.isArray(data.wilayah_terdampak)) {
    throw new ExtractionParseError(
      "Gagal parse JSON dari AI: field wilayah_terdampak tidak ditemukan.",
      text,
    );
  }

  return {
    metadata: {
      tanggal_pemadaman: String(data.metadata.tanggal_pemadaman ?? ""),
      waktu_pemadaman: String(data.metadata.waktu_pemadaman ?? ""),
      unit_pelaksana: String(data.metadata.unit_pelaksana ?? ""),
    },
    wilayah_terdampak: data.wilayah_terdampak.map((wilayah, index) => ({
      sesi_ke: Number(wilayah?.sesi_ke ?? index + 1),
      waktu_spesifik: String(wilayah?.waktu_spesifik ?? ""),
      daftar_lokasi: Array.isArray(wilayah?.daftar_lokasi)
        ? wilayah.daftar_lokasi.map((lokasi) => String(lokasi))
        : [],
    })),
  };
}

export function resolveImageMediaType(
  contentType: string | null,
  imageUrl: string,
): SupportedMediaType {
  const normalizedType = contentType?.toLowerCase() ?? "";

  if (normalizedType.includes("png")) {
    return "image/png";
  }
  if (normalizedType.includes("webp")) {
    return "image/webp";
  }
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) {
    return "image/jpeg";
  }

  const pathname = new URL(imageUrl).pathname.toLowerCase();
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function fetchImageAsBase64(imageUrl: string): Promise<{
  base64: string;
  mediaType: SupportedMediaType;
}> {
  let response: Response;

  try {
    response = await fetch(imageUrl);
  } catch {
    throw new Error("Gagal fetch gambar: tidak dapat terhubung ke URL gambar.");
  }

  if (!response.ok) {
    throw new Error(
      `Gagal fetch gambar: server mengembalikan status ${response.status}.`,
    );
  }

  const mediaType = resolveImageMediaType(
    response.headers.get("content-type"),
    imageUrl,
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");

  if (!base64) {
    throw new Error("Gagal fetch gambar: data gambar kosong.");
  }

  return { base64, mediaType };
}
