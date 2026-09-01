import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { checkCompliance } from "../src/lib/engine/diagnostics";

/**
 * Bantargebang IPAS 2 — which arrangement is actually cheapest.
 *
 * The train proposed in discussion is a good one and this script does not argue
 * with its shape. It tests the three choices inside it that carry most of the
 * cost, by building the alternatives and running them against the same water:
 *
 *   1. What removes the organic load — a light MBBR, or an anaerobic reactor?
 *      On a COD of 35,000 the word "light" is doing a great deal of work.
 *   2. Whether ultrafiltration ahead of DTRO earns its place, given that DTRO
 *      exists precisely to run on feeds that would destroy a spiral element.
 *   3. Whether the coagulation goes before or after the biological stage.
 *
 * The concentrate question is handled separately at the end, because it is not
 * a flowsheet question: it is a mass balance about where the salt finally goes,
 * and neither of the two disposal routes proposed provides one.
 */

const Q = 1200 / 24;           // 50 m3/h
const NH3_N = 2200;            // mg/L as N, the reported ammonia
const SITE_M2 = 20000;         // 2 ha

const feed: FeedSpec = {
  name: "Lindi Bantargebang — basis desain",
  flow: Q, T: 30, pH: 7.4, sourceType: "leachate",
  c: {
    TDS: 20000, TSS: 1000, Cl: 6000, Na: 4200, K: 1500, Ca: 400, Mg: 250,
    SO4: 800, HCO3: 6500, NO3: 23, Fe: 4.134, Mn: 5.05,
    NH4: NH3_N * (18.039 / 14.007), TN: NH3_N,
    BOD: 11000, COD: 35000, TOC: 11000, TP: 25, Oil: 6.1,
  },
  trace: {
    Zn: 0.475, Cr: 0.902, Cd: 0.43, Hg: 0.0008, Pb: 3.363, As: 13.8,
    Se: 0.03, Ni: 4.254, Co: 1.172, CN: 6.1, S2: 28.5, Phenol: 22.4,
  },
};

/* --------------------------------------------------------------- footprint */

const DEPTH: Record<string, number> = {
  eqtank: 5, coagfloc: 4, clarifier: 4.5, anaerobic: 6, phadjust: 4,
  mbr: 5, aombr: 5, mbbr: 5, aao: 5, "coke-ao": 5, thickener: 4,
  rawtank: 5, producttank: 5, baf: 4,
};
const FIXED_AREA: Record<string, number> = {
  intake: 40, "intake-plain": 30, feedsource: 0, outfall: 6, waste: 0,
  dewatering: 90, dtro: 110, aop: 70, cartridge: 12, uf: 60, tuf: 45, suf: 70,
  daf: 0, oilsep: 0, splitter: 0, pump: 8,
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
  if (type === "daf") {
    const a = num(/flotation area/i) ?? 10;
    return a * SPACING * 1.6;      // saturation skid, recycle pumps, sludge box
  }
  const vol = num(/volume/i);
  if (vol != null && DEPTH[type]) return (vol / DEPTH[type]) * SPACING;
  if (FIXED_AREA[type] != null) return FIXED_AREA[type] * SPACING;
  return 25 * SPACING;
}

/* ------------------------------------------------------------------ builder */

interface Spec { type: string; label: string; params?: Params; x: number; y: number }

function build(specs: Spec[], links: [number, string, number][]): Flowsheet {
  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: sp.x, y: sp.y },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, h, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: h, target: nodes[b].id, targetHandle: "in",
  }));
  return {
    nodes, edges, feed,
    basis: { standard: "permen59", productSpecKey: "process", designMode: "feed-driven" } as DesignBasis,
  };
}

/** Blocks that every option shares, up to and including equalisation. */
const HEAD: Spec[] = [
  { type: "feedsource", label: "Raw Leachate", x: 0, y: 200 },
  { type: "intake", label: "Intake & Bar Screen",
    params: { headM: 12, pumpEff: 0.7, screenRemovalTSS: 3, electrochlorination: false, cl2Dose: 0 }, x: 120, y: 200 },
  { type: "eqtank", label: "Equalisation + coarse aeration", params: { hrtH: 12 }, x: 240, y: 200 },
];

const COAG: Spec = { type: "coagfloc", label: "Coagulation-Flocculation",
  params: { coagDose: 250, polymerDose: 3, targetPH: 7.5, mixTimeMin: 2, flocTimeMin: 20 }, x: 0, y: 0 };
