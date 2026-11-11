import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import {
  checkThrottle, clearFailures, errorResponse, hashPassword, HttpError, recordFailure, requireUser,
  startSession, validatePassword, verifyPassword,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Changes the signed-in account's own sign-in password and signs out its other sessions. */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const b = (await req.json()) as { current?: string; next?: string };
    const key = `password:${me.id}`;
    await checkThrottle(key);
    const q = db();
    const rows = (await q`select pass_hash from users where id = ${me.id}`) as { pass_hash: string }[];
    if (!(await verifyPassword(String(b.current ?? ""), rows[0]?.pass_hash ?? null))) {
      await recordFailure(key);
      throw new HttpError(403, "The current password is not right.");
    }
    const next = validatePassword(b.next, "New password");
    await q`update users set pass_hash = ${await hashPassword(next)} where id = ${me.id}`;
    await q`delete from sessions where user_id = ${me.id}`;
    await clearFailures(key);
    await startSession(me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
