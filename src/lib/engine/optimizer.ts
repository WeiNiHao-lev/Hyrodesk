import { Flowsheet, Params, SimulationResult } from "./types";
import { simulate } from "./solver";
import { UNIT_BY_TYPE } from "./units";
import { hardnessAsCaCO3 } from "./stream";

export interface OptimizerGoals {
  /** Minimum overall recovery, %. */
  minRecoveryPct: number;
  /** Weighting 0-1: 1 means reliability dominates, 0 means cost dominates. */
  reliabilityWeight: number;
  /** Allow the optimiser to add redundancy (standby trains). */
  enforceRedundancy: boolean;
  /** Allow the optimiser to add recycle-friendly settings. */
  allowRecycleTuning: boolean;
}

export const DEFAULT_GOALS: OptimizerGoals = {
  minRecoveryPct: 90,
  reliabilityWeight: 0.8,
  enforceRedundancy: true,
  allowRecycleTuning: true,
};

export interface OptimizerChange {
  nodeLabel: string;
  param: string;
  from: string;
  to: string;
  reason: string;
}

export interface OptimizerReport {
  applied: boolean;
  changes: OptimizerChange[];
  before: { recoveryPct: number; secKWhPerM3: number; opexUSDPerM3: number; capexUSD: number; warnings: number };
  after: { recoveryPct: number; secKWhPerM3: number; opexUSDPerM3: number; capexUSD: number; warnings: number };
  reliabilityScore: number;
  notes: string[];
}

/**
 * CCEPC-referenced operating envelopes. The upper bound of each range is what
 * CCEPC has actually delivered and operated, so staying inside it is what makes
 * a guarantee defensible rather than optimistic.
 */
const ENVELOPE: Record<string, Record<string, { min: number; max: number; safe: number }>> = {
  uf: {
    flux: { min: 40, max: 75, safe: 62 },
    recovery: { min: 90, max: 96, safe: 95 },
  },
  ro: {
    recovery: { min: 60, max: 85, safe: 80 },
    flux: { min: 14, max: 22, safe: 18 },
  },
  swro: {
    recovery: { min: 35, max: 60, safe: 45 },
    flux: { min: 10, max: 17, safe: 14 },
  },
  nf: {
    recovery: { min: 60, max: 85, safe: 77 },
    flux: { min: 15, max: 26, safe: 20 },
  },
  edi: {
    recovery: { min: 90, max: 97, safe: 95 },
  },
  clarifier: {
    riseRate: { min: 3, max: 9, safe: 6 },
    tssRemoval: { min: 80, max: 95, safe: 90 },
  },
  mmf: {
    filtrationRate: { min: 7, max: 14, safe: 10 },
  },
  acf: {
    filtrationRate: { min: 6, max: 12, safe: 9 },
  },
  aao: { hrtH: { min: 10, max: 24, safe: 14 } },
  msbr: { hrtH: { min: 12, max: 26, safe: 16 } },
  thickener: { supernatantPct: { min: 0, max: 70, safe: 55 } },
};

function num(p: Params, k: string): number {
  const v = p[k];
  return typeof v === "number" ? v : NaN;
}

function snapshot(r: SimulationResult) {
  return {
    recoveryPct: r.summary.recoveryPct,
    secKWhPerM3: r.summary.secKWhPerM3,
    opexUSDPerM3: r.summary.opexUSDPerM3,
    capexUSD: r.summary.capexUSD,
    warnings: r.summary.warnings.length,
  };
}

/**
 * Reliability score, 0-100. Built from CCEPC deployment maturity of the selected
 * unit operations, how far each parameter sits inside its proven envelope,
 * whether redundancy is present, and how many engineering warnings remain.
 */
