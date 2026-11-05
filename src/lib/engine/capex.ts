import { Flowsheet, SimulationResult } from "./types";

/**
 * Indicative CAPEX, built up from the equipment cost by factors.
 *
 * The unit models price their equipment from capacity curves. That is the
 * process equipment and little else: it leaves out the erection, the piping,
 * the electrics, the civil works and everything a contractor charges to deliver
 * a plant, which together come to two or three times the equipment again. A
 * figure that stops at the equipment reads as the plant cost and understates it
 * by that much, which is exactly the question an engineer gets asked first.
 *
 * The method is the factored estimate used at concept stage (AACE Class 5,
 * accuracy about -30 % / +50 %): each direct item as a share of the equipment,
 * indirects as a share of the direct cost, and a contingency on top. The factors
 * are typical for municipal and industrial water plants in South-East Asia; a
 * seawater plant adds its marine intake and outfall works, which a land-based
 * plant does not have. Every factor is shown so it can be challenged.
 */

export interface CapexFactors {
  installation: number;
  electrical: number;
  civil: number;
  /** Seawater intake and outfall works; applied only on a seawater feed. */
  marine: number;
  engineering: number;
  contractor: number;
  commissioning: number;
  contingency: number;
}

export const DEFAULT_CAPEX_FACTORS: CapexFactors = {
  installation: 0.4,
  electrical: 0.2,
  civil: 0.35,
  marine: 0.2,
  engineering: 0.1,
  contractor: 0.1,
  commissioning: 0.03,
  contingency: 0.2,
};

/** Rupiah per US dollar used for the Rupiah column. Stated wherever it is used. */
export const IDR_PER_USD = 16300;

/** Concept-stage accuracy band, AACE Class 5. */
export const CAPEX_ACCURACY = { low: -0.3, high: 0.5 };

export interface CapexLine {
  key: keyof CapexFactors | "equipment" | "direct" | "indirect" | "total";
  label: string;
  /** The factor applied, as a fraction; absent on the equipment and subtotals. */
  factor?: number;
  /** What the factor multiplies. */
  basis: string;
  /** Typical range of the factor, for the reader to judge it against. */
  range?: string;
  usd: number;
  kind: "equipment" | "direct" | "indirect" | "subtotal" | "contingency" | "total";
}

export interface CapexEstimate {
  equipment: { label: string; type: string; usd: number }[];
  lines: CapexLine[];
  equipmentUSD: number;
  totalUSD: number;
  lowUSD: number;
  highUSD: number;
  /** Total over equipment: the overall factor actually applied. */
  overallFactor: number;
  /** Per m3/d of product capacity. */
  usdPerM3d: number;
  seawater: boolean;
  exclusions: string[];
}

export const CAPEX_EXCLUSIONS = [
  "Land, site acquisition and site preparation beyond the plant footprint",
  "Owner's costs, permits and the environmental approval (AMDAL)",
  "High-voltage power connection to the site",
  "Product pipeline and storage beyond the plant boundary",
  "Import duties and VAT (PPN 11 %)",
  "Financing and interest during construction",
  "Escalation beyond present-day prices",
];

export function indicativeCapex(
  fs: Flowsheet, result: SimulationResult, factors: CapexFactors = DEFAULT_CAPEX_FACTORS,
): CapexEstimate {
  const equipment = result.nodes
    .filter((nd) => nd.aux.capexUSD > 0)
    .map((nd) => ({ label: nd.label, type: nd.type, usd: nd.aux.capexUSD }))
    .sort((a, b) => b.usd - a.usd);
  const E = equipment.reduce((a, x) => a + x.usd, 0);
  const seawater = fs.feed.sourceType === "seawater";
  const f = { ...factors, marine: seawater ? factors.marine : 0 };

  const direct: CapexLine[] = [
    { key: "installation", label: "Installation, piping and valves", factor: f.installation, basis: "equipment", range: "30-50 %", usd: E * f.installation, kind: "direct" },
    { key: "electrical", label: "Electrical, instrumentation and control", factor: f.electrical, basis: "equipment", range: "15-25 %", usd: E * f.electrical, kind: "direct" },
    { key: "civil", label: "Civil works, structures and buildings", factor: f.civil, basis: "equipment", range: "25-45 %", usd: E * f.civil, kind: "direct" },
  ];
  if (seawater) {
    direct.push({
      key: "marine", label: "Seawater intake and outfall (marine works)", factor: f.marine, basis: "equipment",
      range: "10-40 %, set by distance offshore and depth", usd: E * f.marine, kind: "direct",
    });
  }
  const D = E + direct.reduce((a, x) => a + x.usd, 0);
  const indirect: CapexLine[] = [
    { key: "engineering", label: "Engineering, procurement and construction management", factor: f.engineering, basis: "direct cost", range: "8-15 %", usd: D * f.engineering, kind: "indirect" },
    { key: "contractor", label: "Contractor overheads and profit", factor: f.contractor, basis: "direct cost", range: "8-15 %", usd: D * f.contractor, kind: "indirect" },
    { key: "commissioning", label: "Commissioning, start-up and first spares", factor: f.commissioning, basis: "direct cost", range: "2-5 %", usd: D * f.commissioning, kind: "indirect" },
  ];
  const I = indirect.reduce((a, x) => a + x.usd, 0);
  const C = (D + I) * f.contingency;
  const total = D + I + C;
  const productM3d = result.summary.productFlow * 24;

  const lines: CapexLine[] = [
    { key: "equipment", label: "Process equipment (unit cost curves)", basis: "sum of the units", usd: E, kind: "equipment" },
    ...direct,
    { key: "direct", label: "Direct cost", basis: "", usd: D, kind: "subtotal" },
    ...indirect,
    { key: "indirect", label: "Direct plus indirect cost", basis: "", usd: D + I, kind: "subtotal" },
    { key: "contingency", label: "Contingency", factor: f.contingency, basis: "direct + indirect", range: "15-30 % at concept stage", usd: C, kind: "contingency" },
    { key: "total", label: "Indicative CAPEX", basis: "", usd: total, kind: "total" },
  ];

  return {
    equipment, lines, equipmentUSD: E, totalUSD: total,
    lowUSD: total * (1 + CAPEX_ACCURACY.low), highUSD: total * (1 + CAPEX_ACCURACY.high),
    overallFactor: E > 0 ? total / E : 0,
    usdPerM3d: productM3d > 0 ? total / productM3d : 0,
    seawater,
    exclusions: CAPEX_EXCLUSIONS,
  };
}
