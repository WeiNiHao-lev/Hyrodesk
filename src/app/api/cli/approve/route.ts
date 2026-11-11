import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * A person signed in in the browser approves (or refuses) a pending connection.
 * Approving turns the machine's token hash into an API token on their account.
 * Only a browser session can do this: a token cannot mint another token.
 */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "Connecting needs the cloud database" }, { status: 503 });
  try {
    const me = await requireUser();
    const b = (await req.json()) as { code?: string; approve?: boolean };
    const code = String(b.code ?? "");
    const q = db();
    if (!b.approve) {
      await q`delete from cli_requests where code = ${code} and approved_by is null`;
      return NextResponse.json({ ok: true, status: "refused" });
    }
    const rows = (await q`
      update cli_requests set approved_by = ${me.id}
       where code = ${code} and approved_by is null and expires_at > now()
      returning token_hash, label
    `) as { token_hash: string; label: string }[];
    if (!rows[0]) throw new HttpError(404, "This request has expired or was already used. Start again from Claude Code.");
    await q`
      insert into api_tokens (id, user_id, token_hash, label)
      values (${`t-${randomBytes(9).toString("base64url")}`}, ${me.id}, ${rows[0].token_hash}, ${rows[0].label})
    `;
    return NextResponse.json({ ok: true, status: "approved", label: rows[0].label });
  } catch (e) {
    return errorResponse(e);
  }
}
