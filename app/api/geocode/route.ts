import { NextResponse } from "next/server";

import { FlyerGeocodeError, geocodeFlyer } from "@/lib/flyer-geocode";

interface GeocodeRequestBody {
  flyerId?: string;
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

    const result = await geocodeFlyer(flyerId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat geocoding.";

    if (error instanceof FlyerGeocodeError) {
      return NextResponse.json({ status: "error", message }, { status: 500 });
    }

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
