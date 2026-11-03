import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { checkCompliance } from "../src/lib/engine/diagnostics";
import { alkalinityAsCaCO3, hardnessAsCaCO3 } from "../src/lib/engine/stream";

/**
 * SIER — 205 m3/h of reservoir water to TDS below 300, at the lowest capital
 * cost and an operating cost under Rp 2,500 per cubic metre. No membrane if it
 * can be helped; nanofiltration allowed if it must be.
 *
 * The analysis is thin — TSS 20, alkalinity 130, TDS 365, 15 NTU, pH 8.5, green
 * — and the one ion in it decides the whole answer. Alkalinity 130 as CaCO3 is
 * 2.6 meq/L, which is 158 mg/L of bicarbonate: 42 % of the dissolved solids.
 * Bicarbonate paired with calcium is carbonate hardness, and carbonate hardness
 * is the one fraction of TDS that precipitates. The removal asked for is 65
 * mg/L, 18 %, against 211 mg/L theoretically available by softening.
 *
 * So the question is not whether chemistry can reach the target. It is which
 * reactor costs least to get there, and whether anything is given back in the
 * reagent bill.
 */

const Q = 205;
const FX = 16300;                 // Rp per USD
const OPEX_CEILING_RP = 2500;

/**
 * Only alkalinity, TDS, TSS, turbidity and pH were measured. The ion split is
 * the Sagara assumption register, charge-balanced, and it is an assumption:
 * every softening number below is a property of it rather than of the water
 * until a cation analysis comes back.
 */
const feed: FeedSpec = {
  name: "Waduk SIER — analisis terbatas",
  flow: Q, T: 28, pH: 8.5, sourceType: "river",
  c: {
    TDS: 365, TSS: 20, TOC: 5,
    Ca: 55, Mg: 15, Na: 42, K: 6,
    HCO3: 158, SO4: 45, Cl: 40, NO3: 3, SiO2: 12,
    Fe: 0.3, Mn: 0.15, BOD: 3, COD: 15,
  },
  turbidityNTU: 15, alkalinityAsCaCO3: 130,
};

interface Spec { type: string; label: string; params?: Params }

function assemble(mid: Spec[]): Flowsheet {
  const specs: Spec[] = [
    { type: "feedsource", label: "Waduk" },
    { type: "intake", label: "Intake & Screen", params: { headM: 30, pumpEff: 0.75, screenRemovalTSS: 3, cl2Dose: 1.5 } },
    ...mid,
    { type: "producttank", label: "Tangki Produk", params: { hrtH: 4, outletCount: 1 } },
    { type: "pump", label: "Pompa Distribusi", params: { headM: 45, pumpEff: 0.75, standby: 1 } },
  ];
  const MEM = new Set(["nf", "ro", "dtro"]);
  const handle = (i: number) => (MEM.has(specs[i].type) ? "permeate" : "out");
  const links: [number, string, number][] = [];
  for (let i = 0; i < specs.length - 1; i++) links.push([i, handle(i), i + 1]);
  const iLast = specs.length - 1;

  const iOut = specs.length;  specs.push({ type: "outfall", label: "Produk ke SIER" });
  links.push([iLast, "out", iOut]);
  const iThk = specs.length;  specs.push({ type: "thickener", label: "Pengental Lumpur" });
  const iFP = specs.length;   specs.push({ type: "dewatering", label: "Screw Press", params: { cakeDryness: 22 } });
  const iCake = specs.length; specs.push({ type: "waste", label: "Cake ke TPA", params: { name: "sludge" } });
  const iRej = specs.length;  specs.push({ type: "waste", label: "Buangan", params: { name: "reject" } });

  let anySolids = false;
  for (let i = 0; i < specs.length; i++) {
    const t = specs[i].type;
    if (t === "clarifier") { links.push([i, "sludge", iThk]); anySolids = true; }
    if (t === "daf") { links.push([i, "float", iThk]); anySolids = true; }
    if (t === "mmf" || t === "acf") links.push([i, "backwash", iThk]);
    if (t === "limesoft") {
      // Pellets are already dry: they go straight to disposal, not to a press.
      const dry = (specs[i].params?.solidsPct as number ?? 90) > 50;
      links.push([i, "solids", dry ? iCake : iThk]);
      anySolids = true;
    }
    if (MEM.has(t)) { links.push([i, "concentrate", iRej]); anySolids = true; }
  }
  if (anySolids) links.push([iThk, "thickened", iFP], [iThk, "supernatant", iRej], [iFP, "cake", iCake], [iFP, "filtrate", iRej]);

  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: (i % 8) * 140, y: Math.floor(i / 8) * 170 + 120 },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, h, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: h, target: nodes[b].id, targetHandle: "in",
  }));
  return { nodes, edges, feed, basis: { standard: "permenkes", productSpecKey: "process", designMode: "feed-driven" } as DesignBasis };
}

