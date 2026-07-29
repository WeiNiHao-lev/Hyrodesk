import { NextResponse } from "next/server";
import { FEED_PRESETS, TEMPLATES } from "@/lib/engine/templates";
import { simulate } from "@/lib/engine/solver";
import { optimise, reliabilityScore, DEFAULT_GOALS } from "@/lib/engine/optimizer";
import { adviseProcess, validateFeed } from "@/lib/engine/diagnostics";
import { FeedSpec } from "@/lib/engine/types";

/**
 * The raw water analysis from the South Sumatra methanol project, entered
 * exactly as the laboratory reported it. It contains three known defects, so it
 * makes a good regression fixture: the validator must find all three.
 */
const KNOWN_BAD_FEED: FeedSpec = {
  name: "South Sumatra river (2007 lab sheet, as reported)",
  flow: 215, T: 28, pH: 6.5,
  c: {
    Ca: 48.04, Mg: 11.07, NH4: 0.011, Fe: 0.014,
    HCO3: 22.7, CO3: 24.9, SO4: 5.8, NO3: 3.2,
    TDS: 12.1, TSS: 18.9, SiO2: 0.022, BOD: 3.1, COD: 7.3,
  },
  turbidityNTU: 0, coliform: 400, conductivityUScm: 169,
};

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

  /* --- diagnostics regression against a fixture with known defects --- */
  const findings = validateFeed(KNOWN_BAD_FEED);
  const titles = findings.map((f) => f.title);
  const mustCatch = [
    "Ionic balance error outside tolerance",
    "Chloride not analysed",
    "Entered TDS contradicts the sum of ions",
    "Carbonate reported below pH 8.3",
    "Silica implausibly low",
  ];
  const caught = mustCatch.filter((t) => titles.includes(t));
  const diagnosticsOk = caught.length === mustCatch.length;

  const advice = adviseProcess(FEED_PRESETS[1].spec, "demin");

  return NextResponse.json(
    {
      ok: allClosed && allConverged && diagnosticsOk,
      allConverged, allClosed, diagnosticsOk,
      diagnostics: {
        fixture: KNOWN_BAD_FEED.name,
        expected: mustCatch,
        caught,
        missed: mustCatch.filter((t) => !titles.includes(t)),
        bySeverity: findings.reduce<Record<string, number>>((a, f) => {
          a[f.severity] = (a[f.severity] ?? 0) + 1;
          return a;
        }, {}),
        allFindings: findings.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail })),
      },
      advisor: {
        target: advice.target,
        steps: advice.train.map((t) => t.step),
        cautions: advice.cautions,
      },
      results: out,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
