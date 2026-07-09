import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  matchOriginalToNormalized,
  NORMALIZE_SYSTEM_PROMPT,
  NormalizeParseError,
  parseNormalizeResponse,
} from "@/lib/location-normalize";
import { createSupabaseAdminClient } from "@/lib/supabase";

interface NormalizeRequestBody {
  flyerId?: string;
}

interface LocationRow {
  id: string;
  nama_raw: string;
  nama_normalized: string | null;
}

const CLAUDE_TEXT_MODEL = "claude-sonnet-4-5-20250929";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NormalizeRequestBody;
    const flyerId = body.flyerId?.trim();

    if (!flyerId) {
      return NextResponse.json(
        { status: "error", message: "flyerId wajib diisi." },
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

    const { data: sessions, error: sessionsError } = await supabase
      .from("outage_sessions")
      .select("id")
      .eq("flyer_id", flyerId);

    if (sessionsError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Gagal mengambil sesi pemadaman: ${sessionsError.message}`,
        },
        { status: 500 },
      );
    }

    const sessionIds = (sessions ?? []).map((session) => session.id);
    if (sessionIds.length === 0) {
      return NextResponse.json({ sebelum: 0, sesudah: 0 });
    }

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("id, nama_raw, nama_normalized")
      .in("session_id", sessionIds)
      .order("id", { ascending: true });

    if (locationsError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Gagal mengambil lokasi: ${locationsError.message}`,
        },
        { status: 500 },
      );
    }

    const locationRows = (locations ?? []) as LocationRow[];
    const sebelum = locationRows.length;

    if (sebelum === 0) {
      return NextResponse.json({ sebelum: 0, sesudah: 0 });
    }

    const inputNames = locationRows.map(
      (row) => row.nama_normalized?.trim() || row.nama_raw.trim(),
    );

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: CLAUDE_TEXT_MODEL,
      max_tokens: 4096,
      system: NORMALIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(inputNames),
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
        },
        { status: 500 },
      );
    }

    let normalizedList: string[];
    try {
      normalizedList = parseNormalizeResponse(textContent);
    } catch (error) {
      if (error instanceof NormalizeParseError) {
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

    const groups = new Map<string, LocationRow[]>();
    for (const row of locationRows) {
      const original = row.nama_normalized?.trim() || row.nama_raw.trim();
      const canonical = matchOriginalToNormalized(original, normalizedList);
      const existing = groups.get(canonical) ?? [];
      existing.push(row);
      groups.set(canonical, existing);
    }

    const idsToDelete: string[] = [];

    for (const [canonical, rows] of groups) {
      const keeper = rows[0];
      const { error: updateError } = await supabase
        .from("locations")
        .update({ nama_normalized: canonical })
        .eq("id", keeper.id);

      if (updateError) {
        return NextResponse.json(
          {
            status: "error",
            message: `Gagal memperbarui lokasi: ${updateError.message}`,
          },
          { status: 500 },
        );
      }

      for (const duplicate of rows.slice(1)) {
        idsToDelete.push(duplicate.id);
      }
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("locations")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        return NextResponse.json(
          {
            status: "error",
            message: `Gagal menghapus lokasi duplikat: ${deleteError.message}`,
          },
          { status: 500 },
        );
      }
    }

    const sesudah = sebelum - idsToDelete.length;

    return NextResponse.json({ sebelum, sesudah });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat normalisasi lokasi.";

    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