/* --------------------------------------------------------------- blocks */

const COAG: Spec = { type: "coagfloc", label: "Koagulasi-Flokulasi",
  params: { coagDose: 25, polymerDose: 0.3, targetPH: 7.2, mixTimeMin: 1, flocTimeMin: 18 } };
const CLAR: Spec = { type: "clarifier", label: "Lamella Clarifier",
  params: { riseRate: 6, tssRemoval: 92, sludgeFlowPct: 2, codRemoval: 35, trains: 2 } };
const MMF: Spec = { type: "mmf", label: "Filter Dual-Media",
  params: { rate: 10, backwashPct: 3.5, tssRemoval: 88 } };
const PELLET = (target: number): Spec => ({ type: "limesoft", label: `Pellet Softening (target ${target})`,
  params: { reactor: "pellet", reagent: "lime", targetHardness: target, residualFloor: 50,
            excessPct: 10, upflowMH: 80, seedDose: 12, solidsPct: 90, carryoverPct: 8 } });
const LIMECL = (target: number): Spec => ({ type: "limesoft", label: `Lime Clarifier (target ${target})`,
  params: { reactor: "clarifier", reagent: "lime", targetHardness: target, residualFloor: 40,
            excessPct: 15, upflowMH: 2.5, seedDose: 0, solidsPct: 4, carryoverPct: 3 } });
const CAUSTIC = (target: number): Spec => ({ type: "limesoft", label: `Pellet Softening — NaOH (${target})`,
  params: { reactor: "pellet", reagent: "naoh", targetHardness: target, residualFloor: 50,
            excessPct: 10, upflowMH: 80, seedDose: 12, solidsPct: 90, carryoverPct: 8 } });
const RECARB: Spec = { type: "phadjust", label: "Netralisasi pH",
  params: { targetPH: 7.6, reagentDown: "h2so4", codCoPrecipPct: 0, hrtMin: 10 } };
const NF = (rec: number): Spec => ({ type: "nf", label: `NF (recovery ${rec} %)`,
  params: { recovery: rec, flux: 20 } });
const CART: Spec = { type: "cartridge", label: "Cartridge 5 µm", params: { micron: 5 } };

/* ------------------------------------------------------------------ run */

const round = (v: number, dp = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : 0);

