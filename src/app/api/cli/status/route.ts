import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { ensureAuthSchema, errorResponse } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * The connecting machine polls here. It must present the same token hash it
 * started with, so knowing a code is worth nothing to anyone else. Once
 * approved the request is deleted: the token itself is already in api_tokens.
 */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "Connecting needs the cloud database" }, { status: 503 });
  try {
    await ensureAuthSchema();
    const b = (await req.json()) as { code?: string; tokenHash?: string };
    const q = db();
    const rows = (await q`
      select approved_by, expires_at < now() as expired from cli_requests
       where code = ${String(b.code ?? "")} and token_hash = ${String(b.tokenHash ?? "")}
    `) as { approved_by: string | null; expired: boolean }[];
    const r = rows[0];
    if (!r) return NextResponse.json({ status: "unknown" });
    if (r.approved_by) {
      await q`delete from cli_requests where code = ${String(b.code)}`;
      return NextResponse.json({ status: "approved" });
    }
    return NextResponse.json({ status: r.expired ? "expired" : "pending" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
