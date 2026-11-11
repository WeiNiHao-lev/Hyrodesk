import { NextRequest, NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { errorResponse, hashPassword, requireUser, validatePassword } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Whether my workspace is open, and who currently has read access to it. */
export async function GET() {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const q = db();
    const u = (await q`select access_hash is not null as open, access_version from users where id = ${me.id}`) as { open: boolean; access_version: number }[];
    const viewers = (await q`
      select v.id, v.username, v.display_name, g.created_at
        from workspace_grants g join users v on v.id = g.viewer_id
       where g.owner_id = ${me.id} and g.access_version = ${u[0]?.access_version ?? -1}
       order by g.created_at
    `) as { id: string; username: string; display_name: string; created_at: string }[];
    return NextResponse.json({
      open: !!u[0]?.open,
      viewers: u[0]?.open ? viewers.map((v) => ({ id: v.id, username: v.username, displayName: v.display_name, since: v.created_at })) : [],
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Sets, changes or clears my workspace password. Every change moves the access
 * version on, so everyone who opened the workspace under the old password loses
 * access at once and has to be given the new one.
 */
export async function PUT(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const b = (await req.json()) as { password?: string | null };
    const q = db();
    if (b.password == null || b.password === "") {
      await q`update users set access_hash = null, access_version = access_version + 1 where id = ${me.id}`;
      await q`delete from workspace_grants where owner_id = ${me.id}`;
      return NextResponse.json({ ok: true, open: false });
    }
    const pw = validatePassword(b.password, "Workspace password");
    await q`update users set access_hash = ${await hashPassword(pw)}, access_version = access_version + 1 where id = ${me.id}`;
    await q`delete from workspace_grants where owner_id = ${me.id}`;
    return NextResponse.json({ ok: true, open: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Removes one viewer's access without changing the password for the others. */
export async function DELETE(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const viewer = req.nextUrl.searchParams.get("viewer") ?? "";
    const q = db();
    await q`delete from workspace_grants where owner_id = ${me.id} and viewer_id = ${viewer}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
