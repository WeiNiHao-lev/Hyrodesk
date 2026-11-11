import { NextResponse } from "next/server";
import { db, isConfigured } from "@/lib/server/pg";
import {
  checkThrottle, clearFailures, errorResponse, HttpError, recordFailure, requireUser, verifyPassword,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * Opens another account's workspace, read only, with the password its owner
 * set. Wrong attempts are counted per viewer and per owner, so the password
 * cannot be guessed from a list by one account or by several.
 */
export async function POST(req: Request) {
  if (!isConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  try {
    const me = await requireUser();
    const b = (await req.json()) as { username?: string; password?: string };
    const username = String(b.username ?? "").trim().toLowerCase();
    const viewerKey = `open:${me.id}:${username}`;
    const ownerKey = `open-owner:${username}`;
    await checkThrottle(viewerKey);
    await checkThrottle(ownerKey);
    const q = db();
    const rows = (await q`
      select id, display_name, access_hash, access_version from users where username = ${username}
    `) as { id: string; display_name: string; access_hash: string | null; access_version: number }[];
    const owner = rows[0];
    if (owner && owner.id === me.id) throw new HttpError(400, "That is your own workspace.");
    // One message for a missing account, a closed workspace and a wrong password.
    const ok = owner?.access_hash ? await verifyPassword(String(b.password ?? ""), owner.access_hash) : false;
    if (!owner || !ok) {
      await recordFailure(viewerKey);
      await recordFailure(ownerKey);
      throw new HttpError(403, "Wrong username or workspace password, or that workspace is not open.");
    }
    await q`
      insert into workspace_grants (viewer_id, owner_id, access_version)
      values (${me.id}, ${owner.id}, ${owner.access_version})
      on conflict (viewer_id, owner_id) do update set access_version = excluded.access_version, created_at = now()
    `;
    await clearFailures(viewerKey);
    return NextResponse.json({ ok: true, owner: { id: owner.id, username, displayName: owner.display_name } });
  } catch (e) {
    return errorResponse(e);
  }
}
