import { NextResponse } from "next/server";
import { getProjectDb, isConfigured, setShareTokenDb } from "@/lib/server/pg";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 128 bits of randomness, URL-safe. Unguessable in practice. */
function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const { id } = await ctx.params;
  try {
    const p = await getProjectDb(id);
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Reuse the existing token so the link stays stable once shared.
    const token = p.shareToken ?? makeToken();
    if (!p.shareToken) await setShareTokenDb(id, token);
    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  const { id } = await ctx.params;
  try {
    await setShareTokenDb(id, null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
