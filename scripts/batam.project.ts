import { writeFileSync } from "fs";
import { DesignBasis, Flowsheet, Params } from "../src/lib/engine/types";
import { simulateForProduct } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { checkCompliance, checkedRows, conductivityFromIons, langelierIndex } from "../src/lib/engine/diagnostics";
import { alkalinityAsCaCO3, hardnessAsCaCO3 } from "../src/lib/engine/stream";
import { feedPreset } from "../src/lib/engine/templates";
import type { Project, StudyRun } from "../src/lib/store/types";

/**
 * Batam SWRO for a data centre, 300 L/s, against the CCEPC grades S and D.
 *
 * Writes a HydroDesk project file (the same structure the Export button makes)
 * with the flowsheets built and solved by the engine, so each run opens in the
 * app with its canvas, stream table and compliance live.
 *
 * The flowsheet follows the process diagram: intake and screening, coagulation
 * straight onto the multimedia filter (no sedimentation), self-cleaning filter,
 * UF, cartridge with antiscalant and SBS, SWRO first pass with HP pump and ERD,
 * a brackish-water second pass on part of the permeate with caustic ahead of it
 * and its concentrate returned to the UF filtrate, remineralisation, and NaOCl
 * to the product tank. Drainage pit and brine both go to sea.
 *
 * Two membrane cases: nominal (new elements, 25 °C) and design (salt passage 1.6
 * times nominal, about 1.3 for 30 °C times 1.25 for three years in service). The
 * second pass has to be sized on the design case; on nominal it is undersized
 * for most of the plant's life.
 */

const Q = 300 * 3.6; // 300 L/s, m3/h
const FX = 16300;
const NOMINAL = 1.0;
const DESIGN = 1.6;
const feed = feedPreset("seawater-batam");

interface Spec { type: string; label: string; params?: Params; x: number; y: number }
interface Remin { hardnessAdd: number; targetPH: number; co2ExcessPct: number }

function build(specs: Spec[], links: [number, string, number][], standard: string): Flowsheet {
  const nodes = specs.map((sp, i) => ({
    id: `n${i}-${sp.type}`, type: sp.type, label: sp.label,
    position: { x: sp.x, y: sp.y },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, h, b], i) => ({
    id: `e${i}`, source: nodes[a].id, sourceHandle: h, target: nodes[b].id, targetHandle: "in",
  }));
  return {
    nodes, edges, feed: { ...feed },
    basis: {
      standard, productSpecKey: "process", designMode: "product-driven", targetProductFlow: Q,
      operatingHoursPerYear: 8400, designMarginPct: 10, electricityUSDPerKWh: 0.09, extra: [],
    } as DesignBasis,
  };
}

/**
 * The process diagram. `pass2Pct` is the share of SWRO permeate sent through the
 * second pass; the diagram's 50 % bypass is pass2Pct = 50.
 *
 * Caustic ahead of the second pass goes to pH 10. There the CO2 the first pass
 * let through is bicarbonate and is rejected, instead of passing and turning
 * into alkalinity when it is neutralised later; and boron is borate, which the
 * membrane rejects, instead of boric acid, which it does not.
 */
