import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    // Admin client — service role, hanya boleh dipakai di server (API route ini)
    const supabase = createSupabaseAdminClient();

    const { count, error } = await supabase
      .from("flyers")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          connected: false,
          count: null,
          message: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "success",
      connected: true,
      count: count ?? 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown connection error";

    return NextResponse.json(
      {
        status: "error",
        connected: false,
        count: null,
        message,
      },
      { status: 500 },
    );
  }
}
