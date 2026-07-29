import { NextResponse } from "next/server";
import { getProjectByTokenDb, isConfigured } from "@/lib/server/pg";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Public read-only access to one project by share token.
 *
 * Anyone holding the link can read the project. There is no write path here at
 * all, and the token is never derivable from the project id, so a link cannot
 * be guessed from anything visible in the application.
 */
export async function GET(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "Sharing requires the cloud database" }, { status: 503 });
  const { token } = await ctx.params;
  if (!token || token.length < 16) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  try {
    const p = await getProjectByTokenDb(token);
    if (!p) return NextResponse.json({ error: "This link is not valid, or has been revoked." }, { status: 404 });
    // Do not leak the token back to the reader.
    const { shareToken: _omit, ...safe } = p;
    void _omit;
    return NextResponse.json(safe, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
