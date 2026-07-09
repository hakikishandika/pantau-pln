import {
  geocodeLocation,
  type GeocodeSource,
} from "@/lib/geocode";
import { saveGeocodeToCache } from "@/lib/geocode-cache";
import { createSupabaseAdminClient } from "@/lib/supabase";

import type { RegeocodeSummary } from "@/lib/types/geocode";

type StreamEvent =
  | { type: "progress"; current: number; total: number; nama: string }
  | { type: "complete"; summary: RegeocodeSummary }
  | { type: "error"; message: string };

function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function countSource(
  summary: RegeocodeSummary,
  source: GeocodeSource,
): void {
  if (source === "nominatim_banjarbaru") {
    summary.nominatim_banjarbaru += 1;
  } else if (source === "nominatim_kalsel") {
    summary.nominatim_kalsel += 1;
  } else if (source === "claude_estimate") {
    summary.claude_estimate += 1;
  }
}

export async function POST() {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const supabase = createSupabaseAdminClient();

        const { error: clearCacheError } = await supabase
          .from("location_cache")
          .delete()
          .not("nama_normalized", "is", null);

        if (clearCacheError) {
          controller.enqueue(
            encodeEvent({
              type: "error",
              message: `Gagal menghapus cache: ${clearCacheError.message}`,
            }),
          );
          controller.close();
          return;
        }

        const { data: locationRows, error: locationsError } = await supabase
          .from("locations")
          .select("nama_normalized")
          .not("nama_normalized", "is", null);

        if (locationsError) {
          controller.enqueue(
            encodeEvent({
              type: "error",
              message: `Gagal mengambil lokasi: ${locationsError.message}`,
            }),
          );
          controller.close();
          return;
        }

        const uniqueNames = Array.from(
          new Set(
            (locationRows ?? [])
              .map((row) => row.nama_normalized?.trim())
              .filter((name): name is string => Boolean(name)),
          ),
        ).sort((a, b) => a.localeCompare(b));

        const summary: RegeocodeSummary = {
          berhasil: 0,
          gagal: 0,
          nominatim_banjarbaru: 0,
          nominatim_kalsel: 0,
          claude_estimate: 0,
        };

        const total = uniqueNames.length;

        for (let index = 0; index < uniqueNames.length; index += 1) {
          const nama = uniqueNames[index];

          controller.enqueue(
            encodeEvent({
              type: "progress",
              current: index + 1,
              total,
              nama,
            }),
          );

          const result = await geocodeLocation(nama);

          if (!result) {
            summary.gagal += 1;
            continue;
          }

          await saveGeocodeToCache(nama, result);

          const { error: updateError } = await supabase
            .from("locations")
            .update({
              lat: result.lat,
              lng: result.lng,
              geocode_source: result.source,
            })
            .eq("nama_normalized", nama);

          if (updateError) {
            summary.gagal += 1;
            continue;
          }

          summary.berhasil += 1;
          countSource(summary, result.source);
        }

        controller.enqueue(encodeEvent({ type: "complete", summary }));
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat regeocode.";
        controller.enqueue(encodeEvent({ type: "error", message }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
