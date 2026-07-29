import { Component, SourceType } from "./types";

/**
 * What a laboratory actually reports, by water source.
 *
 * A seawater analysis and a municipal sewage analysis have almost nothing in
 * common. Showing every engineer every parameter for every source is how forms
 * become unusable and how zeros end up in a balance where "not analysed" was
 * meant. Each profile lists only what is genuinely expected for that source.
 */

export interface FieldSpec {
  key: Component;
  label?: string;
  /** Shown in the compact "as reported in Indonesia" entry set. */
  common?: boolean;
}

export interface SourceProfile {
  key: SourceType;
  label: string;
  blurb: string;
  /** Whether turbidity is normally reported for this source. */
  showTurbidity: boolean;
  showColiform: boolean;
  /** Alkalinity and hardness are normally reported as CaCO3, not as ions. */
  useCaCO3Entry: boolean;
  cations: FieldSpec[];
  anions: FieldSpec[];
  aggregates: FieldSpec[];
  /**
   * The short parameter set an Indonesian laboratory typically returns as
   * standard. Everything outside it usually has to be requested specially.
   */
  typicalIndonesianSet: string[];
  /** What cannot be decided without the parameters outside that short set. */
  gapWarning: string;
}

const ION = (key: Component, common = false): FieldSpec => ({ key, common });

export const SOURCE_PROFILES: SourceProfile[] = [
  {
    key: "seawater",
    label: "Seawater",
    blurb:
      "Dominated by sodium and chloride at roughly 35,000 mg/L TDS. Organic and nutrient parameters are irrelevant; boron, bromide and algal load are what matter and are usually missing.",
    showTurbidity: true,
    showColiform: false,
    useCaCO3Entry: false,
    cations: [ION("Na", true), ION("K"), ION("Ca", true), ION("Mg", true), ION("Sr"), ION("Ba")],
    anions: [ION("Cl", true), ION("SO4", true), ION("HCO3", true), ION("F")],
    aggregates: [ION("TDS", true), ION("TSS", true), ION("SiO2"), ION("TOC"), ION("Oil")],
    typicalIndonesianSet: ["pH", "TDS", "TSS", "Cl", "Ca", "Mg", "Na"],
    gapWarning:
      "For a desalination design you also need boron, bromide, TOC and an algal bloom history. TOC drives biofouling, which is the dominant fouling mechanism on seawater RO, and boron often has its own product limit.",
  },
  {
    key: "brackish",
    label: "Brackish water",
    blurb:
      "Between fresh and seawater, typically 1,000 to 10,000 mg/L TDS. The full ionic set matters because scaling limits the achievable recovery.",
    showTurbidity: true,
    showColiform: false,
    useCaCO3Entry: true,
    cations: [ION("Na", true), ION("K"), ION("Ca", true), ION("Mg", true), ION("Fe"), ION("Mn"), ION("Ba"), ION("Sr")],
    anions: [ION("Cl", true), ION("SO4", true), ION("HCO3", true), ION("NO3"), ION("F")],
    aggregates: [ION("TDS", true), ION("TSS"), ION("SiO2", true), ION("TOC")],
    typicalIndonesianSet: ["pH", "TDS", "Total hardness (CaCO₃)", "Fe", "Mn", "Cl", "TSS"],
    gapWarning:
      "Barium, strontium and silica govern the maximum RO recovery through their saturation limits. Without them the recovery figure is a guess.",
  },
  {
    key: "river",
    label: "River / surface water",
    blurb:
      "Low TDS, variable turbidity, and quality that changes with rainfall. The wet-season peak is the design case, not the sample you were handed.",
    showTurbidity: true,
    showColiform: true,
    useCaCO3Entry: true,
    cations: [ION("Na"), ION("K"), ION("Ca", true), ION("Mg", true), ION("Fe", true), ION("Mn", true), ION("NH4")],
    anions: [ION("Cl", true), ION("SO4", true), ION("HCO3", true), ION("NO3")],
    aggregates: [ION("TDS", true), ION("TSS", true), ION("SiO2"), ION("TOC"), ION("BOD"), ION("COD")],
    typicalIndonesianSet: ["pH", "Turbidity", "TDS", "TSS", "Total hardness (CaCO₃)", "Fe", "Mn"],
    gapWarning:
      "Chloride, silica and TOC are usually outside the standard set and each governs a different decision: chloride closes the ionic balance, silica limits RO recovery and ion exchange run length, TOC drives membrane fouling and carbon sizing.",
  },
  {
    key: "groundwater",
    label: "Groundwater / well",
    blurb:
      "Stable quality and low turbidity, but often high in iron, manganese and hardness, and sometimes anaerobic.",
    showTurbidity: true,
    showColiform: true,
    useCaCO3Entry: true,
    cations: [ION("Na"), ION("Ca", true), ION("Mg", true), ION("Fe", true), ION("Mn", true), ION("NH4")],
    anions: [ION("Cl", true), ION("SO4"), ION("HCO3", true), ION("NO3"), ION("F")],
    aggregates: [ION("TDS", true), ION("TSS"), ION("SiO2", true), ION("TOC")],
    typicalIndonesianSet: ["pH", "TDS", "Total hardness (CaCO₃)", "Fe", "Mn", "Cl", "NO₃"],
    gapWarning:
      "Ask whether the sample was taken anaerobically. Iron and manganese oxidise on contact with air, so a sample carried to the laboratory in an open bottle understates both — and they are usually the reason the well needs treatment.",
  },
  {
    key: "municipal",
    label: "Municipal supply (PDAM)",
    blurb:
      "Already treated to drinking water standard. Usually needs only polishing, but carries a chlorine residual that will destroy a membrane.",
    showTurbidity: true,
    showColiform: true,
    useCaCO3Entry: true,
    cations: [ION("Na"), ION("Ca", true), ION("Mg", true), ION("Fe")],
    anions: [ION("Cl", true), ION("SO4"), ION("HCO3", true)],
    aggregates: [ION("TDS", true), ION("TSS"), ION("SiO2"), ION("TOC")],
    typicalIndonesianSet: ["pH", "Turbidity", "TDS", "Total hardness (CaCO₃)", "Residual chlorine"],
    gapWarning:
      "Confirm the free chlorine residual. It is the parameter most likely to be present and most likely to be forgotten, and it destroys polyamide membranes irreversibly.",
  },
  {
    key: "ww-domestic",
    label: "Domestic / municipal wastewater",
    blurb:
      "Organic and nutrient load is what sizes the plant. Ionic composition barely matters unless reuse is intended.",
    showTurbidity: false,
    showColiform: true,
    useCaCO3Entry: false,
    cations: [ION("NH4", true)],
    anions: [ION("NO3")],
    aggregates: [
      ION("BOD", true), ION("COD", true), ION("TSS", true), ION("TN", true),
      ION("TP", true), ION("Oil", true), ION("TDS"), ION("TOC"),
    ],
    typicalIndonesianSet: ["pH", "BOD", "COD", "TSS", "Oil & grease", "NH₃-N", "Total coliform"],
    gapWarning:
      "Total nitrogen and total phosphorus are frequently outside the standard set, yet the BOD:TN and BOD:TP ratios decide whether nutrient removal is achievable biologically at all. Ask for them explicitly.",
  },
  {
    key: "ww-industrial",
    label: "Industrial wastewater",
    blurb:
      "Defined by its awkward components, not its bulk parameters. What is not in the analysis is usually what kills the plant.",
    showTurbidity: false,
    showColiform: false,
    useCaCO3Entry: false,
    cations: [ION("NH4", true), ION("Na"), ION("Ca"), ION("Mg"), ION("Fe"), ION("Mn")],
    anions: [ION("Cl", true), ION("SO4", true), ION("NO3")],
    aggregates: [
      ION("COD", true), ION("BOD", true), ION("TSS", true), ION("TDS", true),
      ION("TN", true), ION("TP"), ION("Oil", true), ION("TOC"),
    ],
    typicalIndonesianSet: ["pH", "BOD", "COD", "TSS", "Oil & grease", "NH₃-N", "sector-specific metals"],
    gapWarning:
      "The BOD:COD ratio decides whether biological treatment can work at all — below about 0.3 it cannot. Heavy metals, cyanide, phenol and sulphide are inhibitory and often carry their own discharge limits. None of these appears in a standard analysis unless you ask.",
  },
  {
    key: "leachate",
    label: "Landfill leachate",
    blurb:
      "Very high ammonia and refractory COD, and it changes character as the landfill ages. Young leachate and old leachate need different plants.",
    showTurbidity: false,
    showColiform: false,
    useCaCO3Entry: false,
    cations: [ION("NH4", true), ION("Na"), ION("Ca"), ION("Mg"), ION("Fe"), ION("Mn")],
    anions: [ION("Cl", true), ION("SO4"), ION("HCO3")],
    aggregates: [
      ION("COD", true), ION("BOD", true), ION("TN", true), ION("TSS", true),
      ION("TDS", true), ION("TP"), ION("TOC"), ION("Oil"),
    ],
    typicalIndonesianSet: ["pH", "BOD", "COD", "TSS", "Total N", "Hg", "Cd"],
    gapWarning:
      "Ask the age of the landfill and whether it still receives waste. Young leachate is biodegradable and high in BOD; old leachate is high in ammonia and refractory COD. The same site moves from one to the other over its life, so design for what it will become, not only for what you sampled.",
  },
];

