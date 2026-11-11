import { NextResponse } from "next/server";
import { getProjectDb, isConfigured, setShareTokenDb } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 128 bits of randomness, URL-safe. Unguessable in practice. */
function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only the owner creates or revokes a project's read-only link. */
export async function POST(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const { id } = await ctx.params;
  try {
    const me = await requireUser();
    const p = await getProjectDb(id);
    if (!p || p.ownerId !== me.id) throw new HttpError(404, "Not found");
    // Reuse the existing token so the link stays stable once shared.
    const token = p.shareToken ?? makeToken();
    if (!p.shareToken) await setShareTokenDb(id, token, me.id);
    return NextResponse.json({ token });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const { id } = await ctx.params;
  try {
    const me = await requireUser();
    if (!(await setShareTokenDb(id, null, me.id))) throw new HttpError(404, "Not found");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
