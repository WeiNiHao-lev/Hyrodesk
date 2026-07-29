import { NextResponse } from "next/server";
import { isConfigured, ping } from "@/lib/server/pg";
import { HealthReport } from "@/lib/store/types";

export const dynamic = "force-dynamic";

/**
 * Reports which storage backend is active. The client asks once per session and
 * routes every read and write accordingly, so a missing DATABASE_URL degrades
 * to browser storage instead of breaking the app.
 */
export async function GET() {
  const configured = isConfigured();
  if (!configured) {
    const body: HealthReport = {
      storage: "local", configured: false, ok: true,
      error: "DATABASE_URL is not set — using browser storage (IndexedDB).",
    };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  }
  const p = await ping();
  const body: HealthReport = {
    storage: p.ok ? "cloud" : "local",
    configured: true,
    ok: p.ok,
    projects: p.projects,
    error: p.ok ? undefined : `Database configured but unreachable: ${p.error}`,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
