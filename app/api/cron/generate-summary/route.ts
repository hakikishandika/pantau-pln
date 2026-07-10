import { NextResponse } from "next/server";

import { generateDailySummary, SummaryParseError } from "@/lib/generate-summary";
import { requireAdminUser } from "@/lib/supabase-server";

async function isAuthorized(request: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const user = await requireAdminUser();
  return Boolean(user);
}

async function handleGenerateSummary() {
  const result = await generateDailySummary();
  return NextResponse.json({
    status: "success",
    summary: result.summary,
    processed_count: result.processedCount,
  });
}

export async function GET(request: Request) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized." },
        { status: 401 },
      );
    }

    return await handleGenerateSummary();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat membuat ringkasan.";

    if (error instanceof SummaryParseError) {
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

export async function POST(request: Request) {
  return GET(request);
}
