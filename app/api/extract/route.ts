import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  AI_EXTRACTION_SYSTEM_PROMPT,
  ExtractionParseError,
  fetchImageAsBase64,
  parseExtractionResponse,
  type ExtractionResult,
} from "@/lib/ai-extraction";
import { createSupabaseAdminClient } from "@/lib/supabase";

interface ExtractRequestBody {
  imageUrl?: string;
  flyerId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractRequestBody;
    const imageUrl = body.imageUrl?.trim();
    const flyerId = body.flyerId?.trim();

    if (!imageUrl || !flyerId) {
      return NextResponse.json(
        {
          status: "error",
          message: "imageUrl dan flyerId wajib diisi.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          status: "error",
          message: "ANTHROPIC_API_KEY belum dikonfigurasi di server.",
        },
        { status: 500 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: existingFlyer, error: flyerError } = await supabase
      .from("flyers")
      .select("id")
      .eq("id", flyerId)
      .single();

    if (flyerError || !existingFlyer) {
      return NextResponse.json(
        {
          status: "error",
          message: "Flyer tidak ditemukan.",
        },
        { status: 404 },
      );
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
      return NextResponse.json(
        {
          status: "error",
          message: "Claude API tidak mengembalikan teks respons.",
          debug_raw_response: "",
        },
        { status: 500 },
      );
    }

    let extraction: ExtractionResult;
    try {
      extraction = parseExtractionResponse(textContent);
    } catch (error) {
      if (error instanceof ExtractionParseError) {
        return NextResponse.json(
          {
            status: "error",
            message: error.message,
            debug_raw_response: error.debugRawResponse,
          },
          { status: 500 },
        );
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
      return NextResponse.json(
        {
          status: "error",
          message: `Gagal menyimpan hasil ekstraksi ke flyer: ${updateError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: deleteSessionsError } = await supabase
      .from("outage_sessions")
      .delete()
      .eq("flyer_id", flyerId);

    if (deleteSessionsError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Gagal membersihkan sesi lama: ${deleteSessionsError.message}`,
        },
        { status: 500 },
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
        return NextResponse.json(
          {
            status: "error",
            message: `Gagal menyimpan sesi pemadaman: ${sessionError?.message ?? "unknown error"}`,
          },
          { status: 500 },
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
        return NextResponse.json(
          {
            status: "error",
            message: `Gagal menyimpan lokasi: ${locationsError.message}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      status: "success",
      data: extraction,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat ekstraksi AI.";

    if (error instanceof ExtractionParseError) {
      return NextResponse.json(
        {
          status: "error",
          message,
          debug_raw_response: error.debugRawResponse,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}
