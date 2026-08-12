import { DesignBasis, FeedSpec, Flowsheet, Params } from "./types";
import { defaultParams } from "./units";

export interface WaterStandard {
  key: string;
  name: string;
  scope: string;
  limits: { param: string; limit: string }[];
}

/** Design standards the engineer can declare on a study. */
export const STANDARDS: WaterStandard[] = [
  {
    key: "gbt1576",
    name: "GB/T 1576-2018 — Industrial boiler feed water",
    scope: "Boilers below 3.8 MPa, desalted make-up, 2.5 < p < 3.8 MPa column",
    limits: [
      { param: "Turbidity", limit: "<= 5.0 FTU" },
      { param: "Total hardness", limit: "<= 0.005 mmol/L (0.25 mg/L as CaCO3)" },
      { param: "Conductivity (25 C)", limit: "<= 80.0 uS/cm" },
      { param: "Iron", limit: "<= 0.10 mg/L" },
      { param: "Oil", limit: "<= 2.0 mg/L" },
      { param: "pH (25 C)", limit: "8.5 - 10.5 (achieved by boiler-island dosing)" },
      { param: "Dissolved oxygen", limit: "<= 0.050 mg/L (achieved by deaerator)" },
    ],
  },
  {
    key: "gbt12145",
    name: "GB/T 12145 — Power plant water and steam",
    scope: "Boilers at or above 3.8 MPa; considerably stricter than GB/T 1576",
    limits: [
      { param: "Conductivity", limit: "<= 0.30 uS/cm" },
      { param: "Silica (SiO2)", limit: "<= 20 ug/L" },
      { param: "Iron", limit: "<= 20 ug/L" },
      { param: "Copper", limit: "<= 5 ug/L" },
      { param: "TOC", limit: "<= 200 ug/L" },
    ],
  },
  {
    key: "permenkes",
    name: "Permenkes — Indonesian drinking water",
    scope: "Potable water distribution",
    limits: [
      { param: "Turbidity", limit: "< 3 NTU" },
      { param: "TDS", limit: "< 500 mg/L" },
      { param: "Residual chlorine", limit: "0.2 - 0.5 mg/L" },
      { param: "E. coli", limit: "0 / 100 mL" },
      { param: "pH", limit: "6.5 - 8.5" },
    ],
  },
  {
    key: "permenlhk",
    name: "PermenLHK — Indonesian industrial effluent",
    scope: "Discharge to surface water",
    limits: [
      { param: "COD", limit: "<= 100 mg/L" },
      { param: "BOD", limit: "<= 50 mg/L" },
      { param: "TSS", limit: "<= 100 mg/L" },
      { param: "NH3-N", limit: "<= 10 mg/L" },
      { param: "pH", limit: "6.0 - 9.0" },
    ],
  },
  {
    key: "cooling",
    name: "Cooling tower make-up (typical vendor)",
    scope: "Open recirculating cooling systems",
    limits: [
      { param: "Turbidity", limit: "< 5 NTU" },
      { param: "Total hardness", limit: "< 250 mg/L as CaCO3 (or antiscalant)" },
      { param: "Oil", limit: "< 1 mg/L" },
      { param: "Silica", limit: "< 150 mg/L at design CoC" },
    ],
  },
  {
    key: "custom",
    name: "Custom / project specific",
    scope: "Declared by the engineer on the study",
    limits: [],
  },
];

export const DEFAULT_BASIS: DesignBasis = {
  standard: "gbt1576",
  productSpecKey: "demin",
  operatingHoursPerYear: 8000,
  designMarginPct: 10,
  electricityUSDPerKWh: 0.09,
  extra: [],
  // Design normally works backwards from the demand; the intake is the answer.
  designMode: "product-driven",
};

/**
 * A blank feed. A new study must start from nothing — a preset silently
 * carrying another project's water into a fresh study is worse than an empty
 * form, because the numbers look deliberate.
 */
