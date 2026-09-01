import { Flowsheet } from "./types";

/**
 * Compliance markers: the trace parameters that decide whether an effluent is
 * lawful without affecting how the plant is sized.
 *
 * These are deliberately NOT engine components. A component earns its place in
 * the mass balance by changing a flow, a pressure or a recovery; at 13.8 mg/L
 * of arsenic in 280,000 mg/L of dissolved solids, arsenic changes none of them.
 * But mercury and cadmium are two of the seven parameters Permen LHK P.59/2016
 * actually regulates, and cyanide at a few mg/L decides whether a biological
 * stage works at all. Leaving them out of the model entirely meant the plant
 * could report "compliant" without ever having looked at them.
 *
 * The removals here are TRAIN-LEVEL, taken from published performance of whole
 * treatment chains rather than from a per-unit rejection. That is a deliberate
 * limit: how much mercury an MBR retains depends on speciation, sludge age and
 * the organic matter it is bound to, and nobody has a defensible number for it.
 * A barrier-class removal across the whole plant is a figure that can be cited;
 * a per-unit one would be invented. Where a real project needs better, the
 * answer is a pilot, not a more confident model.
 */

/** What kind of barrier a unit provides against dissolved trace species. */
export type BarrierClass =
  | "coagulation"    // charge neutralisation and co-precipitation onto hydroxide floc
  | "filtration"     // granular media, removes what is already particulate
  | "carbon"         // adsorption of organics
  | "biological"     // sorption onto biomass, and biodegradation of some organics
  | "membraneLoose"  // UF/MF: removes colloidal and particle-bound fractions only
  | "membraneTight"  // NF/RO/DTRO: rejects dissolved ions
  | "oxidation"      // AOP or electrochemical: destroys cyanide, phenol, organics
  | "evaporation";   // everything non-volatile stays behind

const BARRIER_OF: Record<string, BarrierClass> = {
  coagfloc: "coagulation", clarifier: "coagulation", daf: "coagulation",
  chemsoft: "coagulation", phadjust: "coagulation",
  mmf: "filtration", acf: "carbon", cartridge: "filtration",
  denitrifilter: "filtration", baf: "biological",
  aao: "biological", msbr: "biological", mbbr: "biological",
  "coke-ao": "biological", anaerobic: "biological", mbr: "membraneLoose",
  aombr: "membraneLoose",
  uf: "membraneLoose", ceramicmf: "membraneLoose",
  tuf: "membraneLoose", suf: "membraneLoose",
  nf: "membraneTight", ro: "membraneTight", swro: "membraneTight",
  dtro: "membraneTight", edi: "membraneTight", mixedbed: "membraneTight",
  softener: "coagulation",
  aop: "oxidation", electroox: "oxidation",
  // Disinfection is deliberately absent. Chlorination and UV inactivate
  // organisms; they do not destroy cyanide or phenol at the rate an advanced
  // oxidation process does, and crediting them as though they did made a
  // conventional sewage works look better on cyanide than a membrane plant.
  mvr: "evaporation", crystalliser: "evaporation",
};

export interface TraceParameter {
  key: string;
  label: string;
  unit: string;
  group: "Heavy metals" | "Inorganic" | "Organic micropollutants";
  /** Fractional removal achieved by a train containing this barrier class. */
  removal: Partial<Record<BarrierClass, number>>;
  /** Regulatory limits, by the same standard keys the rest of the app uses. */
  limits?: Record<string, number>;
  /** Concentrations at which this parameter stops a process from working. */
  inhibits?: { above: number; process: string; why: string }[];
  /** Why it is on the list at all. */
  why: string;
}

