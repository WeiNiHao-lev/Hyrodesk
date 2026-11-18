import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/server/pg";
import { errorResponse, HttpError, requireUser } from "@/lib/server/auth";
import { simulate, simulateForProduct } from "@/lib/engine/solver";
import { checkCompliance, checkedRows } from "@/lib/engine/diagnostics";
import { indicativeCapex } from "@/lib/engine/capex";
import { swroBenchmark } from "@/lib/engine/benchmarks";
import { UNIT_BY_TYPE } from "@/lib/engine/units";
import {
  buildWorkbenchPage, Multi, ProjectStage, suggestDataNeeded, Verdict, WbLang,
} from "@/lib/report/workbench";

const STAGES = ["lead", "data-collection", "simulation", "pre-approval", "approved", "rejected", "on-hold"];
const VERDICTS = ["feasible", "conditional", "not-feasible"];
const LANGS = ["zh", "en", "id"];
/** A text in up to three languages, each trimmed to a sane length. */
function multi(m: unknown): Multi | undefined {
  if (!m || typeof m !== "object") return undefined;
  const out: Multi = {};
  for (const l of LANGS) {
    const v = (m as Record<string, unknown>)[l];
    if (typeof v === "string" && v.trim()) out[l as WbLang] = v.slice(0, 6000);
  }
  return out;
}
import { Flowsheet } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

/**
 * Solves a flowsheet with the same engine the web app runs, so a run made by
 * Claude Code is the run the browser would have made.
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
    const b = (await req.json()) as {
      flowsheet?: Flowsheet; check?: string[]; dischargeCheck?: string;
      workbench?: {
        title?: string; note?: string; stage?: string; verdict?: string; autoGaps?: boolean;
        notes?: { source?: string; comments?: unknown; dataNeeded?: unknown };
      };
    };
    const fs = b.flowsheet;
    if (!fs || !Array.isArray(fs.nodes) || !Array.isArray(fs.edges) || !fs.feed || !fs.basis) {
      throw new HttpError(400, "Body must be { flowsheet: { nodes, edges, feed, basis } }.");
    }
    const unknown = fs.nodes.filter((n) => !UNIT_BY_TYPE[n.type]).map((n) => `${n.label} (${n.type})`);
    if (unknown.length) throw new HttpError(400, `Unknown unit type: ${unknown.join(", ")}. See /api/catalog.`);
    const ids = new Set(fs.nodes.map((n) => n.id));
    const dangling = fs.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target)).map((e) => e.id);
    if (dangling.length) throw new HttpError(400, `Edges point at nodes that do not exist: ${dangling.join(", ")}.`);

    const target = fs.basis.designMode === "product-driven" ? Number(fs.basis.targetProductFlow ?? 0) : 0;
    let result;
    let converged: boolean;
    if (target > 0) {
      const sol = simulateForProduct(fs, target);
      fs.feed = { ...fs.feed, flow: sol.feedFlow };
      result = sol.result;
      converged = sol.converged;
    } else {
      result = simulate(fs);
      converged = result.converged;
    }

    const standards = b.check?.length ? b.check : [fs.basis.standard];
    const compliance = standards.map((std) => ({
      standard: std,
      products: result.productStreams.map((p) => {
        const rows = checkCompliance(p.stream, std);
        return { label: p.label, failed: checkedRows(rows).filter((r) => !r.pass).map((r) => r.label), rows };
      }),
    }));
    const discharge = b.dischargeCheck
      ? result.wasteStreams.filter((w) => w.stream.flow > 1e-6).map((w) => {
        const rows = checkCompliance(w.stream, b.dischargeCheck!);
        return { label: w.label, failed: checkedRows(rows).filter((r) => !r.pass).map((r) => r.label), rows };
      })
      : [];

    return NextResponse.json({
      converged,
      flowsheet: fs,
      result,
      compliance,
      discharge,
      capex: indicativeCapex(fs, result),
      // CCEPC's SWRO reference figures, when the flowsheet has an SWRO block.
      benchmark: swroBenchmark(fs, result),
      ...(b.workbench ? {
        workbenchHtml: buildWorkbenchPage(fs, result, {
          title: String(b.workbench.title || "HydroDesk run").slice(0, 160),
          note: b.workbench.note ? String(b.workbench.note).slice(0, 4000) : undefined,
          stage: STAGES.includes(String(b.workbench.stage)) ? (b.workbench.stage as ProjectStage) : undefined,
          verdict: VERDICTS.includes(String(b.workbench.verdict)) ? (b.workbench.verdict as Verdict) : undefined,
          gaps: b.workbench.autoGaps === false ? [] : suggestDataNeeded(fs, result, null),
          notes: b.workbench.notes ? {
            source: (LANGS.includes(String(b.workbench.notes.source)) ? b.workbench.notes.source : "en") as WbLang,
            comments: multi(b.workbench.notes.comments),
            dataNeeded: multi(b.workbench.notes.dataNeeded),
          } : undefined,
        }),
      } : {}),
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
