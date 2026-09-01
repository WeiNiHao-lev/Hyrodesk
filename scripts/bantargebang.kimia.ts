import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { checkCompliance } from "../src/lib/engine/diagnostics";

/**
 * Bantargebang — how far chemistry alone can go, on the corrected analysis.
 *
 * Three figures were revised: total nitrogen 5,400 mg/L, TDS 28,000, and a
 * "free chlorine" of 13,000 which cannot be free chlorine and is read here as
 * chloride, for the same reason the chloride in PAC is not a disinfectant.
 *
 * Those three settle the composition without any assumption being needed.
 * Ammonium at 5,000 mg/L as N is 357 meq/L of cation; chloride at 13,000 is
 * 367 meq/L of anion. They balance each other almost exactly, so the salt in
 * this leachate is ammonium chloride and not sodium chloride — and not calcium
 * or magnesium either, because the balance leaves at most a quarter of the
 * cation charge for them.
 *
 * That matters more than it sounds. Sodium cannot be removed by chemistry at
 * any price; ammonium can, because raising the pH turns it into a gas. So the
 * question "can chemistry replace the membrane" has a better answer on this
 * water than it would on a saline one — just not the answer of yes.
 */

const Q = 1200 / 24;

/**
 * Charge-balanced to 0.4 %, which is what fixes the bicarbonate, calcium and
 * magnesium: they are not free choices once TN, TDS and chloride are known.
 */
const feed: FeedSpec = {
  name: "Lindi Bantargebang — analisis terkoreksi",
  flow: Q, T: 30, pH: 8.6, sourceType: "leachate",
  c: {
    TDS: 28000, TSS: 1200,
    NH4: 6439, TN: 5400, NO3: 23,
    Cl: 13000, HCO3: 7000, Ca: 1800, Mg: 400, SO4: 500, K: 900, Na: 300,
    COD: 11000, BOD: 350, TOC: 3500, TP: 25, Oil: 6.1,
    Fe: 4.134, Mn: 5.05,
  },
  trace: { Zn: 0.475, Cr: 0.902, Cd: 0.43, Hg: 0.0008, Pb: 3.363, As: 13.8, Ni: 4.254, CN: 6.1, S2: 28.5, Phenol: 22.4 },
};

const DEPTH: Record<string, number> = {
  eqtank: 5, coagfloc: 4, clarifier: 4.5, anaerobic: 6, phadjust: 4, aop: 4,
  mbr: 5, aombr: 5, mbbr: 5, "coke-ao": 5, thickener: 4, baf: 4, chemsoft: 4.5,
};
const FIXED_AREA: Record<string, number> = {
  intake: 40, feedsource: 0, outfall: 6, waste: 0, dewatering: 90,
  dtro: 110, nf: 90, cartridge: 12, uf: 60, disinfection: 25, daf: 0, nh3strip: 0,
};
const SPACING = 1.45;
function footprint(type: string, sizing: { label: string; value: string }[]): number {
  const num = (re: RegExp) => {
    for (const s of sizing) {
      if (!re.test(s.label)) continue;
      const m = /-?\d[\d.]*/.exec(s.value);
      if (m) return Number(m[0]);
    }
    return null;
  };
  if (type === "nh3strip") { const d = num(/tower diameter/i) ?? 5; return (Math.PI * d * d / 4) * 2 * SPACING; }
  if (type === "daf") return (num(/flotation area/i) ?? 10) * SPACING * 1.6;
  if (type === "clarifier") return (num(/plan area/i) ?? 20) * SPACING;
  const vol = num(/volume/i);
  if (vol != null && DEPTH[type]) return (vol / DEPTH[type]) * SPACING;
  if (FIXED_AREA[type] != null) return FIXED_AREA[type] * SPACING;
  return 25 * SPACING;
}

interface Spec { type: string; label: string; params?: Params }

