import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/pg";
import { endSession, errorResponse } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isConfigured()) return NextResponse.json({ ok: true });
  try {
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
