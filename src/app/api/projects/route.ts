import { NextRequest, NextResponse } from "next/server";
import { isConfigured, listProjectSummariesDb, listProjectsDb, saveProjectDb } from "@/lib/server/pg";
import { canView, errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { Project } from "@/lib/store/types";

export const dynamic = "force-dynamic";

function notConfigured() {
  return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
}

/**
 * The signed-in account's projects, or — with ?owner= — another account's,
 * when its owner has opened the workspace to this account with a password.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured()) return notConfigured();
  try {
    const me = await requireUser();
    const owner = req.nextUrl.searchParams.get("owner") || me.id;
    if (!(await canView(me.id, owner))) {
      throw new HttpError(403, "This workspace is not open to you. Ask its owner for the workspace password.");
    }
    const access = owner === me.id ? "owner" : "viewer";
    // ?summary=1 is what every list on screen asks for. The full form remains
    // for export, which genuinely needs every run.
    const summary = req.nextUrl.searchParams.get("summary") === "1";
    const rows = summary ? await listProjectSummariesDb(owner) : await listProjectsDb(owner);
    return NextResponse.json(rows.map((p) => ({ ...p, access })), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) return notConfigured();
  try {
    const me = await requireUser();
    const body = (await req.json()) as Project;
    if (!body?.id) return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    const saved = await saveProjectDb(body, me.id);
    // The id exists and belongs to someone else: refuse rather than overwrite.
    if (!saved) throw new HttpError(403, "This project belongs to another account and cannot be saved over.", { conflict: true });
    return NextResponse.json({ ...saved, access: "owner" }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
