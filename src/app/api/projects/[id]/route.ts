import { NextResponse } from "next/server";
import { deleteProjectDb, getProjectDb, isConfigured } from "@/lib/server/pg";
import { canView, errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const { id } = await ctx.params;
  try {
    const me = await requireUser();
    const p = await getProjectDb(id);
    // Someone else's project the viewer has no grant for reads as not found, so
    // the API does not confirm which ids exist in other workspaces.
    if (!p || !(await canView(me.id, p.ownerId ?? null))) throw new HttpError(404, "Not found");
    const access = p.ownerId === me.id ? "owner" : "viewer";
    // A viewer has no business with the owner's share link.
    const body = access === "owner" ? { ...p, access } : { ...p, access, shareToken: undefined };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const { id } = await ctx.params;
  try {
    const me = await requireUser();
    if (!(await deleteProjectDb(id, me.id))) throw new HttpError(403, "Only the owner can delete this project.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