export function emptyFeed(): FeedSpec {
  return {
    name: "",
    sourceType: "river",
    flow: 0,
    T: 25,
    pH: 7,
    c: {},
  };
}

/* --------------------------------------------------------------- feed presets */

export interface FeedPreset {
  key: string;
  label: string;
  spec: FeedSpec;
}

export const FEED_PRESETS: FeedPreset[] = [
  {
    key: "reservoir-sagara",
    label: "Reservoir — Sagara / SIER Surabaya (algal, pH 8.5)",
    spec: {
      name: "Waduk Sagara",
      sourceType: "river",
      flow: 205, T: 30, pH: 8.5,
      c: {
        TDS: 365, TSS: 20, TOC: 5,
        Ca: 55, Mg: 15, Na: 42, K: 6,
        HCO3: 158, SO4: 45, Cl: 40, NO3: 3,
        SiO2: 12, Fe: 0.3, Mn: 0.15,
        BOD: 3, COD: 15,
      },
      turbidityNTU: 15,
      alkalinityAsCaCO3: 130,
    },
  },
  {
    key: "seawater-gresik",
    label: "Seawater — Gresik (CCEPC project data)",
    spec: {
      name: "Seawater (Gresik)",
      sourceType: "seawater",
      flow: 4618, T: 30, pH: 8.0,
      c: {
        Na: 9079, Ca: 520, Mg: 1109, K: 350,
        Cl: 13996, SO4: 1500, HCO3: 140,
        TDS: 26651, TSS: 25, SiO2: 3, BOD: 2, COD: 5, TOC: 2,
      },
      turbidityNTU: 15, coliform: 1000,
    },
  },
  {
    key: "river-sumatra",
    label: "River — South Sumatra (methanol project)",
    spec: {
      name: "River water (South Sumatra)",
      sourceType: "river",
      flow: 215, T: 28, pH: 6.5,
      c: {
        Na: 5, Ca: 48.04, Mg: 11.07, K: 2,
        Cl: 20, SO4: 5.8, HCO3: 22.7, NO3: 3.2,
        TDS: 110, TSS: 18.9, SiO2: 20, BOD: 3.1, COD: 7.3, TOC: 3, Fe: 0.014,
      },
      turbidityNTU: 15, coliform: 400,
    },
  },
  {
    key: "municipal-sewage",
    label: "Municipal sewage",
    spec: {
      name: "Municipal sewage",
      sourceType: "ww-domestic",
      flow: 300, T: 27, pH: 7.2,
      c: {
        Na: 80, Ca: 60, Mg: 15, Cl: 120, SO4: 40, HCO3: 250,
        TDS: 650, TSS: 220, BOD: 200, COD: 420, TOC: 130,
        TN: 45, TP: 6, NH4: 30, Oil: 20,
      },
      turbidityNTU: 120, coliform: 1e6,
    },
  },
  {
    key: "coking-wastewater",
    label: "Coking wastewater (CCEPC Jinshenglan)",
    spec: {
      name: "Coking wastewater",
      sourceType: "ww-industrial",
      flow: 120, T: 35, pH: 8.5,
      c: {
        Na: 900, Ca: 80, Mg: 25, Cl: 800, SO4: 300, HCO3: 400,
        TDS: 3500, TSS: 300, BOD: 2000, COD: 8000, TOC: 2500,
        TN: 300, TP: 5, NH4: 200, Oil: 120,
      },
      turbidityNTU: 200, coliform: 1000,
    },
  },
  {
    key: "landfill-leachate",
    label: "Landfill leachate",
    spec: {
      name: "Landfill leachate",
      sourceType: "leachate",
      flow: 40, T: 30, pH: 8.0,
      c: {
        Na: 1800, Ca: 300, Mg: 200, Cl: 2500, SO4: 400, HCO3: 3000,
        TDS: 12000, TSS: 500, BOD: 3000, COD: 9000, TOC: 3000,
        TN: 1800, TP: 20, NH4: 1500, Oil: 30,
      },
      turbidityNTU: 300, coliform: 1e5,
    },
  },
];

