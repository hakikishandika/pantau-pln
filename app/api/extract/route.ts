import { NextResponse } from "next/server";

import { extractFlyer, FlyerExtractError } from "@/lib/flyer-extract";

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

    const extraction = await extractFlyer(flyerId, imageUrl);

    return NextResponse.json({
      status: "success",
      data: extraction,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat ekstraksi AI.";

    if (error instanceof FlyerExtractError) {
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
