import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import { randomUUID } from "crypto";
import {
  checkThrottle, clearFailures, ensureAuthSchema, errorResponse, hashPassword, HttpError, recordFailure,
  startSession, verifyPassword,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

let dummy: string | undefined;

export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    await ensureAuthSchema();
    const b = (await req.json()) as { username?: string; password?: string };
    const username = String(b.username ?? "").trim().toLowerCase();
    const key = `login:${username}`;
    await checkThrottle(key);
    const q = db();
    const rows = (await q`select id, pass_hash from users where username = ${username}`) as { id: string; pass_hash: string }[];
    // Same message, and the same scrypt work, whether the name or the password
    // was wrong, so neither the reply nor its timing says which names exist.
    dummy ??= await hashPassword(randomUUID());
    const ok = await verifyPassword(String(b.password ?? ""), rows[0]?.pass_hash ?? dummy);
    if (!rows[0] || !ok) {
      await recordFailure(key);
      throw new HttpError(401, "Wrong username or password.");
    }
    await clearFailures(key);
    await startSession(rows[0].id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
