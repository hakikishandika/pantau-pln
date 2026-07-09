import { NextResponse } from "next/server";

import {
  geocodeWithCache,
  isNominatimSource,
} from "@/lib/geocode-cache";
import { createSupabaseAdminClient } from "@/lib/supabase";

interface GeocodeRequestBody {
  flyerId?: string;
}

interface LocationRow {
  id: string;
  nama_raw: string;
  nama_normalized: string | null;
  lat: number | null;
  lng: number | null;
  session_id: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GeocodeRequestBody;
    const flyerId = body.flyerId?.trim();

    if (!flyerId) {
      return NextResponse.json(
        { status: "error", message: "flyerId wajib diisi." },
        { status: 400 },
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
      return NextResponse.json({
        berhasil: 0,
        gagal: 0,
        dari_cache: 0,
        dari_nominatim: 0,
        dari_estimasi_ai: 0,
      });
    }

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("id, nama_raw, nama_normalized, lat, lng, session_id")
      .in("session_id", sessionIds)
      .is("lat", null)
      .is("lng", null);

    if (locationsError) {
      return NextResponse.json(
        {
          status: "error",
          message: `Gagal mengambil lokasi: ${locationsError.message}`,
        },
        { status: 500 },
      );
    }

    const pendingLocations = (locations ?? []) as LocationRow[];
    let berhasil = 0;
    let gagal = 0;
    let dariCache = 0;
    let dariNominatim = 0;
    let dariEstimasiAi = 0;

    for (const location of pendingLocations) {
      const namaNormalized =
        location.nama_normalized?.trim() || location.nama_raw.trim();

      const { result, fromCache } = await geocodeWithCache(namaNormalized);

      if (!result) {
        gagal += 1;
        continue;
      }

      const { error: updateError } = await supabase
        .from("locations")
        .update({
          lat: result.lat,
          lng: result.lng,
          geocode_source: result.source,
        })
        .eq("id", location.id);

      if (updateError) {
        gagal += 1;
        continue;
      }

      berhasil += 1;

      if (fromCache) {
        dariCache += 1;
        if (isNominatimSource(result.source)) {
          dariNominatim += 1;
        } else if (result.source === "claude_estimate") {
          dariEstimasiAi += 1;
        }
      } else if (isNominatimSource(result.source)) {
        dariNominatim += 1;
      } else if (result.source === "claude_estimate") {
        dariEstimasiAi += 1;
      }
    }

    return NextResponse.json({
      berhasil,
      gagal,
      dari_cache: dariCache,
      dari_nominatim: dariNominatim,
      dari_estimasi_ai: dariEstimasiAi,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat geocoding.";

    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
