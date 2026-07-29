import { Flowsheet, Params } from "./types";
import { simulate } from "./solver";
import { UNIT_BY_TYPE } from "./units";
import { reliabilityScore } from "./optimizer";

export interface SweepPoint {
  value: number;
  recoveryPct: number;
  productFlow: number;
  feedFlow: number;
  secKWhPerM3: number;
  opexUSDPerM3: number;
  capexUSD: number;
  warnings: number;
  reliability: number;
  converged: boolean;
}

export interface SweepResult {
  nodeId: string;
  nodeLabel: string;
  paramKey: string;
  paramLabel: string;
  unit: string;
  baseValue: number;
  points: SweepPoint[];
  /** Sensitivity of recovery to the parameter, % recovery per unit of parameter. */
  dRecovery: number;
  dSec: number;
  notes: string[];
}

/**
 * Sweeps one parameter across a range and re-solves the whole flowsheet at each
 * step. This is the calculation an engineer would otherwise do by hand, one
 * value at a time, and it is what turns "the design works" into "the design
 * works across the range of things I am not sure about".
 */
export function sweep(
  fs: Flowsheet,
  nodeId: string,
  paramKey: string,
  from: number,
  to: number,
  steps = 9,
): SweepResult | null {
  const node = fs.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const model = UNIT_BY_TYPE[node.type];
  if (!model) return null;
  const def = model.params.find((p) => p.key === paramKey);
  if (!def || def.type !== "number") return null;

  const baseValue = typeof node.params[paramKey] === "number" ? (node.params[paramKey] as number) : 0;
  const n = Math.max(2, Math.min(steps, 25));
  const points: SweepPoint[] = [];

  for (let i = 0; i < n; i++) {
    const value = from + ((to - from) * i) / (n - 1);
    const trial: Flowsheet = {
      ...fs,
      nodes: fs.nodes.map((nd) =>
        nd.id === nodeId ? { ...nd, params: { ...nd.params, [paramKey]: value } as Params } : { ...nd, params: { ...nd.params } },
      ),
    };
    const r = simulate(trial);
    points.push({
      value,
      recoveryPct: r.summary.recoveryPct,
      productFlow: r.summary.productFlow,
      feedFlow: r.summary.feedFlow,
      secKWhPerM3: r.summary.secKWhPerM3,
      opexUSDPerM3: r.summary.opexUSDPerM3,
      capexUSD: r.summary.capexUSD,
      warnings: r.summary.warnings.length,
      reliability: reliabilityScore(trial, r),
      converged: r.converged,
    });
  }

  const first = points[0];
  const last = points[points.length - 1];
  const span = last.value - first.value || 1;
  const dRecovery = (last.recoveryPct - first.recoveryPct) / span;
  const dSec = (last.secKWhPerM3 - first.secKWhPerM3) / span;

  const notes: string[] = [];
  const nonConv = points.filter((p) => !p.converged).length;
  if (nonConv > 0) notes.push(`${nonConv} of ${n} points did not converge; treat those as indicative only.`);
  if (Math.abs(dRecovery) < 1e-6) {
    notes.push("Overall recovery is insensitive to this parameter — it does not sit on the water balance path.");
  }
  const worst = points.reduce((a, p) => (p.warnings > a.warnings ? p : a), points[0]);
  if (worst.warnings > first.warnings) {
    notes.push(
      `Engineering warnings rise from ${first.warnings} to ${worst.warnings} at ${def.label.toLowerCase()} = ${worst.value.toFixed(2)} ${def.unit ?? ""}. Read them before treating that end of the range as available.`,
    );
  }

  return {
    nodeId,
    nodeLabel: node.label,
    paramKey,
    paramLabel: def.label,
    unit: def.unit ?? "",
    baseValue,
    points,
    dRecovery,
    dSec,
    notes,
  };
}

/** Parameters worth sweeping, ordered by how often they decide a design. */
export function sweepCandidates(fs: Flowsheet): {
  nodeId: string; nodeLabel: string; paramKey: string; paramLabel: string;
  unit: string; min: number; max: number; current: number;
}[] {
  const out: ReturnType<typeof sweepCandidates> = [];
  const INTERESTING = new Set([
    "recovery", "flux", "filtrationRate", "riseRate", "hrtH", "backwashPct",
    "supernatantPct", "tssRemoval", "coagDose", "waterEvapPct", "bodRemoval",
    "tnRemoval", "sludgeFlowPct", "lossPct",
  ]);
  for (const nd of fs.nodes) {
    const model = UNIT_BY_TYPE[nd.type];
    if (!model) continue;
    for (const p of model.params) {
      if (p.type !== "number" || !INTERESTING.has(p.key)) continue;
      const cur = typeof nd.params[p.key] === "number" ? (nd.params[p.key] as number) : 0;
      out.push({
        nodeId: nd.id,
        nodeLabel: nd.label,
        paramKey: p.key,
        paramLabel: p.label,
        unit: p.unit ?? "",
        min: p.min ?? cur * 0.5,
        max: p.max ?? cur * 1.5,
        current: cur,
      });
    }
  }
  return out;
}
