import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * The simulation engine as one ES module, for Claude Code to run on its own
 * machine (see scripts/build-engine.mjs). Signed-in accounts and connected
 * Claude Code only. The current version is public at /engine-version.json, so
 * checking for an update costs no database query; this download happens only
 * when the version changes.
 */
export async function GET() {
  try {
    if (isConfigured()) await requireUser({ allowToken: true });
    let code: string;
    try {
      code = await readFile(join(process.cwd(), "engine-dist", "hydrodesk-engine.mjs"), "utf8");
    } catch {
      throw new HttpError(503, "The engine bundle has not been built (npm run engine).");
    }
    const version = /^export const ENGINE_VERSION = "([0-9a-f]+)"/m.exec(code)?.[1] ?? "";
    return new Response(code, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "x-engine-version": version,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
