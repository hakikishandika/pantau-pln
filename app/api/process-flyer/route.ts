import { NextResponse } from "next/server";

import { processFlyer } from "@/lib/flyer-process";

interface ProcessFlyerRequestBody {
  flyerId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProcessFlyerRequestBody;
    const flyerId = body.flyerId?.trim();

    if (!flyerId) {
      return NextResponse.json(
        { status: "error", message: "flyerId wajib diisi." },
        { status: 400 },
      );
    }

    const result = await processFlyer(flyerId);

    if (!result.success) {
      return NextResponse.json(
        {
          status: "error",
          message: result.error ?? "Gagal memproses flyer.",
          failed_step: result.failedStep,
          auto_approved: false,
          flyer_status: "pending",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "success",
      auto_approved: result.autoApproved,
      flyer_status: result.status,
      geocode: result.geocode,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat memproses flyer.";

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
