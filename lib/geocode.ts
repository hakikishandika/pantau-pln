import Anthropic from "@anthropic-ai/sdk";

import { extractJsonFromResponse } from "@/lib/ai-extraction";

const NOMINATIM_USER_AGENT =
  "PantauPLNBanjarbaru/1.0 (kontak: email-kamu@example.com)";
const BANJARBARU_VIEWBOX = "114.7500,-3.3800,114.9200,-3.5200";
const KALSEL_VIEWBOX = "114.1900,-1.3000,116.3300,-4.4000";
const QUERY_SUFFIX = "Banjarbaru, Kalimantan Selatan, Indonesia";
const CLAUDE_TEXT_MODEL = "claude-sonnet-4-5-20250929";

export type GeocodeSource =
  | "nominatim"
  | "nominatim_banjarbaru"
  | "nominatim_kalsel"
  | "claude_estimate";

export interface GeocodeResult {
  lat: number;
  lng: number;
  source: GeocodeSource;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
}

interface ClaudeCoordinateResponse {
  lat: number | null;
  lng: number | null;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY belum dikonfigurasi di server.");
  }
  return new Anthropic({ apiKey });
}

async function delayBeforeNominatimRequest(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
}

async function searchNominatim(
  query: string,
  viewbox: string,
): Promise<{ lat: number; lng: number } | null> {
  await delayBeforeNominatimRequest();

  const fullQuery = `${query.trim()}, ${QUERY_SUFFIX}`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", fullQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("viewbox", viewbox);
  url.searchParams.set("bounded", "1");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let results: NominatimSearchResult[];
  try {
    results = (await response.json()) as NominatimSearchResult[];
  } catch {
    return null;
  }

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const lat = Number.parseFloat(results[0].lat);
  const lng = Number.parseFloat(results[0].lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export async function geocodeWithNominatimBanjarbaru(
  query: string,
): Promise<GeocodeResult | null> {
  const coords = await searchNominatim(query, BANJARBARU_VIEWBOX);
  if (!coords) {
    return null;
  }
  return { ...coords, source: "nominatim_banjarbaru" };
}

export async function geocodeWithNominatimKalsel(
  query: string,
): Promise<GeocodeResult | null> {
  const coords = await searchNominatim(query, KALSEL_VIEWBOX);
  if (!coords) {
    return null;
  }
  return { ...coords, source: "nominatim_kalsel" };
}

/**
 * Geocode lokasi: Nominatim Banjarbaru → Nominatim Kalsel → estimasi Claude.
 * Cek cache dilakukan di layer API (lib/geocode-cache.ts), bukan di sini.
 */
export async function geocodeLocation(
  query: string,
): Promise<GeocodeResult | null> {
  const banjarbaruResult = await geocodeWithNominatimBanjarbaru(query);
  if (banjarbaruResult) {
    return banjarbaruResult;
  }

  const kalselResult = await geocodeWithNominatimKalsel(query);
  if (kalselResult) {
    return kalselResult;
  }

  return estimateCoordinatesWithClaude(query);
}

/** @deprecated Gunakan geocodeLocation */
export const geocodeWithNominatim = geocodeWithNominatimBanjarbaru;

export async function estimateCoordinatesWithClaude(
  nama: string,
): Promise<GeocodeResult | null> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: CLAUDE_TEXT_MODEL,
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Perkirakan koordinat lat,lng untuk lokasi '${nama}' di Kota Banjarbaru, Kalimantan Selatan, Indonesia. Jika tidak yakin sama sekali, jawab null. Kembalikan HANYA JSON: {"lat": number atau null, "lng": number atau null}`,
      },
    ],
  });

  const textContent = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  if (!textContent) {
    return null;
  }

  let parsed: ClaudeCoordinateResponse;
  try {
    parsed = JSON.parse(
      extractJsonFromResponse(textContent),
    ) as ClaudeCoordinateResponse;
  } catch {
    return null;
  }

  if (parsed.lat === null || parsed.lng === null) {
    return null;
  }

  const lat = Number(parsed.lat);
  const lng = Number(parsed.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    source: "claude_estimate",
  };
}