const DAF: Spec = { type: "daf", label: "DAF",
  params: { loading: 6, recyclePct: 12, tssRemoval: 92, oilRemoval: 92, codRemoval: 30, floatFlowPct: 2.5 }, x: 0, y: 0 };
const MBBR: Spec = { type: "mbbr", label: "MBBR (BOD removal)",
  params: { hrtH: 12, mlss: 4000, srtD: 15, bodRemoval: 92, codRemoval: 55, tnRemoval: 0,
            tpRemoval: 20, nh4Removal: 0, aeUp: 2.0, wasPct: 1.5, yieldCoef: 0.45 }, x: 0, y: 0 };
const UASB: Spec = { type: "anaerobic", label: "UASB",
  params: { olr: 8, codRemoval: 78, bodRemoval: 92, hrtH: 24 }, x: 0, y: 0 };
const UF: Spec = { type: "uf", label: "UF (RO guard)",
  params: { flux: 45, recovery: 92, tmpBar: 1.4, dutyTrains: 3, standbyTrains: 1 }, x: 0, y: 0 };
const TUF: Spec = { type: "tuf", label: "Tubular UF",
  params: { flux: 80, crossflow: 3.2, tubeIDmm: 8, modulesInSeries: 4, viscRatio: 2.5, recovery: 96 }, x: 0, y: 0 };

function makeTrain(mid: Spec[], dtroRecovery: number, dtroStages = 2, pass2 = false, recycleP2 = false, trim = false): Flowsheet {
  const specs: Spec[] = [...HEAD];
  const links: [number, string, number][] = [[0, "out", 1], [1, "out", 2]];
  let last = 2;
  let x = 360;
  for (const m of mid) {
    specs.push({ ...m, x, y: 200 });
    links.push([last, "out", specs.length - 1]);
    last = specs.length - 1;
    x += 120;
  }
  const iDTRO = specs.length;
  specs.push({ type: "dtro", label: `DTRO ${dtroStages}-tahap`,
    params: { stages: dtroStages, recovery: dtroRecovery, flux: 18, antiscalantDose: 6, cipPerYear: 24 },
    x, y: 200 });
  links.push([last, "out", iDTRO]);
  x += 120;

  let permeateFrom = iDTRO;
  let iPass2 = -1;
  if (pass2) {
    // A second pass on the permeate. Its feed is already clean, so the osmotic
    // pressure is negligible and the pump is small; its concentrate is cleaner
    // than the plant feed and simply goes back to the front of pass 1, so it is
    // not a loss. This is the cheap way to buy the ammonium rejection that one
    // pass cannot reach.
    const iP2 = specs.length;
    specs.push({ type: "dtro", label: "DTRO pass-2",
      params: { stages: 1, recovery: 90, flux: 22, feedPressureBar: 12, antiscalantDose: 2, cipPerYear: 6 },
      x, y: 200 });
    links.push([iDTRO, "permeate", iP2]);
    permeateFrom = iP2;
    iPass2 = iP2;
    x += 120;
  }
  if (trim) {
    // A twice-passed permeate has no buffer left and the carbon dioxide that
    // crossed both membranes makes it acidic. It fails the pH band of the
    // consent on water that is otherwise cleaner than drinking water, so the
    // last block on the train is a small caustic trim.
    const iTrim = specs.length;
    specs.push({ type: "phadjust", label: "Trim pH permeat (NaOH)",
      params: { targetPH: 7.0, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5, excessPct: 15 },
      x, y: 200 });
    links.push([permeateFrom, "permeate", iTrim]);
    permeateFrom = iTrim;
    x += 120;
  }
  const iProd = specs.length; specs.push({ type: "outfall", label: "Permeat ke SPARING", x, y: 200 });
  links.push([permeateFrom, permeateFrom === iDTRO || specs[permeateFrom].type === "dtro" ? "permeate" : "out", iProd]);
  const iThk = specs.length;  specs.push({ type: "thickener", label: "Thickener", x: 480, y: 430 });
  const iFP = specs.length;   specs.push({ type: "dewatering", label: "Filter Press", params: { cakeDryness: 25 }, x: 600, y: 430 });
  const iCake = specs.length; specs.push({ type: "waste", label: "Cake", params: { name: "sludge" }, x: 720, y: 430 });
  const iConc = specs.length; specs.push({ type: "waste", label: "Konsentrat DTRO", params: { name: "reject" }, x: x, y: 430 });
  const iLoss = specs.length; specs.push({ type: "waste", label: "Supernatan & filtrat", params: { name: "loss" }, x: 600, y: 560 });

  // Every solids-bearing side stream to the sludge line.
  for (let i = 0; i < specs.length; i++) {
    const t = specs[i].type;
    if (t === "daf") links.push([i, "float", iThk]);
    if (t === "clarifier") links.push([i, "sludge", iThk]);
    if (t === "anaerobic") links.push([i, "sludge", iThk]);
    if (t === "mbbr" || t === "aao" || t === "coke-ao") links.push([i, "was", iThk]);
    if (t === "uf" || t === "suf") links.push([i, t === "uf" ? "backwash" : "reject", iLoss]);
    if (t === "tuf") links.push([i, "reject", iLoss]);
  }
  links.push([iThk, "thickened", iFP], [iThk, "supernatant", iLoss],
    [iFP, "cake", iCake], [iFP, "filtrate", iLoss],
    [iDTRO, "concentrate", iConc]);
  if (iPass2 >= 0) {
    // Pass-2 concentrate is cleaner than the plant feed, so returning it to the
    // pass-1 inlet recovers water instead of discarding it.
    links.push([iPass2, "concentrate", recycleP2 ? iDTRO : iLoss]);
  }
  return build(specs, links);
}