function assemble(mid: Spec[]): Flowsheet {
  const specs: Spec[] = [
    { type: "feedsource", label: "Raw Leachate" },
    { type: "intake", label: "Bar Screen", params: { headM: 12, pumpEff: 0.7, screenRemovalTSS: 3, cl2Dose: 0 } },
    { type: "eqtank", label: "Ekualisasi", params: { hrtH: 12 } },
    ...mid,
  ];
  // A membrane's product leaves on "permeate", every other block on "out", so
  // the chain has to ask each source what its handle is called. Getting this
  // wrong does not raise an error: the edge simply carries nothing, and the
  // train quietly delivers no product at all.
  const MEMBRANES = new Set(["dtro", "nf", "ro", "swro"]);
  const productHandle = (i: number) => (MEMBRANES.has(specs[i].type) ? "permeate" : "out");
  const links: [number, string, number][] = [];
  for (let i = 0; i < specs.length - 1; i++) links.push([i, productHandle(i), i + 1]);
  const iLast = specs.length - 1;
  const memHandle = productHandle(iLast);

  const iOut = specs.length;   specs.push({ type: "outfall", label: "Efluen" });
  links.push([iLast, memHandle, iOut]);
  const iThk = specs.length;   specs.push({ type: "thickener", label: "Thickener" });
  const iFP = specs.length;    specs.push({ type: "dewatering", label: "Filter Press", params: { cakeDryness: 30 } });
  const iCake = specs.length;  specs.push({ type: "waste", label: "Cake", params: { name: "sludge" } });
  const iRej = specs.length;   specs.push({ type: "waste", label: "Konsentrat", params: { name: "reject" } });
  const iLoss = specs.length;  specs.push({ type: "waste", label: "Supernatan", params: { name: "loss" } });

  let anyReject = false;
  for (let i = 0; i < specs.length; i++) {
    const t = specs[i].type;
    if (t === "daf") links.push([i, "float", iThk]);
    if (t === "clarifier") links.push([i, "sludge", iThk]);
    if (t === "chemsoft") links.push([i, "sludge", iThk]);
    if (t === "anaerobic") links.push([i, "sludge", iThk]);
    if (["mbbr", "coke-ao", "aao"].includes(t)) links.push([i, "was", iThk]);
    if (t === "baf") links.push([i, "backwash", iLoss]);
    if (MEMBRANES.has(t)) { links.push([i, "concentrate", iRej]); anyReject = true; }
  }
  links.push([iThk, "thickened", iFP], [iThk, "supernatant", iLoss],
    [iFP, "cake", iCake], [iFP, "filtrate", iLoss]);
  if (!anyReject) specs[iRej] = { type: "waste", label: "Konsentrat (tidak dipakai)", params: { name: "reject" } };

  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: (i % 9) * 130, y: Math.floor(i / 9) * 180 + 120 },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links
    .filter(([a, , b]) => a !== iRej || anyReject)
    .map(([a, h, b], i) => ({
      id: `e${i}`, source: nodes[a].id, sourceHandle: h, target: nodes[b].id, targetHandle: "in",
    }));
  const kept = anyReject ? nodes : nodes.filter((_, i) => i !== iRej);
  return { nodes: kept, edges, feed, basis: { standard: "permen59", productSpecKey: "process", designMode: "feed-driven" } as DesignBasis };
}

/* ------------------------------------------------------------- the blocks */

/**
 * Lime to pH 11 is four unit operations bought with one reagent: it precipitates
 * calcium as carbonate and magnesium as hydroxide, it drives the heavy metals
 * down as hydroxides, the magnesium floc sweeps some of the humic COD with it,
 * and above all it converts ammonium to free ammonia so a tower can take it out.
 * On this water the fourth job is the one worth paying for.
 */
const LIME = (target: number): Spec => ({ type: "phadjust", label: `Kapur ke pH ${target}`,
  params: { targetPH: target, reagentUp: "lime", excessPct: 15, codCoPrecipPct: target >= 10.5 ? 25 : 12, hrtMin: 45 } });
const SETTLE: Spec = { type: "clarifier", label: "Clarifier lumpur kapur",
  params: { riseRate: 2.5, tssRemoval: 94, sludgeFlowPct: 6, codRemoval: 15, trains: 2 } };
const STRIP = (ratio: number): Spec => ({ type: "nh3strip", label: `Menara stripping (A/W ${ratio})`,
  params: { airRatio: ratio, acidScrubber: true } });
const NEUT = (target: number): Spec => ({ type: "phadjust", label: `Netralisasi ke pH ${target}`,
  params: { targetPH: target, reagentDown: "h2so4", codCoPrecipPct: 0, hrtMin: 10 } });