function run(name: string, note: string, mid: Spec[]) {
  const r = simulate(assemble(mid));
  const s = r.summary;
  const p = r.productStreams[0]?.stream;
  const comp = p ? checkCompliance(p, "permenkes") : [];
  const chem = (re: RegExp) => round(s.chemicals.filter((x) => re.test(x.name))
    .reduce((a, x) => a + x.kgPerH, 0) * 24 / 1000, 3);
  const soft = r.nodes.find((n) => n.type === "limesoft");
  const mem = r.nodes.find((n) => ["nf", "ro"].includes(n.type));
  return {
    name, note,
    power_kW: round(s.totalPowerKW, 1), sec: round(s.secKWhPerM3, 3),
    capex_USD: Math.round(s.capexUSD), capex_Rp_M: round(s.capexUSD * FX / 1e9, 2),
    opex_USD_m3: round(s.opexUSDPerM3, 4), opex_Rp_m3: Math.round(s.opexUSDPerM3 * FX),
    product_m3h: round(s.productFlow, 1), recovery: round(s.recoveryPct, 1),
    tds: round(p?.c.TDS ?? 0, 1), hardness: round(hardnessAsCaCO3(p!), 0),
    alk: round(alkalinityAsCaCO3(p!), 0), ph: round(p?.pH ?? 0, 2),
    turbidity: round(p?.extras.turbidityNTU ?? 0, 3),
    lime_t_d: chem(/lime/i), acid_t_d: chem(/Sulphuric/i), naoh_t_d: chem(/Caustic/i),
    solids_t_d: round(s.drySolidsKgH * 24 / 1000, 2),
    softArea: soft ? soft.aux.sizing.find((x) => x.label === "Plan area")?.value ?? "" : "",
    memConc: mem ? round(mem.outlets.concentrate.flow * 24, 0) : 0,
    fails: comp.filter((c) => !c.pass && !c.outsideScope).map((c) => `${c.label} ${c.actualText} vs ${c.limitText}`),
    notes: r.nodes.flatMap((n) => n.aux.notes).filter((x) => /dissolved solids fall|carbonate hardness|sodium/i.test(x)).slice(0, 2),
  };
}

const TRIM: Spec = { type: "phadjust", label: "Trim pH Produk",
  params: { targetPH: 7.4, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5 } };

// Softening precipitates crystals and a few per cent of them leave with the
// water, so the filter belongs after the reactor and not before it. Putting it
// first cost 4.85 NTU in the product on the first attempt — the block says so
// in its own notes, and the flowsheet ignored it.
const cases = [
  run("0. Konvensional saja (tanpa penurun TDS)", "pembanding: apakah memang perlu sesuatu?",
      [COAG, CLAR, MMF]),
  run("1. Pellet softening — target 150", "kapur, reaktor pelet, lumpur kering",
      [COAG, CLAR, PELLET(150), RECARB, MMF]),
  run("2. Pellet softening — target 120", "lebih dalam, margin lebih besar",
      [COAG, CLAR, PELLET(120), RECARB, MMF]),
  run("3. Lime clarifier — target 150", "kimia sama, reaktor konvensional",
      [COAG, LIMECL(150), RECARB, MMF]),
  run("4. Pellet softening pakai NaOH — target 150", "lebih mudah ditangani, natriumnya tinggal",
      [COAG, CLAR, CAUSTIC(150), RECARB, MMF]),
  run("5. NF penuh, recovery 85 %", "rute membran, semua air lewat",
      [COAG, CLAR, MMF, CART, NF(85), TRIM]),
  run("6. Pellet target 180 — dosis minimum", "hanya secukupnya untuk menembus 300",
      [COAG, CLAR, PELLET(180), RECARB, MMF]),
];

/**
 * Split-stream softening, the same idea as a split-stream membrane: soften part
 * of the flow hard and blend it back with filtered water that was never
 * softened. Alkalinity and dissolved solids fall together here, because the
 * bicarbonate is the dissolved solid being removed — so softening the whole
 * flow to reach the TDS target also strips the buffer the distribution network
 * needs. Splitting lets the two be set independently: the share picks the TDS,
 * the unsoftened fraction keeps the alkalinity.
 */
