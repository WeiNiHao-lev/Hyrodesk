import { Params, UnitAux } from "./types";

/**
 * Helpers shared by every unit model.
 *
 * These live apart from units.ts so that additional model files can use them
 * without importing the registry that will in turn import those models.
 */

/** Read a numeric parameter, falling back when it is absent or not finite. */
export const n = (v: Params, k: string, d = 0): number => {
  const x = v[k];
  return typeof x === "number" && Number.isFinite(x) ? x : d;
};

export const s = (v: Params, k: string, d = ""): string =>
  typeof v[k] === "string" ? (v[k] as string) : d;

export const b = (v: Params, k: string, d = false): boolean =>
  typeof v[k] === "boolean" ? (v[k] as boolean) : d;

export function aux(partial: Partial<UnitAux> = {}): UnitAux {
  return {
    powerKW: 0, chemicals: {}, drySolidsKgH: 0, sizing: [], capexUSD: 0,
    notes: [], ...partial,
  };
}

/** Pump shaft power, kW. */
export function pumpKW(flow: number, headM: number, eff = 0.72): number {
  if (flow <= 0) return 0;
  return (1000 * 9.81 * (flow / 3600) * headM) / eff / 1000;
}

/** Indicative installed cost from a capacity power-law. */
export function costCurve(capacity: number, a: number, exp = 0.7): number {
  if (capacity <= 0) return 0;
  return a * Math.pow(capacity, exp);
}

/**
 * Fraction of total ammoniacal nitrogen present as free NH3 rather than as the
 * ammonium ion, from the temperature-dependent dissociation constant
 * (Emerson et al., 1975). This single number governs ammonia stripping: only
 * the free fraction can leave the water, which is why the pH is raised to 11
 * before a stripping tower and dropped again before a membrane.
 */
export function freeAmmoniaFraction(pH: number, tempC: number): number {
  const pKa = 0.09018 + 2729.92 / (tempC + 273.15);
  return 1 / (1 + Math.pow(10, pKa - pH));
}
