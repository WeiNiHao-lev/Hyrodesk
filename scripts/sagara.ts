import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams, outletsOf } from "../src/lib/engine/units";
import { checkCompliance } from "../src/lib/engine/diagnostics";

/**
 * WTP Sagara — 50 L/s reservoir water for the SIER industrial estate.
 *
 * The design under test is the split-stream one: everything goes through
 * conventional treatment, and only about a quarter of it is taken up to RO and
 * blended back. The interesting structural feature is the filtered-water tank,
 * which has two draw-off lines — a bypass and an RO feed — and that is what the
 * tank block was given configurable outlets for.
 *
 * Reference figures come from the design conversation (Lampiran C), and the
 * comparison at the end is the point: where the model disagrees with the hand
 * calculation, one of the two is wrong and it is worth knowing which.
 */

const H = 24;
const Q_PRODUCT = 180;   // m3/h to SIER
const Q_RAW = 205;       // m3/h from the reservoir

interface Spec { type: string; label: string; params?: Params; x: number; y: number }

function build(specs: Spec[], links: [number, string, number][], feed: FeedSpec, basis: Partial<DesignBasis>): Flowsheet {
  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: sp.x, y: sp.y },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, handle, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: handle, target: nodes[b].id, targetHandle: "in",
  }));
  return { nodes, edges, feed, basis: basis as DesignBasis };
}

/**
 * Reservoir water per assumption register A1–A3. TDS 365 is the given; the ion
 * split is A1 and is an assumption, so the ionic balance below is a property of
 * that assumption rather than of any measurement.
 */
const feed: FeedSpec = {
  name: "Waduk — air baku (A1–A3)",
  flow: Q_RAW, T: 30, pH: 8.5,
  sourceType: "river",
  c: {
    TDS: 365, TSS: 20, TOC: 5,
    Ca: 55, Mg: 15, Na: 42, K: 6,
    HCO3: 158, SO4: 45, Cl: 40, NO3: 3,
    SiO2: 12, Fe: 0.3, Mn: 0.15,
    BOD: 3, COD: 15,
  },
  turbidityNTU: 15,
  alkalinityAsCaCO3: 130,
};

/** Dry-season peak, assumption A5. This is what sizes the RO. */
const feedDry: FeedSpec = {
  ...feed, name: "Waduk — puncak kemarau (A5)",
  c: { ...feed.c, TDS: 450, HCO3: 190, Cl: 55, SO4: 58, Ca: 68, Na: 52 },
};

/**
 * Fraction of the filtered water sent to RO. The whole design turns on this
 * number, so it is a parameter of the run rather than a constant.
 */
function makeTrain(roSharePct: number, rejScale = 1): Flowsheet {
  const specs: Spec[] = [
    { type: "feedsource", label: "Waduk", x: 0, y: 200 },
    { type: "intake", label: "Intake & Screen", params: { headM: 30, pumpEff: 0.75, screenRemovalTSS: 3, electrochlorination: false, cl2Dose: 1.5 }, x: 140, y: 200 },
    { type: "phadjust", label: "Koreksi pH 8,5 → 6,9", params: { targetPH: 6.9, reagentDown: "h2so4", codCoPrecipPct: 0, hrtMin: 5 }, x: 280, y: 200 },
    { type: "coagfloc", label: "Rapid Mix + Flokulasi", params: { coagDose: 25, polymerDose: 0.3, targetPH: 6.9, mixTimeMin: 1, flocTimeMin: 18 }, x: 420, y: 200 },
    { type: "daf", label: "DAF 2 unit", params: { loading: 10, recyclePct: 10, tssRemoval: 92, oilRemoval: 90, floatFlowPct: 1.0, codRemoval: 40 }, x: 560, y: 200 },
    { type: "mmf", label: "Filter Dual-Media", params: { rate: 10, backwashPct: 3.5, tssRemoval: 88 }, x: 700, y: 200 },
    // The structural feature this run exists to exercise: one vessel, two lines.
    { type: "rawtank", label: "Tangki Air Tersaring", params: { hrtH: 1, outletCount: 2, split2: roSharePct, lossPct: 0 }, x: 840, y: 200 },
    { type: "cartridge", label: "Cartridge 5 µm", params: { micron: 5 }, x: 980, y: 320 },
    { type: "ro", label: "RO Air Payau 3 train", params: { recovery: 75, flux: 18, trains: 3, antiscalantDose: 3, smbsDose: 5, rejectionScale: rejScale }, x: 1120, y: 320 },
    { type: "producttank", label: "Tangki Produk + Blending", params: { hrtH: 4, outletCount: 1 }, x: 1280, y: 200 },
    { type: "phadjust", label: "Trim pH Produk (NaOH)", params: { targetPH: 7.6, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5 }, x: 1420, y: 200 },
    { type: "pump", label: "Pompa Distribusi ke SIER", params: { headM: 45, pumpEff: 0.75, standby: 1 }, x: 1560, y: 200 },
    { type: "outfall", label: "Produk ke SIER", x: 1700, y: 200 },
    { type: "thickener", label: "Pengental Lumpur", params: { supernatantPct: 50 }, x: 700, y: 470 },
    { type: "dewatering", label: "Screw Press", params: { cakeDryness: 18, polymerDose: 4 }, x: 840, y: 470 },
    { type: "waste", label: "Cake ke TPA", params: { name: "sludge" }, x: 980, y: 470 },
    { type: "waste", label: "Efluen ke Badan Air", params: { name: "reject" }, x: 1120, y: 560 },
    // indices: 11 = pH trim, 12 = distribution pump, 13 = thickener,
    // 14 = press, 15 = cake, 16 = effluent
  ];
  const links: [number, string, number][] = [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5], [5, "out", 6],
    // out1 is the bypass to blending; out2 is the RO feed.
    [6, "out1", 9],
    [6, "out2", 7], [7, "out", 8],
    [8, "permeate", 9],
    [9, "out", 10], [10, "out", 11], [11, "out", 12],
    // solids and effluent
    [4, "float", 13], [5, "backwash", 13],
    [13, "thickened", 14], [13, "supernatant", 16],
    [14, "cake", 15], [14, "filtrate", 16],
    [8, "concentrate", 16],
  ];
  return build(specs, links, feed, { standard: "permenkes", productSpecKey: "process", designMode: "feed-driven" });
}

