import { NextResponse } from "next/server";

import { FlyerNormalizeError, normalizeFlyer } from "@/lib/flyer-normalize";

interface NormalizeRequestBody {
  flyerId?: string;
}

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

    const result = await normalizeFlyer(flyerId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat normalisasi lokasi.";

    if (error instanceof FlyerNormalizeError) {
      return NextResponse.json(
        {
          status: "error",
          message,
          debug_raw_response: error.debugRawResponse,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
