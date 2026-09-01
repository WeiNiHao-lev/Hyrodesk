import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { checkCompliance } from "../src/lib/engine/diagnostics";

/**
 * Bantargebang — can it be done without a tight membrane?
 *
 * The question is worth asking because Permen LHK P.59/2016 does not limit
 * dissolved solids. It limits pH, BOD, COD, TSS and total nitrogen, and two
 * metals. If the salt is not regulated then desalting the water is work nobody
 * asked for, and the concentrate it creates — which has no disposal route on
 * this site — is a problem the flowsheet invented for itself.
 *
 * What the standard does demand is COD 35,000 to 300, a removal of 99.1 %, and
 * total nitrogen 2,200 to 60, a removal of 97.3 %. Both are hard. This script
 * tests whether biology and chemistry alone can reach them, and what the
 * nanofiltration variant does that reverse osmosis does not.
 */

const Q = 1200 / 24;
const NH3_N = 2200;

const feed: FeedSpec = {
  name: "Lindi Bantargebang — basis desain",
  flow: Q, T: 30, pH: 7.4, sourceType: "leachate",
  c: {
    TDS: 20000, TSS: 1000, Cl: 6000, Na: 4200, K: 1500, Ca: 400, Mg: 250,
    SO4: 800, HCO3: 6500, NO3: 23, Fe: 4.134, Mn: 5.05,
    NH4: NH3_N * (18.039 / 14.007), TN: NH3_N,
    BOD: 11000, COD: 35000, TOC: 11000, TP: 25, Oil: 6.1,
  },
};

const DEPTH: Record<string, number> = {
  eqtank: 5, coagfloc: 4, clarifier: 4.5, anaerobic: 6, phadjust: 4, aop: 4,
  mbr: 5, aombr: 5, mbbr: 5, aao: 5, "coke-ao": 5, thickener: 4, baf: 4,
};
const FIXED_AREA: Record<string, number> = {
  intake: 40, feedsource: 0, outfall: 6, waste: 0, dewatering: 90,
  dtro: 110, nf: 90, ro: 90, cartridge: 12, uf: 60, disinfection: 25, daf: 0,
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
  if (type === "daf") return (num(/flotation area/i) ?? 10) * SPACING * 1.6;
  if (type === "clarifier") return (num(/plan area/i) ?? 20) * SPACING;
  const vol = num(/volume/i);
  if (vol != null && DEPTH[type]) return (vol / DEPTH[type]) * SPACING;
  if (FIXED_AREA[type] != null) return FIXED_AREA[type] * SPACING;
  return 25 * SPACING;
}

interface Spec { type: string; label: string; params?: Params }