const round = (v: number, dp = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : 0);

function runCase(name: string, fs: Flowsheet, over?: FeedSpec) {
  if (over) fs = { ...fs, feed: over };
  const r = simulate(fs);
  const s = r.summary;
  const product = r.productStreams[0]?.stream;
  const tank = r.nodes.find((x) => x.label === "Tangki Air Tersaring")!;
  const ro = r.nodes.find((x) => x.type === "ro")!;

  return {
    name,
    converged: r.converged,
    waterClosure_pct: round(s.waterBalance[0]?.errorPct ?? 0, 4),
    raw_m3h: round(s.feedFlow, 2),
    product_m3h: round(s.productFlow, 2),
    waste_m3h: round(s.wasteFlow, 2),
    recovery_pct: round(s.recoveryPct, 2),
    // The split the tank actually delivered.
    tankOutlets: Object.fromEntries(
      Object.entries(tank.outlets).map(([k, v]) => [k, round(v.flow, 2)]),
    ),
    roFeed_m3h: round(ro.inlet.flow, 2),
    roPermeate_m3h: round(ro.outlets.permeate.flow, 2),
    roPermeate_TDS: round(ro.outlets.permeate.c.TDS, 1),
    roConcentrate_m3h: round(ro.outlets.concentrate.flow, 2),
    roConcentrate_TDS: round(ro.outlets.concentrate.c.TDS, 0),
    product_TDS: round(product?.c.TDS ?? 0, 1),
    product_turbidity: round(product?.extras.turbidityNTU ?? 0, 3),
    product_pH: round(product?.pH ?? 0, 2),
    power_kW: round(s.totalPowerKW, 1),
    sec_kWh_m3: round(s.secKWhPerM3, 3),
    chemicals: s.chemicals.map((c) => ({ name: c.name, kg_h: round(c.kgPerH, 3) })),
    drySolids_t_d: round(s.drySolidsKgH * H / 1000, 3),
    capex_USD: Math.round(s.capexUSD),
    compliance: product ? checkCompliance(product, "permenkes").map((c) => ({
      p: c.label, limit: c.limitText, actual: c.actualText, pass: c.pass, scope: c.outsideScope ?? false,
    })) : [],
    warnings: s.warnings,
    stages: r.nodes.filter((x) => !["waste"].includes(x.type)).map((x) => ({
      stage: x.label, in_m3h: round(x.inlet.flow, 2),
      TDS: round(x.inlet.c.TDS, 1), TSS: round(x.inlet.c.TSS, 2),
      NTU: round(x.inlet.extras.turbidityNTU, 3), pH: round(x.inlet.pH, 2),
    })),
  };
}

/* --- design point, and the dry-season case that decides the train count --- */
const base = makeTrain(32.7);
const design = runCase("Titik desain — 32,7 % ke RO", base);
const dry = runCase("Puncak kemarau, TDS 450 — bagian RO sama", base, feedDry);