function runSplit(name: string, sharePct: number) {
  const specs: Spec[] = [
    { type: "feedsource", label: "Waduk" },
    { type: "intake", label: "Intake & Screen", params: { headM: 30, pumpEff: 0.75, screenRemovalTSS: 3, cl2Dose: 1.5 } },
    COAG, CLAR,
    { type: "rawtank", label: "Tangki Air Jernih", params: { hrtH: 1, outletCount: 2, split2: sharePct, lossPct: 0 } },
    { type: "limesoft", label: "Pellet Softening", params: { reactor: "pellet", reagent: "lime",
        targetHardness: 60, residualFloor: 50, excessPct: 10, upflowMH: 80, seedDose: 12, solidsPct: 90, carryoverPct: 8 } },
    { type: "producttank", label: "Tangki Produk + Blending", params: { hrtH: 4, outletCount: 1 } },
    { type: "mmf", label: "Filter Dual-Media", params: { rate: 10, backwashPct: 3.5, tssRemoval: 88 } },
    { type: "pump", label: "Pompa Distribusi", params: { headM: 45, pumpEff: 0.75, standby: 1 } },
    { type: "outfall", label: "Produk ke SIER" },
    { type: "thickener", label: "Pengental Lumpur" },
    { type: "dewatering", label: "Screw Press", params: { cakeDryness: 22 } },
    { type: "waste", label: "Cake ke TPA", params: { name: "sludge" } },
    { type: "waste", label: "Buangan", params: { name: "reject" } },
  ];
  const links: [number, string, number][] = [
    [0, "out", 1], [1, "out", 2], [2, "out", 3],
    [3, "out", 4],
    [4, "out1", 6],          // bypass, tidak dilunakkan
    [4, "out2", 5],          // ke pellet softener
    [5, "out", 6],
    [6, "out", 7], [7, "out", 8], [8, "out", 9],
    [3, "sludge", 10], [7, "backwash", 10], [5, "solids", 12],
    [10, "thickened", 11], [10, "supernatant", 13], [11, "cake", 12], [11, "filtrate", 13],
  ];
  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: (i % 8) * 140, y: Math.floor(i / 8) * 170 + 120 },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, h, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: h, target: nodes[b].id, targetHandle: "in",
  }));
  const r = simulate({ nodes, edges, feed, basis: { standard: "permenkes", productSpecKey: "process", designMode: "feed-driven" } as DesignBasis });
  const sm = r.summary;
  const pr = r.productStreams[0]?.stream;
  const comp = pr ? checkCompliance(pr, "permenkes") : [];
  const chem = (re: RegExp) => round(sm.chemicals.filter((x) => re.test(x.name)).reduce((a, x) => a + x.kgPerH, 0) * 24 / 1000, 3);
  const soft = r.nodes.find((n) => n.type === "limesoft")!;
  return {
    name, note: `${sharePct} % dilunakkan, sisanya dicampur balik`,
    power_kW: round(sm.totalPowerKW, 1), sec: round(sm.secKWhPerM3, 3),
    capex_USD: Math.round(sm.capexUSD), capex_Rp_M: round(sm.capexUSD * FX / 1e9, 2),
    opex_USD_m3: round(sm.opexUSDPerM3, 4), opex_Rp_m3: Math.round(sm.opexUSDPerM3 * FX),
    product_m3h: round(sm.productFlow, 1), recovery: round(sm.recoveryPct, 1),
    tds: round(pr?.c.TDS ?? 0, 1), hardness: round(hardnessAsCaCO3(pr!), 0),
    alk: round(alkalinityAsCaCO3(pr!), 0), ph: round(pr?.pH ?? 0, 2),
    turbidity: round(pr?.extras.turbidityNTU ?? 0, 3),
    lime_t_d: chem(/lime/i), acid_t_d: chem(/Sulphuric/i), naoh_t_d: chem(/Caustic/i),
    solids_t_d: round(sm.drySolidsKgH * 24 / 1000, 2),
    softArea: soft.aux.sizing.find((x) => x.label === "Plan area")?.value ?? "",
    memConc: 0,
    fails: comp.filter((c) => !c.pass && !c.outsideScope).map((c) => `${c.label} ${c.actualText} vs ${c.limitText}`),
    notes: [] as string[],
  };
}
for (const share of [40, 50, 60, 70]) cases.push(runSplit(`S. Pelunakan split ${share} %`, share));

