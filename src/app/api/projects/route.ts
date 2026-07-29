import { NextRequest, NextResponse } from "next/server";
import { isConfigured, listProjectsDb, saveProjectDb } from "@/lib/server/pg";
import { Project } from "@/lib/store/types";

export const dynamic = "force-dynamic";

function notConfigured() {
  return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
}

export async function GET() {
  if (!isConfigured()) return notConfigured();
  try {
    return NextResponse.json(await listProjectsDb(), { headers: { "cache-control": "no-store" } });
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