export const TRACE_PARAMETERS: TraceParameter[] = [
  {
    key: "Hg", label: "Mercury", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.6, biological: 0.5, membraneLoose: 0.4, membraneTight: 0.97, carbon: 0.85, evaporation: 0.9 },
    limits: { permenlhk: 0.005, pp22: 0.002 },
    why: "One of the seven parameters Permen LHK P.59/2016 regulates for landfill leachate, and the limit is very low. It must be measured, not assumed.",
  },
  {
    key: "Cd", label: "Cadmium", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.75, biological: 0.6, membraneLoose: 0.45, membraneTight: 0.985, carbon: 0.6, evaporation: 0.95 },
    limits: { permenlhk: 0.1, pp22: 0.01 },
    why: "The second regulated metal in P.59/2016. Mobile at low pH, which matters where an acid step precedes discharge.",
  },
  {
    key: "Pb", label: "Lead", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.85, biological: 0.65, membraneLoose: 0.6, membraneTight: 0.99, carbon: 0.6, evaporation: 0.95 },
    limits: { pp22: 0.03 },
    why: "Regulated in the river-water standard under PP 22/2021 where the effluent reaches a watercourse.",
  },
  {
    key: "As", label: "Arsenic", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.8, biological: 0.3, membraneLoose: 0.3, membraneTight: 0.96, carbon: 0.5, evaporation: 0.9 },
    limits: { pp22: 0.05, permenkes: 0.01 },
    why: "Coagulation with iron removes arsenate well and arsenite poorly, so the oxidation state governs. Where arsenic matters, ask which species was measured.",
  },
  {
    key: "Cr6", label: "Chromium VI", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.3, biological: 0.4, membraneLoose: 0.2, membraneTight: 0.95, carbon: 0.5, evaporation: 0.9 },
    limits: { pp22: 0.05 },
    why: "Hexavalent chromium is an anion and is not removed by hydroxide precipitation. It has to be reduced to trivalent first, which is a separate process step nobody remembers to include.",
  },
  {
    key: "Cr", label: "Chromium, total", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.85, biological: 0.6, membraneLoose: 0.55, membraneTight: 0.98, carbon: 0.55, evaporation: 0.95 },
    limits: { pp22: 0.05 },
    why: "Reported together in most laboratory sets. Only useful alongside the hexavalent figure, because the two behave completely differently.",
  },
  {
    key: "Ni", label: "Nickel", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.6, biological: 0.5, membraneLoose: 0.35, membraneTight: 0.98, carbon: 0.4, evaporation: 0.95 },
    limits: { pp22: 0.05 },
    why: "Poorly removed by precipitation at neutral pH; needs pH 10 or higher, which is convenient when an ammonia stripping step is already raising it.",
  },
  {
    key: "Zn", label: "Zinc", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.8, biological: 0.6, membraneLoose: 0.5, membraneTight: 0.98, carbon: 0.4, evaporation: 0.95 },
    limits: { pp22: 0.05 },
    why: "Usually the most abundant trace metal in leachate and generally the easiest to remove.",
  },
  {
    key: "Cu", label: "Copper", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.85, biological: 0.65, membraneLoose: 0.5, membraneTight: 0.98, carbon: 0.5, evaporation: 0.95 },
    limits: { pp22: 0.02 },
    inhibits: [{ above: 1.0, process: "biological treatment", why: "Copper is broadly toxic to activated sludge above roughly 1 mg/L, and the effect builds as it accumulates in the biomass." }],
    why: "Complexes strongly with the humic matter in old leachate, which keeps it dissolved and lowers the removal a jar test would predict.",
  },
  {
    key: "Se", label: "Selenium", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.3, biological: 0.4, membraneLoose: 0.2, membraneTight: 0.93, carbon: 0.3, evaporation: 0.9 },
    limits: { pp22: 0.05 },
    why: "An oxyanion like chromium VI, so precipitation barely touches it. A membrane or a biological reduction step is the realistic route.",
  },
  {
    key: "Co", label: "Cobalt", unit: "mg/L", group: "Heavy metals",
    removal: { coagulation: 0.55, biological: 0.45, membraneLoose: 0.3, membraneTight: 0.97, carbon: 0.35, evaporation: 0.95 },
    why: "Not usually regulated, but reported in leachate characterisations and worth carrying so the sludge classification is not a surprise.",
  },
  {
    key: "CN", label: "Cyanide", unit: "mg/L", group: "Inorganic",
    removal: { coagulation: 0.15, biological: 0.5, membraneLoose: 0.1, membraneTight: 0.9, oxidation: 0.98, carbon: 0.4 },
    limits: { pp22: 0.02 },
    inhibits: [{ above: 2.0, process: "nitrification", why: "Free cyanide inhibits nitrifying bacteria at very low concentrations, so an ammonia limit is missed while the carbon removal still looks healthy." }],
    why: "Decides whether a biological stage is viable at all. CCEPC has handled it at the Hubei Jinshenglan coking plant, so this is known ground — but only if it is measured first.",
  },
  {
    key: "S2", label: "Sulphide", unit: "mg/L", group: "Inorganic",
    removal: { coagulation: 0.6, biological: 0.85, oxidation: 0.99, membraneTight: 0.9, membraneLoose: 0.2 },
    inhibits: [
      { above: 20, process: "aerobic biology", why: "Sulphide is toxic to aerobic biomass and exerts an immediate oxygen demand of its own." },
      { above: 50, process: "anaerobic digestion", why: "Sulphide inhibits methanogens directly and signals that sulphate reduction is already competing for the substrate." },
    ],
    why: "An odour, corrosion and safety issue as much as a compliance one. Hydrogen sulphide is lethal at concentrations people cannot smell.",
  },
  {
    key: "Phenol", label: "Phenol", unit: "mg/L", group: "Organic micropollutants",
    removal: { coagulation: 0.1, biological: 0.9, carbon: 0.95, oxidation: 0.99, membraneTight: 0.95, membraneLoose: 0.05 },
    limits: { pp22: 1.0 },
    why: "Biodegradable when the biomass is acclimatised and toxic when it is not. Which of the two applies depends on how the plant is started up.",
  },
  {
    key: "MBAS", label: "Surfactants as MBAS", unit: "mg/L", group: "Organic micropollutants",
    removal: { coagulation: 0.3, biological: 0.85, carbon: 0.8, oxidation: 0.9, membraneTight: 0.97, membraneLoose: 0.3 },
    limits: { pp22: 0.2 },
    inhibits: [{ above: 20, process: "membrane operation", why: "Surfactants foam in aeration basins and adsorb onto membrane surfaces, where they are difficult to clean off." }],
    why: "Rarely designed for and frequently the reason an aeration basin foams over.",
  },
  {
    key: "AOX", label: "Adsorbable organic halides", unit: "mg/L", group: "Organic micropollutants",
    removal: { coagulation: 0.15, biological: 0.4, carbon: 0.85, oxidation: 0.5, membraneTight: 0.95, membraneLoose: 0.1 },
    why: "A bulk indicator for chlorinated organics. It rises across chlorination and across electrochemical oxidation on a saline water, so it is one of the few parameters a treatment step can make worse.",
  },
];

