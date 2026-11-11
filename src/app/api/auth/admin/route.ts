import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import {
  errorResponse, hashPassword, HttpError, requireUser, validatePassword, validateUsername,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const me = await requireUser();
  if (!me.isAdmin) throw new HttpError(403, "Administrator only.");
  return me;
}

/** Members, and whether registration is open. Never the invite code itself: only its hash is stored. */
export async function GET() {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    await requireAdmin();
    const q = db();
    const users = (await q`
      select u.username, u.display_name, u.is_admin, u.created_at,
             (select count(*)::int from projects p where p.owner_id = u.id) as projects
        from users u order by u.created_at
    `) as { username: string; display_name: string; is_admin: boolean; created_at: string; projects: number }[];
    const invite = (await q`select 1 from app_settings where key = 'invite_hash'`) as unknown[];
    return NextResponse.json({
      registrationOpen: invite.length > 0,
      members: users.map((u) => ({
        username: u.username, displayName: u.display_name, isAdmin: u.is_admin,
        createdAt: u.created_at, projects: u.projects,
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * action "invite": set the invite code (or null to close registration).
 * action "reset": give a member a new sign-in password when they have lost
 * theirs, and sign them out everywhere. Their projects are untouched.
 */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    await requireAdmin();
    const b = (await req.json()) as { action?: string; code?: string | null; username?: string; password?: string };
    const q = db();
    if (b.action === "invite") {
      if (b.code == null || b.code === "") {
        await q`delete from app_settings where key = 'invite_hash'`;
        return NextResponse.json({ ok: true, registrationOpen: false });
      }
      const code = validatePassword(b.code, "Invite code");
      const hash = await hashPassword(code);
      await q`
        insert into app_settings (key, value) values ('invite_hash', ${hash})
        on conflict (key) do update set value = excluded.value
      `;
      return NextResponse.json({ ok: true, registrationOpen: true });
    }
    if (b.action === "reset") {
      const username = validateUsername(b.username);
      const password = validatePassword(b.password, "New password");
      const rows = (await q`
        update users set pass_hash = ${await hashPassword(password)} where username = ${username} returning id
      `) as { id: string }[];
      if (!rows[0]) throw new HttpError(404, "No such member.");
      await q`delete from sessions where user_id = ${rows[0].id}`;
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(400, "Unknown action.");
  } catch (e) {
    return errorResponse(e);
  }
}
