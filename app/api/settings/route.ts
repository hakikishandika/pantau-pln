import { NextResponse } from "next/server";

import { getAutoApprove, setAutoApprove } from "@/lib/app-settings";
import { requireAdminUser } from "@/lib/supabase-server";

export async function GET() {
  try {
    const autoApprove = await getAutoApprove();
    return NextResponse.json({ auto_approve: autoApprove });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memuat pengaturan.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { auto_approve?: boolean };
    if (typeof body.auto_approve !== "boolean") {
      return NextResponse.json(
        { status: "error", message: "auto_approve harus boolean." },
        { status: 400 },
      );
    }

    await setAutoApprove(body.auto_approve);
    return NextResponse.json({ auto_approve: body.auto_approve });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal menyimpan pengaturan.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