function fsProcess(pass2Pct: number, rm: Remin, passage: number, standard: string): Flowsheet {
  const s: Spec[] = [
    { type: "intake", label: "Seawater Intake + Screening", params: { cl2Dose: 0, headM: 25 }, x: 0, y: 200 },
    // In-line coagulation onto the filter: a light PAC dose, no settling.
    { type: "coagfloc", label: "Coagulation & Flocculation", params: { coagDose: 10 }, x: 200, y: 200 },
    { type: "mmf", label: "Multimedia Filter", params: { backwashPct: 4 }, x: 400, y: 200 },
    { type: "selfclean", label: "Self-cleaning Filter", x: 600, y: 200 },
    { type: "uf", label: "UF", x: 800, y: 200 },
    { type: "cartridge", label: "Cartridge Filter (antiscalant + SBS)", x: 1000, y: 340 },
    {
      type: "swro", label: "SWRO 1st pass (HP pump + ERD)",
      params: { recovery: 45, erd: true, antiscalantDose: 3, smbsDose: 2, passageFactor: passage }, x: 800, y: 340,
    },
    { type: "splitter", label: "Permeate split (A = 2nd pass, B = bypass)", params: { fractionA: pass2Pct }, x: 600, y: 340 },
    { type: "phadjust", label: "NaOH to pH 10", params: { targetPH: 10, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 2 }, x: 500, y: 460 },
    { type: "ro", label: "2nd Pass RO (BWRO)", params: { recovery: 90, erd: false, antiscalantDose: 0, passageFactor: passage }, x: 400, y: 340 },
    {
      type: "remin", label: "Remineralization (lime + CO2)",
      params: { method: "lime", ...rm, turbidityAddNTU: 0.2, contactMin: 5 }, x: 200, y: 340,
    },
    { type: "disinfection", label: "NaOCl dosing", params: { method: "naocl", dose: 1.0, contactMin: 30 }, x: 100, y: 460 },
    { type: "producttank", label: "Product water tank", x: 0, y: 340 },
    { type: "product", label: "Product water to data centre (300 L/s)", params: { name: "process" }, x: -200, y: 340 },
    { type: "eqtank", label: "Drainage collection pit", params: { hrtH: 4 }, x: 400, y: 40 },
    { type: "waste", label: "Discharge to sea", params: { name: "reject" }, x: 700, y: 40 },
  ];
  return build(s, [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5], [5, "out", 6],
    [6, "permeate", 7], [7, "a", 8], [8, "out", 9], [7, "b", 10], [9, "permeate", 10],
    // Second-pass concentrate back to the UF filtrate, ahead of the cartridge.
    [9, "concentrate", 5],
    [10, "out", 11], [11, "out", 12], [12, "out", 13],
    [2, "backwash", 14], [3, "flush", 14], [4, "backwash", 14], [14, "out", 15],
    [6, "concentrate", 15],
  ], standard);
}

/* ------------------------------------------------------------ evaluate */

function solve(fs: Flowsheet) {
  const sol = simulateForProduct(fs, Q);
  fs.feed = { ...fs.feed, flow: sol.feedFlow };
  return sol;
}
const productOf = (sol: ReturnType<typeof solve>) => sol.result.productStreams[0].stream;

/** Modelled limits met, with margin where the vendor projection will move the number. */
function score(fs: Flowsheet, std: string) {
  const sol = solve(fs);
  const p = productOf(sol);
  const rows = checkedRows(checkCompliance(p, std));
  const fails = rows.filter((r) => !r.pass).length;
  const get = (prefix: string) => rows.find((r) => r.label.startsWith(prefix))!;
  const lim = std === "dc-s"
    ? { cl: 100, tds: 250, ec: 600, h: [60, 120], a: [60, 100] }
    : { cl: 40, tds: 150, ec: 350, h: [40, 80], a: [40, 80] };
  const lsi = langelierIndex(p);
  const hard = hardnessAsCaCO3(p);
  const alk = alkalinityAsCaCO3(p);
  const robust = sol.converged && fails === 0
    && get("Chloride").actual <= 0.85 * lim.cl
    && get("TDS").actual <= 0.9 * lim.tds
    && get("Conductivity").actual <= 0.9 * lim.ec
    && lsi >= 0.05 && lsi <= 0.45
    && hard >= lim.h[0] + 2 && hard <= lim.h[1] - 2 && alk >= lim.a[0] + 2 && alk <= lim.a[1] - 2
    && p.pH <= 8.17;
  return { fails, robust, lsi };
}