const COAG: Spec = { type: "coagfloc", label: "Koagulasi-Flokulasi",
  params: { coagDose: 250, polymerDose: 3, targetPH: 7.2, mixTimeMin: 2, flocTimeMin: 20 } };
const DAF: Spec = { type: "daf", label: "DAF",
  params: { loading: 6, recyclePct: 12, tssRemoval: 92, oilRemoval: 92, codRemoval: 35, floatFlowPct: 2.5 } };
const DTRO = (rec: number, stages: number): Spec => ({ type: "dtro", label: `DTRO ${stages} tahap`,
  params: { stages, recovery: rec, flux: 18, antiscalantDose: 8, cipPerYear: 24 } });
const AOP: Spec = { type: "aop", label: "Ozonasi katalitik", params: { method: "o3cat", codRemoval: 70, bodIncrease: 25 } };
const BAF: Spec = { type: "baf", label: "BAF", params: { hrtH: 4, volLoad: 3 } };
const TRIM: Spec = { type: "phadjust", label: "Trim pH",
  params: { targetPH: 7.2, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5 } };

/* -------------------------------------------------------------------- run */

const round = (v: number, dp = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : 0);

function run(name: string, note: string, mid: Spec[]) {
  const r = simulate(assemble(mid));
  const s = r.summary;
  const p = r.productStreams[0]?.stream;
  const units = r.nodes.filter((n) => !["feedsource", "outfall", "waste"].includes(n.type));
  const area = units.reduce((a, u) => a + footprint(u.type, u.aux.sizing), 0);
  const mem = r.nodes.find((n) => ["dtro", "nf"].includes(n.type));
  const comp = p ? checkCompliance(p, "permen59") : [];
  const chem = (re: RegExp) => {
    const c = s.chemicals.filter((x) => re.test(x.name));
    return round(c.reduce((a, x) => a + x.kgPerH, 0) * 24 / 1000, 2);
  };
  return {
    name, note,
    power_kW: round(s.totalPowerKW, 1), sec: round(s.secKWhPerM3, 2),
    capex: Math.round(s.capexUSD), opexPerM3: round(s.opexUSDPerM3, 3),
    product_m3d: round(s.productFlow * 24, 0),
    concentrate_m3d: mem ? round(mem.outlets.concentrate.flow * 24, 0) : 0,
    area_m2: round(area, 0),
    lime_t_d: chem(/lime/i), acid_t_d: chem(/Sulphuric/i), naoh_t_d: chem(/Caustic/i),
    drySolids_t_d: round(s.drySolidsKgH * 24 / 1000, 2),
    effluent: {
      COD: round(p?.c.COD ?? 0, 1), BOD: round(p?.c.BOD ?? 0, 1), TSS: round(p?.c.TSS ?? 0, 1),
      TN: round(p?.c.TN ?? 0, 1), TDS: round(p?.c.TDS ?? 0, 0), pH: round(p?.pH ?? 0, 2),
    },
    fails: comp.filter((c) => !c.pass && !c.outsideScope).map((c) => `${c.label} ${c.actualText} vs ${c.limitText}`),
    units: units.map((u) => ({ label: u.label, kW: round(u.aux.powerKW, 1), capex: Math.round(u.aux.capexUSD), area: round(footprint(u.type, u.aux.sizing), 0) })),
  };
}

const cases = [
  run("A. Kimia-maks pH 11 + stripping + DTRO 1 pass", "kapur mengerjakan empat hal sekaligus",
      [LIME(11), SETTLE, STRIP(3500), NEUT(7.2), COAG, DAF, DTRO(85, 2), TRIM]),
  run("B. Sama, kapur hanya ke pH 10,5", "menguji harga setengah satuan pH terakhir",
      [LIME(10.5), SETTLE, STRIP(3500), NEUT(7.2), COAG, DAF, DTRO(85, 2), TRIM]),
  run("C. Sama, pH 10,0", "amonia bebas 88,9 % — cukup?",
      [LIME(10), SETTLE, STRIP(3500), NEUT(7.2), COAG, DAF, DTRO(85, 2), TRIM]),
  run("D. Kimia-maks TANPA membran (+ AOP + BAF)", "apakah kimia saja bisa?",
      [LIME(11), SETTLE, STRIP(3500), NEUT(7.2), COAG, DAF, AOP, BAF, TRIM]),
  run("E. Tanpa stripping — DTRO 2 pass", "rekomendasi sebelumnya, pada umpan terkoreksi",
      [COAG, DAF, DTRO(85, 2), DTRO(90, 1), TRIM]),
  run("F. Kimia-maks + DTRO, stripping lebih keras", "A/W 5000, sisa N lebih rendah",
      [LIME(11), SETTLE, STRIP(5000), NEUT(7.2), COAG, DAF, DTRO(85, 2), TRIM]),
];

