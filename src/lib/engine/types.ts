/**
 * Core type definitions for the WTP/WWTP simulation engine.
 *
 * Design note: every stream carries a full component vector in mg/L plus a
 * volumetric flow in m3/h. Mass loads are therefore flow * conc = g/h, which is
 * the basis on which every unit operation closes its balance.
 */

/** Ionic species tracked through the flowsheet (mg/L as the ion). */
export const IONS = [
  "Na", "K", "Ca", "Mg", "NH4",
  "Cl", "SO4", "HCO3", "CO3", "NO3", "F",
  "SiO2", "Fe", "Mn", "Ba", "Sr",
] as const;
export type Ion = (typeof IONS)[number];

/** Non-ionic / aggregate quality parameters (mg/L unless noted). */
export const AGGREGATES = [
  "TDS", "TSS", "BOD", "COD", "TOC", "TN", "TP", "Oil",
] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export const COMPONENTS = [...IONS, ...AGGREGATES] as const;
export type Component = (typeof COMPONENTS)[number];

/** Turbidity (NTU) and coliform are carried separately: they are not mass-conservative. */
export interface StreamExtras {
  turbidityNTU: number;
  coliform: number; // count/100 mL
  sdi15: number; // silt density index, dimensionless
}

export interface Stream {
  /** Volumetric flow, m3/h */
  flow: number;
  /** Temperature, degC */
  T: number;
  /** pH (dimensionless) */
  pH: number;
  /** Concentrations in mg/L, keyed by component */
  c: Record<Component, number>;
  extras: StreamExtras;
}

export type ParamType = "number" | "select" | "boolean";

export interface ParamDef {
  key: string;
  label: string;
  type: ParamType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  /** Short explanation shown in the UI so the engineer knows what he is changing. */
  help?: string;
  /** Group heading in the parameter panel. */
  group?: string;
}

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

/** Chemical consumption, kg/h as 100% active substance. */
export type ChemicalUse = Record<string, number>;

/** Equipment sizing output produced by a unit model. */
export interface SizingItem {
  label: string;
  value: string;
}

/** Everything a unit reports besides its outlet streams. */
export interface UnitAux {
  /** Electrical demand, kW */
  powerKW: number;
  /** Chemical dosing, kg/h of 100% active substance */
  chemicals: ChemicalUse;
  /** Dry solids produced, kg/h */
  drySolidsKgH: number;
  /** Preliminary sizing lines for the equipment list */
  sizing: SizingItem[];
  /** Indicative installed-equipment cost, USD (order-of-magnitude only) */
  capexUSD: number;
  /** Engineering notes / warnings raised by the model */
  notes: string[];
  /** Hydraulic retention time in hours, where meaningful */
  hrtH?: number;
}

export interface SolveResult {
  outlets: Record<string, Stream>;
  aux: UnitAux;
}

export type UnitCategory =
  | "intake"
  | "pretreatment"
  | "membrane"
  | "ionexchange"
  | "biological"
  | "oxidation"
  | "thermal"
  | "sludge"
  | "storage"
  | "transport"
  | "network";

export interface UnitModel {
  type: string;
  label: string;
  short: string;
  category: UnitCategory;
  /** Number of inlet ports. Streams are mixed before solving. */
  inlets: number;
  /** Named outlet ports, in display order. */
  outlets: string[];
  description: string;
  /**
   * CCEPC deployment maturity, 1-5. Used by the optimiser: higher means the
   * technology appears in more delivered CCEPC references and therefore carries
   * lower execution risk.
   */
  ccepcMaturity: number;
  params: ParamDef[];
  defaults: Params;
  solve: (inlet: Stream, p: Params) => SolveResult;
}

/* ------------------------------------------------------------------ flowsheet */

export interface FlowNode {
  id: string;
  type: string; // UnitModel.type
  label: string;
  position: { x: number; y: number };
  params: Params;
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle: string; // outlet port name
  target: string;
  targetHandle: string; // "in"
}

