import Anthropic from "@anthropic-ai/sdk";

import {
  matchOriginalToNormalized,
  NORMALIZE_SYSTEM_PROMPT,
  NormalizeParseError,
  parseNormalizeResponse,
} from "@/lib/location-normalize";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CLAUDE_TEXT_MODEL = "claude-sonnet-4-5-20250929";

export class FlyerNormalizeError extends Error {
  constructor(
    message: string,
    public readonly debugRawResponse?: string,
  ) {
    super(message);
    this.name = "FlyerNormalizeError";
  }
}

interface LocationRow {
  id: string;
  nama_raw: string;
  nama_normalized: string | null;
}

export interface NormalizeFlyerResult {
  sebelum: number;
  sesudah: number;
}

export async function normalizeFlyer(
  flyerId: string,
): Promise<NormalizeFlyerResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new FlyerNormalizeError(
      "ANTHROPIC_API_KEY belum dikonfigurasi di server.",
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: sessions, error: sessionsError } = await supabase
    .from("outage_sessions")
    .select("id")
    .eq("flyer_id", flyerId);

  if (sessionsError) {
    throw new FlyerNormalizeError(
      `Gagal mengambil sesi pemadaman: ${sessionsError.message}`,
    );
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (sessionIds.length === 0) {
    return { sebelum: 0, sesudah: 0 };
  }

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id, nama_raw, nama_normalized")
    .in("session_id", sessionIds)
    .order("id", { ascending: true });

  if (locationsError) {
    throw new FlyerNormalizeError(
      `Gagal mengambil lokasi: ${locationsError.message}`,
    );
  }

  const locationRows = (locations ?? []) as LocationRow[];
  const sebelum = locationRows.length;

  if (sebelum === 0) {
    return { sebelum: 0, sesudah: 0 };
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
    throw new FlyerNormalizeError(
      "Claude API tidak mengembalikan teks respons.",
    );
  }

  let normalizedList: string[];
  try {
    normalizedList = parseNormalizeResponse(textContent);
  } catch (error) {
    if (error instanceof NormalizeParseError) {
      throw new FlyerNormalizeError(error.message, error.debugRawResponse);
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
      throw new FlyerNormalizeError(
        `Gagal memperbarui lokasi: ${updateError.message}`,
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
      throw new FlyerNormalizeError(
        `Gagal menghapus lokasi duplikat: ${deleteError.message}`,
      );
    }
  }

  return { sebelum, sesudah: sebelum - idsToDelete.length };
}