/* --------------------------------------------------------------------- run */

const round = (v: number, dp = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : 0);

interface Result {
  name: string; note: string;
  power_kW: number; sec: number; capex: number; opexPerM3: number;
  product_m3d: number; concentrate_m3d: number; recovery: number;
  area_m2: number; areaPct: number;
  effluent: Record<string, number>; concentrateC: Record<string, number>; fails: string[];
  units: { label: string; kW: number; capex: number; area: number }[];
}

function run(name: string, note: string, mid: Spec[], rec: number, stages = 2, pass2 = false, recycleP2 = false, trim = false): Result {
  const fs = makeTrain(mid, rec, stages, pass2, recycleP2, trim);
  const r = simulate(fs);
  const s = r.summary;
  const p = r.productStreams[0]?.stream;
  const units = r.nodes
    .filter((n) => !["feedsource", "outfall", "waste"].includes(n.type))
    .map((n) => ({
      label: n.label, kW: round(n.aux.powerKW, 1),
      capex: Math.round(n.aux.capexUSD),
      area: round(footprint(n.type, n.aux.sizing), 0),
    }));
  const area = units.reduce((a, u) => a + u.area, 0);
  const dtro1 = r.nodes.find((n) => n.type === "dtro")!;
  const conc = dtro1.outlets.concentrate.flow * 24;
  const concC = dtro1.outlets.concentrate.c;
  const comp = p ? checkCompliance(p, "permen59") : [];
  return {
    name, note,
    power_kW: round(s.totalPowerKW, 1), sec: round(s.secKWhPerM3, 2),
    capex: Math.round(s.capexUSD), opexPerM3: round(s.opexUSDPerM3, 3),
    product_m3d: round(s.productFlow * 24, 0), concentrate_m3d: round(conc, 0),
    recovery: round(s.recoveryPct, 1),
    area_m2: round(area, 0), areaPct: round((100 * area) / SITE_M2, 1),
    effluent: {
      ...Object.fromEntries((["COD", "BOD", "TSS", "TN", "NH4", "TDS"] as const)
        .map((k) => [k, round(p?.c[k] ?? 0, 1)])),
      pH: round(p?.pH ?? 0, 2),
    },
    concentrateC: Object.fromEntries((["COD", "TN", "TDS"] as const)
      .map((k) => [k, round(concC[k] ?? 0, 0)])),
    fails: comp.filter((c) => !c.pass && !c.outsideScope).map((c) => `${c.label} ${c.actualText} vs ${c.limitText}`),
    units,
  };
}

const STRIP_UP: Spec = { type: "phadjust", label: "Dosing kapur ke pH 10,5",
  params: { targetPH: 10.5, reagentUp: "lime", codCoPrecipPct: 3, hrtMin: 20, excessPct: 15 }, x: 0, y: 0 };
const STRIP: Spec = { type: "nh3strip", label: "Menara Stripping NH3",
  params: { airRatio: 3000, acidScrubber: true }, x: 0, y: 0 };
const NEUT: Spec = { type: "phadjust", label: "Netralisasi ke pH 7",
  params: { targetPH: 7, reagentDown: "h2so4", codCoPrecipPct: 0, hrtMin: 10 }, x: 0, y: 0 };