const f = (v: number, dp = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const L: string[] = [];
L.push("BANTARGEBANG — SEBERAPA JAUH KIMIA BISA MENGGANTIKAN MEMBRAN");
L.push("=".repeat(122));
L.push("Umpan terkoreksi: TN 5.400 · TDS 28.000 · klorida 13.000 · COD 11.000 · BOD 350 · pH 8,6");
L.push("BOD:COD = 0,032 — praktis seluruh COD-nya refraktori.");
L.push("");
L.push("OPSI".padEnd(46) + "daya".padStart(7) + "kWh/m3".padStart(8) + "CAPEX".padStart(11) +
  "OPEX/m3".padStart(9) + "produk".padStart(8) + "kapur".padStart(8) + "lumpur".padStart(8) + "lahan".padStart(8));
L.push("-".repeat(122));
for (const c of cases) {
  L.push(c.name.padEnd(46) + f(c.power_kW).padStart(7) + f(c.sec, 2).padStart(8) + f(c.capex).padStart(11) +
    f(c.opexPerM3, 2).padStart(9) + f(c.product_m3d).padStart(8) +
    (c.lime_t_d ? f(c.lime_t_d, 1) : "—").padStart(8) + f(c.drySolids_t_d, 1).padStart(8) + f(c.area_m2).padStart(8));
}
L.push("");
L.push("EFLUEN terhadap Permen LHK P.59/2016");
L.push("-".repeat(122));
L.push("OPSI".padEnd(46) + "COD".padStart(9) + "BOD".padStart(8) + "TSS".padStart(7) + "TN".padStart(8) +
  "TDS".padStart(9) + "pH".padStart(6) + "   hasil");
for (const c of cases) {
  const e = c.effluent;
  L.push(c.name.padEnd(46) + f(e.COD, 1).padStart(9) + f(e.BOD, 1).padStart(8) + f(e.TSS, 1).padStart(7) +
    f(e.TN, 1).padStart(8) + f(e.TDS).padStart(9) + f(e.pH, 2).padStart(6) +
    "   " + (c.fails.length ? c.fails.join("; ") : "LOLOS"));
}
L.push("");
L.push("REAGEN (ton/hari) DAN KONSENTRAT");
L.push("-".repeat(122));
L.push("OPSI".padEnd(46) + "kapur".padStart(8) + "H2SO4".padStart(8) + "NaOH".padStart(8) +
  "lumpur".padStart(9) + "konsentrat m3/hari".padStart(20));
for (const c of cases) {
  L.push(c.name.padEnd(46) + f(c.lime_t_d, 1).padStart(8) + f(c.acid_t_d, 1).padStart(8) +
    f(c.naoh_t_d, 2).padStart(8) + f(c.drySolids_t_d, 1).padStart(9) +
    (c.concentrate_m3d ? f(c.concentrate_m3d) : "tidak ada").padStart(20));
}

const best = cases.find((c) => c.fails.length === 0);
if (best) {
  L.push("");
  L.push("RINCIAN — " + best.name);
  L.push("-".repeat(122));
  L.push("unit".padEnd(38) + "daya kW".padStart(10) + "CAPEX USD".padStart(13) + "lahan m2".padStart(10));
  for (const u of best.units) L.push(u.label.padEnd(38) + f(u.kW, 1).padStart(10) + f(u.capex).padStart(13) + f(u.area).padStart(10));
  L.push("TOTAL".padEnd(38) + f(best.power_kW, 1).padStart(10) + f(best.capex).padStart(13) + f(best.area_m2).padStart(10));
}

const text = L.join("\n");
console.log(text);
writeFileSync("scripts/out/bantargebang-kimia.txt", text);
writeFileSync("scripts/out/bantargebang-kimia.json", JSON.stringify({ generated: new Date().toISOString(), feed: feed.c, cases }, null, 2));