export const TRACE_BY_KEY: Record<string, TraceParameter> =
  Object.fromEntries(TRACE_PARAMETERS.map((t) => [t.key, t]));

export interface TraceResult {
  key: string;
  label: string;
  unit: string;
  group: string;
  inlet: number;
  removalPct: number;
  outlet: number;
  /** Which barrier class the removal was taken from. */
  basis: BarrierClass | "none";
  limit?: number;
  pass?: boolean;
  marginX?: number;
  note?: string;
}

/** Barrier classes present anywhere in this flowsheet. */
export function barriersIn(fs: Flowsheet): BarrierClass[] {
  const set = new Set<BarrierClass>();
  for (const nd of fs.nodes) {
    const b = BARRIER_OF[nd.type];
    if (b) set.add(b);
  }
  return [...set];
}

/**
 * Carries the trace parameters from the intake to the final effluent using the
 * best barrier the train provides for each. Deliberately end-to-end: no
 * intermediate concentrations are reported, because the model does not have the
 * per-unit knowledge that would make them meaningful.
 */
export function traceBalance(
  fs: Flowsheet,
  standardKey?: string,
): TraceResult[] {
  const entered = fs.feed.trace ?? {};
  const barriers = barriersIn(fs);
  const out: TraceResult[] = [];

  for (const t of TRACE_PARAMETERS) {
    const inlet = entered[t.key];
    if (inlet == null || !Number.isFinite(inlet)) continue;

    // The strongest barrier present governs; they are not multiplied, because
    // published train removals already include everything upstream of them.
    let best = 0;
    let basis: BarrierClass | "none" = "none";
    for (const b of barriers) {
      const r = t.removal[b];
      if (r != null && r > best) { best = r; basis = b; }
    }
    const outlet = inlet * (1 - best);
    const concentrating = basis === "membraneTight" || basis === "membraneLoose"
      || basis === "coagulation" || basis === "filtration";
    const limit = standardKey ? t.limits?.[standardKey] : undefined;
    const notes: string[] = [];
    if (basis === "none") {
      notes.push("No barrier in this train is credited with removing this parameter. Whatever enters, leaves.");
    }
    if (t.key === "AOX" && barriers.includes("oxidation")) {
      notes.push("Electrochemical oxidation on a chloride-bearing water generates AOX rather than removing it. Where that route is used, this figure is optimistic and must be measured.");
    }
    if (concentrating) {
      notes.push("This barrier separates rather than destroys: the mass removed leaves in the concentrate, the sludge or the backwash, at a higher concentration than it entered. It has to be disposed of, and on a heavy metal that usually decides how the residue is classified.");
    }
    if (t.key === "Cr6" && basis === "coagulation") {
      notes.push("Hexavalent chromium is an anion and does not precipitate as a hydroxide. Without a reduction step ahead of the coagulation this removal will not be achieved.");
    }
    out.push({
      key: t.key, label: t.label, unit: t.unit, group: t.group,
      inlet, removalPct: best * 100, outlet, basis,
      limit,
      pass: limit != null ? outlet <= limit : undefined,
      marginX: limit != null && outlet > 0 ? limit / outlet : undefined,
      note: notes.length ? notes.join(" ") : undefined,
    });
  }
  return out;
}

