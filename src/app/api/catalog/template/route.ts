import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { TEMPLATES } from "@/lib/engine/templates";

export const dynamic = "force-dynamic";

/** A template, built: a complete flowsheet to start from or simulate as it is. */
export async function GET(req: NextRequest) {
  try {
    if (isConfigured()) await requireUser({ allowToken: true });
    const key = req.nextUrl.searchParams.get("key") ?? "";
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) throw new HttpError(404, `No template "${key}".`);
    return NextResponse.json(t.make(), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
