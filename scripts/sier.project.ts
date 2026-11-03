import { writeFileSync } from "fs";
import { DesignBasis, FeedSpec, Flowsheet, Params } from "../src/lib/engine/types";
import { simulate } from "../src/lib/engine/solver";
import { defaultParams } from "../src/lib/engine/units";
import { checkCompliance } from "../src/lib/engine/diagnostics";
import { alkalinityAsCaCO3, hardnessAsCaCO3 } from "../src/lib/engine/stream";
import type { Project, StudyRun } from "../src/lib/store/types";

/**
 * Builds the SIER study as a HydroDesk project file.
 *
 * Projects live in each browser's IndexedDB, so a run made in one browser is
 * invisible in another. The import path is the way across: this writes the same
 * structure the Export button produces, with the flowsheets built and solved by
 * the engine itself rather than described in prose, so the runs open in the app
 * with their canvas, stream table, compliance and exports all live.
 */

const Q = 205;
const FX = 16300;

const feed: FeedSpec = {
  name: "Waduk SIER — analisis terbatas (TSS 20, Alk 130, TDS 365, 15 NTU, pH 8,5)",
  flow: Q, T: 28, pH: 8.5, sourceType: "river",
  c: {
    TDS: 365, TSS: 20, TOC: 5,
    Ca: 55, Mg: 15, Na: 42, K: 6,
    HCO3: 158, SO4: 45, Cl: 40, NO3: 3, SiO2: 12,
    Fe: 0.3, Mn: 0.15, BOD: 3, COD: 15,
  },
  turbidityNTU: 15, alkalinityAsCaCO3: 130,
};

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
    basis: {
      standard: "permenkes", productSpecKey: "process", designMode: "feed-driven",
      operatingHoursPerYear: 8000, designMarginPct: 10, electricityUSDPerKWh: 0.09, extra: [],
    } as DesignBasis,
  };
}

const INTAKE: Spec = { type: "intake", label: "Intake & Screen",
  params: { headM: 30, pumpEff: 0.75, screenRemovalTSS: 3, electrochlorination: false, cl2Dose: 1.5 }, x: 140, y: 220 };
const COAG: Spec = { type: "coagfloc", label: "Koagulasi-Flokulasi (PAC)",
  params: { coagDose: 25, polymerDose: 0.3, targetPH: 7.2, mixTimeMin: 1, flocTimeMin: 18 }, x: 280, y: 220 };
const CLAR: Spec = { type: "clarifier", label: "Lamella Clarifier",
  params: { riseRate: 6, tssRemoval: 92, sludgeFlowPct: 2, codRemoval: 35, trains: 2 }, x: 420, y: 220 };
const MMF = (x: number): Spec => ({ type: "mmf", label: "Filter Dual-Media",
  params: { rate: 10, backwashPct: 3.5, tssRemoval: 88 }, x, y: 220 });
const RECARB = (x: number): Spec => ({ type: "phadjust", label: "Netralisasi pH (H2SO4)",
  params: { targetPH: 7.6, reagentDown: "h2so4", codCoPrecipPct: 0, hrtMin: 10 }, x, y: 220 });
const PTANK = (x: number): Spec => ({ type: "producttank", label: "Tangki Produk",
  params: { hrtH: 4, outletCount: 1 }, x, y: 220 });
const DPUMP = (x: number): Spec => ({ type: "pump", label: "Pompa Distribusi ke SIER",
  params: { headM: 45, pumpEff: 0.75, standby: 1 }, x, y: 220 });
const OUT = (x: number): Spec => ({ type: "outfall", label: "Produk ke SIER", x, y: 220 });
const THK: Spec = { type: "thickener", label: "Pengental Lumpur", x: 560, y: 470 };
const FP: Spec = { type: "dewatering", label: "Screw Press", params: { cakeDryness: 22 }, x: 700, y: 470 };
const CAKE: Spec = { type: "waste", label: "Cake ke TPA", params: { name: "sludge" }, x: 840, y: 470 };
const REJ = (x: number): Spec => ({ type: "waste", label: "Buangan", params: { name: "reject" }, x, y: 560 });

