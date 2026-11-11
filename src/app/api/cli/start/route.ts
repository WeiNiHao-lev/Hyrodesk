import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { db, isConfigured } from "@/lib/server/pg";
import { checkThrottle, clientIp, ensureAuthSchema, errorResponse, HttpError, recordFailure } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A machine (Claude Code, a script) asks to be connected. It sends only the
 * SHA-256 of a token it generated itself, and gets back a short code and the
 * address where a signed-in person approves it. The token never travels until
 * it is used, and the server never sees it in the clear.
 */
export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Connecting needs the cloud database" }, { status: 503 });
  try {
    await ensureAuthSchema();
    const b = (await req.json()) as { tokenHash?: string; label?: string };
    if (!/^[0-9a-f]{64}$/.test(String(b.tokenHash ?? ""))) throw new HttpError(400, "tokenHash must be a SHA-256 hex digest.");
    const label = String(b.label ?? "").trim().slice(0, 80) || "Claude Code";
    // Counted, not judged: at most eight requests per address per quarter hour.
    const key = `cli-start:${await clientIp()}`;
    await checkThrottle(key);
    await recordFailure(key);
    const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    const q = db();
    await q`delete from cli_requests where expires_at < now()`;
    await q`
      insert into cli_requests (code, token_hash, label, expires_at)
      values (${code}, ${b.tokenHash!}, ${label}, now() + interval '10 minutes')
    `;
    return NextResponse.json({ code, url: `${req.nextUrl.origin}/connect?code=${code}`, expiresInSeconds: 600 });
  } catch (e) {
    return errorResponse(e);
  }
}
