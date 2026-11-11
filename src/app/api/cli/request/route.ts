import { NextRequest, NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** What the approval page shows about a pending connection: never the token hash. */
export async function GET(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Connecting needs the cloud database" }, { status: 503 });
  try {
    await requireUser();
    const code = req.nextUrl.searchParams.get("code") ?? "";
    const q = db();
    const rows = (await q`
      select code, label, created_at, approved_by, expires_at < now() as expired
        from cli_requests where code = ${code}
    `) as { code: string; label: string; created_at: string; approved_by: string | null; expired: boolean }[];
    const r = rows[0];
    if (!r) throw new HttpError(404, "No such request. It may have expired, or already been approved.");
    return NextResponse.json({
      code: r.code, label: r.label, createdAt: r.created_at,
      status: r.approved_by ? "approved" : r.expired ? "expired" : "pending",
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