/* --------------------------------------------------------- the flowsheets */

/** Baseline: no TDS removal at all, to show what the plant does without it. */
function fsConventional(): Flowsheet {
  const s: Spec[] = [
    { type: "feedsource", label: "Waduk", x: 0, y: 220 }, INTAKE, COAG, CLAR, MMF(560),
    PTANK(700), DPUMP(840), OUT(980), THK, FP, CAKE, REJ(700),
  ];
  return build(s, [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4],
    [4, "out", 5], [5, "out", 6], [6, "out", 7],
    [3, "sludge", 8], [4, "backwash", 8],
    [8, "thickened", 9], [8, "supernatant", 11], [9, "cake", 10], [9, "filtrate", 11],
  ]);
}

/**
 * Split softening. Part of the clarified water goes through the pellet reactor
 * and the rest bypasses it, so the share sets the dissolved solids while the
 * unsoftened fraction keeps the alkalinity the distribution network needs.
 */
function fsSplit(sharePct: number): Flowsheet {
  const s: Spec[] = [
    { type: "feedsource", label: "Waduk", x: 0, y: 220 }, INTAKE, COAG, CLAR,
    { type: "rawtank", label: "Tangki Air Jernih (2 jalur)",
      params: { hrtH: 1, outletCount: 2, split2: sharePct, lossPct: 0 }, x: 560, y: 220 },
    { type: "limesoft", label: `Pellet Softening (${sharePct} % aliran)`,
      params: { reactor: "pellet", reagent: "lime", targetHardness: 60, residualFloor: 50,
                excessPct: 10, upflowMH: 80, seedDose: 12, solidsPct: 90, carryoverPct: 8 }, x: 700, y: 340 },
    { type: "producttank", label: "Tangki Produk + Blending", params: { hrtH: 4, outletCount: 1 }, x: 840, y: 220 },
    MMF(980), DPUMP(1120), OUT(1260), THK, FP, CAKE, REJ(840),
  ];
  return build(s, [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4],
    [4, "out1", 6], [4, "out2", 5], [5, "out", 6],
    [6, "out", 7], [7, "out", 8], [8, "out", 9],
    [3, "sludge", 10], [7, "backwash", 10], [5, "solids", 12],
    [10, "thickened", 11], [10, "supernatant", 13], [11, "cake", 12], [11, "filtrate", 13],
  ]);
}

/** Softening the whole flow, which reaches the TDS target and strips the buffer. */
function fsFull(target: number): Flowsheet {
  const s: Spec[] = [
    { type: "feedsource", label: "Waduk", x: 0, y: 220 }, INTAKE, COAG, CLAR,
    { type: "limesoft", label: `Pellet Softening (target ${target})`,
      params: { reactor: "pellet", reagent: "lime", targetHardness: target, residualFloor: 50,
                excessPct: 10, upflowMH: 80, seedDose: 12, solidsPct: 90, carryoverPct: 8 }, x: 560, y: 220 },
    RECARB(700), MMF(840), PTANK(980), DPUMP(1120), OUT(1260), THK, FP, CAKE, REJ(840),
  ];
  return build(s, [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5],
    [5, "out", 6], [6, "out", 7], [7, "out", 8], [8, "out", 9],
    [3, "sludge", 10], [6, "backwash", 10], [4, "solids", 12],
    [10, "thickened", 11], [10, "supernatant", 13], [11, "cake", 12], [11, "filtrate", 13],
  ]);
}

/** The membrane comparison, so the cost difference is on the record. */
function fsNF(): Flowsheet {
  const s: Spec[] = [
    { type: "feedsource", label: "Waduk", x: 0, y: 220 }, INTAKE, COAG, CLAR, MMF(560),
    { type: "cartridge", label: "Cartridge 5 µm", params: { micron: 5 }, x: 700, y: 220 },
    { type: "nf", label: "Nanofiltrasi (recovery 85 %)", params: { recovery: 85, flux: 20 }, x: 840, y: 220 },
    { type: "phadjust", label: "Trim pH Produk (NaOH)",
      params: { targetPH: 7.4, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5 }, x: 980, y: 220 },
    PTANK(1120), DPUMP(1260), OUT(1400), THK, FP, CAKE, REJ(980),
  ];
  return build(s, [
    [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5],
    [5, "out", 6], [6, "permeate", 7], [7, "out", 8], [8, "out", 9], [9, "out", 10],
    [3, "sludge", 11], [4, "backwash", 11], [6, "concentrate", 14],
    [11, "thickened", 12], [11, "supernatant", 14], [12, "cake", 13], [12, "filtrate", 14],
  ]);
}

