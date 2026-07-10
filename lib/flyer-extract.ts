import Anthropic from "@anthropic-ai/sdk";

import {
  AI_EXTRACTION_SYSTEM_PROMPT,
  ExtractionParseError,
  fetchImageAsBase64,
  parseExtractionResponse,
  type ExtractionResult,
} from "@/lib/ai-extraction";
import { createSupabaseAdminClient } from "@/lib/supabase";

export class FlyerExtractError extends Error {
  constructor(
    message: string,
    public readonly debugRawResponse?: string,
  ) {
    super(message);
    this.name = "FlyerExtractError";
  }
}

export async function extractFlyer(
  flyerId: string,
  imageUrl: string,
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new FlyerExtractError(
      "ANTHROPIC_API_KEY belum dikonfigurasi di server.",
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: existingFlyer, error: flyerError } = await supabase
    .from("flyers")
    .select("id")
    .eq("id", flyerId)
    .single();

  if (flyerError || !existingFlyer) {
    throw new FlyerExtractError("Flyer tidak ditemukan.");
  }

  const { base64, mediaType } = await fetchImageAsBase64(imageUrl);

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: AI_EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: "Ekstrak data pemadaman dari flyer ini sesuai format JSON yang diminta.",
          },
        ],
      },
    ],
  });

  const textContent = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  if (!textContent) {
    throw new FlyerExtractError(
      "Claude API tidak mengembalikan teks respons.",
      "",
    );
  }

  let extraction: ExtractionResult;
  try {
    extraction = parseExtractionResponse(textContent);
  } catch (error) {
    if (error instanceof ExtractionParseError) {
      throw new FlyerExtractError(error.message, error.debugRawResponse);
    }
    throw error;
  }

  const { error: updateError } = await supabase
    .from("flyers")
    .update({
      tanggal_pemadaman: extraction.metadata.tanggal_pemadaman || null,
      waktu_pemadaman: extraction.metadata.waktu_pemadaman || null,
      unit_pelaksana: extraction.metadata.unit_pelaksana || null,
      raw_ai_response: extraction,
    })
    .eq("id", flyerId);

  if (updateError) {
    throw new FlyerExtractError(
      `Gagal menyimpan hasil ekstraksi ke flyer: ${updateError.message}`,
    );
  }

  const { error: deleteSessionsError } = await supabase
    .from("outage_sessions")
    .delete()
    .eq("flyer_id", flyerId);

  if (deleteSessionsError) {
    throw new FlyerExtractError(
      `Gagal membersihkan sesi lama: ${deleteSessionsError.message}`,
    );
  }

  for (const wilayah of extraction.wilayah_terdampak) {
    const { data: session, error: sessionError } = await supabase
      .from("outage_sessions")
      .insert({
        flyer_id: flyerId,
        sesi_ke: wilayah.sesi_ke,
        waktu_spesifik: wilayah.waktu_spesifik || null,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      throw new FlyerExtractError(
        `Gagal menyimpan sesi pemadaman: ${sessionError?.message ?? "unknown error"}`,
      );
    }

    if (wilayah.daftar_lokasi.length === 0) {
      continue;
    }

    const locationRows = wilayah.daftar_lokasi.map((nama) => ({
      session_id: session.id,
      nama_raw: nama,
      nama_normalized: nama,
      lat: null,
      lng: null,
    }));

    const { error: locationsError } = await supabase
      .from("locations")
      .insert(locationRows);

    if (locationsError) {
      throw new FlyerExtractError(
        `Gagal menyimpan lokasi: ${locationsError.message}`,
      );
    }
  }

  return extraction;
}