function assemble(mid: Spec[], tail: "none" | "nf" | "dtro"): Flowsheet {
  const specs: Spec[] = [
    { type: "feedsource", label: "Raw Leachate" },
    { type: "intake", label: "Bar Screen", params: { headM: 12, pumpEff: 0.7, screenRemovalTSS: 3, cl2Dose: 0 } },
    { type: "eqtank", label: "Ekualisasi", params: { hrtH: 12 } },
    ...mid,
  ];
  const links: [number, string, number][] = [];
  for (let i = 0; i < specs.length - 1; i++) links.push([i, "out", i + 1]);
  let last = specs.length - 1;

  let iMem = -1;
  if (tail !== "none") {
    specs.push(tail === "nf"
      ? { type: "nf", label: "NF", params: { recovery: 80, flux: 18 } }
      : { type: "dtro", label: "DTRO 2-tahap", params: { stages: 2, recovery: 85, flux: 18 } });
    iMem = specs.length - 1;
    links.push([last, "out", iMem]);
    last = iMem;
  }
  const iTrim = specs.length;
  specs.push({ type: "phadjust", label: "Trim pH", params: { targetPH: 7.2, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5 } });
  links.push([last, iMem >= 0 ? "permeate" : "out", iTrim]);

  const iOut = specs.length;   specs.push({ type: "outfall", label: "Efluen" });
  links.push([iTrim, "out", iOut]);
  const iThk = specs.length;   specs.push({ type: "thickener", label: "Thickener" });
  const iFP = specs.length;    specs.push({ type: "dewatering", label: "Filter Press", params: { cakeDryness: 25 } });
  const iCake = specs.length;  specs.push({ type: "waste", label: "Cake", params: { name: "sludge" } });
  const iRej = specs.length;   specs.push({ type: "waste", label: "Konsentrat", params: { name: "reject" } });
  const iLoss = specs.length;  specs.push({ type: "waste", label: "Supernatan", params: { name: "loss" } });

  for (let i = 0; i < specs.length; i++) {
    const t = specs[i].type;
    if (t === "daf") links.push([i, "float", iThk]);
    if (t === "clarifier") links.push([i, "sludge", iThk]);
    if (t === "anaerobic") links.push([i, "sludge", iThk]);
    if (["mbbr", "aao", "coke-ao", "msbr"].includes(t)) links.push([i, "was", iThk]);
    if (t === "baf") links.push([i, "backwash", iLoss]);
  }
  if (iMem >= 0) links.push([iMem, "concentrate", iRej]);
  links.push([iThk, "thickened", iFP], [iThk, "supernatant", iLoss],
    [iFP, "cake", iCake], [iFP, "filtrate", iLoss]);

  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: (i % 10) * 130, y: Math.floor(i / 10) * 180 + 150 },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, h, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: h, target: nodes[b].id, targetHandle: "in",
  }));
  return { nodes, edges, feed, basis: { standard: "permen59", productSpecKey: "process", designMode: "feed-driven" } as DesignBasis };
}

/* ---------------------------------------------------------------- pieces */

const COAG = (dose: number, label = "Koagulasi-Flokulasi"): Spec =>
  ({ type: "coagfloc", label, params: { coagDose: dose, polymerDose: 3, targetPH: 7.5, mixTimeMin: 2, flocTimeMin: 20 } });
const DAF: Spec = { type: "daf", label: "DAF",
  params: { loading: 6, recyclePct: 12, tssRemoval: 92, oilRemoval: 92, codRemoval: 30, floatFlowPct: 2.5 } };
const CLAR: Spec = { type: "clarifier", label: "Lamella Clarifier",
  params: { riseRate: 3, tssRemoval: 92, sludgeFlowPct: 3, codRemoval: 40, trains: 2 } };

/** Aerobic MBBR only: it nitrifies, and the nitrate stays. */
const MBBR_AER = (label: string): Spec => ({ type: "mbbr", label,
  params: { hrtH: 24, mlss: 4500, srtD: 25, bodRemoval: 96, codRemoval: 62,
            tnRemoval: 8, tpRemoval: 25, nh4Removal: 95, aeUp: 1.6,
            wasPct: 1.5, yieldCoef: 0.35, carbonDose: 0 } });

/**
 * Anoxic-oxic MBBR. Stage 1 is limited by the recycle: at R=4 it can denitrify
 * 80 % of what it nitrifies. Stage 2 is not, because the nitrate arrives in its
 * feed rather than being made in its own oxic zone — which is exactly why two
 * stages is the leachate arrangement and one is not.
 */
const AO1: Spec = { type: "coke-ao", label: "A/O MBBR tahap 1",
  params: { hrtH: 36, mlss: 5000, srtD: 30, bodRemoval: 94, codRemoval: 60,
            tnRemoval: 78, tpRemoval: 30, nh4Removal: 95, aeUp: 1.6,
            wasPct: 1.2, yieldCoef: 0.3, carbonDose: 0 } };
const AO2 = (carbon: number): Spec => ({ type: "coke-ao", label: `A/O MBBR tahap 2${carbon ? " + metanol" : ""}`,
  params: { hrtH: 20, mlss: 5000, srtD: 30, bodRemoval: 90, codRemoval: 35,
            tnRemoval: 88, tpRemoval: 25, nh4Removal: 95, aeUp: 1.6,
            wasPct: 1.0, yieldCoef: 0.3, carbonDose: carbon } });