const reminGrid = (std: string): Remin[] => {
  const out: Remin[] = [];
  for (const hardnessAdd of std === "dc-s" ? [70, 75, 80, 85, 90, 95] : [56, 60, 64, 68, 72])
    for (const targetPH of [8.0, 8.05, 8.1, 8.15])
      for (const co2ExcessPct of [0, 5, 10]) out.push({ hardnessAdd, targetPH, co2ExcessPct });
  return out;
};

/** Best remineralisation for a fixed second-pass share: robust first, then fewest failures, then LSI nearest 0.2. */
function bestRemin(pass2: number, passage: number, std: string) {
  let best: { rm: Remin; fails: number; robust: boolean; lsi: number } | null = null;
  for (const rm of reminGrid(std)) {
    const sc = score(fsProcess(pass2, rm, passage, std), std);
    const better = !best
      || (sc.robust && !best.robust)
      || (sc.robust === best.robust && sc.fails < best.fails)
      || (sc.robust === best.robust && sc.fails === best.fails && Math.abs(sc.lsi - 0.2) < Math.abs(best.lsi - 0.2));
    if (better) best = { rm, ...sc };
  }
  return best!;
}

/** Smallest second-pass share, in steps of 5 %, that meets the grade with margin. */
function minimumPass2(passage: number, std: string) {
  for (let pass2 = 0; pass2 <= 100; pass2 += 5) {
    const b = bestRemin(pass2, passage, std);
    if (b.robust) return { pass2, rm: b.rm };
  }
  throw new Error(`no design meets ${std}`);
}

/* ------------------------------------------------------------- assemble */

