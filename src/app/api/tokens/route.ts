import { NextRequest, NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** My connected machines: label, when connected, when last used. Never the token. */
export async function GET() {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const q = db();
    const rows = (await q`
      select id, label, created_at, last_used_at from api_tokens where user_id = ${me.id} order by created_at desc
    `) as { id: string; label: string; created_at: string; last_used_at: string | null }[];
    return NextResponse.json(
      rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at })),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Revokes a token: by id from the browser, or ?self=1 from the machine that
 * holds it (its own "log out"). A token can only ever revoke itself.
 */
export async function DELETE(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const self = req.nextUrl.searchParams.get("self") === "1";
    const me = await requireUser({ allowToken: self });
    const q = db();
    if (self) {
      if (!me.viaToken || !me.tokenId) throw new HttpError(400, "self=1 is for a token revoking itself.");
      await q`delete from api_tokens where id = ${me.tokenId}`;
    } else {
      await q`delete from api_tokens where id = ${req.nextUrl.searchParams.get("id") ?? ""} and user_id = ${me.id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