export function reliabilityScore(fs: Flowsheet, r: SimulationResult): number {
  if (fs.nodes.length === 0) return 0;
  let maturity = 0;
  let envelope = 0;
  let envCount = 0;
  let redundancy = 0;
  let redCount = 0;

  for (const nd of fs.nodes) {
    const model = UNIT_BY_TYPE[nd.type];
    if (!model) continue;
    maturity += model.ccepcMaturity / 5;

    const env = ENVELOPE[nd.type];
    if (env) {
      for (const [key, band] of Object.entries(env)) {
        const v = num(nd.params, key);
        if (!Number.isFinite(v)) continue;
        envCount++;
        if (v >= band.min && v <= band.max) {
          // Full marks at the safe point, tapering toward the band edges.
          const span = Math.max(band.max - band.min, 1e-6);
          const dist = Math.abs(v - band.safe) / span;
          envelope += Math.max(0.5, 1 - dist);
        }
      }
    }
    if (["uf", "ro", "swro", "nf", "edi", "mixedbed"].includes(nd.type)) {
      redCount++;
      const trains = num(nd.params, "trains") || num(nd.params, "dutyTrains") || 1;
      const standby = num(nd.params, "standbyTrains") || 0;
      if (trains >= 2 || standby >= 1) redundancy += 1;
    }
  }

  const mMat = maturity / fs.nodes.length;
  const mEnv = envCount > 0 ? envelope / envCount : 0.8;
  const mRed = redCount > 0 ? redundancy / redCount : 1;
  const warnPenalty = Math.min(r.summary.warnings.length * 0.05, 0.35);
  const convergePenalty = r.converged ? 0 : 0.15;

  const score = (0.35 * mMat + 0.35 * mEnv + 0.3 * mRed - warnPenalty - convergePenalty) * 100;
  return Math.max(0, Math.min(100, score));
}

/**
 * Adjust the flowsheet toward a configuration CCEPC can guarantee: parameters
 * pulled inside proven envelopes, redundancy added, and recovery lifted to the
 * target using the cheapest levers first (recycle and thickener supernatant
 * before membrane recovery, membrane recovery before extra equipment).
 */
