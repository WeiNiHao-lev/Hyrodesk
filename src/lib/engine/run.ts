/**
 * One simulation as HydroDesk answers it: solve the flowsheet (backwards from
 * the product target when it is product-driven), check the product against
 * the standards asked for and the discharges against a discharge standard,
 * price it, and optionally build the workbench page.
 *
 * The server's /api/simulate calls this, and so does the engine bundle that
 * Claude Code downloads to simulate on its own machine (scripts/build-engine.mjs).
 * Same code both ways, so a run computed on a laptop is the run the server
 * would have computed. Nothing here touches the network, the database or the
 * browser.
 */
import { Flowsheet } from "./types";
import { simulate, simulateForProduct } from "./solver";
import { checkCompliance, checkedRows } from "./diagnostics";
import { indicativeCapex } from "./capex";
import { swroBenchmark } from "./benchmarks";
import { UNIT_BY_TYPE } from "./units";
import {
  buildWorkbenchPage, Multi, ProjectStage, suggestDataNeeded, Verdict, WbLang,
} from "../report/workbench";

export interface RunRequest {
  flowsheet?: Flowsheet;
  check?: string[];
  dischargeCheck?: string;
  workbench?: {
    title?: string; note?: string; stage?: string; verdict?: string; autoGaps?: boolean;
    notes?: { source?: string; comments?: unknown; dataNeeded?: unknown };
  };
}

/** A request that cannot be simulated; `message` says why. */
export class RunError extends Error {}

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

export function runSimulation(b: RunRequest) {
  const fs = b.flowsheet;
  if (!fs || !Array.isArray(fs.nodes) || !Array.isArray(fs.edges) || !fs.feed || !fs.basis) {
    throw new RunError("Body must be { flowsheet: { nodes, edges, feed, basis } }.");
  }
  const unknown = fs.nodes.filter((n) => !UNIT_BY_TYPE[n.type]).map((n) => `${n.label} (${n.type})`);
  if (unknown.length) throw new RunError(`Unknown unit type: ${unknown.join(", ")}. See the catalog.`);
  const ids = new Set(fs.nodes.map((n) => n.id));
  const dangling = fs.edges.filter((e) => !ids.has(e.source) || !ids.has(e.target)).map((e) => e.id);
  if (dangling.length) throw new RunError(`Edges point at nodes that do not exist: ${dangling.join(", ")}.`);

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

  const wb = b.workbench;
  return {
    converged,
    flowsheet: fs,
    result,
    compliance,
    discharge,
    capex: indicativeCapex(fs, result),
    // CCEPC's SWRO reference figures, when the flowsheet has an SWRO block.
    benchmark: swroBenchmark(fs, result),
    ...(wb ? {
      workbenchHtml: buildWorkbenchPage(fs, result, {
        title: String(wb.title || "HydroDesk run").slice(0, 160),
        note: wb.note ? String(wb.note).slice(0, 4000) : undefined,
        stage: STAGES.includes(String(wb.stage)) ? (wb.stage as ProjectStage) : undefined,
        verdict: VERDICTS.includes(String(wb.verdict)) ? (wb.verdict as Verdict) : undefined,
        gaps: wb.autoGaps === false ? [] : suggestDataNeeded(fs, result, null),
        notes: wb.notes ? {
          source: (LANGS.includes(String(wb.notes.source)) ? wb.notes.source : "en") as WbLang,
          comments: multi(wb.notes.comments),
          dataNeeded: multi(wb.notes.dataNeeded),
        } : undefined,
      }),
    } : {}),
  };
}