/**
 * What share of filtered water has to go to RO for the blend to hit a target?
 * Solved by scanning rather than algebra, so the answer comes out of the same
 * model as everything else.
 */
function shareFor(target: number, f: FeedSpec, rejScale = 1): { share: number; tds: number } {
  let best = { share: 0, tds: Number.POSITIVE_INFINITY };
  for (let s = 5; s <= 75; s += 0.1) {
    const r = simulate({ ...makeTrain(s, rejScale), feed: f });
    const tds = r.productStreams[0]?.stream.c.TDS ?? 1e9;
    best = { share: round(s, 1), tds: round(tds, 1) };
    if (tds <= target) break;
  }
  return best;
}

/**
 * The memo assumes the membrane rejects 98.5 % of TDS; the model's brackish
 * default is 97.5 %. One point of rejection sounds like nothing and decides the
 * number of RO trains, so it gets scanned rather than argued about.
 *
 * rejectionScale multiplies the whole matrix, so 0.985/0.975 lifts TDS
 * rejection to the memo's figure.
 */
const SCALE_985 = 0.985 / 0.975;
const rejectionStudy = [
  { label: "Model default — rejeksi TDS 97,5 %", scale: 1 },
  { label: "Asumsi memo — rejeksi TDS 98,5 %", scale: SCALE_985 },
].map((c) => {
  const atDesign = simulate({ ...makeTrain(32.7, c.scale), feed });
  const perm = atDesign.nodes.find((x) => x.type === "ro")!.outlets.permeate;
  return {
    ...c,
    permeate_TDS: round(perm.c.TDS, 1),
    product_TDS_at_32_7pct: round(atDesign.productStreams[0]?.stream.c.TDS ?? 0, 1),
    shareNormal: shareFor(300, feed, c.scale),
    shareDry: shareFor(300, feedDry, c.scale),
  };
});

const out = {
  generated: new Date().toISOString(),
  project: {
    name: "WTP Sagara — 50 L/s ke Kawasan Industri SIER, Surabaya",
    productTarget_m3h: Q_PRODUCT, rawDesign_m3h: Q_RAW,
    land_m2: 2000,
    spec: { TDS_max: 300, turbidity_max_NTU: 1 },
  },
  // The feature added for this run.
  tankOutletsConfigured: outletsOf("rawtank", { outletCount: 2 }),
  design, dry,
  minShareNormal: shareFor(300, feed),
  minShareDry: shareFor(300, feedDry),
  rejectionStudy,
  // Three trains at the memo's sizing cap the RO share at 40 % of product.
  threeTrainCeilingPct: 40,
  reference: {
    source: "Percakapan desain, Lampiran C (tabel aliran S-01 … S-13)",
    raw_m3h: 205.0, filtered_m3h: 196.0, bypass_m3h: 132.0, roFeed_m3h: 64.0,
    permeate_m3h: 48.0, permeate_TDS: 12, concentrate_m3h: 16.0, concentrate_TDS: 1464,
    product_m3h: 180.0, product_TDS: 278, recovery_pct: 87.8, sec_kWh_m3: 0.545,
    roSharePct_ofProduct: 26.7,
  },
};

writeFileSync("scripts/out/sagara.json", JSON.stringify(out, null, 2));
console.log("Wrote scripts/out/sagara.json\n");

for (const c of [design, dry]) {
  console.log(`=== ${c.name} ===`);
  console.log(`  converged ${c.converged}  closure ${c.waterClosure_pct} %`);
  console.log(`  tank outlets: ${JSON.stringify(c.tankOutlets)}`);
  console.log(`  raw ${c.raw_m3h} -> product ${c.product_m3h} m3/h  (recovery ${c.recovery_pct} %)`);
  console.log(`  RO: feed ${c.roFeed_m3h}  permeate ${c.roPermeate_m3h} @ TDS ${c.roPermeate_TDS}  conc ${c.roConcentrate_m3h} @ ${c.roConcentrate_TDS}`);
  console.log(`  product: TDS ${c.product_TDS}  turbidity ${c.product_turbidity} NTU  pH ${c.product_pH}`);
  console.log(`  power ${c.power_kW} kW   SEC ${c.sec_kWh_m3} kWh/m3\n`);
}
for (const r of rejectionStudy) {
  console.log(`${r.label}`);
  console.log(`   permeate TDS ${r.permeate_TDS}   product at 32.7 % = ${r.product_TDS_at_32_7pct}`);
  console.log(`   share needed for 300: normal ${r.shareNormal.share} %   dry ${r.shareDry.share} %`);
}