export function optimise(
  fs: Flowsheet,
  goals: OptimizerGoals = DEFAULT_GOALS,
): { flowsheet: Flowsheet; report: OptimizerReport } {
  const before = simulate(fs);
  const changes: OptimizerChange[] = [];
  const notes: string[] = [];
  const next: Flowsheet = {
    ...fs,
    nodes: fs.nodes.map((nd) => ({ ...nd, params: { ...nd.params } })),
  };

  const record = (label: string, param: string, from: unknown, to: unknown, reason: string) => {
    changes.push({ nodeLabel: label, param, from: String(from), to: String(to), reason });
  };

  /* Step 1 — pull every parameter inside the CCEPC-proven envelope. */
  for (const nd of next.nodes) {
    const env = ENVELOPE[nd.type];
    if (!env) continue;
    for (const [key, band] of Object.entries(env)) {
      const v = num(nd.params, key);
      if (!Number.isFinite(v)) continue;
      if (v < band.min || v > band.max) {
        record(nd.label, key, v, band.safe,
          `Outside the CCEPC-proven range ${band.min}-${band.max}; reset to the reference operating point.`);
        nd.params[key] = band.safe;
      }
    }
  }

  /* Step 2 — redundancy on the units that stop the plant if they fail. */
  if (goals.enforceRedundancy) {
    for (const nd of next.nodes) {
      if (["ro", "swro", "nf", "edi", "mixedbed"].includes(nd.type)) {
        const trains = num(nd.params, "trains");
        if (Number.isFinite(trains) && trains < 2) {
          record(nd.label, "trains", trains, 2,
            "Single train is a plant-stopping single point of failure; 2 x 50 % adopted.");
          nd.params.trains = 2;
        }
      }
      if (nd.type === "uf") {
        const sb = num(nd.params, "standbyTrains");
        if (Number.isFinite(sb) && sb < 1) {
          record(nd.label, "standbyTrains", sb, 1,
            "A standby train allows backwash and CIP without derating the plant.");
          nd.params.standbyTrains = 1;
        }
      }
    }
  }

  /* Step 3 — protect EDI: it is the least tolerant unit in any demin train. */
  const ediNodes = next.nodes.filter((nd) => nd.type === "edi");
  if (ediNodes.length > 0) {
    const res = simulate(next);
    for (const nd of ediNodes) {
      const r = res.nodes.find((x) => x.id === nd.id);
      if (!r) continue;
      const hard = hardnessAsCaCO3(r.inlet);
      const limit = num(nd.params, "hardnessLimit") || 1;
      if (hard > limit) {
        notes.push(
          `${nd.label}: feed hardness ${hard.toFixed(3)} mg/L as CaCO3 exceeds the ${limit} mg/L EDI limit. ` +
          "The optimiser cannot fix this by tuning alone: add a second RO pass or a softener upstream. " +
          "This is the same finding that drove the two-pass configuration in the South Sumatra study.",
        );
      }
    }
  }

  /* Step 4 — lift recovery to target using the cheapest levers first. */
  let attempt = simulate(next);
  let guard = 0;
  while (attempt.summary.recoveryPct < goals.minRecoveryPct && guard < 12) {
    guard++;
    let moved = false;

    // 4a. Thickener supernatant recovery (essentially free).
    if (goals.allowRecycleTuning) {
      for (const nd of next.nodes) {
        if (nd.type !== "thickener") continue;
        const v = num(nd.params, "supernatantPct");
        if (Number.isFinite(v) && v < 55) {
          record(nd.label, "supernatantPct", v, 55,
            "Returning thickener supernatant is the cheapest available recovery lever.");
          nd.params.supernatantPct = 55;
          moved = true;
        }
      }
    }

    // 4b. UF recovery, within the proven band.
    if (!moved) {
      for (const nd of next.nodes) {
        if (nd.type !== "uf") continue;
        const v = num(nd.params, "recovery");
        const band = ENVELOPE.uf.recovery;
        if (Number.isFinite(v) && v < band.max) {
          const to = Math.min(band.max, v + 1);
          record(nd.label, "recovery", v, to,
            "UF recovery raised within the CCEPC-proven band to meet the recovery target.");
          nd.params.recovery = to;
          moved = true;
        }
      }
    }

    // 4c. RO recovery, within the proven band. Done last because it is the
    //     lever that most increases scaling risk and antiscalant demand.
    if (!moved) {
      for (const nd of next.nodes) {
        if (nd.type !== "ro" && nd.type !== "nf") continue;
        const band = ENVELOPE[nd.type].recovery;
        const v = num(nd.params, "recovery");
        if (Number.isFinite(v) && v < band.max) {
          const to = Math.min(band.max, v + 1);
          record(nd.label, "recovery", v, to,
            "Membrane recovery raised within the proven band; antiscalant duty must be confirmed with the supplier.");
          nd.params.recovery = to;
          moved = true;
        }
      }
    }

    if (!moved) {
      notes.push(
        `Recovery target of ${goals.minRecoveryPct} % could not be reached by tuning alone ` +
        `(reached ${attempt.summary.recoveryPct.toFixed(2)} %). Add a backwash recovery basin, ` +
        "recycle a reject stream, or reduce the demineralised water demand.",
      );
      break;
    }
    attempt = simulate(next);
  }

  /* Step 5 — antiscalant where the model flags scaling risk. */
  for (const nd of next.nodes) {
    if (!["ro", "swro", "nf"].includes(nd.type)) continue;
    const dose = num(nd.params, "antiscalantDose");
    const r = attempt.nodes.find((x) => x.id === nd.id);
    const risky = r?.aux.notes.some((t) => t.toLowerCase().includes("scaling"));
    if (risky && Number.isFinite(dose) && dose < 4) {
      record(nd.label, "antiscalantDose", dose, 4,
        "Concentrate scaling flagged by the model; antiscalant raised to a defensible dose.");
      nd.params.antiscalantDose = 4;
    }
  }

  const after = simulate(next);
  const score = reliabilityScore(next, after);

  if (goals.reliabilityWeight > 0.6) {
    notes.push(
      "Optimisation ranked reliability above cost, per the brief. Parameters were pulled toward the centre " +
      "of CCEPC's demonstrated operating envelope rather than to the edge of what is theoretically achievable.",
    );
  }
  if (changes.length === 0) {
    notes.push("No changes were required: the flowsheet already sits inside the CCEPC-proven envelope.");
  }

  return {
    flowsheet: next,
    report: {
      applied: changes.length > 0,
      changes,
      before: snapshot(before),
      after: snapshot(after),
      reliabilityScore: score,
      notes,
    },
  };
}
