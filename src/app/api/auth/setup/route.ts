import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import {
  ensureAuthSchema, errorResponse, hashPassword, HttpError, newUserId, startSession,
  validatePassword, validateUsername,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * Creates the first account, which becomes the administrator and takes over
 * every project stored before accounts existed. Works exactly once: the insert
 * only happens while the users table is empty, so two people racing for it
 * cannot both win.
 */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    await ensureAuthSchema();
    const b = (await req.json()) as { username?: string; password?: string; displayName?: string };
    const username = validateUsername(b.username);
    const password = validatePassword(b.password);
    const displayName = String(b.displayName ?? "").trim().slice(0, 80) || username;
    const id = newUserId();
    const hash = await hashPassword(password);
    const q = db();
    const rows = (await q`
      insert into users (id, username, display_name, pass_hash, is_admin)
      select ${id}, ${username}, ${displayName}, ${hash}, true
       where not exists (select 1 from users)
      returning id
    `) as unknown[];
    if (rows.length === 0) throw new HttpError(409, "Setup has already been done. Sign in instead.");
    const claimed = (await q`update projects set owner_id = ${id} where owner_id is null returning id`) as unknown[];
    await startSession(id);
    return NextResponse.json({ ok: true, claimedProjects: claimed.length });
  } catch (e) {
    return errorResponse(e);
  }
}