const cases: Result[] = [
  run("A. Usulan — MBBR ringan + UF",
      "kereta seperti didiskusikan", [COAG, DAF, MBBR, UF], 85),
  run("B. UASB menggantikan MBBR",
      "beban organik dibuang secara anaerob", [COAG, DAF, UASB, UF], 85),
  run("C. UASB, tanpa UF",
      "DTRO memang dibuat untuk umpan kotor", [COAG, DAF, UASB], 85),
  run("D. Tanpa biologi sama sekali",
      "koagulasi lalu langsung membran", [COAG, DAF], 85),
  run("E. UASB + TUF menggantikan UF hollow-fibre",
      "toleransi umpan, bukan energi", [COAG, DAF, UASB, TUF], 85),
  run("F. Koagulasi SESUDAH UASB",
      "menguji urutannya", [UASB, COAG, DAF], 85),
  run("G. C dengan DTRO 3 tahap, recovery 90 %",
      "konsentrat lebih sedikit, tekanan lebih tinggi", [COAG, DAF, UASB], 90, 3),
  run("H. C + DTRO pass-2",
      "nitrogen diselesaikan oleh membran kedua", [COAG, DAF, UASB], 85, 2, true),
  run("I. Tanpa biologi + DTRO pass-2",
      "CAPEX terendah yang masih lolos?", [COAG, DAF], 85, 2, true),
  run("J. Stripping amonia lalu DTRO",
      "rute analisis Bantargebang terdahulu", [COAG, DAF, UASB, STRIP_UP, STRIP, NEUT], 85),
  run("K. H + konsentrat pass-2 dikembalikan",
      "air bersih tidak dibuang", [COAG, DAF, UASB], 85, 2, true, true),
  run("L. I + konsentrat pass-2 dikembalikan",
      "tanpa biologi, air bersih tidak dibuang", [COAG, DAF], 85, 2, true, true),
  run("M. K + trim pH  <- KANDIDAT",
      "lengkap: UASB, 2 pass, konsentrat balik, pH", [COAG, DAF, UASB], 85, 2, true, true, true),
  run("N. L + trim pH",
      "sama tanpa UASB", [COAG, DAF], 85, 2, true, true, true),
];

/* ------------------------------------------------------- concentrate maths */

// Cheapest OPEX among the compliant options is not the right test on its own:
// the model does not price concentrate disposal, and that is the largest single
// operating cost on a leachate plant. Rank on the concentrate COD load, which
// is what the disposal contract is actually written against.
const compliant = cases.filter((c) => c.fails.length === 0);
const best = compliant.length
  ? compliant.reduce((a, b) =>
      (b.concentrateC.COD * b.concentrate_m3d < a.concentrateC.COD * a.concentrate_m3d ? b : a))
  : cases[2];
const FEED_TDS = feed.c.TDS ?? 0;
const saltLoad_t_d = (FEED_TDS * Q * 24) / 1e6;
const saltOutPermeate_t_d = (best.effluent.TDS * best.product_m3d) / 1e6;
const saltToAccount_t_d = saltLoad_t_d - saltOutPermeate_t_d;

// Bekasi: rainfall clearly exceeds pan evaporation for much of the year. Even
// on a generous net figure the pond area is the thing to check.
const pondCases = [400, 800, 1200].map((netMmY) => ({
  netMmY,
  area_ha: ((best.concentrate_m3d * 365) / (netMmY / 1000)) / 10000,
}));

/* ------------------------------------------------------------------ report */

const L: string[] = [];
const f = (v: number, dp = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: dp, maximumFractionDigits: dp });

L.push("BANTARGEBANG IPAS 2 — PERBANDINGAN SUSUNAN");
L.push("=".repeat(118));
L.push("umpan 1.200 m3/hari, COD 35.000, NH3-N 2.200, TDS 20.000, lahan 20.000 m2");
L.push("");
L.push("OPSI".padEnd(42) + "daya".padStart(8) + "kWh/m3".padStart(8) + "CAPEX".padStart(11) +
  "OPEX/m3".padStart(9) + "produk".padStart(8) + "konsen".padStart(8) + "lahan".padStart(8) + "  % situs");
L.push("-".repeat(118));
for (const c of cases) {
  L.push(c.name.padEnd(42) + f(c.power_kW).padStart(8) + f(c.sec, 2).padStart(8) +
    f(c.capex).padStart(11) + f(c.opexPerM3, 2).padStart(9) +
    f(c.product_m3d).padStart(8) + f(c.concentrate_m3d).padStart(8) +
    f(c.area_m2).padStart(8) + `  ${f(c.areaPct, 1)} %`);
}
L.push("");
L.push("EFLUEN terhadap Permen LHK P.59/2016");
L.push("-".repeat(118));
L.push("OPSI".padEnd(42) + "COD".padStart(9) + "BOD".padStart(8) + "TSS".padStart(7) +
  "TN".padStart(8) + "TDS".padStart(9) + "pH".padStart(7) + "   gagal");