export interface InhibitionFinding {
  parameter: string;
  value: number;
  threshold: number;
  process: string;
  why: string;
  present: boolean;
}

/**
 * Parameters entered at a concentration that would stop part of the train
 * working. These never enter the balance; they change the process decision,
 * which is a different kind of answer and belongs in a different list.
 */
export function inhibitionFindings(fs: Flowsheet): InhibitionFinding[] {
  const entered = fs.feed.trace ?? {};
  const types = new Set(fs.nodes.map((nd) => nd.type));
  const hasBiology = [...types].some((t) => BARRIER_OF[t] === "biological" || t === "mbr" || t === "aombr");
  const hasMembrane = [...types].some((t) =>
    BARRIER_OF[t] === "membraneTight" || BARRIER_OF[t] === "membraneLoose");

  const found: InhibitionFinding[] = [];
  for (const t of TRACE_PARAMETERS) {
    const v = entered[t.key];
    if (v == null || !t.inhibits) continue;
    for (const inh of t.inhibits) {
      if (v <= inh.above) continue;
      const relevant =
        inh.process.includes("membrane") ? hasMembrane :
        inh.process.includes("anaerobic") ? types.has("anaerobic") :
        hasBiology;
      found.push({
        parameter: t.label, value: v, threshold: inh.above,
        process: inh.process, why: inh.why, present: relevant,
      });
    }
  }
  return found;
}
