import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** The signed-in account, with a few counts, for the profile page. */
export async function GET() {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const q = db();
    const [u] = (await q`
      select u.username, u.display_name, u.is_admin, u.created_at,
             (select count(*)::int from projects p where p.owner_id = u.id) as projects,
             (select count(*)::int from workspace_grants g
               where g.owner_id = u.id and u.access_hash is not null and g.access_version = u.access_version) as viewers,
             (select count(*)::int from workspace_grants g join users o on o.id = g.owner_id
               where g.viewer_id = u.id and o.access_hash is not null and g.access_version = o.access_version) as opened,
             (select count(*)::int from api_tokens t where t.user_id = u.id) as machines,
             u.access_hash is not null as workspace_open
        from users u where u.id = ${me.id}`) as {
      username: string; display_name: string; is_admin: boolean; created_at: string;
      projects: number; viewers: number; opened: number; machines: number; workspace_open: boolean;
    }[];
    if (!u) throw new HttpError(404, "Account not found.");
    return NextResponse.json({
      username: u.username, displayName: u.display_name, isAdmin: u.is_admin, createdAt: u.created_at,
      projects: u.projects, viewers: u.viewers, workspacesOpenToMe: u.opened, machines: u.machines,
      workspaceOpen: u.workspace_open,
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Changes the name shown to teammates. The username stays: it is how people open a workspace. */
export async function PATCH(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const b = (await req.json()) as { displayName?: string };
    const name = String(b.displayName ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) throw new HttpError(400, "The name cannot be empty.");
    await db()`update users set display_name = ${name} where id = ${me.id}`;
    return NextResponse.json({ ok: true, displayName: name });
  } catch (e) {
    return errorResponse(e);
  }
}