/* --------------------------------------------------------------- templates */

let seq = 0;
const nid = (t: string) => `${t}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

interface Spec {
  type: string;
  label?: string;
  params?: Params;
  x: number;
  y: number;
}

function build(
  specs: Spec[],
  links: [number, string, number][],
  feed: FeedSpec,
  basis: Partial<DesignBasis> = {},
): Flowsheet {
  const nodes = specs.map((sp) => ({
    id: nid(sp.type),
    type: sp.type,
    label: sp.label ?? sp.type.toUpperCase(),
    position: { x: sp.x, y: sp.y },
    params: { ...defaultParams(sp.type), ...(sp.params ?? {}) },
  }));
  const edges = links.map(([a, handle, bIdx], i) => ({
    id: `e${i}-${nodes[a].id}-${nodes[bIdx].id}`,
    source: nodes[a].id,
    sourceHandle: handle,
    target: nodes[bIdx].id,
    targetHandle: "in",
  }));
  return { nodes, edges, feed, basis: { ...DEFAULT_BASIS, ...basis } };
}

export interface Template {
  key: string;
  name: string;
  category: string;
  description: string;
  make: () => Flowsheet;
}

export const TEMPLATES: Template[] = [
  {
    key: "blank",
    name: "Blank flowsheet",
    category: "General",
    description: "Start from nothing. Drag units in from the palette.",
    make: () =>
      build([], [], emptyFeed()),
  },
  {
    key: "demin-ro-edi",
    name: "Demineralisation — UF + 2-pass RO + EDI",
    category: "Demineralisation",
    description:
      "Boiler feed water train: clarification, ultrafiltration, activated carbon, two-pass RO and EDI — the unit sequence used in the South Sumatra methanol utility study. Recycle streams and the cooling / service / potable branches are NOT included, so the recovery it reports is the demineralisation train alone, not a whole-plant figure. Add a splitter and route the reject streams back to reproduce a full plant balance.",
    make: () =>
      build(
        [
          { type: "intake", label: "Intake & Screen", x: 0, y: 160 },
          { type: "rawtank", label: "Raw Water Pond", x: 200, y: 160 },
          { type: "coagfloc", label: "Coagulation", x: 400, y: 160 },
          { type: "clarifier", label: "Lamella Clarifier", x: 600, y: 160 },
          { type: "uf", label: "Ultrafiltration", x: 800, y: 160 },
          { type: "acf", label: "Carbon Filter", x: 1000, y: 160 },
          { type: "cartridge", label: "Cartridge Filter", x: 1200, y: 160 },
          { type: "ro", label: "RO Pass 1", params: { recovery: 80 }, x: 1400, y: 160 },
          { type: "ro", label: "RO Pass 2", params: { recovery: 90, feedPressureBar: 8 }, x: 1600, y: 160 },
          { type: "edi", label: "EDI", x: 1800, y: 160 },
          { type: "producttank", label: "Demin Tank", params: { hrtH: 8 }, x: 2000, y: 160 },
          { type: "product", label: "Demineralised Water", params: { name: "demin" }, x: 2200, y: 160 },
          { type: "waste", label: "Clarifier Sludge", params: { name: "sludge" }, x: 600, y: 360 },
          { type: "waste", label: "UF Backwash", params: { name: "backwash" }, x: 800, y: 360 },
          { type: "waste", label: "ACF Backwash", params: { name: "backwash" }, x: 1000, y: 360 },
          { type: "waste", label: "RO-1 Reject", params: { name: "reject" }, x: 1400, y: 360 },
          { type: "waste", label: "RO-2 Reject", params: { name: "reject" }, x: 1600, y: 360 },
          { type: "waste", label: "EDI Concentrate", params: { name: "reject" }, x: 1800, y: 360 },
        ],
        [
          [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5],
          [5, "out", 6], [6, "out", 7], [7, "permeate", 8], [8, "permeate", 9],
          [9, "product", 10], [10, "out", 11],
          [3, "sludge", 12], [4, "backwash", 13], [5, "backwash", 14],
          [7, "concentrate", 15], [8, "concentrate", 16], [9, "concentrate", 17],
        ],
        feedPreset("river-sumatra"),
        { standard: "gbt1576", productSpecKey: "demin" },
      ),
  },
  {
    key: "seawater-desal",
    name: "Seawater desalination — CCEPC Gresik train",
    category: "Desalination",
    description:
      "Replicates the CCEPC Gresik salt plant pre-treatment and membrane train: coagulation, DAF, sand filtration, UF, NF salt separation and high-pressure RO concentration.",
    make: () =>
      build(
        [
          { type: "intake", label: "Seawater Intake", params: { electrochlorination: true, headM: 25 }, x: 0, y: 200 },
          { type: "coagfloc", label: "Coagulation", params: { coagDose: 25 }, x: 200, y: 200 },
          { type: "clarifier", label: "Sedimentation Basin", x: 400, y: 200 },
          { type: "daf", label: "Air Flotation", x: 600, y: 200 },
          { type: "rawtank", label: "Clean Water Tank", params: { hrtH: 2 }, x: 800, y: 200 },
          { type: "mmf", label: "Quartz Sand Filter", x: 1000, y: 200 },
          { type: "uf", label: "Ultrafiltration", x: 1200, y: 200 },
          { type: "nf", label: "1st NF Unit", params: { recovery: 77 }, x: 1400, y: 200 },
          { type: "swro", label: "1st HP-RO", params: { recovery: 55, erd: true }, x: 1600, y: 200 },
          { type: "product", label: "Fresh Water", params: { name: "process" }, x: 1800, y: 120 },
          { type: "product", label: "Concentrated Brine", params: { name: "process" }, x: 1800, y: 300 },
          { type: "waste", label: "Sludge", params: { name: "sludge" }, x: 400, y: 400 },
          { type: "waste", label: "DAF Float", params: { name: "sludge" }, x: 600, y: 400 },
          { type: "waste", label: "Filter Backwash", params: { name: "backwash" }, x: 1000, y: 400 },
          { type: "waste", label: "UF Backwash", params: { name: "backwash" }, x: 1200, y: 400 },
          { type: "waste", label: "NF Concentrate", params: { name: "reject" }, x: 1400, y: 400 },
        ],
        [
          [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5],
          [5, "out", 6], [6, "out", 7], [7, "permeate", 8],
          [8, "permeate", 9], [8, "concentrate", 10],
          [2, "sludge", 11], [3, "float", 12], [5, "backwash", 13],
          [6, "backwash", 14], [7, "concentrate", 15],
        ],
        feedPreset("seawater-gresik"),
        { standard: "custom", productSpecKey: "process" },
      ),
  },
  {
    key: "municipal-wwtp",
    name: "Municipal WWTP — AAO + tertiary",
    category: "Wastewater",
    description:
      "Modified AAO with secondary clarification, denitrification filtration and disinfection. Based on the CCEPC Baoxie and Zuoling references in Wuhan.",
    make: () =>
      build(
        [
          { type: "intake", label: "Inlet Works", params: { headM: 8, cl2Dose: 0 }, x: 0, y: 200 },
          { type: "eqtank", label: "Equalisation", params: { hrtH: 6, settleTSSPct: 20 }, x: 200, y: 200 },
          { type: "aao", label: "Modified AAO", x: 400, y: 200 },
          { type: "clarifier", label: "Secondary Clarifier", params: { riseRate: 1.2, tssRemoval: 95, sludgeFlowPct: 3 }, x: 600, y: 200 },
          { type: "denitrifilter", label: "Denitrification Filter", x: 800, y: 200 },
          { type: "disinfection", label: "Disinfection", x: 1000, y: 200 },
          { type: "product", label: "Treated Effluent", params: { name: "reuse" }, x: 1200, y: 200 },
          { type: "thickener", label: "Sludge Thickener", x: 600, y: 400 },
          { type: "dewatering", label: "Filter Press", x: 800, y: 400 },
          { type: "waste", label: "Sludge Cake", params: { name: "sludge" }, x: 1000, y: 400 },
          { type: "waste", label: "Thickener Supernatant", params: { name: "loss" }, x: 800, y: 520 },
          { type: "waste", label: "Press Filtrate", params: { name: "loss" }, x: 1000, y: 520 },
          { type: "waste", label: "DNF Backwash", params: { name: "backwash" }, x: 800, y: 60 },
        ],
        [
          [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5], [5, "out", 6],
          [2, "was", 7], [3, "sludge", 7], [7, "thickened", 8], [8, "cake", 9],
          [7, "supernatant", 10], [8, "filtrate", 11], [4, "backwash", 12],
        ],
        feedPreset("municipal-sewage"),
        { standard: "permenlhk", productSpecKey: "reuse" },
      ),
  },
  {
    key: "leachate-mld",
    name: "Leachate / high-strength MLD",
    category: "Wastewater",
    description:
      "High-strength industrial or landfill leachate: biological A/O, ultrafiltration, two-stage RO and evaporation, approaching minimal liquid discharge.",
    make: () =>
      build(
        [
          { type: "eqtank", label: "Equalisation", params: { hrtH: 12 }, x: 0, y: 200 },
          { type: "coke-ao", label: "A/O Biological", x: 200, y: 200 },
          { type: "uf", label: "Ultrafiltration", params: { recovery: 92 }, x: 400, y: 200 },
          { type: "ro", label: "RO Stage 1", params: { recovery: 70 }, x: 600, y: 200 },
          { type: "swro", label: "RO Stage 2 (HP)", params: { recovery: 60 }, x: 800, y: 200 },
          { type: "mvr", label: "MVR Evaporator", params: { waterEvapPct: 80 }, x: 1000, y: 320 },
          { type: "product", label: "Reuse Water", params: { name: "reuse" }, x: 1000, y: 120 },
          { type: "product", label: "Distillate", params: { name: "reuse" }, x: 1200, y: 260 },
          { type: "waste", label: "Concentrate to Disposal", params: { name: "reject" }, x: 1200, y: 400 },
          { type: "waste", label: "Waste Sludge", params: { name: "sludge" }, x: 200, y: 400 },
          { type: "waste", label: "UF Backwash", params: { name: "backwash" }, x: 400, y: 400 },
        ],
        [
          [0, "out", 1], [1, "out", 2], [2, "out", 3],
          [3, "permeate", 6], [3, "concentrate", 4],
          [4, "permeate", 6], [4, "concentrate", 5],
          [5, "distillate", 7], [5, "concentrate", 8],
          [1, "was", 9], [2, "backwash", 10],
        ],
        feedPreset("landfill-leachate"),
        { standard: "permenlhk", productSpecKey: "reuse" },
      ),
  },
  {
    key: "wtp-sagara-split",
    name: "WTP surface water — split-stream RO (Sagara / SIER)",
    category: "WTP",
    description:
      "Reservoir water for industrial supply where the dissolved solids need only a small reduction. Everything passes conventional treatment; a quarter of the filtered water is taken to RO and blended back. DAF rather than sedimentation, because an algal floc floats. The filtered water tank has two draw-off lines, which is the point of the design.",
    make: () =>
      build(
        [
          { type: "feedsource", label: "Waduk", x: 0, y: 200 },
          { type: "intake", label: "Intake & Screen", params: { headM: 30, pumpEff: 0.75, screenRemovalTSS: 3, cl2Dose: 1.5 }, x: 150, y: 200 },
          { type: "phadjust", label: "Koreksi pH 8.5 to 6.9", params: { targetPH: 6.9, reagentDown: "h2so4", codCoPrecipPct: 0, hrtMin: 5 }, x: 300, y: 200 },
          { type: "coagfloc", label: "Rapid Mix + Flokulasi", params: { coagDose: 25, polymerDose: 0.3, targetPH: 6.9, mixTimeMin: 1, flocTimeMin: 18 }, x: 450, y: 200 },
          { type: "daf", label: "DAF 2 unit", params: { loading: 10, recyclePct: 10, tssRemoval: 92, floatFlowPct: 1.0, codRemoval: 40 }, x: 600, y: 200 },
          { type: "mmf", label: "Filter Dual-Media", params: { rate: 10, backwashPct: 3.5, tssRemoval: 88 }, x: 750, y: 200 },
          // One vessel, two lines: the bypass and the RO feed. This is why tanks
          // take an outlet count.
          { type: "rawtank", label: "Tangki Air Tersaring", params: { hrtH: 1, outletCount: 2, split2: 32.7, lossPct: 0 }, x: 900, y: 200 },
          { type: "cartridge", label: "Cartridge 5 um", params: { micron: 5 }, x: 1050, y: 340 },
          { type: "ro", label: "RO Air Payau 3 train", params: { recovery: 75, flux: 18, trains: 3, antiscalantDose: 3, smbsDose: 5 }, x: 1200, y: 340 },
          { type: "producttank", label: "Tangki Produk + Blending", params: { hrtH: 4 }, x: 1350, y: 200 },
          { type: "phadjust", label: "Trim pH Produk", params: { targetPH: 7.6, reagentUp: "naoh", codCoPrecipPct: 0, hrtMin: 5 }, x: 1500, y: 200 },
          { type: "pump", label: "Pompa Distribusi", params: { headM: 45, pumpEff: 0.75, standby: 1 }, x: 1650, y: 200 },
          { type: "outfall", label: "Produk ke SIER", x: 1800, y: 200 },
          { type: "thickener", label: "Pengental Lumpur", params: { supernatantPct: 50 }, x: 750, y: 470 },
          { type: "dewatering", label: "Screw Press", params: { cakeDryness: 18, polymerDose: 4 }, x: 900, y: 470 },
          { type: "waste", label: "Cake ke TPA", params: { name: "sludge" }, x: 1050, y: 470 },
          { type: "waste", label: "Efluen ke Badan Air", params: { name: "reject" }, x: 1200, y: 560 },
        ],
        [
          [0, "out", 1], [1, "out", 2], [2, "out", 3], [3, "out", 4], [4, "out", 5], [5, "out", 6],
          [6, "out1", 9],
          [6, "out2", 7], [7, "out", 8], [8, "permeate", 9],
          [9, "out", 10], [10, "out", 11], [11, "out", 12],
          [4, "float", 13], [5, "backwash", 13],
          [13, "thickened", 14], [13, "supernatant", 16],
          [14, "cake", 15], [14, "filtrate", 16],
          [8, "concentrate", 16],
        ],
        feedPreset("reservoir-sagara"),
        { standard: "permenkes", productSpecKey: "process" },
      ),
  },
];

/**
 * A feed by name rather than by position. Templates used to index into
 * FEED_PRESETS, so adding a preset at the front silently repointed every one of
 * them at the wrong water — the kind of break that shows up as a plausible
 * number rather than as an error.
 */
export function feedPreset(key: string): FeedSpec {
  const p = FEED_PRESETS.find((x) => x.key === key);
  if (!p) throw new Error(`Unknown feed preset: ${key}`);
  return JSON.parse(JSON.stringify(p.spec)) as FeedSpec;
}

export function templateByKey(key: string): Template | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
