import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import {
  checkThrottle, clearFailures, clientIp, ensureAuthSchema, errorResponse, hashPassword, HttpError,
  newUserId, recordFailure, startSession, validatePassword, validateUsername, verifyPassword,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * A team member creates their own account with the invite code the
 * administrator set. Without a code nobody can register, so finding the address
 * is not enough to get in.
 */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    await ensureAuthSchema();
    const b = (await req.json()) as { username?: string; password?: string; displayName?: string; inviteCode?: string };
    const key = `register:${await clientIp()}`;
    await checkThrottle(key);
    const q = db();
    const set = (await q`select value from app_settings where key = 'invite_hash'`) as { value: string }[];
    if (!set[0]) throw new HttpError(403, "Registration is closed. Ask the administrator for an invite code.");
    if (!(await verifyPassword(String(b.inviteCode ?? ""), set[0].value))) {
      await recordFailure(key);
      throw new HttpError(403, "That invite code is not valid.");
    }
    const username = validateUsername(b.username);
    const password = validatePassword(b.password);
    const displayName = String(b.displayName ?? "").trim().slice(0, 80) || username;
    const id = newUserId();
    const rows = (await q`
      insert into users (id, username, display_name, pass_hash)
      values (${id}, ${username}, ${displayName}, ${await hashPassword(password)})
      on conflict (username) do nothing
      returning id
    `) as unknown[];
    if (rows.length === 0) throw new HttpError(409, "That username is taken.");
    await clearFailures(key);
    await startSession(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