/* ------------------------------------------------------------- assemble */

const round = (v: number, dp = 1) => (Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : 0);
let seq = 0;
const rid = () => `sier-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function makeRun(name: string, fs: Flowsheet, note: (r: ReturnType<typeof simulate>) => string): StudyRun {
  const result = simulate(fs);
  const p = result.productStreams[0]?.stream;
  const comp = p ? checkCompliance(p, "permenkes") : [];
  const fails = comp.filter((c) => !c.pass && !c.outsideScope);
  const opexRp = Math.round(result.summary.opexUSDPerM3 * FX);
  const verdict: StudyRun["verdict"] =
    fails.length === 0 && opexRp <= 2500 ? "feasible"
      : fails.length === 0 ? "conditional" : "not-feasible";
  return {
    id: rid(), name, createdAt: new Date().toISOString(),
    flowsheet: fs, result, verdict, engineerNote: note(result),
  };
}

const summary = (r: ReturnType<typeof simulate>) => {
  const p = r.productStreams[0]?.stream;
  const s = r.summary;
  return `TDS ${round(p?.c.TDS ?? 0)} mg/L · kesadahan ${round(hardnessAsCaCO3(p!), 0)} · alkalinitas ${round(alkalinityAsCaCO3(p!), 0)} mg/L CaCO3 · pH ${round(p?.pH ?? 0, 2)} · ${round(p?.extras.turbidityNTU ?? 0, 2)} NTU. `
    + `Produk ${round(s.productFlow)} m3/jam, recovery ${round(s.recoveryPct)} %. `
    + `Daya ${round(s.totalPowerKW)} kW (${round(s.secKWhPerM3, 3)} kWh/m3). `
    + `CAPEX peralatan USD ${Math.round(s.capexUSD).toLocaleString("en-US")} = Rp ${round(s.capexUSD * FX / 1e9, 2)} miliar. `
    + `OPEX Rp ${Math.round(s.opexUSDPerM3 * FX).toLocaleString("id-ID")}/m3 terhadap plafon Rp 2.500.`;
};

const runs: StudyRun[] = [
  makeRun("0. Konvensional saja — pembanding", fsConventional(),
    (r) => `Pembanding tanpa penurun TDS. ${summary(r)} GAGAL target: TDS tidak berkurang sama sekali melewati koagulasi, clarifier dan filter, karena ketiganya menyingkirkan padatan tersuspensi dan bukan terlarut. Ini yang membuktikan sebuah tahap penurun TDS memang diperlukan.`),
  makeRun("1. Pellet softening split 50 %", fsSplit(50),
    (r) => `Setengah aliran lewat reaktor pelet, setengahnya dicampur balik. ${summary(r)} Alkalinitas tetap sehat karena separuh air tidak pernah dilunakkan.`),
  makeRun("2. Pellet softening split 60 % — DIREKOMENDASIKAN", fsSplit(60),
    (r) => `Pilihan yang disarankan. ${summary(r)} Margin TDS terhadap 300 cukup untuk variasi musim, alkalinitas masih di atas 45 mg/L CaCO3 sehingga air tidak agresif terhadap pipa, dan share-nya bisa dinaikkan kalau TDS air baku naik di musim kemarau — mekanisme yang sama dengan pembagian train RO di Sagara.`),
  makeRun("3. Pellet softening seluruh aliran, target 150", fsFull(150),
    (r) => `Melunakkan semua aliran. ${summary(r)} PERHATIAN: alkalinitas tinggal sekitar 11 mg/L CaCO3. Air itu agresif dan akan memakan pipa distribusi. TDS-nya bagus, tapi tanpa stabilisasi tambahan konfigurasi ini tidak layak dipakai — inilah alasan split lebih baik.`),
  makeRun("4. Nanofiltrasi penuh — pembanding membran", fsNF(),
    (r) => `Rute membran untuk pembanding. ${summary(r)} CAPEX lebih dari dua kali lipat rute pelunakan dan OPEX menembus plafon Rp 2.500. Menghasilkan konsentrat yang harus dibuang, sedangkan pelunakan menghasilkan pelet kering.`),
];

const now = new Date().toISOString();
const project: Project = {
  id: `sier-${Date.now().toString(36)}`,
  name: "SIER — WTP 205 m³/jam (studi penurunan TDS)",
  client: "Kawasan Industri SIER",
  location: "Surabaya",
  kind: "WTP",
  status: "simulation",
  capacityNote: "205 m³/jam air baku waduk · target TDS < 300 mg/L · OPEX maks Rp 2.500/m³ · CAPEX serendahnya",
  marketingContact: "",
  createdAt: now, updatedAt: now,
  notes: [
    "Analisis air baku terbatas: TSS 20 mg/L, alkalinitas 130 mg/L CaCO3, TDS 365 mg/L, kekeruhan 15 NTU, pH 8,5, warna hijau.",
    "",
    "ASUMSI YANG MENENTUKAN SELURUH STUDI INI: pecahan ion tidak diukur. Ca 55, Mg 15, Na 42, K 6, SO4 45, Cl 40, NO3 3, SiO2 12 mg/L diambil dari register asumsi Sagara dan diseimbangkan muatannya. Alkalinitas 130 yang terukur memberi HCO3 158 mg/L, yaitu 42 % dari TDS.",
    "",
    "Logika rekomendasi: bikarbonat yang berpasangan dengan kalsium adalah kesadahan karbonat, satu-satunya bagian TDS yang dapat diendapkan. Tiap meq membuang 81 mg/L melalui Ca(HCO3)2 + Ca(OH)2 -> 2 CaCO3. Yang perlu dibuang hanya 65 mg/L (18 %), sementara yang tersedia 211 mg/L.",
    "",
    "RISIKO UTAMA: kalau kalsium sebenarnya jauh lebih rendah daripada asumsi — misalnya airnya natrium-bikarbonat dan bukan kalsium-bikarbonat — tidak ada yang dapat diendapkan dan seluruh rekomendasi ini gugur, menyisakan nanofiltrasi. Satu analisis kation (Ca, Mg, Na) menentukan selisih sekitar Rp 8,5 miliar CAPEX dan harus diminta sebelum apa pun dikunci.",
    "",
    "Catatan kedua: warna hijau menandakan alga. Alga menaikkan dosis koagulan, memperpendek siklus filter, dan dapat melewati filter sebagai rasa dan bau. Perlu data musiman klorofil-a atau setidaknya satu sampel saat bloom.",
  ].join("\n"),
  runs,
};

const payload = { version: 1, exportedAt: now, projects: [project] };
const file = "scripts/out/sier-hydrodesk-project.json";
writeFileSync(file, JSON.stringify(payload, null, 2));

console.log(`Ditulis: ${file}`);
console.log(`Proyek : ${project.name}`);
console.log(`Run    : ${runs.length}\n`);
console.log("run".padEnd(46) + "verdict".padEnd(14) + "TDS".padStart(8) + "alk".padStart(6) +
  "CAPEX Rp M".padStart(12) + "OPEX Rp/m3".padStart(12));
console.log("-".repeat(100));
for (const r of runs) {
  const p = r.result.productStreams[0]?.stream;
  const s = r.result.summary;
  console.log(
    r.name.slice(0, 44).padEnd(46) + (r.verdict ?? "").padEnd(14) +
    round(p?.c.TDS ?? 0).toFixed(1).padStart(8) +
    round(alkalinityAsCaCO3(p!), 0).toFixed(0).padStart(6) +
    (s.capexUSD * FX / 1e9).toFixed(2).padStart(12) +
    Math.round(s.opexUSDPerM3 * FX).toLocaleString("id-ID").padStart(12),
  );
}
