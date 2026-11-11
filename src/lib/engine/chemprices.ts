/**
 * Chemical prices from the CCEPC water treatment chemical price list
 * (药剂价格-水处理药剂费用明细), as delivered, in CNY per tonne, at the list's own
 * 6.8 CNY/USD.
 *
 * The model books every chemical in kg/h of the ACTIVE substance it doses, so a
 * price per tonne of delivered product has to be divided by how much active
 * substance a tonne of that product carries. A 10 % hypochlorite at CNY 2,556/t
 * is USD 376 per tonne of solution but USD 3,759 per tonne of chlorine, and it
 * is the second figure the dose is multiplied by. Pricing the active substance
 * at the solution's price understates the chemical bill tenfold.
 */

export const CNY_PER_USD = 6.8;
export const PRICE_LIST_SOURCE =
  "CCEPC water treatment chemical price list (药剂价格-水处理药剂费用明细), CNY/t delivered, 6.8 CNY/USD";

export interface PriceBasis {
  /** The chemical names, as the unit models book them, that this entry prices. */
  names: string[];
  /** What is delivered, as the price list describes it. */
  product: string;
  form: string;
  /** Price per tonne as delivered. */
  cnyPerT: number;
  /** Tonnes of the model's active basis in one tonne delivered. */
  activeFraction: number;
  /** What the model's dose is expressed as, and so what "active" means here. */
  activeBasis: string;
  standard?: string;
}

/** SMBS, as the RO block doses it, delivered as sodium bisulphite: Na2S2O5 + H2O -> 2 NaHSO3. */
const NAHSO3_PER_SMBS = (2 * 104.06) / 190.1;

export const CCEPC_PRICE_LIST: PriceBasis[] = [
  { names: ["Poly-aluminium chloride"], product: "Poly aluminium chloride (PAC)", form: "bagged solid",
    cnyPerT: 1376, activeFraction: 1, activeBasis: "PAC as supplied", standard: "GB/T 22627-2022" },
  { names: ["Polymer flocculant"], product: "Anionic polyacrylamide (PAM)", form: "bagged solid",
    cnyPerT: 13763, activeFraction: 1, activeBasis: "PAM as supplied", standard: "GB/T 17514-2016, MW ≥ 15 million" },
  { names: ["Polymer (dewatering)"], product: "Cationic polyacrylamide (PAM)", form: "bagged solid",
    cnyPerT: 17695, activeFraction: 1, activeBasis: "PAM as supplied", standard: "GB/T 31246-2014, MW ≥ 15 million" },
  { names: ["Sodium hypochlorite (as Cl2)", "Sodium hypochlorite (UF CEB)", "Sodium hypochlorite (CIP)"],
    product: "Sodium hypochlorite (NaClO)", form: "10 % solution",
    cnyPerT: 2556, activeFraction: 0.10, activeBasis: "available chlorine", standard: "GB/T 19106-2013, type A II" },
  { names: ["Caustic soda NaOH", "Caustic soda (pH correction)", "Caustic soda (softening)", "Caustic soda (regeneration)", "Caustic soda (CIP)"],
    product: "Sodium hydroxide (NaOH)", form: "32 % solution",
    cnyPerT: 3342, activeFraction: 0.32, activeBasis: "100 % NaOH", standard: "GB/T 11199-2006, HL-II" },
  { names: ["Hydrochloric acid HCl", "Hydrochloric acid (UF CEB)", "Hydrochloric acid (regeneration)"],
    product: "Hydrochloric acid (HCl)", form: "31 % solution",
    cnyPerT: 2320, activeFraction: 0.31, activeBasis: "100 % HCl", standard: "GB 320-2006" },
  { names: ["Sodium metabisulphite"], product: "Sodium hydrogen sulphite (NaHSO3)", form: "99.5 % bagged solid",
    cnyPerT: 6291, activeFraction: 0.995 / NAHSO3_PER_SMBS,
    activeBasis: "SMBS equivalent (1 mg SMBS = 1.095 mg NaHSO3)", standard: "HG/T 3814-2006" },
  { names: ["Antiscalant"], product: "Antiscalant (PWT SpectraGuard 205 SC)", form: "11x concentrate",
    cnyPerT: 250000, activeFraction: 11, activeBasis: "standard-strength antiscalant (the concentrate makes 11 t)" },
  { names: ["Non-oxidising biocide (isothiazolinone)"], product: "Non-oxidising biocide (PWT BioGuard SHOCK)", form: "standard solution",
    cnyPerT: 6000, activeFraction: 1, activeBasis: "as supplied" },
  { names: ["Sodium carbonate"], product: "Sodium carbonate (soda ash)", form: "bagged solid",
    cnyPerT: 4500, activeFraction: 1, activeBasis: "100 % Na2CO3", standard: "GB/T 210-2022" },
  { names: ["Magnesium oxide"], product: "Magnesium oxide (light)", form: "bagged solid",
    cnyPerT: 2800, activeFraction: 1, activeBasis: "as supplied", standard: "HG/T 2573-2012" },
  { names: ["EDTA-4Na (CIP)"], product: "EDTA tetrasodium", form: "bagged solid",
    cnyPerT: 32000, activeFraction: 1, activeBasis: "as supplied", standard: "GB/T 35622-2017" },
  { names: ["Citric acid (CIP)"], product: "Citric acid", form: "bagged solid",
    cnyPerT: 7000, activeFraction: 1, activeBasis: "as supplied", standard: "GB/T 8269.1-2025" },
  { names: ["Sodium hexametaphosphate (dispersant)"], product: "Sodium hexametaphosphate", form: "bagged solid",
    cnyPerT: 4500, activeFraction: 1, activeBasis: "as supplied" },
  { names: ["Carbohydrazide (oxygen scavenger)"], product: "Carbohydrazide", form: "bagged solid",
    cnyPerT: 7800, activeFraction: 1, activeBasis: "as supplied" },
];

/** USD per tonne of the active basis the model doses. */
export function usdPerTActive(p: PriceBasis): number {
  return p.cnyPerT / CNY_PER_USD / p.activeFraction;
}

/** The price-list entry behind a chemical name, if the name is on the list. */
export const PRICE_BASIS_BY_NAME: Record<string, PriceBasis> = Object.fromEntries(
  CCEPC_PRICE_LIST.flatMap((p) => p.names.map((nm) => [nm, p])),
);
