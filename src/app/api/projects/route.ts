import { NextRequest, NextResponse } from "next/server";
import { isConfigured, listProjectSummariesDb, listProjectsDb, saveProjectDb } from "@/lib/server/pg";
import { Project } from "@/lib/store/types";

export const dynamic = "force-dynamic";

function notConfigured() {
  return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) return notConfigured();
  try {
    // ?summary=1 is what every list on screen asks for. The full form remains
    // for export, which genuinely needs every run.
    const summary = req.nextUrl.searchParams.get("summary") === "1";
    const body = summary ? await listProjectSummariesDb() : await listProjectsDb();
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) return notConfigured();
  try {
    const body = (await req.json()) as Project;
    if (!body?.id) return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    const saved = await saveProjectDb(body);
    return NextResponse.json(saved, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