const f = (v: number, dp = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const L: string[] = [];
L.push("SIER — 205 m3/jam, target TDS < 300, OPEX maks Rp 2.500/m3, CAPEX serendahnya");
L.push("=".repeat(132));
const ionSum = Object.entries(feed.c).filter(([k]) => ["Na", "K", "Ca", "Mg", "Cl", "SO4", "HCO3", "NO3", "SiO2", "Fe"].includes(k)).reduce((a, [, v]) => a + (v ?? 0), 0);
L.push(`Umpan: TDS 365 · alkalinitas 130 mg/L CaCO3 (= HCO3 ${f(feed.c.HCO3!, 0)}, ${f(100 * feed.c.HCO3! / ionSum, 0)} % dari jumlah ion) · TSS 20 · 15 NTU · pH 8,5`);
L.push("Perlu disisihkan 65 mg/L = 17,8 %. Kesadahan karbonat tersedia 129 mg/L CaCO3 = 2,6 meq = 211 mg/L TDS.");
L.push("");
L.push("OPSI".padEnd(40) + "daya".padStart(7) + "kWh/m3".padStart(8) + "CAPEX Rp M".padStart(12) +
  "OPEX Rp/m3".padStart(12) + "TDS".padStart(8) + "pH".padStart(6) + "NTU".padStart(7) + "  hasil");
L.push("-".repeat(132));
for (const c of cases) {
  const ok = c.fails.length === 0 && c.tds < 300 && c.opex_Rp_m3 <= OPEX_CEILING_RP;
  L.push(c.name.padEnd(40) + f(c.power_kW).padStart(7) + f(c.sec, 2).padStart(8) +
    f(c.capex_Rp_M, 2).padStart(12) + f(c.opex_Rp_m3).padStart(12) +
    f(c.tds, 1).padStart(8) + f(c.ph, 2).padStart(6) + f(c.turbidity, 2).padStart(7) +
    "  " + (ok ? "MEMENUHI" : c.fails.length ? c.fails.join("; ") : c.tds >= 300 ? `TDS ${f(c.tds, 0)} > 300` : `OPEX Rp ${f(c.opex_Rp_m3)} > 2.500`));
}
L.push("");
L.push("REAGEN, LUMPUR, DAN LAHAN REAKTOR");
L.push("-".repeat(132));
L.push("OPSI".padEnd(40) + "kapur t/hr".padStart(11) + "NaOH t/hr".padStart(11) + "asam t/hr".padStart(11) +
  "padatan t/hr".padStart(13) + "konsentrat m3/hr".padStart(18) + "  luas reaktor");
for (const c of cases) {
  L.push(c.name.padEnd(40) + f(c.lime_t_d, 2).padStart(11) + f(c.naoh_t_d, 2).padStart(11) +
    f(c.acid_t_d, 2).padStart(11) + f(c.solids_t_d, 2).padStart(13) +
    (c.memConc ? f(c.memConc) : "—").padStart(18) + "  " + c.softArea);
}
L.push("");
L.push("KUALITAS PRODUK");
L.push("-".repeat(132));
L.push("OPSI".padEnd(40) + "TDS".padStart(8) + "kesadahan".padStart(11) + "alkalinitas".padStart(13) +
  "pH".padStart(7) + "produk m3/jam".padStart(15) + "recovery %".padStart(12));
for (const c of cases) {
  L.push(c.name.padEnd(40) + f(c.tds, 1).padStart(8) + f(c.hardness).padStart(11) +
    f(c.alk).padStart(13) + f(c.ph, 2).padStart(7) + f(c.product_m3h, 1).padStart(15) + f(c.recovery, 1).padStart(12));
}
L.push("");
L.push("CATATAN MODEL");
L.push("-".repeat(132));
for (const c of cases) {
  if (!c.notes.length) continue;
  L.push(c.name);
  for (const nt of c.notes) L.push("   " + nt);
}

const text = L.join("\n");
console.log(text);
writeFileSync("scripts/out/sier.txt", text);
writeFileSync("scripts/out/sier.json", JSON.stringify({ generated: new Date().toISOString(), feed: feed.c, cases }, null, 2));