export function profileFor(t?: SourceType): SourceProfile {
  return SOURCE_PROFILES.find((p) => p.key === t) ?? SOURCE_PROFILES[2];
}

/* ------------------------------------------------------------ conversions */

/** Alkalinity as CaCO3 to the equivalent bicarbonate, mg/L. */
export function alkToBicarbonate(alkAsCaCO3: number): number {
  return (alkAsCaCO3 / 50) * 61.02;
}

export function bicarbonateToAlk(hco3: number): number {
  return (hco3 / 61.02) * 50;
}

/**
 * Split total hardness as CaCO3 into calcium and magnesium.
 *
 * Where calcium is known, magnesium follows by difference. Where it is not, a
 * typical 70:30 split is assumed — reasonable for most Indonesian surface and
 * ground water, but an assumption, and the caller should say so.
 */
export function hardnessToCaMg(
  hardnessAsCaCO3: number,
  knownCa?: number,
): { Ca: number; Mg: number; assumed: boolean } {
  const totalEq = hardnessAsCaCO3 / 50; // meq/L
  if (knownCa != null && knownCa > 0) {
    const caEq = knownCa / 20.04;
    const mgEq = Math.max(0, totalEq - caEq);
    return { Ca: knownCa, Mg: mgEq * 12.15, assumed: false };
  }
  const caEq = totalEq * 0.7;
  const mgEq = totalEq * 0.3;
  return { Ca: caEq * 20.04, Mg: mgEq * 12.15, assumed: true };
}

export function caMgToHardness(ca: number, mg: number): number {
  return (ca / 20.04 + mg / 12.15) * 50;
}