const AO3: Spec = { type: "coke-ao", label: "A/O MBBR tahap 3",
  params: { hrtH: 14, mlss: 5000, srtD: 30, bodRemoval: 85, codRemoval: 25,
            tnRemoval: 85, tpRemoval: 20, nh4Removal: 95, aeUp: 1.6,
            wasPct: 0.8, yieldCoef: 0.3, carbonDose: 0 } };
const AOP: Spec = { type: "aop", label: "Fenton / AOP",
  params: { codRemoval: 65, bodIncrease: 15 } };
const DIS: Spec = { type: "disinfection", label: "Disinfeksi NaClO",
  params: { method: "naocl", dose: 5, contactMin: 30 } };

/* ------------------------------------------------------------------- run */

const round = (v: number, dp = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : 0);

function run(name: string, note: string, mid: Spec[], tail: "none" | "nf" | "dtro") {
  const fs = assemble(mid, tail);
  const r = simulate(fs);
  const s = r.summary;
  const p = r.productStreams[0]?.stream;
  const units = r.nodes.filter((n) => !["feedsource", "outfall", "waste"].includes(n.type));
  const area = units.reduce((a, u) => a + footprint(u.type, u.aux.sizing), 0);
  const mem = r.nodes.find((n) => n.type === "nf" || n.type === "dtro");
  const conc = mem ? mem.outlets.concentrate.flow * 24 : 0;
  const concC = mem ? mem.outlets.concentrate.c : null;
  const comp = p ? checkCompliance(p, "permen59") : [];
  const meoh = s.chemicals.find((c) => /Methanol|External carbon/.test(c.name));
  return {
    name, note,
    power_kW: round(s.totalPowerKW, 1), sec: round(s.secKWhPerM3, 2),
    capex: Math.round(s.capexUSD), opexPerM3: round(s.opexUSDPerM3, 3),
    product_m3d: round(s.productFlow * 24, 0), concentrate_m3d: round(conc, 0),
    area_m2: round(area, 0),
    methanol_t_y: meoh ? round((meoh.kgPerH * 8000) / 1000, 1) : 0,
    effluent: {
      COD: round(p?.c.COD ?? 0, 1), BOD: round(p?.c.BOD ?? 0, 1),
      TSS: round(p?.c.TSS ?? 0, 1), TN: round(p?.c.TN ?? 0, 1),
      NH4N: round((p?.c.NH4 ?? 0) * 14.007 / 18.039, 1),
      NO3N: round((p?.c.NO3 ?? 0) * 14.007 / 62.004, 1),
      TDS: round(p?.c.TDS ?? 0, 0), pH: round(p?.pH ?? 0, 2),
    },
    concentrate: concC ? { COD: round(concC.COD, 0), TN: round(concC.TN, 0), TDS: round(concC.TDS, 0) } : null,
    fails: comp.filter((c) => !c.pass && !c.outsideScope).map((c) => `${c.label} ${c.actualText} vs ${c.limitText}`),
    warnings: s.warnings.filter((w) => /carbon|BOD:TN|alkalinity|recycle/i.test(w)).slice(0, 3),
  };
}

const cases = [
  run("1. Saran teman — MBBR aerob x2 + NF", "'2-stage MBBR' dibaca dua reaktor aerob",
      [COAG(200), DAF, MBBR_AER("MBBR aerob 1"), MBBR_AER("MBBR aerob 2"), COAG(150, "Koagulasi kimia"), CLAR, DIS], "nf"),
  run("2. Saran teman, A/O — 2 tahap + NF", "'2-stage' dibaca anoksik-oksik dua tahap",
      [COAG(200), DAF, AO1, AO2(0), COAG(150, "Koagulasi kimia"), CLAR, DIS], "nf"),
  run("3. A/O 2 tahap + metanol + NF", "karbon tahap 2 dibeli",
      [COAG(200), DAF, AO1, AO2(800), COAG(150, "Koagulasi kimia"), CLAR, DIS], "nf"),
  run("4. A/O 3 tahap + NF", "tahap ketiga menggantikan metanol",
      [COAG(200), DAF, AO1, AO2(0), AO3, COAG(150, "Koagulasi kimia"), CLAR, DIS], "nf"),
  run("5. TANPA MEMBRAN — A/O 3 tahap + Fenton", "tidak ada konsentrat sama sekali",
      [COAG(200), DAF, AO1, AO2(0), AO3, COAG(150, "Koagulasi kimia"), CLAR, AOP, DIS], "none"),
  run("6. TANPA MEMBRAN — A/O 3 tahap + metanol + Fenton", "karbon dibeli, tanpa konsentrat",
      [COAG(200), DAF, AO1, AO2(600), AO3, COAG(150, "Koagulasi kimia"), CLAR, AOP, DIS], "none"),
  run("7. Pembanding — A/O 2 tahap + DTRO", "membran ketat, bukan NF",
      [COAG(200), DAF, AO1, AO2(0), COAG(150, "Koagulasi kimia"), CLAR, DIS], "dtro"),
];

