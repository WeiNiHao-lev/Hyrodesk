import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { RunError, RunRequest, runSimulation } from "@/lib/engine/run";

export const dynamic = "force-dynamic";

/**
 * Solves a flowsheet with the same engine the web app runs, so a run made by
 * Claude Code is the run the browser would have made.
 *
 * Claude Code normally simulates on its own machine with the downloaded engine
 * (/api/engine) and does not call this; it remains for `hd simulate --server`
 * and for anything that cannot run the engine itself.
 *
 * Body: { flowsheet, check?: string[], dischargeCheck?: string,
 *         workbench?: { title?, stage?, verdict?, notes?: { source, comments?, dataNeeded? },
 *                       autoGaps? (default true), note? } }.
 * With `workbench`, the answer also carries `workbenchHtml`: the run as one
 * self-contained page (中 / EN / ID) for a workbench showcase library.
 * Product-driven flowsheets (basis.designMode "product-driven" with a
 * targetProductFlow) are solved backwards for the intake; the flowsheet that
 * comes back carries the solved feed flow, ready to save as a run.
 */
export async function POST(req: Request) {
  try {
    if (isConfigured()) await requireUser({ allowToken: true });
    const b = (await req.json()) as RunRequest;
    let out;
    try {
      out = runSimulation(b);
    } catch (e) {
      if (e instanceof RunError) throw new HttpError(400, e.message);
      throw e;
    }
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
