import { NextResponse } from "next/server";
import { TEMPLATES } from "@/lib/engine/templates";
import { simulate } from "@/lib/engine/solver";
import { optimise, reliabilityScore, DEFAULT_GOALS } from "@/lib/engine/optimizer";

/**
 * Self-test endpoint. Runs every built-in template through the solver and
 * reports whether the balances close. Useful for a quick regression check
 * after touching the engine: GET /api/selftest
 */
export async function GET() {
  const out = TEMPLATES.filter((t) => t.key !== "blank").map((t) => {
    const fs = t.make();
    const r = simulate(fs);
    const s = r.summary;
    const opt = optimise(fs, DEFAULT_GOALS);
    return {
      template: t.key,
      name: t.name,
      converged: r.converged,
      iterations: r.iterations,
      residual: Number(r.residual.toExponential(2)),
      nodes: fs.nodes.length,
      edges: fs.edges.length,
      feed_m3h: round(s.feedFlow),
      product_m3h: round(s.productFlow),
      waste_m3h: round(s.wasteFlow),
      recovery_pct: round(s.recoveryPct),
      waterClosure_pct: round(s.waterBalance[0]?.errorPct ?? 0, 4),
      saltClosure: s.saltBalance.map((b) => ({
        c: b.label, in: round(b.inKgH, 3), out: round(b.outKgH, 3), err_pct: round(b.errorPct, 3),
      })),
      power_kW: round(s.totalPowerKW),
      sec_kWh_m3: round(s.secKWhPerM3, 4),
      chemicals: s.chemicals.map((c) => ({ name: c.name, kg_h: round(c.kgPerH, 4) })),
      drySolids_kg_h: round(s.drySolidsKgH, 3),
      capex_USD: Math.round(s.capexUSD),
      opex_USD_m3: round(s.opexUSDPerM3, 4),
      reliability: round(reliabilityScore(fs, r), 1),
      warnings: s.warnings,
      optimiser: {
        changes: opt.report.changes.length,
        recovery_before: round(opt.report.before.recoveryPct),
        recovery_after: round(opt.report.after.recoveryPct),
        reliability_after: round(opt.report.reliabilityScore, 1),
        notes: opt.report.notes,
      },
    };
  });

  const allClosed = out.every((o) => Math.abs(o.waterClosure_pct) < 0.5);
  const allConverged = out.every((o) => o.converged);

  return NextResponse.json(
    { ok: allClosed && allConverged, allConverged, allClosed, results: out },
    { headers: { "cache-control": "no-store" } },
  );
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
