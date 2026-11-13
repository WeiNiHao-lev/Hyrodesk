import { Flowsheet, SimulationResult } from "./types";

/**
 * CCEPC's own reference figures for a seawater RO plant, applied to any
 * flowsheet that contains an SWRO block.
 *
 * Source: CCEPC SWRO key-question sheet (standard 10,000 m3/d seawater
 * desalination plant). These are what CCEPC quotes from its projects, so for an
 * SWRO plant they are the first CAPEX and OPEX to show a client; the factored
 * estimate from the unit cost curves stays beside them as a cross-check.
 *
 * Break-even and payback are worked from the benchmark ranges themselves:
 * break-even = OPEX + CAPEX x CRF(8 %, 20 y) / annual volume, and simple
 * payback = CAPEX / ((tariff - OPEX) x annual volume). Taking the low and the
 * high ends of CAPEX and OPEX together, that brackets CCEPC's own reference
 * results (break-even 0.85-0.99 against its 0.95; payback 4.1-5.7 years
 * against 5.4 at USD 1.20, 6.1-9.5 against 8.4 at USD 1.00). CCEPC's IRR also
 * carries tax and financing the model does not, so it is quoted, not computed.
 */
export const CCEPC_SWRO = {
  source: "CCEPC SWRO reference, standard 10,000 m³/d seawater desalination plant",
  referenceCapacityM3d: 10000,
  capexRmbPerM3d: [6000, 7000] as const,
  rmbPerUsd: 6.7,
  capexExcludes: "seawater intake and discharge works, piling foundations",
  landM2PerM3d: 0.7,
  landExcludes: "land for the intake and discharge works",
  opexUsdPerM3: [0.6, 0.7] as const,
  opexCovers: "power, membrane replacement, chemicals and O&M labour; excludes depreciation and financing",
  discountRate: 0.08,
  horizonYears: 20,
  reference: {
    breakEvenUsdPerM3: 0.95,
    cases: [
      { tariff: 1.2, paybackYears: 5.4, irr: "12–14 %" },
      { tariff: 1.0, paybackYears: 8.4, irr: "7–8 %" },
    ],
  },
  epcMonths: [12, 15] as const,
  epcExcludes: "piling and permitting",
  /** Open cooling towers at 5 cycles of concentration: WUE 1.8-2.2 L/kWh. */
  coolingM3hPerMwIt: [1.8, 2.2] as const,
};

export interface Range { low: number; high: number }

export interface SwroBenchmark {
  capacityM3d: number;
  annualM3: number;
  capexUSD: Range;
  opexUSDPerM3: Range;
  opexUSDPerYear: Range;
  /** The model's own itemised OPEX, to set against the benchmark. */
  modelOpexUSDPerM3: number;
  landM2: Range;
  breakEvenUSDPerM3: Range;
  payback: { tariff: number; years: Range | null }[];
  /** IT load this product could keep cooled in open towers. */
  supportsMwIt: Range;
  epcMonths: readonly [number, number];
}

const crf = (r: number, n: number) => (r * (1 + r) ** n) / ((1 + r) ** n - 1);

export function swroBenchmark(
  fs: Flowsheet, result: SimulationResult, tariffs: number[] = [1.0, 1.2],
): SwroBenchmark | null {
  if (!fs.nodes.some((n) => n.type === "swro")) return null;
  const B = CCEPC_SWRO;
  const flow = result.summary.productFlow;
  const capacityM3d = flow * 24;
  const annualM3 = flow * (fs.basis.operatingHoursPerYear || 8760);
  const capex = { low: (capacityM3d * B.capexRmbPerM3d[0]) / B.rmbPerUsd, high: (capacityM3d * B.capexRmbPerM3d[1]) / B.rmbPerUsd };
  const opex = { low: B.opexUsdPerM3[0], high: B.opexUsdPerM3[1] };
  const k = crf(B.discountRate, B.horizonYears);
  const be = annualM3 > 0
    ? { low: opex.low + (capex.low * k) / annualM3, high: opex.high + (capex.high * k) / annualM3 }
    : { low: NaN, high: NaN };
  const payback = tariffs.map((t) => {
    const optimistic = t > opex.low ? capex.low / ((t - opex.low) * annualM3) : NaN;
    const conservative = t > opex.high ? capex.high / ((t - opex.high) * annualM3) : NaN;
    return { tariff: t, years: Number.isFinite(optimistic) ? { low: optimistic, high: Number.isFinite(conservative) ? conservative : Infinity } : null };
  });
  return {
    capacityM3d,
    annualM3,
    capexUSD: capex,
    opexUSDPerM3: opex,
    opexUSDPerYear: { low: opex.low * annualM3, high: opex.high * annualM3 },
    modelOpexUSDPerM3: result.summary.opexUSDPerM3,
    landM2: { low: capacityM3d * B.landM2PerM3d, high: capacityM3d * B.landM2PerM3d },
    breakEvenUSDPerM3: be,
    payback,
    supportsMwIt: { low: flow / B.coolingM3hPerMwIt[1], high: flow / B.coolingM3hPerMwIt[0] },
    epcMonths: B.epcMonths,
  };
}