for (const c of cases) {
  L.push(c.name.padEnd(42) + f(c.effluent.COD, 1).padStart(9) + f(c.effluent.BOD, 1).padStart(8) +
    f(c.effluent.TSS, 1).padStart(7) + f(c.effluent.TN, 1).padStart(8) +
    f(c.effluent.TDS, 1).padStart(9) + f(c.effluent.pH, 2).padStart(7) +
    "   " + (c.fails.length ? c.fails.join("; ") : "LOLOS"));
}

L.push("");
L.push("KONSENTRAT — yang menentukan biaya pembuangannya");
L.push("-".repeat(118));
L.push("OPSI".padEnd(42) + "m3/hari".padStart(9) + "COD".padStart(10) + "TN".padStart(9) + "TDS".padStart(10) + "   beban COD ton/hari");
for (const c of cases) {
  L.push(c.name.padEnd(42) + f(c.concentrate_m3d).padStart(9) +
    f(c.concentrateC.COD).padStart(10) + f(c.concentrateC.TN).padStart(9) +
    f(c.concentrateC.TDS).padStart(10) +
    `   ${f((c.concentrateC.COD * c.concentrate_m3d) / 1e6, 2)}`);
}

L.push("");
L.push("RINCIAN OPSI TERPILIH — " + best.name);
L.push("-".repeat(118));
L.push("unit".padEnd(36) + "daya kW".padStart(10) + "CAPEX USD".padStart(13) + "lahan m2".padStart(10));
for (const u of best.units) {
  L.push(u.label.padEnd(36) + f(u.kW, 1).padStart(10) + f(u.capex).padStart(13) + f(u.area).padStart(10));
}
L.push("TOTAL".padEnd(36) + f(best.power_kW, 1).padStart(10) + f(best.capex).padStart(13) + f(best.area_m2).padStart(10));

L.push("");
L.push("KE MANA GARAMNYA PERGI — neraca yang menentukan nasib konsentrat");
L.push("-".repeat(118));
L.push(`Garam masuk bersama lindi     : ${f(saltLoad_t_d, 1)} ton/hari (TDS ${f(FEED_TDS)} mg/L x 1.200 m3/hari)`);
L.push(`Keluar bersama permeat        : ${f(saltOutPermeate_t_d, 2)} ton/hari`);
L.push(`Harus keluar lewat jalan lain : ${f(saltToAccount_t_d, 1)} ton/hari`);
L.push("");
L.push("Opsi 1 — resirkulasi konsentrat ke timbunan sampah:");
L.push("  Air keluar sebagai permeat, garam kembali ke timbunan dan terlarut lagi di lindi berikutnya.");
L.push("  Timbunan bukan tempat pembuangan garam; ia tempat penyimpanan. Neraca tunak tidak ada:");
L.push(`  ${f(saltToAccount_t_d, 1)} ton/hari menumpuk, konsentrasi umpan naik, tekanan DTRO naik, sampai berhenti.`);
L.push("  Ini menunda, bukan membuang.");
L.push("");
L.push("Opsi 2 — kolam evaporasi surya:");
L.push(`  Konsentrat ${f(best.concentrate_m3d)} m3/hari = ${f(best.concentrate_m3d * 365)} m3/tahun harus menguap.`);
for (const pc of pondCases) {
  L.push(`  Evaporasi neto ${pc.netMmY} mm/tahun -> luas kolam ${f(pc.area_ha, 1)} ha` +
    (pc.area_ha > 1.7 ? `  — lahan tersisa 1,7 ha, kurang ${f(pc.area_ha / 1.7, 1)}x` : "  — muat"));
}
L.push("  Dan di Bekasi curah hujan ~1.800-2.000 mm/tahun terhadap evaporasi panci ~1.500-1.800.");
L.push("  Evaporasi neto kolam terbuka mendekati nol atau negatif: kolamnya menambah air, bukan membuangnya.");

const text = L.join("\n");
console.log(text);
writeFileSync("scripts/out/bantargebang-optimal.txt", text);
writeFileSync("scripts/out/bantargebang-optimal.json", JSON.stringify({
  generated: new Date().toISOString(), cases,
  saltLoad_t_d, saltOutPermeate_t_d, saltToAccount_t_d, pondCases,
}, null, 2));