const fmt = (v: number, dp = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: dp, maximumFractionDigits: dp });
let seq = 0;
const rid = () => `batam-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const gradeName = (std: string) => (std === "dc-s" ? "Grade S" : "Grade D");

function describe(fs: Flowsheet, sol: ReturnType<typeof solve>) {
  const p = productOf(sol);
  const s = sol.result.summary;
  const swro = sol.result.nodes.find((n) => n.type === "swro")!;
  const perm = swro.outlets.permeate;
  // Boron is not a component, so it is estimated rather than modelled: 4.41 mg/L
  // in the feed, 85-90 % SWRO rejection on the log-mean concentration, and about
  // 97 % in a second pass run at pH 10, where boron is borate.
  const Y = Number(fs.nodes.find((n) => n.type === "swro")!.params.recovery ?? 45) / 100;
  const cfLm = Math.log(1 / (1 - Y)) / Y;
  const f2 = Number(fs.nodes.find((n) => n.type === "splitter")!.params.fractionA) / 100;
  const boron = (rej: number) => {
    const b1 = 4.41 * (1 - rej) * cfLm;
    return (1 - f2) * b1 + f2 * b1 * 0.03 * (Math.log(10) / 0.9);
  };
  const verdicts = ["dc-s", "dc-d"].map((std) => {
    const fails = checkedRows(checkCompliance(p, std)).filter((r) => !r.pass);
    return fails.length
      ? `${gradeName(std)} GAGAL pada ${fails.map((f) => `${f.label} ${f.actualText}`).join(", ")}`
      : `${gradeName(std)} terpenuhi untuk semua parameter yang dimodelkan`;
  });
  const tds180 = checkCompliance(p, "dc-s").find((r) => r.label.startsWith("TDS"))!.actual;
  return `Produk ${fmt(s.productFlow)} m3/jam (300 L/s) dari air laut ${fmt(sol.feedFlow)} m3/jam, recovery keseluruhan ${fmt(s.recoveryPct, 1)} %. `
    + `Permeat SWRO: Cl ${fmt(perm.c.Cl)} mg/L, jumlah ion ${fmt(perm.c.TDS)} mg/L. `
    + `Produk: pH ${fmt(p.pH, 2)}, TDS (180 °C) ${fmt(tds180)}, Cl ${fmt(p.c.Cl, 1)}, konduktivitas ${fmt(conductivityFromIons(p))} µS/cm, `
    + `kesadahan ${fmt(hardnessAsCaCO3(p))}, alkalinitas ${fmt(alkalinityAsCaCO3(p))} mg/L CaCO3, LSI ${fmt(langelierIndex(p), 2)}. `
    + `${verdicts.join("; ")}. `
    + `Daya ${fmt(s.totalPowerKW)} kW (${fmt(s.secKWhPerM3, 2)} kWh/m3). `
    + `CAPEX peralatan USD ${fmt(s.capexUSD / 1e6, 2)} juta = Rp ${fmt((s.capexUSD * FX) / 1e9, 1)} miliar (angka screening). `
    + `OPEX Rp ${fmt(s.opexUSDPerM3 * FX)}/m3. `
    + `Belum dimodelkan, harus dibuktikan terpisah: boron (umpan ~4,4 mg/L; perkiraan di produk ${fmt(boron(0.9), 2)}–${fmt(boron(0.85), 2)} mg/L, batas 1,0), klor bebas di titik serah, dan bakteri.`;
}

function makeRun(name: string, fs: Flowsheet, std: string, lead: string): StudyRun {
  const sol = solve(fs);
  const fails = checkedRows(checkCompliance(productOf(sol), std)).filter((r) => !r.pass);
  return {
    id: rid(), name, createdAt: new Date().toISOString(),
    flowsheet: fs, result: sol.result,
    verdict: fails.length ? "not-feasible" : "conditional",
    engineerNote: `${lead} ${describe(fs, sol)}`,
  };
}

const rmText = (rm: Remin) =>
  `remineralisasi kapur + CO2 menambah kesadahan ${rm.hardnessAdd} mg/L CaCO3, CO2 berlebih ${rm.co2ExcessPct} %, trim NaOH ke pH ${rm.targetPH}`;

// The diagram as drawn: 50 % through the second pass. Remineralisation tuned for Grade S.
const asDrawnNominal = bestRemin(50, NOMINAL, "dc-s");
const asDrawnDesign = bestRemin(50, DESIGN, "dc-s");
const dS = minimumPass2(DESIGN, "dc-s");
const dD = minimumPass2(DESIGN, "dc-d");
// What the nominal case would have suggested, to show the size of the trap.
const dSnom = minimumPass2(NOMINAL, "dc-s");
const dDnom = minimumPass2(NOMINAL, "dc-d");

const runs: StudyRun[] = [
  makeRun("A. Sesuai diagram (bypass 50 %) — membran nominal", fsProcess(50, asDrawnNominal.rm, NOMINAL, "dc-s"), "dc-s",
    `Diagram apa adanya, 50 % permeat SWRO lewat pass kedua (BWRO, recovery 90 %, NaOH ke pH 10), 50 % bypass. Membran baru pada 25 °C. ${rmText(asDrawnNominal.rm)}.`),
  makeRun("B. Sesuai diagram (bypass 50 %) — kasus desain 30 °C, 3 tahun", fsProcess(50, asDrawnDesign.rm, DESIGN, "dc-s"), "dc-s",
    `Diagram yang sama pada kasus desain: salt passage 1,6 × nominal (30 °C, elemen umur 3 tahun). ${rmText(asDrawnDesign.rm)}.`),
  makeRun(`C. Grade S — pass 2 ${dS.pass2} % (bypass ${100 - dS.pass2} %)`, fsProcess(dS.pass2, dS.rm, DESIGN, "dc-s"), "dc-s",
    `Porsi pass kedua terkecil yang memenuhi Grade S dengan margin pada kasus desain (Cl ≤ 85 %, TDS dan konduktivitas ≤ 90 % batas, LSI 0,05–0,45); pada membran nominal cukup ${dSnom.pass2} %. ${rmText(dS.rm)}.`),
  makeRun(`D. Grade D — pass 2 ${dD.pass2} % (bypass ${100 - dD.pass2} %)`, fsProcess(dD.pass2, dD.rm, DESIGN, "dc-d"), "dc-d",
    `Porsi pass kedua terkecil yang memenuhi Grade D dengan margin pada kasus desain; pada membran nominal cukup ${dDnom.pass2} %. ${rmText(dD.rm)}.`),
];

const now = new Date().toISOString();
const project: Project = {
  id: `batam-${Date.now().toString(36)}`,
  name: "Batam SWRO — data centre 300 L/s (Grade S & D)",
  client: "Data centre, Batam",
  location: "Batam",
  kind: "Desalination",
  status: "simulation",
  capacityNote: "300 L/s produk (25.920 m³/hari) · air laut Batam · CCEPC Grade S dan Grade D di titik serah",
  marketingContact: "",
  createdAt: now, updatedAt: now,
  notes: [
    "Air baku: preset \"Seawater — Batam\". Yang terukur hanya pH 7,78, Cl 18.994, F 1,72, COD 79,9 dan NH3-N 0,36 mg/L (Appendix 1 §10.2.3); ion mayor lainnya diskalakan dari Cl dengan komposisi air laut referensi. Turbiditas, TSS, TOC, silika, besi dan boron belum dianalisis; TSS 100 mg/L adalah batas atas asumsi spesifikasi.",
    "",
    "Proses mengikuti diagram: intake + screening → koagulasi-flokulasi → MMF → self-cleaning filter → UF → cartridge (antiskalan + SBS) → HP pump + ERD → SWRO pass 1 → sebagian ke pass 2 (BWRO, NaOH di depannya), sisanya bypass → remineralisasi → tangki produk (NaOCl). Konsentrat pass 2 kembali ke air produk UF. Drainage pit dan brine ke laut.",
    "",
    "Pass kedua memakai BWRO, bukan SWRO: umpannya permeat SWRO (~330 mg/L, tekanan osmotik ~0,25 bar), jadi elemen brackish pada 8–15 bar dan flux 25–35 LMH sudah cukup; elemen SWRO hanya menambah tekanan dan energi.",
    "",
    "Kasus desain membran: salt passage 1,6 × nominal (parameter Salt passage factor), kira-kira 1,3 untuk 30 °C terhadap 25 °C dikali 1,25 untuk elemen umur 3 tahun. Porsi pass kedua harus dikonfirmasi dengan proyeksi vendor (ROSA/WAVE/IMSDesign) pada kondisi yang sama.",
    "",
    "Diagram tidak punya sedimentasi: koagulasi langsung ke MMF (filtrasi langsung). Ini wajar hanya untuk air laut yang jernih (kekeruhan di bawah ~10 NTU, TSS beberapa mg/L). Dengan TSS 100 mg/L — angka asumsi spesifikasi — MMF akan dicuci terus-menerus. Turbiditas/TSS terukur menentukan perlu tidaknya sedimentasi atau DAF.",
    "",
    "Risiko terbuka: boron (≤ 1,0 mg/L) tidak dimodelkan; perkiraan ada di catatan tiap run. NaOH ke pH 10 di depan pass kedua penting untuk boron. Klor bebas di titik serah (0,2–0,5 mg/L) dan bakteri dibuktikan dengan desain dosing dan sampling.",
  ].join("\n"),
  runs,
};

const payload = { version: 1, exportedAt: now, projects: [project] };
const file = "scripts/out/batam-swro-hydrodesk-project.json";
writeFileSync(file, JSON.stringify(payload, null, 2));

console.log(`Ditulis: ${file}`);
console.log(`Diagram 50 %: nominal ${JSON.stringify(asDrawnNominal)}; desain ${JSON.stringify(asDrawnDesign)}`);
console.log(`Grade S: pass 2 ${dS.pass2} % (nominal ${dSnom.pass2} %), ${JSON.stringify(dS.rm)}`);
console.log(`Grade D: pass 2 ${dD.pass2} % (nominal ${dDnom.pass2} %), ${JSON.stringify(dD.rm)}\n`);
for (const r of runs) console.log(`${r.name}  [${r.verdict}]\n  ${r.engineerNote}\n`);