/** Water source, which decides what a laboratory would actually report. */
export type SourceType =
  | "seawater"
  | "brackish"
  | "river"
  | "groundwater"
  | "municipal"
  | "ww-domestic"
  | "ww-industrial"
  | "leachate";

export interface FeedSpec {
  name: string;
  /**
   * Feed flow, m3/h.
   *
   * In product-driven design mode this is an OUTPUT: the solver scales it until
   * the connected product outlets deliver the target. Treat it as a result, not
   * an input, unless the intake is genuinely fixed.
   */
  flow: number;
  T: number;
  pH: number;
  /** Concentrations in mg/L. Absent means not analysed, which is not the same as zero. */
  c: Partial<Record<Component, number>>;
  turbidityNTU?: number;
  coliform?: number;
  /** Measured conductivity — the quickest cross-check on a reported TDS. */
  conductivityUScm?: number;
  /** What kind of water this is; drives which parameters are shown and expected. */
  sourceType?: SourceType;
  /**
   * Total alkalinity as mg/L CaCO3, as Indonesian laboratories normally report
   * it. Converted to bicarbonate for the balance — below pH 8.3 essentially all
   * alkalinity is bicarbonate, so the conversion is exact enough.
   */
  alkalinityAsCaCO3?: number;
  /**
   * Total hardness as mg/L CaCO3. Where calcium is also given, magnesium is
   * derived by difference; where it is not, a typical split is assumed and the
   * assumption is flagged.
   */
  hardnessAsCaCO3?: number;
}

/** Design mode: fix the intake, or fix the product and solve for the intake. */
export type DesignMode = "feed-driven" | "product-driven";

export interface DesignBasis {
  standard: string;
  productSpecKey: string;
  operatingHoursPerYear: number;
  designMarginPct: number;
  electricityUSDPerKWh: number;
  /** Additional free-form design parameters the engineer wants recorded. */
  extra: { key: string; value: string }[];
  /**
   * How the plant is sized. Product-driven is how design actually works: you
   * know the demand and solve backwards for the intake.
   */
  designMode?: DesignMode;
  /** Target total product flow, m3/h, used in product-driven mode. */
  targetProductFlow?: number;
}

export interface Flowsheet {
  nodes: FlowNode[];
  edges: FlowEdge[];
  feed: FeedSpec;
  basis: DesignBasis;
}

/* ------------------------------------------------------------------ results */

export interface StreamRow {
  id: string;
  label: string;
  from: string;
  to: string;
  stream: Stream;
}

export interface NodeResult {
  id: string;
  type: string;
  label: string;
  inlet: Stream;
  outlets: Record<string, Stream>;
  aux: UnitAux;
}

export interface Balance {
  label: string;
  inKgH: number;
  outKgH: number;
  errorPct: number;
}

export interface SimulationResult {
  ok: boolean;
  converged: boolean;
  iterations: number;
  residual: number;
  messages: string[];
  nodes: NodeResult[];
  streams: StreamRow[];
  /** Streams entering the flowsheet from outside (fresh feed) */
  feedStreams: StreamRow[];
  /** Streams leaving to product sinks */
  productStreams: StreamRow[];
  /** Streams leaving to waste sinks */
  wasteStreams: StreamRow[];
  summary: ResultSummary;
}

export interface ResultSummary {
  feedFlow: number;
  productFlow: number;
  wasteFlow: number;
  recoveryPct: number;
  totalPowerKW: number;
  secKWhPerM3: number;
  chemicals: { name: string; kgPerH: number; tPerY: number; usdPerY: number }[];
  drySolidsKgH: number;
  waterBalance: Balance[];
  saltBalance: Balance[];
  biologicalBalance: Balance[];
  capexUSD: number;
  opexUSDPerY: number;
  opexUSDPerM3: number;
  hrtTotalH: number;
  warnings: string[];
}