const f = (v: number, dp = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const L: string[] = [];
L.push("BANTARGEBANG — RUTE TANPA MEMBRAN KETAT");
L.push("=".repeat(120));
L.push("P.59/2016 membatasi pH, BOD 150, COD 300, TSS 100, N-total 60. TDS TIDAK dibatasi.");
L.push("");
L.push("OPSI".padEnd(44) + "daya".padStart(7) + "kWh/m3".padStart(8) + "CAPEX".padStart(11) +
  "OPEX/m3".padStart(9) + "produk".padStart(8) + "konsen".padStart(8) + "MeOH t/th".padStart(10) + "lahan".padStart(8));
L.push("-".repeat(120));
for (const c of cases) {
  L.push(c.name.padEnd(44) + f(c.power_kW).padStart(7) + f(c.sec, 2).padStart(8) +
    f(c.capex).padStart(11) + f(c.opexPerM3, 2).padStart(9) + f(c.product_m3d).padStart(8) +
    (c.concentrate_m3d ? f(c.concentrate_m3d) : "—").padStart(8) +
    (c.methanol_t_y ? f(c.methanol_t_y, 1) : "—").padStart(10) + f(c.area_m2).padStart(8));
}
L.push("");
L.push("EFLUEN");
L.push("-".repeat(120));
L.push("OPSI".padEnd(44) + "COD".padStart(8) + "BOD".padStart(7) + "TSS".padStart(7) +
  "TN".padStart(8) + "NH4-N".padStart(8) + "NO3-N".padStart(8) + "TDS".padStart(8) + "  hasil");
for (const c of cases) {
  const e = c.effluent;
  L.push(c.name.padEnd(44) + f(e.COD, 1).padStart(8) + f(e.BOD, 1).padStart(7) + f(e.TSS, 1).padStart(7) +
    f(e.TN, 1).padStart(8) + f(e.NH4N, 1).padStart(8) + f(e.NO3N, 1).padStart(8) + f(e.TDS).padStart(8) +
    "  " + (c.fails.length ? c.fails.join("; ") : "LOLOS"));
}
L.push("");
L.push("KONSENTRAT");
L.push("-".repeat(120));
for (const c of cases) {
  if (!c.concentrate) { L.push(c.name.padEnd(44) + "  tidak ada konsentrat"); continue; }
  L.push(c.name.padEnd(44) + f(c.concentrate_m3d).padStart(7) + " m3/hari   COD " +
    f(c.concentrate.COD).padStart(8) + "   TN " + f(c.concentrate.TN).padStart(7) +
    "   TDS " + f(c.concentrate.TDS).padStart(8) +
    "   garam " + f((c.concentrate.TDS * c.concentrate_m3d) / 1e6, 1) + " t/hari");
}
L.push("");
L.push("PERINGATAN MODEL");
L.push("-".repeat(120));
for (const c of cases) {
  if (!c.warnings.length) continue;
  L.push(c.name);
  for (const w of c.warnings) L.push("   ! " + w);
}

const text = L.join("\n");
console.log(text);
writeFileSync("scripts/out/bantargebang-nomembrane.txt", text);
writeFileSync("scripts/out/bantargebang-nomembrane.json", JSON.stringify({ generated: new Date().toISOString(), cases }, null, 2));
