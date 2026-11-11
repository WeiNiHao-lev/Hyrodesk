import { NextRequest, NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { errorResponse, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Other workspaces currently open to me: grants made under the owner's present password. */
export async function GET() {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser({ allowToken: true });
    const q = db();
    const rows = (await q`
      select u.id, u.username, u.display_name, g.created_at,
             (select count(*)::int from projects p where p.owner_id = u.id) as projects
        from workspace_grants g join users u on u.id = g.owner_id
       where g.viewer_id = ${me.id} and u.access_hash is not null and g.access_version = u.access_version
       order by u.display_name
    `) as { id: string; username: string; display_name: string; created_at: string; projects: number }[];
    return NextResponse.json(
      rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, since: r.created_at, projects: r.projects })),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** Gives up my access to one workspace. */
export async function DELETE(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const owner = req.nextUrl.searchParams.get("owner") ?? "";
    const q = db();
    await q`delete from workspace_grants where viewer_id = ${me.id} and owner_id = ${owner}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
