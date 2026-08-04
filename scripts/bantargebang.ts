import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { osmoticPressureBar } from "../src/lib/engine/stream";
import { traceBalance, inhibitionFindings } from "../src/lib/engine/compliance";
import { validateFeed } from "../src/lib/engine/diagnostics";

/**
 * Bantargebang IPAS 2 — leachate at 1200 m3/d on a 2 ha site.
 *
 * Runs the same engine the application uses, so the report and the app cannot
 * disagree. Two cases:
 *
 *   A  the laboratory sheet exactly as written, to show what it implies
 *   B  a defensible design basis, with every substitution named
 *
 * Output: scripts/out/bantargebang.json
 */

const DAY = 24;                    // hours
const Q_DAY = 1200;                // m3/d
const Q_HOUR = Q_DAY / DAY;        // 50 m3/h

interface Spec { type: string; label: string; params?: Params; x: number; y: number }

function build(specs: Spec[], links: [number, string, number][], feed: FeedSpec, basis: Partial<DesignBasis>): Flowsheet {
  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`,
    type: sp.type,
    label: sp.label,
    position: { x: sp.x, y: sp.y },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, handle, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: handle, target: nodes[b].id, targetHandle: "in",
  }));
  return { nodes, edges, feed, basis: basis as DesignBasis };
}

/* ------------------------------------------------------ the laboratory sheet */

/**
 * "Karakter lindi dan wet scrubber.xlsx", sheet `leachate`, entered exactly as
 * written including the values that cannot be right. Sources are five different
 * papers between 1993 and 2022, which is itself the first finding.
 */
const NH3_N_AS_REPORTED = 2200;
const asReported: FeedSpec = {
  name: "Landfill leachate — literature composite, as tabulated",
  flow: Q_HOUR, T: 30, pH: 7.4,
  c: {
    TDS: 280000,
    TSS: 1000,
    Fe: 4.134, Mn: 5.05, Ba: 0.86, F: 9.35,
    NO3: 23,
    // "Klorin bebas, Cl2 130.000 mg/L" read as chloride, which is the only
    // reading under which the figure is even dimensionally possible.
    Cl: 130000,
    NH4: NH3_N_AS_REPORTED * (18.039 / 14.007),
    BOD: 11000, COD: 35000, Oil: 6.1,
    TN: NH3_N_AS_REPORTED,
  },
  trace: {
    Zn: 0.475, Cr: 0.902, Cd: 0.43, Hg: 0.0008, Pb: 3.363, As: 13.8,
    Se: 0.03, Ni: 4.254, Co: 1.172, CN: 6.1, S2: 28.5, Phenol: 22.4,
    // Reported in µg/L in the sheet, converted here.
    Cu: 0.00027,
  },
};

/* --------------------------------------------------------- the design basis */

/**
 * Case B keeps the organic and nitrogen load from the sheet, because those are
 * what the plant is for, and replaces the salinity with a figure a leachate can
 * actually have. Every change is listed in `substitutions` and appears in the
 * report; nothing is quietly corrected.
 */
const designBasis: FeedSpec = {
  ...asReported,
  name: "Landfill leachate — design basis (salinity substituted, see assumptions)",
  c: {
    ...asReported.c,
    TDS: 20000,
    Cl: 6000,
    Na: 4200, K: 1500, Ca: 400, Mg: 250,
    SO4: 800, HCO3: 6500,
    TOC: 11000,
    TP: 25,
  },
};

const substitutions = [
  {
    parameter: "TDS",
    reported: "280 000 mg/L",
    used: "20 000 mg/L",
    why: "At 280 000 mg/L the osmotic pressure is about 218 bar, which is above the pressure rating of every leachate membrane made. The plant the sheet describes cannot be built by any membrane route. 20 000 mg/L is the middle of the published range for mature landfill leachate.",
  },
  {
    parameter: "Chloride",
    reported: "130 000 mg/L, labelled free chlorine (Cl2)",
    used: "6 000 mg/L",
    why: "Free chlorine cannot coexist with 35 000 mg/L of COD — it would be consumed in seconds. The figure is a mislabelled chloride, and even as chloride it is nearly seven times seawater.",
  },
  {
    parameter: "Na, K, Ca, Mg, SO4, HCO3",
    reported: "not analysed",
    used: "assumed, balanced against the chloride",
    why: "None of the major cations appear in the sheet, so no ionic balance can be computed from it. The set used here is typical of mature leachate and is internally neutral; it is an assumption, not a measurement.",
  },
  {
    parameter: "Total nitrogen",
    reported: "not analysed; free ammonia 2 200 mg/L",
    used: "TN = 2 200 mg/L as N",
    why: "The sheet gives ammonia but no total nitrogen, so organic nitrogen is unknown. Taking TN equal to the ammonia is the optimistic case: any organic nitrogen present is not strippable and would raise the final effluent nitrogen.",
  },
];

/* --------------------------------------------------------------- the train */

function makeTrain(feed: FeedSpec, opts: { withMVR: boolean }): Flowsheet {
  const specs: Spec[] = [
    { type: "feedsource", label: "Raw Leachate", x: 0, y: 200 },
    { type: "intake", label: "Intake & Screen", params: { headM: 12, screenRemovalTSS: 3 }, x: 150, y: 200 },
    { type: "eqtank", label: "Equalisation", params: { hrtH: 12 }, x: 300, y: 200 },
    { type: "coagfloc", label: "Coagulation", params: { coagDose: 250, polymerDose: 3, targetPH: 7 }, x: 450, y: 200 },
    { type: "clarifier", label: "Lamella Clarifier", params: { riseRate: 4, tssRemoval: 88, sludgeFlowPct: 3, codRemoval: 25 }, x: 600, y: 200 },
    { type: "anaerobic", label: "UASB", params: { olr: 8, codRemoval: 78, bodRemoval: 92, hrtH: 24 }, x: 750, y: 200 },
    { type: "phadjust", label: "Alkali Dosing pH 11", params: { targetPH: 11, reagentUp: "lime" }, x: 900, y: 200 },
    { type: "nh3strip", label: "Ammonia Stripping", params: { airRatio: 3000, acidScrubber: true }, x: 1050, y: 200 },
    { type: "phadjust", label: "Neutralisation pH 7", params: { targetPH: 7, codCoPrecipPct: 0 }, x: 1200, y: 200 },
    { type: "mbr", label: "MBR", params: { hrtH: 20, mlss: 10000, flux: 12, codRemoval: 65, bodRemoval: 97, tnRemoval: 45, nh4Removal: 92 }, x: 1350, y: 200 },
    { type: "dtro", label: "DTRO 2-stage", params: { recovery: 85, stages: 2, flux: 18 }, x: 1500, y: 200 },
    { type: "aop", label: "Catalytic AOP", params: { codRemoval: 60, bodIncrease: 10 }, x: 1650, y: 200 },
    { type: "phadjust", label: "Final pH Trim", params: { targetPH: 7, codCoPrecipPct: 0 }, x: 1800, y: 200 },
    { type: "outfall", label: "Outfall to SPARING", x: 1950, y: 200 },
    { type: "thickener", label: "Sludge Thickener", x: 700, y: 450 },
    { type: "dewatering", label: "Filter Press", x: 850, y: 450 },
    { type: "waste", label: "Cake to Landfill", params: { name: "sludge" }, x: 1000, y: 450 },
    { type: "waste", label: "Thickener Supernatant", params: { name: "loss" }, x: 850, y: 570 },
  ];
  const links: [number, string, number][] = [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4],
    [4, "out", 5], [5, "out", 6], [6, "out", 7], [7, "out", 8],
    [8, "out", 9], [9, "out", 10], [10, "permeate", 11], [11, "out", 12], [12, "out", 13],
    // solids
    [4, "sludge", 14], [5, "was", 14], [9, "was", 14],
    [14, "thickened", 15], [14, "supernatant", 17],
    [15, "cake", 16], [15, "filtrate", 17],
  ];

  if (opts.withMVR) {
    specs.push(
      { type: "mvr", label: "MVR Evaporator", params: { waterEvapPct: 82 }, x: 1650, y: 380 },
      { type: "crystalliser", label: "Crystalliser", x: 1800, y: 380 },
      { type: "outfall", label: "Distillate Reuse", x: 1950, y: 340 },
      { type: "waste", label: "Salt to Disposal", params: { name: "sludge" }, x: 1950, y: 430 },
    );
    const m = specs.length - 4, cr = m + 1, dist = m + 2, salt = m + 3;
    links.push([10, "concentrate", m], [m, "distillate", dist], [m, "concentrate", cr],
      [cr, "salt", salt], [cr, "mother", salt]);
  } else {
    specs.push({ type: "waste", label: "DTRO Concentrate", params: { name: "reject" }, x: 1650, y: 380 });
    links.push([10, "concentrate", specs.length - 1]);
  }

  return build(specs, links, feed, {
    standard: "permenlhk", productSpecKey: "reuse", designMode: "feed-driven",
  });
}

/* --------------------------------------------------------------- footprint */

/**
 * Plan area per unit, from the volume or area the model sized, divided by a
 * working depth and multiplied by a spacing allowance for walkways, pipe runs
 * and access. Deliberately crude: the point is to answer "does it fit", not to
 * replace a layout drawing.
 */
const DEPTH: Record<string, number> = {
  eqtank: 5, coagfloc: 4, clarifier: 4.5, anaerobic: 6, phadjust: 4,
  mbr: 5, thickener: 4, rawtank: 5, producttank: 5, baf: 4,
};
const FIXED_AREA: Record<string, number> = {
  intake: 40, "intake-plain": 30, feedsource: 0, outfall: 6, waste: 0,
  dewatering: 90, mvr: 120, crystalliser: 90, dtro: 110, aop: 70,
  nh3strip: 0, cartridge: 12, uf: 60, electroox: 40, oilsep: 0,
};
const SPACING = 1.45; // walkways, pipework, access, drainage

function footprint(type: string, sizing: { label: string; value: string }[]): number {
  const num = (re: RegExp) => {
    for (const s of sizing) {
      if (!re.test(s.label)) continue;
      const m = /-?\d[\d.]*/.exec(s.value);
      if (m) return Number(m[0]);
    }
    return null;
  };
  // Units whose own model already reports an area use it directly.
  const area = num(/tower diameter|footprint|separator area|filter area/i);
  if (type === "nh3strip") {
    const d = num(/tower diameter/i) ?? 5;
    return Math.PI * d * d / 4 * 2 * SPACING; // two towers
  }
  if (area != null && /oilsep|baf/.test(type)) return area * SPACING;

  const vol = num(/volume/i);
  if (vol != null && DEPTH[type]) return (vol / DEPTH[type]) * SPACING;
  if (FIXED_AREA[type] != null) return FIXED_AREA[type] * SPACING;
  return 25 * SPACING;
}

/* ------------------------------------------------------------------- run it */

function runCase(name: string, feed: FeedSpec, withMVR: boolean) {
  const fs = makeTrain(feed, { withMVR });
  const r = simulate(fs);
  const s = r.summary;

  const units = r.nodes
    .filter((n) => !["feedsource", "outfall", "waste", "splitter"].includes(n.type))
    .map((n) => ({
      label: n.label,
      type: n.type,
      inFlow: round(n.inlet.flow, 2),
      power_kW: round(n.aux.powerKW, 2),
      capex_USD: Math.round(n.aux.capexUSD),
      area_m2: round(footprint(n.type, n.aux.sizing), 0),
      sizing: n.aux.sizing,
      notes: n.aux.notes,
    }));

  const processArea = units.reduce((a, u) => a + u.area_m2, 0);

  const stages = r.nodes
    .filter((n) => !["waste", "thickener", "dewatering"].includes(n.type))
    .map((n) => ({
      stage: n.label,
      flow_m3d: round(n.inlet.flow * DAY, 1),
      COD: round(n.inlet.c.COD, 1),
      BOD: round(n.inlet.c.BOD, 1),
      TN: round(n.inlet.c.TN, 1),
      NH4_N: round(n.inlet.c.NH4 * (14.007 / 18.039), 1),
      TSS: round(n.inlet.c.TSS, 1),
      TDS: round(n.inlet.c.TDS, 0),
      pH: round(n.inlet.pH, 2),
      osmotic_bar: round(osmoticPressureBar(n.inlet), 1),
    }));

  const product = r.productStreams[0]?.stream;
  const compliance = product ? {
    pH: { v: round(product.pH, 2), limit: "6–9", pass: product.pH >= 6 && product.pH <= 9 },
    BOD: { v: round(product.c.BOD, 2), limit: 150, pass: product.c.BOD <= 150 },
    COD: { v: round(product.c.COD, 2), limit: 300, pass: product.c.COD <= 300 },
    TSS: { v: round(product.c.TSS, 2), limit: 100, pass: product.c.TSS <= 100 },
    TN: { v: round(product.c.TN, 2), limit: 60, pass: product.c.TN <= 60 },
  } : null;

  return {
    name, withMVR,
    feedName: feed.name,
    feedFlow_m3d: round(s.feedFlow * DAY, 1),
    productFlow_m3d: round(s.productFlow * DAY, 1),
    wasteFlow_m3d: round(s.wasteFlow * DAY, 1),
    recovery_pct: round(s.recoveryPct, 2),
    totalPower_kW: round(s.totalPowerKW, 1),
    energy_kWh_d: round(s.totalPowerKW * DAY, 0),
    sec_kWh_m3: round(s.secKWhPerM3, 2),
    capex_USD: Math.round(s.capexUSD),
    opex_USD_m3: round(s.opexUSDPerM3, 3),
    drySolids_t_d: round(s.drySolidsKgH * DAY / 1000, 2),
    chemicals_t_d: s.chemicals.map((c) => ({ name: c.name, t_d: round(c.kgPerH * DAY / 1000, 3) })),
    processArea_m2: Math.round(processArea),
    waterClosure_pct: round(s.waterBalance[0]?.errorPct ?? 0, 4),
    converged: r.converged,
    compliance,
    stages,
    units,
    warnings: s.warnings,
    trace: traceBalance(fs, "permenlhk"),
    inhibitions: inhibitionFindings(fs),
  };
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

const out = {
  generated: new Date().toISOString(),
  site: { landAvailable_m2: 20000, capacity_m3d: Q_DAY, capacity_m3h: Q_HOUR },
  benchmark: {
    name: "IPAL Krukut, Setia Budi, South Jakarta",
    capacity_m3d: 8600,
    land_m2: 1200,
    intensity_m2_per_m3d: round(1200 / 8600, 3),
    technology: "MBBR, multi-storey",
    note: "First multi-storey IPAL in Indonesia; operating since August 2021; rooftop cafe and an education space above the process.",
  },
  dataDefects: validateFeed(asReported).map((f) => ({ severity: f.severity, title: f.title, detail: f.detail })),
  substitutions,
  caseA: runCase("Case A — laboratory sheet as written", asReported, false),
  caseB: runCase("Case B — design basis, concentrate to disposal", designBasis, false),
  caseC: runCase("Case C — design basis with MVR/crystalliser (ZLD)", designBasis, true),
  // The land question does not bite at 1200 m3/d. It bites at the 2028 target,
  // so the footprint is computed there rather than extrapolated.
  caseD: runCase("Case D — 2028 target, 7000 m3/d on the same site",
    { ...designBasis, flow: 7000 / DAY, name: designBasis.name + " at 7000 m3/d" }, true),
  // Capping the waste surface is reported to cut leachate generation by about
  // 70 %. It is the only intervention that addresses the flow, the slope and
  // the land at the same time, so it gets its own case rather than a footnote.
  caseE: runCase("Case E — 2028 target after capping, 2100 m3/d",
    { ...designBasis, flow: 2100 / DAY, name: designBasis.name + " at 2100 m3/d (post-capping)" }, true),
};

writeFileSync("scripts/out/bantargebang.json", JSON.stringify(out, null, 2));
console.log("Wrote scripts/out/bantargebang.json");
for (const c of [out.caseA, out.caseB, out.caseC, out.caseD, out.caseE]) {
  console.log(`\n=== ${c.name} ===`);
  console.log(`  converged ${c.converged}  closure ${c.waterClosure_pct} %`);
  console.log(`  feed ${c.feedFlow_m3d} -> product ${c.productFlow_m3d} m3/d  (recovery ${c.recovery_pct} %)`);
  console.log(`  power ${c.totalPower_kW} kW = ${c.energy_kWh_d} kWh/d   SEC ${c.sec_kWh_m3} kWh/m3`);
  console.log(`  process area ${c.processArea_m2} m2 of 20000 (${round(c.processArea_m2 / 200, 1)} % of the site)`);
  if (c.compliance) {
    console.log("  compliance: " + Object.entries(c.compliance)
      .map(([k, v]) => `${k}=${v.v}${v.pass ? "" : " FAIL"}`).join("  "));
  }
}
